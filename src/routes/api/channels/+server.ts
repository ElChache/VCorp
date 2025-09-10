import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { channels } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/channels?projectId=123 - List channels for a project
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		const projectChannels = await db
			.select()
			.from(channels)
			.where(eq(channels.projectId, parseInt(projectId)))
			.orderBy(channels.createdAt);

		return json(projectChannels);
	} catch (error) {
		console.error('Failed to load channels:', error);
		return json({ error: 'Failed to load channels' }, { status: 500 });
	}
}

// POST /api/channels - Create new channel
export async function POST({ request }) {
	try {
		const { name, description, promptForAgents, isMainChannel, projectId } = await request.json();
		
		if (!name?.trim() || !projectId) {
			return json({ error: 'Channel name and project ID are required' }, { status: 400 });
		}

		// Check if channel name already exists in this project (for uniqueness)
		const [existingChannel] = await db
			.select()
			.from(channels)
			.where(and(
				eq(channels.name, name.trim()),
				eq(channels.projectId, parseInt(projectId))
			))
			.limit(1);

		if (existingChannel) {
			return json({ error: 'Channel name already exists in this project' }, { status: 400 });
		}

		// If this is set as main channel, unset other main channels in this project
		if (isMainChannel) {
			await db
				.update(channels)
				.set({ isMainChannel: false })
				.where(eq(channels.projectId, parseInt(projectId)));
		}

		const [newChannel] = await db
			.insert(channels)
			.values({
				projectId: parseInt(projectId),
				name: name.trim(),
				description: description?.trim() || null,
				promptForAgents: promptForAgents?.trim() || null,
				isMainChannel: isMainChannel || false
			})
			.returning();

		return json(newChannel);
	} catch (error) {
		console.error('Failed to create channel:', error);
		return json({ error: 'Failed to create channel' }, { status: 500 });
	}
}