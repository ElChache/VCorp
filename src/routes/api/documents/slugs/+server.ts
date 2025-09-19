import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content } from '$lib/db/schema';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';

// GET /api/documents/slugs - Get available document slugs for a project
export async function GET({ url }: RequestEvent) {
	try {
		const projectId = parseInt(url.searchParams.get('projectId') || '');
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		// Get documents with slugs, prioritizing those without author ID
		const documentsWithSlugs = await db
			.select({
				documentSlug: content.documentSlug,
				title: content.title,
				authorAgentId: content.authorAgentId,
				updatedAt: content.updatedAt
			})
			.from(content)
			.where(and(
				eq(content.projectId, projectId),
				eq(content.type, 'document'),
				isNotNull(content.documentSlug)
			))
			.orderBy(
				// First priority: documents without author (public documents)
				content.authorAgentId,
				// Second priority: most recently updated
				desc(content.updatedAt)
			);

		// Group documents: public first (no authorAgentId), then authored documents
		const publicDocuments = documentsWithSlugs
			.filter(doc => !doc.authorAgentId)
			.map(doc => ({
				slug: doc.documentSlug!,
				title: doc.title || doc.documentSlug!,
				isPublic: true
			}));

		const authoredDocuments = documentsWithSlugs
			.filter(doc => doc.authorAgentId)
			.map(doc => ({
				slug: doc.documentSlug!,
				title: doc.title || doc.documentSlug!,
				isPublic: false,
				authorAgentId: doc.authorAgentId
			}));

		return json({
			slugs: [...publicDocuments, ...authoredDocuments],
			total: documentsWithSlugs.length
		});

	} catch (error: unknown) {
		console.error('Failed to fetch document slugs:', error);
		return json({ 
			error: 'Internal server error occurred while fetching document slugs'
		}, { status: 500 });
	}
}