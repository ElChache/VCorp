import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, agents, readingAssignments } from '$lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

// GET /api/messages/direct - Get all agents that have DM history with the specified agent
export async function GET({ url }: RequestEvent) {
	try {
		const projectId = url.searchParams.get('projectId');
		const agentId = url.searchParams.get('agentId');
		
		if (!projectId || !agentId) {
			return json({ error: 'projectId and agentId are required' }, { status: 400 });
		}

		// Get all DM messages (channelId = null) in this project
		const allDMMessages = await db
			.select({
				id: content.id,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt,
			})
			.from(content)
			.where(and(
				eq(content.projectId, parseInt(projectId)),
				isNull(content.channelId)
			))
			.orderBy(content.createdAt);

		// For each DM message, check if it involves the specified agent
		const agentIds = new Set<string>();
		
		for (const message of allDMMessages) {
			// Check if the specified agent is the author
			if (message.authorAgentId === agentId) {
				// Get reading assignments to see who this message was sent to
				const assignments = await db
					.select({ assignedTo: readingAssignments.assignedTo })
					.from(readingAssignments)
					.where(and(
						eq(readingAssignments.contentId, message.id),
						eq(readingAssignments.assignedToType, 'agent')
					));
				
				// Add all agents this message was sent to
				for (const assignment of assignments) {
					if (assignment.assignedTo !== agentId) {
						agentIds.add(assignment.assignedTo);
					}
				}
			} else {
				// Check if this message was sent TO the specified agent
				const [assignment] = await db
					.select({ id: readingAssignments.id })
					.from(readingAssignments)
					.where(and(
						eq(readingAssignments.contentId, message.id),
						eq(readingAssignments.assignedToType, 'agent'),
						eq(readingAssignments.assignedTo, agentId)
					))
					.limit(1);
				
				if (assignment && message.authorAgentId) {
					agentIds.add(message.authorAgentId);
				}
			}
		}

		// Get agent details for each unique agent
		const dmAgents = await Promise.all(
			Array.from(agentIds).map(async (otherAgentId) => {
				// Get agent details
				const [agent] = await db
					.select({
						id: agents.id,
						roleType: agents.roleType,
						status: agents.status,
					})
					.from(agents)
					.where(eq(agents.id, otherAgentId))
					.limit(1);

				if (!agent) {
					// Handle special case for human-director or other system agents
					return {
						id: otherAgentId,
						roleType: otherAgentId === 'human-director' ? 'Human Director' : otherAgentId,
						status: 'online',
						lastMessageDate: null
					};
				}

				// Get the most recent message date with this agent
				// We need to check reading assignments to find messages between these agents
				const messagesQuery = await db
					.select({ 
						id: content.id,
						createdAt: content.createdAt,
						authorAgentId: content.authorAgentId 
					})
					.from(content)
					.where(and(
						eq(content.projectId, parseInt(projectId)),
						isNull(content.channelId),
						or(
							eq(content.authorAgentId, agentId),
							eq(content.authorAgentId, otherAgentId)
						)
					))
					.orderBy(content.createdAt);

				// Filter messages that are actually between these two agents
				let lastMessageDate = null;
				for (const message of messagesQuery) {
					const assignments = await db
						.select({ assignedTo: readingAssignments.assignedTo })
						.from(readingAssignments)
						.where(and(
							eq(readingAssignments.contentId, message.id),
							eq(readingAssignments.assignedToType, 'agent')
						));

					// Check if message is between the two agents
					const isRelevant = (
						(message.authorAgentId === agentId && assignments.some(a => a.assignedTo === otherAgentId)) ||
						(message.authorAgentId === otherAgentId && assignments.some(a => a.assignedTo === agentId))
					);

					if (isRelevant) {
						lastMessageDate = message.createdAt;
					}
				}

				return {
					...agent,
					lastMessageDate: lastMessageDate
				};
			})
		);

		// Sort by most recent message date (desc)
		const sortedAgents = dmAgents
			.filter(agent => agent !== null)
			.sort((a, b) => {
				if (!a.lastMessageDate && !b.lastMessageDate) return 0;
				if (!a.lastMessageDate) return 1;
				if (!b.lastMessageDate) return -1;
				return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
			});

		return json(sortedAgents);
	} catch (error: unknown) {
		console.error('Failed to load DM agents:', error);
		return json({ error: 'Failed to load DM agents' }, { status: 500 });
	}
}