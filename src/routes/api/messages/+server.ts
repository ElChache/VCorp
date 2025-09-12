import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, channels, channelRoleAssignments, roles } from '$lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// GET /api/messages - Get messages for a channel or DMs
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		const channelId = url.searchParams.get('channelId');
		const isDM = url.searchParams.get('isDM') === 'true';
		
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

		let whereCondition;
		
		if (isDM) {
			// Get DM messages (channelId = null)
			whereCondition = and(
				eq(content.projectId, parsedProjectId),
				isNull(content.channelId)
			);
		} else if (channelId) {
			// Get channel messages
			const parsedChannelId = parseInt(channelId);
			if (isNaN(parsedChannelId) || parsedChannelId <= 0) {
				return json({ 
					error: 'Invalid channelId: must be a positive integer'
				}, { status: 400 });
			}
			
			whereCondition = and(
				eq(content.projectId, parsedProjectId),
				eq(content.channelId, parsedChannelId)
			);
		} else {
			return json({ 
				error: 'Must specify either channelId or isDM=true'
			}, { status: 400 });
		}

		// Get messages
		const messages = await db
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
				// Ticket-specific fields
				status: content.status,
				priority: content.priority,
				assignedToRoleType: content.assignedToRoleType,
				claimedByAgent: content.claimedByAgent,
			})
			.from(content)
			.where(whereCondition)
			.orderBy(content.createdAt);

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

		return json(messagesWithAssignments);
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

		// Create reading assignments
		let assignmentSummary = [];
		
		// 1. Manual assignments (if provided)
		if (assignTo && assignTo.length > 0) {
			const assignmentPromises = assignTo.map(async (assignment) => {
				return await db
					.insert(readingAssignments)
					.values({
						contentId: newMessage.id,
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