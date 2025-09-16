import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/projects/[id]/message-director - Send a direct message to the human director for a project
export async function POST({ request, params }: RequestEvent) {
	try {
		if (!params.id) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}
		const projectId = parseInt(params.id || '');
		const {
			authorAgentId,
			title,
			body,
			parentContentId, // Optional - for replies
			type = 'message'
		} = await request.json();

		// Validate required fields
		if (!projectId || isNaN(projectId)) {
			return json({ 
				error: 'Invalid project ID'
			}, { status: 400 });
		}

		if (!body?.trim()) {
			return json({ 
				error: 'Message body is required'
			}, { status: 400 });
		}

		// Find the human director for this project dynamically
		const [humanDirector] = await db
			.select()
			.from(agents)
			.where(and(
				eq(agents.projectId, projectId),
				eq(agents.isHumanDirector, true)
			))
			.limit(1);

		if (!humanDirector) {
			return json({ 
				error: 'No human director found for this project'
			}, { status: 404 });
		}

		// Create the direct message content
		const [messageContent] = await db
			.insert(content)
			.values({
				projectId: projectId,
				channelId: null, // Direct message, no channel
				parentContentId: parentContentId || null,
				type: type,
				title: title || null,
				body: body.trim(),
				authorAgentId: authorAgentId || null,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning();

		// Create reading assignment for the human director
		await db
			.insert(readingAssignments)
			.values({
				contentId: messageContent.id,
				assignedToType: 'agent',
				assignedTo: humanDirector.id,
				assignedAt: new Date()
			});

		console.log(`📨 Direct message sent to human director ${humanDirector.id} for project ${projectId}`);

		return json({
			success: true,
			messageId: messageContent.id,
			humanDirectorId: humanDirector.id,
			message: 'Message sent to human director'
		}, { status: 201 });

	} catch (error: unknown) {
		console.error('Failed to send message to human director:', error);
		return json({ 
			error: 'Failed to send message to human director: ' + (error as Error).message 
		}, { status: 500 });
	}
}