import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { channels, content } from '$lib/db/schema';
import { eq, like, sql } from 'drizzle-orm';

// GET /api/channels/search - Search for channels by name or get channel info
export async function GET({ url }) {
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

		let query = db
			.select({
				id: channels.id,
				name: channels.name,
				description: channels.description,
				isForHumanDirector: channels.isForHumanDirector,
				projectId: channels.projectId,
				createdAt: channels.createdAt
			})
			.from(channels)
			.where(eq(channels.projectId, parsedProjectId));

		// If searching by specific channel ID
		if (channelId) {
			const parsedChannelId = parseInt(channelId);
			if (isNaN(parsedChannelId) || parsedChannelId <= 0) {
				return json({ 
					error: 'Invalid channelId: must be a positive integer'
				}, { status: 400 });
			}
			query = query.where(eq(channels.id, parsedChannelId));
		}
		// If searching by name pattern
		else if (name) {
			query = query.where(like(channels.name, `%${name}%`));
		}

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

	} catch (error) {
		console.error('Failed to search channels:', error);
		
		return json({ 
			error: 'Internal server error occurred while searching channels',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}