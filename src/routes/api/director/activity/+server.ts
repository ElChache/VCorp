import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, agents, channels, readingAssignments } from '$lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

// GET /api/director/activity?projectId=1 - Get activity overview for director dashboard
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		// Get recent activity across all channels and agents
		const recentActivity = await db
			.select({
				messageId: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				authorAgentId: content.authorAgentId,
				channelId: content.channelId,
				channelName: channels.name,
				createdAt: content.createdAt,
				isDirectorChannel: channels.isForHumanDirector,
			})
			.from(content)
			.leftJoin(channels, eq(content.channelId, channels.id))
			.where(eq(content.projectId, parseInt(projectId)))
			.orderBy(desc(content.createdAt))
			.limit(50);

		// Get agent activity stats
		const agentStats = await db
			.select({
				agentId: content.authorAgentId,
				messageCount: sql<number>`cast(count(*) as int)`,
				lastActivity: sql<string>`max(${content.createdAt})`,
			})
			.from(content)
			.where(and(
				eq(content.projectId, parseInt(projectId)),
				sql`${content.authorAgentId} IS NOT NULL`
			))
			.groupBy(content.authorAgentId)
			.orderBy(desc(sql`max(${content.createdAt})`));

		// Get channel activity stats
		const channelStats = await db
			.select({
				channelId: content.channelId,
				channelName: channels.name,
				messageCount: sql<number>`cast(count(*) as int)`,
				lastActivity: sql<string>`max(${content.createdAt})`,
				isDirectorChannel: channels.isForHumanDirector,
			})
			.from(content)
			.innerJoin(channels, eq(content.channelId, channels.id))
			.where(eq(content.projectId, parseInt(projectId)))
			.groupBy(content.channelId, channels.name, channels.isForHumanDirector)
			.orderBy(desc(sql`max(${content.createdAt})`));

		// Get unread message counts for director
		const unreadCounts = await db
			.select({
				total: sql<number>`cast(count(*) as int)`,
			})
			.from(readingAssignments)
			.innerJoin(content, eq(readingAssignments.contentId, content.id))
			.leftJoin(
				sql`reading_assignment_reads`,
				sql`reading_assignment_reads.reading_assignment_id = ${readingAssignments.id} AND reading_assignment_reads.agent_id = 'director'`
			)
			.where(and(
				eq(content.projectId, parseInt(projectId)),
				eq(readingAssignments.assignedToType, 'agent'),
				eq(readingAssignments.assignedTo, 'director'),
				sql`reading_assignment_reads.id IS NULL` // Not read yet
			));

		// Get content type breakdown
		const contentTypeStats = await db
			.select({
				type: content.type,
				count: sql<number>`cast(count(*) as int)`,
			})
			.from(content)
			.where(eq(content.projectId, parseInt(projectId)))
			.groupBy(content.type)
			.orderBy(desc(sql`count(*)`));

		// Calculate time-based metrics
		const now = new Date();
		const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

		const recentCounts = {
			last24Hours: recentActivity.filter(a => new Date(a.createdAt) > last24Hours).length,
			lastHour: recentActivity.filter(a => new Date(a.createdAt) > lastHour).length,
		};

		return json({
			recentActivity: recentActivity.slice(0, 20), // Latest 20 for preview
			agentStats,
			channelStats,
			unreadCount: unreadCounts[0]?.total || 0,
			contentTypeStats,
			timing: recentCounts,
			summary: {
				totalMessages: recentActivity.length,
				activeAgents: agentStats.length,
				activeChannels: channelStats.length,
				directorChannels: channelStats.filter(c => c.isDirectorChannel).length,
				needsAttention: (unreadCounts[0]?.total || 0) > 0,
				recentActivity: recentCounts.last24Hours > 0
			}
		});

	} catch (error) {
		console.error('Failed to load director activity:', error);
		return json({ error: 'Failed to load director activity' }, { status: 500 });
	}
}