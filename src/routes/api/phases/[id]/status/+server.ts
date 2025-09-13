import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// PUT /api/phases/[id]/status - Update phase status (internal web app endpoint)
export async function PUT({ params, request }) {
	try {
		const phaseId = parseInt(params.id);
		const {
			phaseStatus,
			projectId
		} = await request.json();

		// Validate phase ID
		if (isNaN(phaseId) || phaseId <= 0) {
			return json({ 
				error: 'Invalid phase ID: must be a positive integer'
			}, { status: 400 });
		}

		// Validate required fields
		if (!phaseStatus) {
			return json({ 
				error: 'Missing required field: phaseStatus must be provided'
			}, { status: 400 });
		}

		if (!projectId) {
			return json({ 
				error: 'Missing required field: projectId must be provided'
			}, { status: 400 });
		}

		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Validate phaseStatus
		const validStatuses = ['draft', 'approved', 'active', 'completed', 'blocked'];
		if (!validStatuses.includes(phaseStatus)) {
			return json({ 
				error: `Invalid phaseStatus: must be one of ${validStatuses.join(', ')}`
			}, { status: 400 });
		}

		// Get the current phase to verify it exists and belongs to the project
		const [currentPhase] = await db
			.select({
				id: content.id,
				projectId: content.projectId,
				assignedToRoleType: content.assignedToRoleType,
				phaseStatus: content.phaseStatus,
				title: content.title,
				requiredInputs: content.requiredInputs,
				expectedOutputs: content.expectedOutputs
			})
			.from(content)
			.where(and(
				eq(content.id, phaseId),
				eq(content.type, 'phase')
			))
			.limit(1);

		if (!currentPhase) {
			return json({ 
				error: `Phase with ID ${phaseId} not found`
			}, { status: 404 });
		}

		if (currentPhase.projectId !== parsedProjectId) {
			return json({ 
				error: `Phase ${phaseId} does not belong to project ${parsedProjectId}`
			}, { status: 403 });
		}

		// Store old status for notifications/logging
		const oldStatus = currentPhase.phaseStatus;

		// Validate document dependencies before allowing status changes
		if (phaseStatus === 'active') {
			// Check that all required input documents exist
			const missingInputs = await validateRequiredInputs(currentPhase, parsedProjectId);
			if (missingInputs.length > 0) {
				return json({
					error: `Cannot set phase to 'active': Required input documents are missing`,
					missingDocuments: missingInputs,
					details: `The following document slugs must exist before this phase can be activated: ${missingInputs.join(', ')}`
				}, { status: 400 });
			}
		}

		if (phaseStatus === 'completed') {
			// Check that all expected output documents exist
			const missingOutputs = await validateExpectedOutputs(currentPhase, parsedProjectId);
			if (missingOutputs.length > 0) {
				return json({
					error: `Cannot set phase to 'completed': Expected output documents are missing`,
					missingDocuments: missingOutputs,
					details: `The following document slugs must exist before this phase can be marked as completed: ${missingOutputs.join(', ')}`
				}, { status: 400 });
			}
		}

		// Update the phase status
		const [updatedPhase] = await db
			.update(content)
			.set({
				phaseStatus,
				updatedAt: new Date()
			})
			.where(eq(content.id, phaseId))
			.returning();

		// Create reading assignments for all agents with the phase's assigned role
		// Only create assignments if status is changing to something that requires notification
		const notificationStatuses = ['approved', 'active', 'completed', 'blocked'];
		if (notificationStatuses.includes(phaseStatus) && oldStatus !== phaseStatus) {
			
			// Get all agents with the phase's assigned role type
			const roleAgents = await db
				.select({ 
					id: agents.id,
					roleType: agents.roleType
				})
				.from(agents)
				.where(and(
					eq(agents.projectId, parsedProjectId),
					eq(agents.roleType, currentPhase.assignedToRoleType)
				));

			// Create reading assignments for each agent in the role
			const assignmentPromises = roleAgents.map(async (agent) => {
				return await db
					.insert(readingAssignments)
					.values({
						contentId: phaseId,
						assignedToType: 'agent',
						assignedTo: agent.id,
					})
					.returning();
			});

			const createdAssignments = await Promise.all(assignmentPromises);

			// Also create reading assignment for human director
			const [humanDirector] = await db
				.select({ id: agents.id })
				.from(agents)
				.where(and(
					eq(agents.projectId, parsedProjectId),
					eq(agents.isHumanDirector, true)
				))
				.limit(1);

			let humanDirectorAssignment = null;
			if (humanDirector) {
				const [hdAssignment] = await db
					.insert(readingAssignments)
					.values({
						contentId: phaseId,
						assignedToType: 'agent',
						assignedTo: humanDirector.id,
					})
					.returning();
				humanDirectorAssignment = hdAssignment;
			}

			// Send notifications for the status change
			await sendStatusChangeNotifications(updatedPhase, oldStatus, phaseStatus);

			return json({
				id: updatedPhase.id,
				phaseStatus: updatedPhase.phaseStatus,
				updatedAt: updatedPhase.updatedAt,
				oldStatus,
				assignmentsCreated: {
					roleAgents: roleAgents.length,
					humanDirector: humanDirectorAssignment ? 1 : 0,
					total: roleAgents.length + (humanDirectorAssignment ? 1 : 0)
				}
			});
		}

		return json({
			id: updatedPhase.id,
			phaseStatus: updatedPhase.phaseStatus,
			updatedAt: updatedPhase.updatedAt,
			oldStatus,
			assignmentsCreated: {
				roleAgents: 0,
				humanDirector: 0,
				total: 0
			}
		});

	} catch (error) {
		console.error('Failed to update phase status:', error);
		
		// Provide more specific error messages based on the error type
		if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === '23503') {
			return json({ 
				error: 'Database constraint violation: Referenced entities may not exist'
			}, { status: 400 });
		}
		
		return json({ 
			error: 'Internal server error occurred while updating phase status',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}

// Helper function to send status change notifications
async function sendStatusChangeNotifications(phase: any, oldStatus: string, newStatus: string) {
	try {
		// This is where you could integrate with notification systems
		// For now, just log the status change
		
		const phaseTitle = phase.title;
		const roleType = phase.assignedToRoleType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
		
		console.log(`🔄 Phase Status Change:
			Phase: "${phaseTitle}"
			Role: ${roleType}
			Status: ${oldStatus} → ${newStatus}
			Updated: ${new Date(phase.updatedAt).toLocaleString()}
		`);
		
		// Future: Send notifications via email, Slack, etc.
		// await notificationService.sendPhaseStatusUpdate({
		//   phase,
		//   oldStatus,
		//   newStatus,
		//   recipients: assignedAgents
		// });
		
	} catch (error) {
		console.error('Failed to send status change notifications:', error);
		// Don't fail the main operation if notifications fail
	}
}

// Helper function to validate required input documents exist
async function validateRequiredInputs(phase: any, projectId: number): Promise<string[]> {
	try {
		if (!phase.requiredInputs) {
			return []; // No inputs required
		}

		// Parse the JSON array of required input document slugs
		const requiredInputSlugs: string[] = JSON.parse(phase.requiredInputs);
		if (!Array.isArray(requiredInputSlugs) || requiredInputSlugs.length === 0) {
			return []; // No inputs required
		}

		// Check which document slugs exist in the database
		const existingDocuments = await db
			.select({ 
				documentSlug: content.documentSlug 
			})
			.from(content)
			.where(and(
				eq(content.projectId, projectId),
				eq(content.type, 'document')
			));

		const existingSlugs = existingDocuments
			.map(doc => doc.documentSlug)
			.filter(slug => slug !== null);

		// Find missing input document slugs
		const missingInputs = requiredInputSlugs.filter(slug => 
			!existingSlugs.includes(slug)
		);

		return missingInputs;

	} catch (error) {
		console.error('Error validating required inputs:', error);
		// If we can't parse or validate, assume all are missing for safety
		return JSON.parse(phase.requiredInputs || '[]');
	}
}

// Helper function to validate expected output documents exist
async function validateExpectedOutputs(phase: any, projectId: number): Promise<string[]> {
	try {
		if (!phase.expectedOutputs) {
			return []; // No outputs required
		}

		// Parse the JSON array of expected output document slugs
		const expectedOutputSlugs: string[] = JSON.parse(phase.expectedOutputs);
		if (!Array.isArray(expectedOutputSlugs) || expectedOutputSlugs.length === 0) {
			return []; // No outputs required
		}

		// Check which document slugs exist in the database
		const existingDocuments = await db
			.select({ 
				documentSlug: content.documentSlug 
			})
			.from(content)
			.where(and(
				eq(content.projectId, projectId),
				eq(content.type, 'document')
			));

		const existingSlugs = existingDocuments
			.map(doc => doc.documentSlug)
			.filter(slug => slug !== null);

		// Find missing output document slugs
		const missingOutputs = expectedOutputSlugs.filter(slug => 
			!existingSlugs.includes(slug)
		);

		return missingOutputs;

	} catch (error) {
		console.error('Error validating expected outputs:', error);
		// If we can't parse or validate, assume all are missing for safety
		return JSON.parse(phase.expectedOutputs || '[]');
	}
}