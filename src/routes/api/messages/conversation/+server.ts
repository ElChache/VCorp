import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments } from '$lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

// GET /api/messages/conversation - Get all DM messages between two agents
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		const agent1 = url.searchParams.get('agent1');
		const agent2 = url.searchParams.get('agent2');
		
		if (!projectId || !agent1 || !agent2) {
			return json({ error: 'projectId, agent1, and agent2 are required' }, { status: 400 });
		}

		// Get all DM messages (channelId = null) between the two agents
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
			})
			.from(content)
			.where(and(
				eq(content.projectId, parseInt(projectId)),
				isNull(content.channelId),
				or(
					and(eq(content.authorAgentId, agent1)),
					and(eq(content.authorAgentId, agent2))
				)
			))
			.orderBy(content.createdAt);

		// Filter messages that are actually between these two agents
		const conversationMessages = [];
		
		for (const message of messages) {
			// For each message, get the reading assignments
			const assignments = await db
				.select({
					id: readingAssignments.id,
					assignedToType: readingAssignments.assignedToType,
					assignedTo: readingAssignments.assignedTo,
					assignedAt: readingAssignments.assignedAt,
				})
				.from(readingAssignments)
				.where(eq(readingAssignments.contentId, message.id));

			// Check if this message is part of the conversation between agent1 and agent2
			const isFromAgent1ToAgent2 = message.authorAgentId === agent1 && 
				assignments.some(a => a.assignedToType === 'agent' && a.assignedTo === agent2);
			
			const isFromAgent2ToAgent1 = message.authorAgentId === agent2 && 
				assignments.some(a => a.assignedToType === 'agent' && a.assignedTo === agent1);

			// Include message if it's between these two agents
			if (isFromAgent1ToAgent2 || isFromAgent2ToAgent1) {
				conversationMessages.push({
					...message,
					readingAssignments: assignments
				});
			}
		}

		const filteredMessages = conversationMessages;

		return json(filteredMessages);
	} catch (error) {
		console.error('Failed to load conversation:', error);
		return json({ error: 'Failed to load conversation' }, { status: 500 });
	}
}