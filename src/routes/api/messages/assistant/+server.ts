import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, agents, roles } from '$lib/db/schema';
import { eq, desc, or, and, isNull } from 'drizzle-orm';

// GET /api/messages/assistant?projectId=<id> - Get messages between director and director assistant
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		console.log(`🤖 Loading assistant messages for project ${projectId}`);

		// Get all DM messages (channelId is null) that are either:
		// 1. From director_assistant agents (authorAgentId with director_assistant role)
		// 2. To director_assistant agents (messages from human director with reading assignments to director_assistant role)
		
		// First, get all agents with Director Assistant role for this project
		const assistantAgents = await db
			.select({ id: agents.id })
			.from(agents)
			.where(
				and(
					eq(agents.projectId, parseInt(projectId)),
					eq(agents.roleType, 'Director Assistant')
				)
			);
		
		const assistantAgentIds = assistantAgents.map(a => a.id);

		// Get all DM messages from assistant agents
		let messages = [];
		
		if (assistantAgentIds.length > 0) {
			messages = await db
				.select({
					id: content.id,
					type: content.type,
					title: content.title,
					body: content.body,
					authorAgentId: content.authorAgentId,
					createdAt: content.createdAt,
					updatedAt: content.updatedAt,
				})
				.from(content)
				.where(
					and(
						eq(content.projectId, parseInt(projectId)),
						isNull(content.channelId), // DM messages only
						eq(content.type, 'message'), // Only message type
						or(...assistantAgentIds.map(id => eq(content.authorAgentId, id)))
					)
				)
				.orderBy(desc(content.createdAt));
		}

		console.log(`✅ Loaded ${messages.length} assistant messages`);

		return json({
			messages: messages.map(msg => ({
				...msg,
				isDM: true,
				isReply: false,
				isFromAssistant: assistantAgentIds.includes(msg.authorAgentId),
				isFromDirector: false // No longer including director messages
			}))
		});

	} catch (error) {
		console.error('Failed to load assistant messages:', error);
		return json({ error: 'Failed to load assistant messages' }, { status: 500 });
	}
}