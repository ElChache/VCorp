import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, roles, channels } from '$lib/db/schema';
import { eq, desc, isNotNull, or, and } from 'drizzle-orm';

// GET /api/messages/all?projectId=<id> - Get all messages with reading assignment status
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		console.log(`📬 Loading all messages for project ${projectId}`);

		// Get all messages (content) for this project, ordered by creation time
		const allMessages = await db
			.select({
				id: content.id,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				channelId: content.channelId,
				parentContentId: content.parentContentId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
				// Include ticket/phase specific fields
				status: content.status,
				priority: content.priority,
				assignedToRoleType: content.assignedToRoleType,
				claimedByAgent: content.claimedByAgent,
				phaseStatus: content.phaseStatus
			})
			.from(content)
			.where(eq(content.projectId, parseInt(projectId)))
			.orderBy(desc(content.createdAt));

		// For each message, get reading assignments with read status (similar to channels endpoint)
		const messagesWithAssignments = await Promise.all(
			allMessages.map(async (message) => {
				// Get channel name if message is in a channel
				let channelName = null;
				if (message.channelId) {
					const [channel] = await db
						.select({ name: channels.name })
						.from(channels)
						.where(eq(channels.id, message.channelId))
						.limit(1);
					channelName = channel?.name || 'Unknown';
				}

				// Get reading assignments for this message
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
								.innerJoin(roles, eq(agents.roleId, roles.id))
								.where(eq(roles.name, assignment.assignedTo));
							targetAgents = roleAgents.map(a => a.id);
						} else if (assignment.assignedToType === 'squad') {
							// Squad assignment - get all agents in this squad
							const squadAgents = await db
								.select({ id: agents.id })
								.from(agents)
								.where(eq(agents.squadId, assignment.assignedTo));
							targetAgents = squadAgents.map(a => a.id);
						}

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
					channelName,
					isDM: !message.channelId,
					isReply: !!message.parentContentId,
					readingAssignments: assignmentsWithStatus
				};
			})
		);

		console.log(`✅ Loaded ${messagesWithAssignments.length} messages with reading assignments`);

		return json({
			messages: messagesWithAssignments,
			summary: {
				total: messagesWithAssignments.length,
				withAssignments: messagesWithAssignments.filter(m => m.readingAssignments.length > 0).length,
				withoutAssignments: messagesWithAssignments.filter(m => m.readingAssignments.length === 0).length
			}
		});

	} catch (error) {
		console.error('Failed to load all messages:', error);
		return json({ error: 'Failed to load all messages' }, { status: 500 });
	}
}