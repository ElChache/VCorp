import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents, roles, channels, channelRoleAssignments } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolveAssignmentTarget, isHumanDirectorId, getHumanDirectorIdForProject } from '$lib/utils/humanDirectorHelpers';
import { CONFIG } from '$lib/config';

// Type definitions
interface Assignment {
	type: string;
	target: string;
}

interface AssignmentSummary {
	type: string;
	target: string;
	assignmentId: number;
	auto?: boolean;
	autoThread?: boolean;
}

// POST /api/send-message - Send a message with automatic reading assignments
export async function POST({ request }: RequestEvent) {
	try {
		const {
			projectId,
			authorAgentId,
			title,
			body,
			channelId, // Optional - null for DMs
			parentContentId, // Optional - for replies to other messages/content
			type = 'message', // 'message', 'document', 'reply'
			priority = 'medium', // 'low', 'medium', 'high' - default to medium
			assignTo // Array of assignments: { type: 'agent'|'role'|'squad', target: 'be_001'|'Backend Developer'|'leadership' }
		} = await request.json();

		// Validate required fields with detailed error messages
		if (!projectId) {
			return json({ 
				error: 'Missing required field: projectId must be provided to identify which project the message belongs to'
			}, { status: 400 });
		}

		if (!body) {
			return json({ 
				error: 'Missing required field: body must be provided and cannot be empty'
			}, { status: 400 });
		}

		// Validate message length based on message type and channel
		const bodyLength = body.length;
		let maxLength: number;
		let messageContext: string;

		if (type === 'document') {
			maxLength = CONFIG.MESSAGE_LIMITS.MAX_DOCUMENT_LENGTH;
			messageContext = 'document';
		} else if (channelId) {
			// Channel message
			maxLength = CONFIG.MESSAGE_LIMITS.MAX_CHANNEL_MESSAGE_LENGTH;
			messageContext = 'channel message';
		} else {
			// Direct message
			maxLength = CONFIG.MESSAGE_LIMITS.MAX_DIRECT_MESSAGE_LENGTH;
			messageContext = 'direct message';
		}

		if (bodyLength > maxLength) {
			return json({ 
				error: `Message too long: ${messageContext} cannot exceed ${maxLength} characters. Your message is ${bodyLength} characters long (${bodyLength - maxLength} characters over the limit). Please shorten your message to maintain concise communication in channels.`,
				details: {
					messageType: messageContext,
					currentLength: bodyLength,
					maxLength: maxLength,
					overLimit: bodyLength - maxLength
				}
			}, { status: 400 });
		}

		// Validate projectId is a valid number
		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Validate priority
		if (priority && !['low', 'medium', 'high'].includes(priority)) {
			return json({ 
				error: 'Invalid priority: must be "low", "medium", or "high"'
			}, { status: 400 });
		}

		// Override priority to 'high' if message is from human director
		let finalPriority = priority;
		if (authorAgentId) {
			// Check if the agent is a human director by querying the database
			const [authorAgent] = await db
				.select({ isHumanDirector: agents.isHumanDirector })
				.from(agents)
				.where(eq(agents.id, authorAgentId))
				.limit(1);
			
			if (authorAgent && authorAgent.isHumanDirector) {
				finalPriority = 'high';
			}
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

				if (!assignment.type) {
					return json({ 
						error: `Missing 'type' in assignment at index ${i}: must be 'agent', 'role', or 'squad'`
					}, { status: 400 });
				}

				if (!assignment.target) {
					return json({ 
						error: `Missing 'target' in assignment at index ${i}: must specify the agent ID, role name, or squad name to assign to`
					}, { status: 400 });
				}

				if (!['agent', 'role', 'squad'].includes(assignment.type)) {
					return json({ 
						error: `Invalid assignment type '${assignment.type}' at index ${i}: must be 'agent', 'role', or 'squad'`
					}, { status: 400 });
				}

				if (typeof assignment.target !== 'string' || assignment.target.trim() === '') {
					return json({ 
						error: `Invalid target '${assignment.target}' at index ${i}: must be a non-empty string`
					}, { status: 400 });
				}
			}
		}

		// Resolve human director aliases to actual agent IDs
		if (assignTo && assignTo.length > 0) {
			for (let i = 0; i < assignTo.length; i++) {
				if (assignTo[i].type === 'agent' && ['director', 'human', 'human_director', 'human-director'].includes(assignTo[i].target)) {
					try {
						assignTo[i] = await resolveAssignmentTarget(assignTo[i], parsedProjectId);
					} catch (error) {
						return json({ 
							error: `Cannot assign to human director: ${error instanceof Error ? error.message : String(error)}`
						}, { status: 400 });
					}
				}
			}
		}

		// Validate author agent exists (if provided)
		if (authorAgentId && !isHumanDirectorId(authorAgentId)) {
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

		// Check if any assignments target the human director (after resolution)
		const humanDirectorId = await getHumanDirectorIdForProject(parsedProjectId);
		const hasDirectorAssignment = assignTo && assignTo.some((assignment: Assignment) => 
			assignment.type === 'agent' && (
				assignment.target === humanDirectorId ||
				isHumanDirectorId(assignment.target)
			)
		);

		// If targeting human director, ensure this is a DM (no channelId)
		if (hasDirectorAssignment && channelId) {
			return json({ 
				error: 'Messages assigned to human director must be sent as direct messages (DMs). Remove the channelId or change the assignment target.'
			}, { status: 400 });
		}

		// Validate channelId if provided
		if (channelId !== null && channelId !== undefined) {
			const parsedChannelId = parseInt(channelId);
			if (isNaN(parsedChannelId) || parsedChannelId <= 0) {
				return json({ 
					error: 'Invalid channelId: must be a positive integer or null for direct messages'
				}, { status: 400 });
			}

			// Verify channel exists and belongs to the project
			const [channel] = await db
				.select({ id: channels.id, projectId: channels.projectId })
				.from(channels)
				.where(eq(channels.id, parsedChannelId))
				.limit(1);
			
			if (!channel) {
				return json({ 
					error: `Channel with ID ${parsedChannelId} not found. Please verify the channel exists.`
				}, { status: 404 });
			}

			if (channel.projectId !== parsedProjectId) {
				return json({ 
					error: `Channel ${parsedChannelId} does not belong to project ${parsedProjectId}. Messages can only be sent to channels within the same project.`
				}, { status: 403 });
			}
		}

		// Validate parent content exists if this is a reply and enforce flat threading
		let actualParentContentId = null;
		if (parentContentId) {
			const parsedParentId = parseInt(parentContentId);
			if (isNaN(parsedParentId) || parsedParentId <= 0) {
				return json({ 
					error: 'Invalid parentContentId: must be a positive integer'
				}, { status: 400 });
			}

			const [requestedParent] = await db
				.select({ 
					id: content.id, 
					projectId: content.projectId, 
					type: content.type,
					parentContentId: content.parentContentId
				})
				.from(content)
				.where(eq(content.id, parsedParentId))
				.limit(1);
			
			if (!requestedParent) {
				return json({ 
					error: `Parent content with ID ${parsedParentId} not found. Cannot create reply to non-existent content.`
				}, { status: 404 });
			}
			
			// Ensure reply is in the same project as parent
			if (requestedParent.projectId !== parsedProjectId) {
				return json({ 
					error: `Cannot create reply: parent content belongs to project ${requestedParent.projectId}, but reply is for project ${parsedProjectId}. Replies must be in the same project as the parent content.`
				}, { status: 403 });
			}

			// ENFORCE FLAT THREADING: If replying to a reply, use the original parent instead
			if (requestedParent.parentContentId !== null) {
				// This is a reply to an existing reply - point to the original content instead
				actualParentContentId = requestedParent.parentContentId;
				console.log(`Enforcing flat threading: Reply to ${parsedParentId} redirected to original content ${actualParentContentId}`);
			} else {
				// This is a reply to original content - use as-is
				actualParentContentId = parsedParentId;
			}
		}

		// Create the message
		const [newMessage] = await db
			.insert(content)
			.values({
				projectId: parsedProjectId,
				channelId: channelId ? parseInt(channelId) : null,
				parentContentId: actualParentContentId,
				type: type,
				title: title || null,
				body,
				priority: finalPriority,
				authorAgentId: authorAgentId || null,
			})
			.returning();

		// Helper function to resolve agent ID
		const resolveAgentId = async (target: string, type: string): Promise<string> => {
			if (type === 'role') {
				if (target === 'human-director') {
					// Find the actual human director agent ID for this project using isHumanDirector flag
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
				
				if (target === 'it-administrator') {
					// Find the actual IT administrator agent ID for this project using isItAdministrator flag
					const [itAdmin] = await db
						.select({ id: agents.id })
						.from(agents)
						.where(and(
							eq(agents.projectId, parsedProjectId),
							eq(agents.isItAdministrator, true)
						))
						.limit(1);
					
					return itAdmin?.id || target; // Fallback to original if not found
				}
			}
			
			if (type === 'agent' && target === 'human-director') {
				// Legacy support: Find the actual human director agent ID for this project
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

		// Create reading assignments
		let createdAssignments: any[] = [];
		let assignmentSummary: AssignmentSummary[] = [];
		
		// 1. Manual assignments (if provided)
		if (assignTo && assignTo.length > 0) {
			const assignmentPromises = assignTo.map(async (assignment: Assignment) => {
				const resolvedTarget = await resolveAgentId(assignment.target, assignment.type);
				
				// Skip creating assignment if the author is assigning to themselves
				if (assignment.type === 'agent' && resolvedTarget === authorAgentId) {
					return null; // Skip this assignment
				}
				
				return await db
					.insert(readingAssignments)
					.values({
						contentId: newMessage.id,
						assignedToType: assignment.type,
						assignedTo: resolvedTarget,
					})
					.returning();
			});

			const results = await Promise.all(assignmentPromises);
			createdAssignments = results.filter(result => result !== null);

			// Get summary of who was assigned (excluding skipped assignments)
			assignmentSummary = assignTo
				.filter((assignment: Assignment, index: number) => results[index] !== null)
				.map((assignment: Assignment, originalIndex: number) => {
					const resultIndex = results.slice(0, originalIndex + 1).filter(r => r !== null).length - 1;
					return {
						type: assignment.type,
						target: assignment.target,
						assignmentId: createdAssignments[resultIndex][0].id
					};
				});
		}
		
		// 2. Automatic thread assignments - notify thread participants when someone replies
		if (actualParentContentId) {
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
					const threadParticipants = new Set();

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
								contentId: newMessage.id,
								assignedToType: 'agent',
								assignedTo: participantAgentId as string,
							})
							.returning();
						
						assignmentSummary.push({
							type: 'agent',
							target: participantAgentId as string,
							assignmentId: threadAssignment.id,
							autoThread: true
						});
					}
				}
			} catch (threadAssignError) {
				console.error('Failed to create thread assignments:', threadAssignError);
			}
		}
		
		// 3. Automatic assignments - create assignments for all role types that have access to this channel
		// except the role type of the message author
		if (channelId) {
			try {
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
					.where(eq(channelRoleAssignments.channelId, parseInt(channelId)));

				// Create reading assignments for each role assigned to the channel
				// except the author's role type
				for (const role of channelRoles) {
					if (role.roleName !== authorRoleType) {
						const [autoAssignment] = await db
							.insert(readingAssignments)
							.values({
								contentId: newMessage.id,
								assignedToType: 'role',
								assignedTo: role.roleName,
							})
							.returning();
						
						assignmentSummary.push({
							type: 'role',
							target: role.roleName,
							assignmentId: autoAssignment.id,
							auto: true
						});
					}
				}
			} catch (autoAssignError) {
				console.error('Failed to create auto assignments:', autoAssignError);
			}
		}

		return json({
			message: newMessage,
			assignments: assignmentSummary,
			success: true,
			isDM: !channelId,
			isReply: !!actualParentContentId,
			parentContentId: actualParentContentId || null,
			flatThreadingApplied: actualParentContentId !== (parentContentId ? parseInt(parentContentId) : null)
		});

	} catch (error) {
		console.error('Failed to send message:', error);
		
		// Provide more specific error messages based on the error type
		if ((error as any).code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || (error as any).code === '23503') {
			return json({ 
				error: 'Database constraint violation: One or more referenced entities (project, channel, agent, or parent content) may not exist or may be invalid. Please verify all IDs are correct.'
			}, { status: 400 });
		}
		
		if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE' || (error as any).code === '23505') {
			return json({ 
				error: 'Constraint violation: This message conflicts with existing data. Please check for duplicate entries.'
			}, { status: 409 });
		}
		
		return json({ 
			error: 'Internal server error occurred while sending message. Please try again or contact support if the problem persists.',
			details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
		}, { status: 500 });
	}
}