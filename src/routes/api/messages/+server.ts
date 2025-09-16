import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, channels, channelRoleAssignments, roles } from '$lib/db/schema';
import { eq, and, isNull, or, desc, sql, like } from 'drizzle-orm';

// GET /api/messages - Get messages with various filters
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		const channelId = url.searchParams.get('channelId');
		const isDM = url.searchParams.get('isDM') === 'true';
		const agentId = url.searchParams.get('agentId');
		const search = url.searchParams.get('search');
		const since = url.searchParams.get('since');
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const listAll = url.searchParams.get('all') === 'true';
		
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

		// Build query conditions
		let conditions = [
			eq(content.projectId, parsedProjectId),
			eq(content.type, 'message')
		];
		
		// Handle different modes: list all, DM, or channel specific
		if (listAll) {
			// List all messages mode - no additional channel filters
		} else if (isDM) {
			// Get DM messages (channelId = null)
			conditions.push(isNull(content.channelId));
		} else if (channelId) {
			// Get channel messages
			const parsedChannelId = parseInt(channelId);
			if (isNaN(parsedChannelId) || parsedChannelId <= 0) {
				return json({ 
					error: 'Invalid channelId: must be a positive integer'
				}, { status: 400 });
			}
			conditions.push(eq(content.channelId, parsedChannelId));
		} else if (!search && !agentId) {
			return json({ 
				error: 'Must specify either channelId, isDM=true, all=true, search, or agentId'
			}, { status: 400 });
		}
		
		// Add search filter
		if (search) {
			const searchPattern = `%${search}%`;
			conditions.push(
				or(
					like(content.title, searchPattern),
					like(content.body, searchPattern)
				)
			);
		}
		
		// Add time filter
		if (since) {
			conditions.push(sql`${content.createdAt} > ${since}`);
		}
		
		let whereCondition = and(...conditions);

		// Get messages
		let messages = await db
			.select({
				id: content.id,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				parentContentId: content.parentContentId,
				channelId: content.channelId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
				// Ticket-specific fields (not applicable for messages but included for consistency)
				status: content.status,
				priority: content.priority,
				assignedToRoleType: content.assignedToRoleType,
				claimedByAgent: content.claimedByAgent,
			})
			.from(content)
			.where(whereCondition)
			.orderBy(desc(content.createdAt))
			.limit(limit)
			.offset(offset);
			
		// Filter by agentId if provided (messages where agent is recipient or sender)
		if (agentId && !listAll) {
			// If we have messages to filter
			if (messages.length > 0) {
				// Get the agent's role for role-based filtering
				const [agent] = await db
					.select({ roleType: agents.roleType })
					.from(agents)
					.where(eq(agents.id, agentId))
					.limit(1);
				
				const messageIds = messages.map(m => m.id);
				
				// Get messages where agent is assigned to read
				const assignedMessageIds = await db
					.select({ contentId: readingAssignments.contentId })
					.from(readingAssignments)
					.where(
						and(
							sql`${readingAssignments.contentId} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`,
							or(
								and(
									eq(readingAssignments.assignedToType, 'agent'),
									eq(readingAssignments.assignedTo, agentId)
								),
								agent?.roleType ? and(
									eq(readingAssignments.assignedToType, 'role'),
									eq(readingAssignments.assignedTo, agent.roleType)
								) : sql`false`
							)
						)
					);
				
				const assignedIds = new Set(assignedMessageIds.map(a => a.contentId));
				
				// Include messages where agent is author or is assigned to read
				messages = messages.filter(msg => 
					msg.authorAgentId === agentId || assignedIds.has(msg.id)
				);
			}
		}

		// For each message, get the reading assignments
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
					...message,
					readingAssignments: assignmentsWithReads
				};
			})
		);

		// Get total count for pagination
		const totalConditions = [...conditions];
		if (agentId && !listAll) {
			// For agent-specific queries, we need to count differently
			// This is a simplified count - ideally we'd do the full filter
			// For now, return the filtered message count
			return json({
				messages: messagesWithAssignments,
				total: messages.length,
				limit,
				offset
			});
		}
		
		const [countResult] = await db
			.select({ count: sql`count(*)` })
			.from(content)
			.where(and(...totalConditions));
		
		return json({
			messages: messagesWithAssignments,
			total: Number(countResult.count),
			limit,
			offset
		});
	} catch (error) {
		console.error('Failed to fetch messages:', error);
		return json({ 
			error: 'Internal server error occurred while fetching messages'
		}, { status: 500 });
	}
}

// POST /api/messages - Create a new message (channel or DM)
export async function POST({ request }) {
	try {
		const {
			projectId,
			authorAgentId,
			title,
			body,
			channelId, // null for DMs
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

		// Validate projectId is a valid number
		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
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

		// Validate channelId if provided (null = DM)
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
					error: `Channel with ID ${parsedChannelId} not found`
				}, { status: 404 });
			}

			if (channel.projectId !== parsedProjectId) {
				return json({ 
					error: `Channel ${parsedChannelId} does not belong to project ${parsedProjectId}`
				}, { status: 403 });
			}
		}

		// Create the message
		const [newMessage] = await db
			.insert(content)
			.values({
				projectId: parsedProjectId,
				channelId: channelId ? parseInt(channelId) : null,
				parentContentId: null, // Messages are not replies
				type: 'message',
				title: title || null,
				body,
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

		// Create reading assignments
		let assignmentSummary = [];
		
		// 1. Manual assignments (if provided)
		if (assignTo && assignTo.length > 0) {
			const assignmentPromises = assignTo.map(async (assignment) => {
				const resolvedTarget = await resolveAgentId(assignment.target, assignment.type);
				
				return await db
					.insert(readingAssignments)
					.values({
						contentId: newMessage.id,
						assignedToType: assignment.type,
						assignedTo: resolvedTarget,
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
		
		// 2. Automatic channel assignments - assign to all roles in channel except author's role
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
			id: newMessage.id,
			projectId: newMessage.projectId,
			channelId: newMessage.channelId,
			type: newMessage.type,
			title: newMessage.title,
			body: newMessage.body,
			authorAgentId: newMessage.authorAgentId,
			createdAt: newMessage.createdAt,
			updatedAt: newMessage.updatedAt,
			assignments: assignmentSummary,
			isDM: !channelId
		}, { status: 201 });

	} catch (error) {
		console.error('Failed to create message:', error);
		
		// Provide more specific error messages based on the error type
		if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === '23503') {
			return json({ 
				error: 'Database constraint violation: One or more referenced entities may not exist or may be invalid'
			}, { status: 400 });
		}
		
		if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') {
			return json({ 
				error: 'Constraint violation: This message conflicts with existing data'
			}, { status: 409 });
		}
		
		return json({ 
			error: 'Internal server error occurred while creating message',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}