import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET({ url }) {
	try {
		const projectId = parseInt(url.searchParams.get('projectId') || '');
		const slug = url.searchParams.get('slug');
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		if (!slug) {
			return json({ error: 'Document slug is required' }, { status: 400 });
		}

		// Get document by slug for the project
		const [document] = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				documentSlug: content.documentSlug,
				authorAgentId: content.authorAgentId,
				squadId: content.squadId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt
			})
			.from(content)
			.where(and(
				eq(content.projectId, projectId),
				eq(content.documentSlug, slug),
				eq(content.type, 'document')
			))
			.limit(1);

		if (!document) {
			return json({ error: 'Document not found' }, { status: 404 });
		}

		return json(document);
	} catch (error) {
		console.error('Failed to fetch document by slug:', error);
		return json({ error: 'Failed to fetch document' }, { status: 500 });
	}
}