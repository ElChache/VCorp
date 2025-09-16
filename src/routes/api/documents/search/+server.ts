import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content } from '$lib/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';

// GET /api/documents/search - Full-text search for documents
export async function GET({ url }) {
	try {
		const projectId = parseInt(url.searchParams.get('projectId') || '');
		const query = url.searchParams.get('q') || url.searchParams.get('query');
		const authorId = url.searchParams.get('authorId');
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		if (!query) {
			return json({ error: 'Search query is required' }, { status: 400 });
		}

		if (limit > 50) {
			return json({ error: 'Search limit cannot exceed 50' }, { status: 400 });
		}

		// Build search conditions
		const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
		
		const conditions = [
			eq(content.projectId, projectId),
			eq(content.type, 'document')
		];

		// Add author filter if provided
		if (authorId) {
			conditions.push(eq(content.authorAgentId, authorId));
		}

		// Build search conditions for title and body
		const searchConditions = searchTerms.map(term => 
			or(
				sql`LOWER(${content.title}) LIKE ${`%${term}%`}`,
				sql`LOWER(${content.body}) LIKE ${`%${term}%`}`
			)
		);

		// Combine all conditions
		const allConditions = [
			and(...conditions),
			or(...searchConditions)
		];

		const documents = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				documentSlug: content.documentSlug,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
				// Simple relevance scoring based on title matches
				relevance: sql`
					CASE 
						WHEN LOWER(${content.title}) LIKE ${`%${query.toLowerCase()}%`} THEN 10
						WHEN LOWER(${content.body}) LIKE ${`%${query.toLowerCase()}%`} THEN 5
						ELSE 1
					END
				`.as('relevance')
			})
			.from(content)
			.where(and(...allConditions))
			.orderBy(desc(sql`relevance`), desc(content.updatedAt))
			.limit(limit)
			.offset(offset);

		// Generate search snippets
		const documentsWithSnippets = documents.map(doc => {
			const snippet = generateSearchSnippet(doc.body, query, 150);
			return {
				...doc,
				snippet,
				matchesInTitle: countMatches(doc.title, query),
				matchesInBody: countMatches(doc.body, query)
			};
		});

		return json({
			query,
			documents: documentsWithSnippets,
			pagination: {
				limit,
				offset,
				total: documents.length,
				hasMore: documents.length === limit
			},
			filters: {
				authorId: authorId || null
			}
		});
	} catch (error) {
		console.error('Failed to search documents:', error);
		return json({ error: 'Failed to search documents' }, { status: 500 });
	}
}

// Helper function to generate search snippet with highlighted context
function generateSearchSnippet(text: string, query: string, maxLength: number): string {
	if (!text || !query) return '';
	
	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();
	
	// Find first occurrence of query terms
	const terms = lowerQuery.split(/\s+/);
	let earliestIndex = text.length;
	
	for (const term of terms) {
		const index = lowerText.indexOf(term);
		if (index !== -1 && index < earliestIndex) {
			earliestIndex = index;
		}
	}
	
	if (earliestIndex === text.length) {
		// No matches found, return beginning of text
		return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
	}
	
	// Create snippet around the match
	const start = Math.max(0, earliestIndex - Math.floor(maxLength / 3));
	const end = Math.min(text.length, start + maxLength);
	
	let snippet = text.substring(start, end);
	
	// Add ellipsis if truncated
	if (start > 0) snippet = '...' + snippet;
	if (end < text.length) snippet = snippet + '...';
	
	return snippet;
}

// Helper function to count matches
function countMatches(text: string, query: string): number {
	if (!text || !query) return 0;
	
	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const terms = lowerQuery.split(/\s+/);
	
	let totalMatches = 0;
	for (const term of terms) {
		const matches = lowerText.split(term).length - 1;
		totalMatches += matches;
	}
	
	return totalMatches;
}