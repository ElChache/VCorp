import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/replies - Reply to any content (enforces flat threading)
export async function POST({ request }: RequestEvent) {
	try {
		const {
			projectId,
			authorAgentId,
			title,
			body,
			parentContentId, // Required - what we're replying to
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

		if (!parentContentId) {
			return json({ 
				error: 'Missing required field: parentContentId must be provided for replies'
			}, { status: 400 });
		}

		// Validate projectId is a valid number
		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Validate parentContentId
		const parsedParentId = parseInt(parentContentId);
		if (isNaN(parsedParentId) || parsedParentId <= 0) {
			return json({ 
				error: 'Invalid parentContentId: must be a positive integer'
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

		// Validate parent content exists and enforce flat threading
		const [requestedParent] = await db
			.select({ 
				id: content.id, 
				projectId: content.projectId, 
				type: content.type,
				parentContentId: content.parentContentId,
				channelId: content.channelId
			})
			.from(content)
			.where(eq(content.id, parsedParentId))
			.limit(1);
		
		if (!requestedParent) {
			return json({ 
				error: `Parent content with ID ${parsedParentId} not found`
			}, { status: 404 });
		}
		
		// Ensure reply is in the same project as parent
		if (requestedParent.projectId !== parsedProjectId) {
			return json({ 
				error: `Cannot create reply: parent content belongs to project ${requestedParent.projectId}, but reply is for project ${parsedProjectId}`
			}, { status: 403 });
		}

		// ENFORCE FLAT THREADING: If replying to a reply, use the original parent instead
		let actualParentContentId;
		let actualParentChannelId;
		let flatThreadingApplied = false;
		
		if (requestedParent.parentContentId !== null) {
			// This is a reply to an existing reply - point to the original content instead
			actualParentContentId = requestedParent.parentContentId;
			flatThreadingApplied = true;
			console.log(`Enforcing flat threading: Reply to ${parsedParentId} redirected to original content ${actualParentContentId}`);
			
			// Get the original parent's channelId
			const [originalParent] = await db
				.select({ channelId: content.channelId })
				.from(content)
				.where(eq(content.id, actualParentContentId))
				.limit(1);
			actualParentChannelId = originalParent?.channelId || null;
		} else {
			// This is a reply to original content - use as-is
			actualParentContentId = parsedParentId;
			actualParentChannelId = requestedParent.channelId;
		}

		// Create the reply
		const [newReply] = await db
			.insert(content)
			.values({
				projectId: parsedProjectId,
				channelId: actualParentChannelId, // Inherit channelId from parent (null for DM threads, channelId for channel threads)
				parentContentId: actualParentContentId,
				type: 'reply',
				title: title || null,
				body: body.trim(),
				authorAgentId: authorAgentId || null,
			})
			.returning();

		// Helper function to resolve agent ID
		const resolveAgentId = async (target: string, type: string): Promise<string> => {
			if (type === 'agent' && target === 'human-director') {
				// Find the actual human director agent ID for this project
				const [humanDirector] = await db
					.select({ id: agents.id })
					.from(agents)
					.where(and(
						eq(agents.projectId, parsedProjectId),
						eq(agents.isHumanDirector, true)
					))
					.limit(1);
				
				return humanDirector?.id || target; // Fallback to original if not found
			}
			return target;
		};

		// Define types for assignments
		interface Assignment {
			type: string;
			target: string;
		}

		interface AssignmentSummary {
			type: string;
			target: string;
			assignmentId: number;
			autoThread?: boolean;
		}

		// Create reading assignments
		let assignmentSummary: AssignmentSummary[] = [];
		
		// 1. Manual assignments (if provided)
		if (assignTo && assignTo.length > 0) {
			const assignmentPromises = assignTo.map(async (assignment: Assignment) => {
				const resolvedTarget = await resolveAgentId(assignment.target, assignment.type);
				
				return await db
					.insert(readingAssignments)
					.values({
						contentId: newReply.id,
						assignedToType: assignment.type,
						assignedTo: resolvedTarget,
					})
					.returning();
			});

			const createdAssignments = await Promise.all(assignmentPromises);

			// Get summary of who was assigned
			assignmentSummary = assignTo.map((assignment: Assignment, index: number) => ({
				type: assignment.type,
				target: assignment.target,
				assignmentId: createdAssignments[index][0].id
			}));
		}
		
		// 2. Automatic thread assignments - notify thread participants when someone replies
		try {
			// Get the original content (document or message) being replied to
			const [parentContent] = await db
				.select({ 
					id: content.id, 
					authorAgentId: content.authorAgentId,
					type: content.type 
				})
				.from(content)
				.where(eq(content.id, actualParentContentId))
				.limit(1);

			if (parentContent) {
				const threadParticipants = new Set<string>();

				// Add original content author (if it's an agent, not the current replier)
				if (parentContent.authorAgentId && 
					parentContent.authorAgentId !== authorAgentId &&
					parentContent.authorAgentId !== 'human-director') {
					threadParticipants.add(parentContent.authorAgentId);
				}

				// Get all other agents who have replied to the same parent content
				const existingReplies = await db
					.select({ authorAgentId: content.authorAgentId })
					.from(content)
					.where(eq(content.parentContentId, actualParentContentId));

				existingReplies.forEach(reply => {
					if (reply.authorAgentId && 
						reply.authorAgentId !== authorAgentId &&
						reply.authorAgentId !== 'human-director') {
						threadParticipants.add(reply.authorAgentId);
					}
				});

				// Create reading assignments for all thread participants
				for (const participantAgentId of threadParticipants) {
					const [threadAssignment] = await db
						.insert(readingAssignments)
						.values({
							contentId: newReply.id,
							assignedToType: 'agent',
							assignedTo: participantAgentId,
						})
						.returning();
					
					assignmentSummary.push({
						type: 'agent',
						target: participantAgentId,
						assignmentId: threadAssignment.id,
						autoThread: true
					});
				}
			}
		} catch (threadAssignError) {
			console.error('Failed to create thread assignments:', threadAssignError);
		}

		return json({
			id: newReply.id,
			projectId: newReply.projectId,
			parentContentId: newReply.parentContentId,
			type: newReply.type,
			title: newReply.title,
			body: newReply.body,
			authorAgentId: newReply.authorAgentId,
			createdAt: newReply.createdAt,
			updatedAt: newReply.updatedAt,
			assignments: assignmentSummary,
			flatThreadingApplied,
			requestedParentId: parsedParentId,
			actualParentId: actualParentContentId
		}, { status: 201 });

	} catch (error: unknown) {
		console.error('Failed to create reply:', error);
		
		// Type guard for database errors
		const dbError = error as { code?: string; message?: string };
		
		// Provide more specific error messages based on the error type
		if (dbError.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || dbError.code === '23503') {
			return json({ 
				error: 'Database constraint violation: One or more referenced entities may not exist or may be invalid'
			}, { status: 400 });
		}
		
		if (dbError.code === 'SQLITE_CONSTRAINT_UNIQUE' || dbError.code === '23505') {
			return json({ 
				error: 'Constraint violation: This reply conflicts with existing data'
			}, { status: 409 });
		}
		
		return json({ 
			error: 'Internal server error occurred while creating reply',
			details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
		}, { status: 500 });
	}
}