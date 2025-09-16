import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents, content, readingAssignments } from '$lib/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';

// GET /api/dm-oversight/[agentId]/conversations - Get all DM conversations for a specific agent
export async function GET({ params, url }) {
	try {
		const agentId = params.agentId;
		const projectId = parseInt(url.searchParams.get('projectId') || '0');
		
		if (!projectId) {
			return json({ error: 'projectId is required' }, { status: 400 });
		}

		console.log(`🔍 Getting DM conversations for agent ${agentId} in project ${projectId}`);

		// Verify the agent exists and is not Human Director
		const agent = await db
			.select({
				id: agents.id,
				roleType: agents.roleType,
				isHumanDirector: agents.isHumanDirector
			})
			.from(agents)
			.where(and(
				eq(agents.id, agentId),
				eq(agents.projectId, projectId)
			))
			.limit(1);

		if (agent.length === 0) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		// Get all DMs involving this agent (sent by them or received by them) 
		// but EXCLUDE any DMs involving the Human Director
		const dmConversations = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt,
				// Get author info
				authorRoleType: sql<string>`author_agent.role_type`,
				// Get recipient info via reading assignments
				recipientAgentId: sql<string>`recipient_agent.id`,
				recipientRoleType: sql<string>`recipient_agent.role_type`
			})
			.from(content)
			.innerJoin(
				agents.as('author_agent'),
				eq(agents.id, content.authorAgentId)
			)
			.innerJoin(readingAssignments, eq(readingAssignments.contentId, content.id))
			.innerJoin(
				agents.as('recipient_agent'), 
				eq(agents.id, readingAssignments.assignedTo)
			)
			.where(and(
				eq(content.projectId, projectId),
				eq(content.type, 'message'),
				eq(content.channelId, null), // DMs have null channelId
				eq(readingAssignments.assignedToType, 'agent'),
				// Include DMs where this agent is either sender or recipient
				or(
					eq(content.authorAgentId, agentId),
					eq(readingAssignments.assignedTo, agentId)
				),
				// EXCLUDE any DMs involving Human Director
				eq(sql`author_agent.is_human_director`, false),
				eq(sql`recipient_agent.is_human_director`, false)
			))
			.orderBy(desc(content.createdAt));

		// Group conversations by the OTHER agent (the one who isn't the selected agent)
		const conversationsByAgent = new Map();
		
		dmConversations.forEach(dm => {
			const otherAgentId = dm.authorAgentId === agentId ? dm.recipientAgentId : dm.authorAgentId;
			const otherAgentRole = dm.authorAgentId === agentId ? dm.recipientRoleType : dm.authorRoleType;
			
			if (!conversationsByAgent.has(otherAgentId)) {
				conversationsByAgent.set(otherAgentId, {
					otherAgentId,
					otherAgentRole,
					messages: []
				});
			}
			
			conversationsByAgent.get(otherAgentId).messages.push({
				id: dm.id,
				title: dm.title,
				body: dm.body,
				authorAgentId: dm.authorAgentId,
				authorRoleType: dm.authorRoleType,
				recipientAgentId: dm.recipientAgentId,
				recipientRoleType: dm.recipientRoleType,
				createdAt: dm.createdAt,
				sentBySelectedAgent: dm.authorAgentId === agentId,
				direction: dm.authorAgentId === agentId ? 'sent' : 'received'
			});
		});

		// Convert to array and add conversation metadata
		const conversations = Array.from(conversationsByAgent.values()).map(conv => ({
			...conv,
			messageCount: conv.messages.length,
			lastMessageAt: conv.messages[0]?.createdAt,
			messages: conv.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
		}));

		// Sort conversations by most recent activity
		conversations.sort((a, b) => 
			new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
		);

		console.log(`✅ Found ${conversations.length} DM conversations for agent ${agentId}`);

		return json({
			agentId,
			agentRole: agent[0].roleType,
			conversations,
			totalDmMessages: dmConversations.length,
			conversationPartners: conversations.length
		});

	} catch (error) {
		console.error(`Failed to get DM conversations for agent ${agentId}:`, error);
		return json({ error: 'Failed to get DM conversations' }, { status: 500 });
	}
}