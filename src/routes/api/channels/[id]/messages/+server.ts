import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, roles, channels, channelRoleAssignments } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// GET /api/channels/[id]/messages - Get messages for a channel
export async function GET({ params }) {
	try {
		const channelId = parseInt(params.id);
		
		if (!channelId || channelId < 0) {
			return json({ 
				error: 'Invalid channel ID: must be a positive integer to retrieve messages for that channel'
			}, { status: 400 });
		}

		// Get all messages for this channel, ordered by creation time
		const messages = await db
			.select({
				id: content.id,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				parentContentId: content.parentContentId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
				// Ticket-specific fields
				status: content.status,
				priority: content.priority,
				assignedToRoleType: content.assignedToRoleType,
				claimedByAgent: content.claimedByAgent,
			})
			.from(content)
			.where(eq(content.channelId, channelId))
			.orderBy(content.createdAt);

		// For each message, get the reading assignments with read status
		const messagesWithAssignments = await Promise.all(
			messages.map(async (message) => {
				const assignments = await db
					.select({
						id: readingAssignments.id,
						assignedToType: readingAssignments.assignedToType,
						assignedTo: readingAssignments.assignedTo,
						assignedAt: readingAssignments.assignedAt,
					})
					.from(readingAssignments)
					.where(eq(readingAssignments.contentId, message.id));

				// For each assignment, determine which agents should read it and who has read it
				const assignmentsWithStatus = await Promise.all(
					assignments.map(async (assignment) => {
						let targetAgents = [];
						
						// Get agents that should read this assignment based on type
						if (assignment.assignedToType === 'agent') {
							// Direct agent assignment
							const agent = await db
								.select({ id: agents.id })
								.from(agents)
								.where(eq(agents.id, assignment.assignedTo))
								.limit(1);
							if (agent.length > 0) {
								targetAgents = [agent[0].id];
							}
						} else if (assignment.assignedToType === 'role') {
							// Role assignment - get all agents with this role type
							const roleAgents = await db
								.select({ id: agents.id })
								.from(agents)
								.where(eq(agents.roleType, assignment.assignedTo));
							targetAgents = roleAgents.map(a => a.id);
						}
						// TODO: Add squad support later

						// Get which of these agents have actually read it
						const reads = await db
							.select({
								agentId: readingAssignmentReads.agentId,
								readAt: readingAssignmentReads.readAt,
								acknowledged: readingAssignmentReads.acknowledged,
							})
							.from(readingAssignmentReads)
							.where(eq(readingAssignmentReads.readingAssignmentId, assignment.id));

						const readByAgents = reads.map(r => r.agentId);
						const unreadAgents = targetAgents.filter(id => !readByAgents.includes(id));

						return {
							...assignment,
							targetAgents,
							readBy: reads,
							unreadAgents,
							totalTargets: targetAgents.length,
							readCount: reads.length,
							isFullyRead: unreadAgents.length === 0 && targetAgents.length > 0
						};
					})
				);

				return {
					...message,
					readingAssignments: assignmentsWithStatus
				};
			})
		);

		return json(messagesWithAssignments);
	} catch (error) {
		console.error('Failed to load channel messages:', error);
		
		// Provide more specific error messages based on the error type
		if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === '23503') {
			return json({ 
				error: 'Database constraint violation: The channel may not exist or may be invalid. Please verify the channel ID is correct.'
			}, { status: 404 });
		}
		
		return json({ 
			error: 'Internal server error occurred while loading channel messages. Please try again or contact support if the problem persists.',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}

// POST /api/channels/[id]/messages - Create a message or ticket in a channel
export async function POST({ params, request }) {
	try {
		const channelId = parseInt(params.id);
		
		// Allow channelId = 0 for DM messages (treat as null)
		if (isNaN(channelId) || channelId < 0) {
			return json({ 
				error: 'Invalid channel ID: must be a non-negative integer (0 for direct messages, positive integers for channel messages)'
			}, { status: 400 });
		}

		const body = await request.json();
		
		const { 
			type, 
			title, 
			body: messageBody, 
			authorAgentId,
			projectId,
			parentContentId,
			// Ticket-specific fields
			priority,
			status,
			assignedToRoleType,
			claimedByAgent
		} = body;

		if (!type) {
			return json({ 
				error: 'Missing required field: type must be provided (e.g., "message", "ticket", "document")'
			}, { status: 400 });
		}

		if (!messageBody) {
			return json({ 
				error: 'Missing required field: body must be provided and cannot be empty'
			}, { status: 400 });
		}

		if (!projectId) {
			return json({ 
				error: 'Missing required field: projectId must be provided to identify which project the message belongs to'
			}, { status: 400 });
		}

		// Validate projectId is a valid number
		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Validate message type
		const validTypes = ['message', 'ticket', 'document', 'reply'];
		if (!validTypes.includes(type)) {
			return json({ 
				error: `Invalid message type '${type}': must be one of ${validTypes.join(', ')}`
			}, { status: 400 });
		}

		// Validate ticket-specific fields if this is a ticket
		if (type === 'ticket') {
			if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
				return json({ 
					error: `Invalid ticket priority '${priority}': must be one of low, medium, high, urgent`
				}, { status: 400 });
			}
			
			if (status && !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
				return json({ 
					error: `Invalid ticket status '${status}': must be one of open, in_progress, resolved, closed`
				}, { status: 400 });
			}
		}

		// Validate parentContentId if provided
		if (parentContentId) {
			const parsedParentId = parseInt(parentContentId);
			if (isNaN(parsedParentId) || parsedParentId <= 0) {
				return json({ 
					error: 'Invalid parentContentId: must be a positive integer'
				}, { status: 400 });
			}

			const [parentContent] = await db
				.select({ id: content.id, projectId: content.projectId })
				.from(content)
				.where(eq(content.id, parsedParentId))
				.limit(1);
			
			if (!parentContent) {
				return json({ 
					error: `Parent content with ID ${parsedParentId} not found. Cannot create reply to non-existent content.`
				}, { status: 404 });
			}
			
			if (parentContent.projectId !== parsedProjectId) {
				return json({ 
					error: `Cannot create reply: parent content belongs to project ${parentContent.projectId}, but reply is for project ${parsedProjectId}. Replies must be in the same project as the parent content.`
				}, { status: 403 });
			}
		}

		// Validate authorAgentId if provided
		if (authorAgentId && authorAgentId !== 'human-director') {
			if (typeof authorAgentId !== 'string' || authorAgentId.trim() === '') {
				return json({ 
					error: 'Invalid authorAgentId: must be a non-empty string'
				}, { status: 400 });
			}

			const [author] = await db
				.select({ id: agents.id, projectId: agents.projectId })
				.from(agents)
				.where(eq(agents.id, authorAgentId))
				.limit(1);
			
			if (!author) {
				return json({ 
					error: `Author agent '${authorAgentId}' not found. Please verify the agent ID exists in the system.`
				}, { status: 404 });
			}

			if (author.projectId !== parsedProjectId) {
				return json({ 
					error: `Author agent '${authorAgentId}' does not belong to project ${parsedProjectId}. The agent can only send messages within their assigned project.`
				}, { status: 403 });
			}
		}

		// Validate channel exists and belongs to project (if not DM)
		if (channelId > 0) {
			const [channel] = await db
				.select({ id: channels.id, projectId: channels.projectId })
				.from(channels)
				.where(eq(channels.id, channelId))
				.limit(1);
			
			if (!channel) {
				return json({ 
					error: `Channel with ID ${channelId} not found. Please verify the channel exists.`
				}, { status: 404 });
			}

			if (channel.projectId !== parsedProjectId) {
				return json({ 
					error: `Channel ${channelId} does not belong to project ${parsedProjectId}. Messages can only be sent to channels within the same project.`
				}, { status: 403 });
			}
		}

		// Create the content
		const [newContent] = await db
			.insert(content)
			.values({
				projectId: parsedProjectId,
				channelId: channelId === 0 ? null : channelId,
				type,
				title,
				body: messageBody,
				authorAgentId,
				parentContentId: parentContentId || null,
				// Ticket-specific fields (null for non-tickets)
				status: type === 'ticket' ? status : null,
				priority: type === 'ticket' ? priority : null,
				assignedToRoleType: type === 'ticket' ? assignedToRoleType : null,
				claimedByAgent: type === 'ticket' ? claimedByAgent : null,
			})
			.returning();

		// Auto-create reading assignments for special cases
		try {
			// 1. If this is a reply (has parentContentId), automatically create a reading assignment 
			// for the original author so they get notified
			if (parentContentId) {
				// Get the original message to find its author
				const [originalMessage] = await db
					.select({ authorAgentId: content.authorAgentId })
					.from(content)
					.where(eq(content.id, parentContentId))
					.limit(1);

				// If the original message has an author and it's not the same as the reply author,
				// create a reading assignment for the original author
				if (originalMessage?.authorAgentId && originalMessage.authorAgentId !== authorAgentId) {
					await db
						.insert(readingAssignments)
						.values({
							contentId: newContent.id,
							assignedToType: 'agent',
							assignedTo: originalMessage.authorAgentId,
						});
				}
			}

			// 2. Create reading assignments for all role types that have access to this channel
			// except the role type of the message author
			if (channelId && channelId > 0) {
				// Get author's role type to exclude from assignments
				let authorRoleType = null;
				if (authorAgentId && authorAgentId !== 'human-director') {
					const [authorAgent] = await db
						.select({ roleType: agents.roleType })
						.from(agents)
						.where(eq(agents.id, authorAgentId))
						.limit(1);
					authorRoleType = authorAgent?.roleType;
				} else if (authorAgentId === 'human-director') {
					authorRoleType = 'Human Director';
				}

				// Get all roles assigned to this channel
				const channelRoles = await db
					.select({ 
						roleId: channelRoleAssignments.roleId,
						roleName: roles.name 
					})
					.from(channelRoleAssignments)
					.innerJoin(roles, eq(channelRoleAssignments.roleId, roles.id))
					.where(eq(channelRoleAssignments.channelId, channelId));

				// Create reading assignments for each role assigned to the channel
				// except the author's role type
				for (const role of channelRoles) {
					if (role.roleName !== authorRoleType) {
						await db
							.insert(readingAssignments)
							.values({
								contentId: newContent.id,
								assignedToType: 'role',
								assignedTo: role.roleName,
							});
					}
				}
			}
		} catch (error) {
			console.error('Failed to create auto reading assignments:', error);
			// Don't fail the entire request if reading assignment creation fails
		}


		return json(newContent);
	} catch (error) {
		console.error('Failed to create content:', error);
		
		// Provide more specific error messages based on the error type
		if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === '23503') {
			return json({ 
				error: 'Database constraint violation: One or more referenced entities (project, channel, agent, or parent content) may not exist or may be invalid. Please verify all IDs are correct.'
			}, { status: 400 });
		}
		
		if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') {
			return json({ 
				error: 'Constraint violation: This message conflicts with existing data. Please check for duplicate entries.'
			}, { status: 409 });
		}
		
		return json({ 
			error: 'Internal server error occurred while creating message. Please try again or contact support if the problem persists.',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}