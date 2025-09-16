import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content } from '$lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET({ url }: RequestEvent) {
	try {
		const type = url.searchParams.get('type');
		const projectId = url.searchParams.get('projectId');
		
		// Build conditions array
		const conditions: any[] = [];
		
		// Filter by type if specified
		if (type) {
			conditions.push(eq(content.type, type));
		}
		
		// Filter by project if specified
		if (projectId) {
			const projectIdInt = parseInt(projectId);
			if (!isNaN(projectIdInt)) {
				conditions.push(eq(content.projectId, projectIdInt));
			}
		}
		
		// Build final query
		const baseQuery = db.select().from(content);
		const queryWithConditions = conditions.length > 0 
			? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
			: baseQuery;
		const finalQuery = queryWithConditions.orderBy(desc(content.createdAt));
		
		const results = await finalQuery;
		
		return json(results);
	} catch (error: unknown) {
		console.error('Failed to fetch content:', error);
		return json({ error: 'Failed to fetch content' }, { status: 500 });
	}
}

export async function POST({ request }: RequestEvent) {
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
	} catch (error: unknown) {
		console.error('Failed to create content:', error);
		return json({ error: 'Failed to create content' }, { status: 500 });
	}
}