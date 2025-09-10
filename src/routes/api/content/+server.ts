import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET({ url }) {
	try {
		const type = url.searchParams.get('type');
		const projectId = url.searchParams.get('projectId');
		
		let query = db.select().from(content);
		
		// Filter by type if specified
		if (type) {
			query = query.where(eq(content.type, type));
		}
		
		// Filter by project if specified
		if (projectId) {
			const projectIdInt = parseInt(projectId);
			if (!isNaN(projectIdInt)) {
				query = query.where(eq(content.projectId, projectIdInt));
			}
		}
		
		// Order by created date (newest first)
		query = query.orderBy(desc(content.createdAt));
		
		const results = await query;
		
		return json(results);
	} catch (error) {
		console.error('Failed to fetch content:', error);
		return json({ error: 'Failed to fetch content' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { 
			projectId, 
			type, 
			title, 
			body: contentBody, 
			assignedToRoleType,
			status,
			priority,
			acceptanceCriteria,
			documentSlug,
			channelId,
			parentContentId,
			authorAgentId,
			squadId,
			claimedByAgent,
			phaseStatus,
			requiredInputs,
			expectedOutputs
		} = body;

		if (!type || !title) {
			return json({ error: 'Type and title are required' }, { status: 400 });
		}

		const newContent = await db
			.insert(content)
			.values({
				projectId: projectId || null,
				type,
				title,
				body: contentBody || '',
				assignedToRoleType,
				status,
				priority,
				acceptanceCriteria,
				documentSlug,
				channelId: channelId || null,
				parentContentId: parentContentId || null,
				authorAgentId,
				squadId,
				claimedByAgent,
				phaseStatus,
				requiredInputs,
				expectedOutputs,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning();

		return json(newContent[0]);
	} catch (error) {
		console.error('Failed to create content:', error);
		return json({ error: 'Failed to create content' }, { status: 500 });
	}
}