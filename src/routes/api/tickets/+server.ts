import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/tickets - Create a work ticket
export async function POST({ request }) {
	try {
		const {
			projectId,
			authorAgentId,
			title,
			body,
			status = 'open', // 'open', 'in_progress', 'blocked', 'ready_for_review', 'reviewing', 'review_passed', 'needs_attention', 'resolved', 'closed'
			priority = 'medium', // 'low', 'medium', 'high', 'critical'
			assignedToRoleType, // Role type to assign ticket to
			assignTo // Array of assignments: { type: 'agent'|'role'|'squad', target: 'be_001'|'Backend Developer'|'leadership' }
		} = await request.json();

		// Validate required fields
		if (!projectId) {
			return json({ 
				error: 'Missing required field: projectId must be provided'
			}, { status: 400 });
		}

		if (!body) {
			return json({ 
				error: 'Missing required field: body must be provided and cannot be empty'
			}, { status: 400 });
		}

		if (!title) {
			return json({ 
				error: 'Missing required field: title is required for tickets'
			}, { status: 400 });
		}

		// Validate projectId is a valid number
		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Validate status
		const validStatuses = ['open', 'in_progress', 'blocked', 'ready_for_review', 'reviewing', 'review_passed', 'needs_attention', 'resolved', 'closed'];
		if (status && !validStatuses.includes(status)) {
			return json({ 
				error: `Invalid status: must be one of ${validStatuses.join(', ')}`
			}, { status: 400 });
		}

		// Validate priority
		const validPriorities = ['low', 'medium', 'high', 'critical'];
		if (priority && !validPriorities.includes(priority)) {
			return json({ 
				error: `Invalid priority: must be one of ${validPriorities.join(', ')}`
			}, { status: 400 });
		}

		// Validate assignment targets (if provided)
		if (assignTo && assignTo.length > 0) {
			if (!Array.isArray(assignTo)) {
				return json({ 
					error: 'Invalid assignTo format: must be an array of assignment objects'
				}, { status: 400 });
			}

			for (let i = 0; i < assignTo.length; i++) {
				const assignment = assignTo[i];
				
				if (!assignment || typeof assignment !== 'object') {
					return json({ 
						error: `Invalid assignment at index ${i}: must be an object with 'type' and 'target' properties`
					}, { status: 400 });
				}

				if (!assignment.type || !['agent', 'role', 'squad'].includes(assignment.type)) {
					return json({ 
						error: `Invalid assignment type at index ${i}: must be 'agent', 'role', or 'squad'`
					}, { status: 400 });
				}

				if (!assignment.target || typeof assignment.target !== 'string' || assignment.target.trim() === '') {
					return json({ 
						error: `Invalid target at index ${i}: must be a non-empty string`
					}, { status: 400 });
				}
			}
		}

		// Validate author agent exists (if provided)
		if (authorAgentId && !['director', 'human-director'].includes(authorAgentId)) {
			const [author] = await db
				.select({ id: agents.id, projectId: agents.projectId })
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
		}

		// Create the ticket
		const [newTicket] = await db
			.insert(content)
			.values({
				projectId: parsedProjectId,
				channelId: null, // Tickets are not posted to channels directly
				parentContentId: null, // Tickets are not replies
				type: 'ticket',
				title: title.trim(),
				body: body.trim(),
				authorAgentId: authorAgentId || null,
				status: status,
				priority: priority,
				assignedToRoleType: assignedToRoleType || null,
			})
			.returning();

		// Create reading assignments
		let assignmentSummary = [];
		
		// 1. Manual assignments (if provided)
		if (assignTo && assignTo.length > 0) {
			const assignmentPromises = assignTo.map(async (assignment) => {
				return await db
					.insert(readingAssignments)
					.values({
						contentId: newTicket.id,
						assignedToType: assignment.type,
						assignedTo: assignment.target,
					})
					.returning();
			});

			const createdAssignments = await Promise.all(assignmentPromises);

			// Get summary of who was assigned
			assignmentSummary = assignTo.map((assignment, index) => ({
				type: assignment.type,
				target: assignment.target,
				assignmentId: createdAssignments[index][0].id
			}));
		}
		
		// 2. Automatic assignment to assigned role type (if provided)
		if (assignedToRoleType) {
			const [roleAssignment] = await db
				.insert(readingAssignments)
				.values({
					contentId: newTicket.id,
					assignedToType: 'role',
					assignedTo: assignedToRoleType,
				})
				.returning();
			
			assignmentSummary.push({
				type: 'role',
				target: assignedToRoleType,
				assignmentId: roleAssignment.id,
				auto: true
			});
		}

		return json({
			id: newTicket.id,
			projectId: newTicket.projectId,
			type: newTicket.type,
			title: newTicket.title,
			body: newTicket.body,
			status: newTicket.status,
			priority: newTicket.priority,
			assignedToRoleType: newTicket.assignedToRoleType,
			claimedByAgent: newTicket.claimedByAgent,
			authorAgentId: newTicket.authorAgentId,
			createdAt: newTicket.createdAt,
			updatedAt: newTicket.updatedAt,
			assignments: assignmentSummary
		}, { status: 201 });

	} catch (error) {
		console.error('Failed to create ticket:', error);
		
		// Provide more specific error messages based on the error type
		if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === '23503') {
			return json({ 
				error: 'Database constraint violation: One or more referenced entities may not exist or may be invalid'
			}, { status: 400 });
		}
		
		if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') {
			return json({ 
				error: 'Constraint violation: This ticket conflicts with existing data'
			}, { status: 409 });
		}
		
		return json({ 
			error: 'Internal server error occurred while creating ticket',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}