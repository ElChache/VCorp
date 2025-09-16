import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents, content, readingAssignments } from '$lib/db/schema';
import { eq, and, ne, sql, desc } from 'drizzle-orm';

// GET /api/dm-oversight/agents - Get all agents with their inter-agent DM counts
export async function GET({ url }) {
	try {
		const projectId = parseInt(url.searchParams.get('projectId') || '0');
		
		if (!projectId) {
			return json({ error: 'projectId is required' }, { status: 400 });
		}

		console.log(`📊 Getting DM oversight data for project ${projectId}`);

		// Get all agents in the project (excluding Human Director)
		const projectAgents = await db
			.select({
				id: agents.id,
				roleType: agents.roleType,
				status: agents.status,
				isHumanDirector: agents.isHumanDirector
			})
			.from(agents)
			.where(and(
				eq(agents.projectId, projectId),
				eq(agents.isHumanDirector, false) // Exclude Human Director
			))
			.orderBy(agents.roleType);

		if (projectAgents.length === 0) {
			return json([]);
		}

		// Get DM counts for each agent (DMs they sent to other agents, excluding Human Director)
		const agentsWithCounts = await Promise.all(
			projectAgents.map(async (agent) => {
				// Count DMs this agent sent to OTHER AGENTS (not to Human Director)
				const dmCount = await db
					.select({
						count: sql<number>`count(*)`
					})
					.from(content)
					.innerJoin(readingAssignments, eq(readingAssignments.contentId, content.id))
					.innerJoin(agents, eq(agents.id, readingAssignments.assignedTo))
					.where(and(
						eq(content.projectId, projectId),
						eq(content.type, 'message'),
						eq(content.authorAgentId, agent.id),
						eq(content.channelId, null), // DMs have null channelId
						eq(readingAssignments.assignedToType, 'agent'),
						eq(agents.isHumanDirector, false) // Recipient is not Human Director
					));

				// Get count of recent DMs (last 24 hours) for activity indicator
				const recentDmCount = await db
					.select({
						count: sql<number>`count(*)`
					})
					.from(content)
					.innerJoin(readingAssignments, eq(readingAssignments.contentId, content.id))
					.innerJoin(agents, eq(agents.id, readingAssignments.assignedTo))
					.where(and(
						eq(content.projectId, projectId),
						eq(content.type, 'message'),
						eq(content.authorAgentId, agent.id),
						eq(content.channelId, null),
						eq(readingAssignments.assignedToType, 'agent'),
						eq(agents.isHumanDirector, false),
						sql`${content.createdAt} >= NOW() - INTERVAL '24 hours'`
					));

				return {
					...agent,
					totalDmCount: dmCount[0]?.count || 0,
					recentDmCount: recentDmCount[0]?.count || 0
				};
			})
		);

		// Sort by total DM count (most active first)
		agentsWithCounts.sort((a, b) => b.totalDmCount - a.totalDmCount);

		console.log(`✅ Found ${agentsWithCounts.length} agents with DM data`);

		return json(agentsWithCounts);

	} catch (error) {
		console.error('Failed to get DM oversight data:', error);
		return json({ error: 'Failed to get DM oversight data' }, { status: 500 });
	}
}