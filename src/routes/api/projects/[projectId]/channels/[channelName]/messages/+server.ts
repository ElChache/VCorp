import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { channels, content } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/projects/[projectId]/channels/[channelName]/messages - Post message to channel by name
export async function POST({ params, request }) {
	try {
		const { projectId, channelName } = params;
		const { type = 'message', title, body, authorAgentId, squadId } = await request.json();

		if (!projectId || !channelName) {
			return json({ error: 'Project ID and channel name are required' }, { status: 400 });
		}

		if (!body?.trim()) {
			return json({ error: 'Message body is required' }, { status: 400 });
		}

		// Find the channel by project ID and name
		const [channel] = await db
			.select()
			.from(channels)
			.where(and(
				eq(channels.projectId, parseInt(projectId)),
				eq(channels.name, channelName)
			))
			.limit(1);

		if (!channel) {
			return json({ error: `Channel '${channelName}' not found in project ${projectId}` }, { status: 404 });
		}

		// Create the message
		const [newMessage] = await db
			.insert(content)
			.values({
				projectId: parseInt(projectId),
				channelId: channel.id,
				type: type.trim(),
				title: title?.trim() || null,
				body: body.trim(),
				authorAgentId: authorAgentId?.trim() || null,
				squadId: squadId?.trim() || null,
			})
			.returning();

		return json(newMessage, { status: 201 });
	} catch (error) {
		console.error('Failed to post message:', error);
		return json({ error: 'Failed to post message' }, { status: 500 });
	}
}

// GET /api/projects/[projectId]/channels/[channelName]/messages - Get messages from channel by name
export async function GET({ params, url }) {
	try {
		const { projectId, channelName } = params;
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		if (!projectId || !channelName) {
			return json({ error: 'Project ID and channel name are required' }, { status: 400 });
		}

		// Find the channel by project ID and name
		const [channel] = await db
			.select()
			.from(channels)
			.where(and(
				eq(channels.projectId, parseInt(projectId)),
				eq(channels.name, channelName)
			))
			.limit(1);

		if (!channel) {
			return json({ error: `Channel '${channelName}' not found in project ${projectId}` }, { status: 404 });
		}

		// Get messages from the channel
		const messages = await db
			.select()
			.from(content)
			.where(eq(content.channelId, channel.id))
			.orderBy(content.createdAt)
			.limit(limit)
			.offset(offset);

		return json({
			channel: {
				id: channel.id,
				name: channel.name,
				description: channel.description
			},
			messages,
			pagination: {
				limit,
				offset,
				count: messages.length
			}
		});
	} catch (error) {
		console.error('Failed to get messages:', error);
		return json({ error: 'Failed to get messages' }, { status: 500 });
	}
}