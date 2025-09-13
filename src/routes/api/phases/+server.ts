import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/phases - Get phases for a project
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
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

		// Get phases for the project
		const phases = await db
			.select({
				id: content.id,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				assignedToRoleType: content.assignedToRoleType,
				phaseStatus: content.phaseStatus,
				requiredInputs: content.requiredInputs,
				expectedOutputs: content.expectedOutputs,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
			})
			.from(content)
			.where(and(
				eq(content.projectId, parsedProjectId),
				eq(content.type, 'phase')
			))
			.orderBy(content.createdAt);

		// For each phase, get the reading assignments
		const phasesWithAssignments = await Promise.all(
			phases.map(async (phase) => {
				const assignments = await db
					.select({
						id: readingAssignments.id,
						assignedToType: readingAssignments.assignedToType,
						assignedTo: readingAssignments.assignedTo,
						assignedAt: readingAssignments.assignedAt,
					})
					.from(readingAssignments)
					.where(eq(readingAssignments.contentId, phase.id));

				// Get read status for each assignment
				const assignmentsWithReads = await Promise.all(
					assignments.map(async (assignment) => {
						const reads = await db
							.select({
								agentId: readingAssignmentReads.agentId,
								readAt: readingAssignmentReads.readAt,
								acknowledged: readingAssignmentReads.acknowledged,
							})
							.from(readingAssignmentReads)
							.where(eq(readingAssignmentReads.readingAssignmentId, assignment.id));

						return {
							...assignment,
							reads
						};
					})
				);

				return {
					...phase,
					readingAssignments: assignmentsWithReads
				};
			})
		);

		return json(phasesWithAssignments);
	} catch (error) {
		console.error('Failed to fetch phases:', error);
		return json({ 
			error: 'Internal server error occurred while fetching phases'
		}, { status: 500 });
	}
}

// POST /api/phases - Create a new phase
export async function POST({ request }) {
	try {
		const {
			projectId,
			authorAgentId,
			title,
			body,
			assignedToRoleType,
			phaseStatus = 'draft',
			requiredInputs, // JSON string array
			expectedOutputs, // JSON string array
		} = await request.json();

		// Validate required fields
		if (!projectId) {
			return json({ 
				error: 'Missing required field: projectId must be provided'
			}, { status: 400 });
		}

		if (!title) {
			return json({ 
				error: 'Missing required field: title is required for phases'
			}, { status: 400 });
		}

		if (!body) {
			return json({ 
				error: 'Missing required field: body must be provided and cannot be empty'
			}, { status: 400 });
		}

		if (!assignedToRoleType) {
			return json({ 
				error: 'Missing required field: assignedToRoleType is required for phases'
			}, { status: 400 });
		}

		// Validate projectId is a valid number
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

		// Validate JSON arrays if provided
		if (requiredInputs) {
			try {
				JSON.parse(requiredInputs);
			} catch {
				return json({ 
					error: 'Invalid requiredInputs: must be a valid JSON string array'
				}, { status: 400 });
			}
		}

		if (expectedOutputs) {
			try {
				JSON.parse(expectedOutputs);
			} catch {
				return json({ 
					error: 'Invalid expectedOutputs: must be a valid JSON string array'
				}, { status: 400 });
			}
		}

		// Validate author agent exists (if provided)
		if (authorAgentId) {
			const [author] = await db
				.select({ id: agents.id, projectId: agents.projectId, canCreatePhases: agents.canCreatePhases })
				.from(agents)
				.where(eq(agents.id, authorAgentId))
				.limit(1);
			
			if (!author) {
				return json({ 
					error: `Author agent '${authorAgentId}' not found`
				}, { status: 404 });
			}

			if (author.projectId !== parsedProjectId) {
				return json({ 
					error: `Author agent '${authorAgentId}' does not belong to project ${parsedProjectId}`
				}, { status: 403 });
			}

			if (!author.canCreatePhases) {
				return json({ 
					error: "You don't have the permissions to create phases, please contact IT for help"
				}, { status: 403 });
			}
		}

		// Create the phase
		const [newPhase] = await db
			.insert(content)
			.values({
				projectId: parsedProjectId,
				channelId: null, // Phases don't belong to channels
				parentContentId: null, // Phases are not replies
				type: 'phase',
				title,
				body,
				authorAgentId: authorAgentId || null,
				assignedToRoleType,
				phaseStatus,
				requiredInputs: requiredInputs || null,
				expectedOutputs: expectedOutputs || null,
			})
			.returning();

		// Helper function to resolve human director agent ID
		const resolveHumanDirectorId = async (): Promise<string | null> => {
			const [humanDirector] = await db
				.select({ id: agents.id })
				.from(agents)
				.where(and(
					eq(agents.projectId, parsedProjectId),
					eq(agents.isHumanDirector, true)
				))
				.limit(1);
			
			return humanDirector?.id || null;
		};

		// Create reading assignment for human director
		const humanDirectorId = await resolveHumanDirectorId();
		let assignmentSummary = [];
		
		if (humanDirectorId) {
			const [humanDirectorAssignment] = await db
				.insert(readingAssignments)
				.values({
					contentId: newPhase.id,
					assignedToType: 'agent',
					assignedTo: humanDirectorId,
				})
				.returning();

			assignmentSummary.push({
				type: 'agent',
				target: 'human-director',
				assignmentId: humanDirectorAssignment.id
			});
		} else {
			// Fallback: create assignment to 'human-director' identifier
			const [humanDirectorAssignment] = await db
				.insert(readingAssignments)
				.values({
					contentId: newPhase.id,
					assignedToType: 'agent',
					assignedTo: 'human-director',
				})
				.returning();

			assignmentSummary.push({
				type: 'agent',
				target: 'human-director',
				assignmentId: humanDirectorAssignment.id
			});
		}

		return json({
			id: newPhase.id,
			projectId: newPhase.projectId,
			type: newPhase.type,
			title: newPhase.title,
			body: newPhase.body,
			authorAgentId: newPhase.authorAgentId,
			assignedToRoleType: newPhase.assignedToRoleType,
			phaseStatus: newPhase.phaseStatus,
			requiredInputs: newPhase.requiredInputs,
			expectedOutputs: newPhase.expectedOutputs,
			createdAt: newPhase.createdAt,
			updatedAt: newPhase.updatedAt,
			assignments: assignmentSummary
		}, { status: 201 });

	} catch (error) {
		console.error('Failed to create phase:', error);
		
		// Provide more specific error messages based on the error type
		if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === '23503') {
			return json({ 
				error: 'Database constraint violation: One or more referenced entities may not exist or may be invalid'
			}, { status: 400 });
		}
		
		if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') {
			return json({ 
				error: 'Constraint violation: This phase conflicts with existing data'
			}, { status: 409 });
		}
		
		return json({ 
			error: 'Internal server error occurred while creating phase',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}