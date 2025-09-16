import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { channels, content } from '$lib/db/schema';
import { eq, like, sql, and } from 'drizzle-orm';

// GET /api/channels/search - Search for channels by name or get channel info
export async function GET({ url }: RequestEvent) {
	try {
		const projectId = url.searchParams.get('projectId');
		const name = url.searchParams.get('name');
		const channelId = url.searchParams.get('channelId');

		if (!projectId) {
			return json({ 
				error: 'Missing required parameter: projectId must be provided'
			}, { status: 400 });
		}

		// Validate projectId is a valid number
		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Build conditions
		let conditions = [eq(channels.projectId, parsedProjectId)];

		// If searching by specific channel ID
		if (channelId) {
			const parsedChannelId = parseInt(channelId);
			if (isNaN(parsedChannelId) || parsedChannelId <= 0) {
				return json({ 
					error: 'Invalid channelId: must be a positive integer'
				}, { status: 400 });
			}
			conditions.push(eq(channels.id, parsedChannelId));
		}
		// If searching by name pattern
		else if (name) {
			conditions.push(like(channels.name, `%${name}%`));
		}

		const query = db
			.select({
				id: channels.id,
				name: channels.name,
				description: channels.description,
				isForHumanDirector: channels.isForHumanDirector,
				projectId: channels.projectId,
				createdAt: channels.createdAt
			})
			.from(channels)
			.where(and(...conditions));

		const foundChannels = await query.orderBy(channels.name);

		// For each channel, get message count
		const channelsWithStats = await Promise.all(
			foundChannels.map(async (channel) => {
				const [messageCount] = await db
					.select({ count: sql<number>`count(*)` })
					.from(content)
					.where(eq(content.channelId, channel.id));

				return {
					...channel,
					messageCount: messageCount?.count || 0
				};
			})
		);

		return json({
			channels: channelsWithStats,
			total: channelsWithStats.length
		});

	} catch (error: unknown) {
		console.error('Failed to search channels:', error);
		
		return json({ 
			error: 'Internal server error occurred while searching channels',
			details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
		}, { status: 500 });
	}
}