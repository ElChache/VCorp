import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { channels } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/channels/[id] - Get single channel
export async function GET({ params }: RequestEvent) {
	try {
		const { id } = params;
		
		if (!id) {
			return json({ error: 'Channel ID is required' }, { status: 400 });
		}
		
		const channelId = parseInt(id);
		if (isNaN(channelId)) {
			return json({ error: 'Invalid channel ID' }, { status: 400 });
		}
		
		const [channel] = await db
			.select()
			.from(channels)
			.where(eq(channels.id, channelId))
			.limit(1);

		if (!channel) {
			return json({ error: 'Channel not found' }, { status: 404 });
		}

		return json(channel);
	} catch (error: unknown) {
		console.error('Failed to get channel:', error);
		return json({ error: 'Failed to get channel' }, { status: 500 });
	}
}

// PUT /api/channels/[id] - Update channel
export async function PUT({ params, request }: RequestEvent) {
	try {
		const { id: channelId } = params;
		const { id: newId, name, description, promptForAgents, isMainChannel } = await request.json();
		
		if (!channelId) {
			return json({ error: 'Channel ID is required' }, { status: 400 });
		}
		
		const currentChannelId = parseInt(channelId);
		if (isNaN(currentChannelId)) {
			return json({ error: 'Invalid channel ID' }, { status: 400 });
		}
		
		if (!newId?.trim() || !name?.trim()) {
			return json({ error: 'Channel ID and name are required' }, { status: 400 });
		}

		// Get the current channel to check project
		const [currentChannel] = await db
			.select()
			.from(channels)
			.where(eq(channels.id, currentChannelId))
			.limit(1);

		if (!currentChannel) {
			return json({ error: 'Channel not found' }, { status: 404 });
		}

		// If ID is changing, check if new ID already exists
		const newChannelId = parseInt(newId);
		if (isNaN(newChannelId)) {
			return json({ error: 'Invalid new channel ID' }, { status: 400 });
		}
		
		if (newChannelId !== currentChannelId) {
			const [existingChannel] = await db
				.select()
				.from(channels)
				.where(and(
					eq(channels.id, newChannelId),
					eq(channels.projectId, currentChannel.projectId)
				))
				.limit(1);

			if (existingChannel) {
				return json({ error: 'Channel ID already exists in this project' }, { status: 400 });
			}
		}

		// If this is set as default, unset other defaults in this project
		if (isMainChannel) {
			await db
				.update(channels)
				.set({ isMainChannel: false })
				.where(eq(channels.projectId, currentChannel.projectId));
		}

		const [updatedChannel] = await db
			.update(channels)
			.set({
				id: newChannelId,
				name: name.trim(),
				description: description?.trim() || null,
				promptForAgents: promptForAgents?.trim() || null,
				isMainChannel: isMainChannel || false
			})
			.where(eq(channels.id, currentChannelId))
			.returning();

		return json(updatedChannel);
	} catch (error: unknown) {
		console.error('Failed to update channel:', error);
		return json({ error: 'Failed to update channel' }, { status: 500 });
	}
}

// DELETE /api/channels/[id] - Delete channel
export async function DELETE({ params }: RequestEvent) {
	try {
		const { id } = params;
		
		if (!id) {
			return json({ error: 'Channel ID is required' }, { status: 400 });
		}
		
		const channelId = parseInt(id);
		if (isNaN(channelId)) {
			return json({ error: 'Invalid channel ID' }, { status: 400 });
		}
		
		const [deletedChannel] = await db
			.delete(channels)
			.where(eq(channels.id, channelId))
			.returning();

		if (!deletedChannel) {
			return json({ error: 'Channel not found' }, { status: 404 });
		}

		return json({ success: true, message: 'Channel deleted successfully' });
	} catch (error: unknown) {
		console.error('Failed to delete channel:', error);
		return json({ error: 'Failed to delete channel' }, { status: 500 });
	}
}