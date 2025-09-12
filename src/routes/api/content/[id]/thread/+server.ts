import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content } from '$lib/db/schema';
import { eq, desc, asc, sql } from 'drizzle-orm';

// GET /api/content/[id]/thread - Get paginated thread for a message/document
export async function GET({ params, url }) {
	try {
		const contentId = params.id;
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100); // Max 100 per page
		const sort = url.searchParams.get('sort') || 'asc'; // 'asc' or 'desc'

		// Validate contentId
		const parsedContentId = parseInt(contentId);
		if (isNaN(parsedContentId) || parsedContentId <= 0) {
			return json({ 
				error: 'Invalid content ID: must be a positive integer'
			}, { status: 400 });
		}

		// Validate page and limit
		if (page < 1) {
			return json({ 
				error: 'Invalid page: must be 1 or greater'
			}, { status: 400 });
		}

		if (limit < 1) {
			return json({ 
				error: 'Invalid limit: must be 1 or greater'
			}, { status: 400 });
		}

		// Validate sort parameter
		if (sort !== 'asc' && sort !== 'desc') {
			return json({ 
				error: 'Invalid sort parameter: must be "asc" or "desc"'
			}, { status: 400 });
		}

		// Get the original content (this should be the root of the thread)
		const [originalContent] = await db
			.select({
				id: content.id,
				projectId: content.projectId,
				channelId: content.channelId,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				squadId: content.squadId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
				parentContentId: content.parentContentId
			})
			.from(content)
			.where(eq(content.id, parsedContentId))
			.limit(1);

		if (!originalContent) {
			return json({ 
				error: `Content with ID ${parsedContentId} not found`
			}, { status: 404 });
		}

		// If this content is itself a reply, we want the thread of its parent
		const threadRootId = originalContent.parentContentId || originalContent.id;

		// Get total count of replies for pagination
		const totalRepliesResult = await db
			.select({ count: sql`count(*)`.as('count') })
			.from(content)
			.where(eq(content.parentContentId, threadRootId));
		
		const totalReplies = Number(totalRepliesResult[0]?.count || 0);
		const totalPages = Math.ceil(totalReplies / limit);
		const offset = (page - 1) * limit;

		// Get paginated replies
		const orderBy = sort === 'desc' ? desc(content.createdAt) : asc(content.createdAt);
		
		const replies = await db
			.select({
				id: content.id,
				projectId: content.projectId,
				channelId: content.channelId,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				squadId: content.squadId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
				parentContentId: content.parentContentId
			})
			.from(content)
			.where(eq(content.parentContentId, threadRootId))
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset);

		// Get the actual thread root if we were given a reply ID
		let threadRoot = originalContent;
		if (originalContent.parentContentId) {
			const [root] = await db
				.select({
					id: content.id,
					projectId: content.projectId,
					channelId: content.channelId,
					type: content.type,
					title: content.title,
					body: content.body,
					authorAgentId: content.authorAgentId,
					squadId: content.squadId,
					createdAt: content.createdAt,
					updatedAt: content.updatedAt,
					parentContentId: content.parentContentId
				})
				.from(content)
				.where(eq(content.id, originalContent.parentContentId))
				.limit(1);
			
			if (root) {
				threadRoot = root;
			}
		}

		return json({
			originalContent: threadRoot,
			replies: replies,
			pagination: {
				page: page,
				limit: limit,
				total: totalReplies,
				pages: totalPages,
				hasNext: page < totalPages,
				hasPrev: page > 1
			},
			meta: {
				sort: sort,
				requestedContentId: parsedContentId,
				threadRootId: threadRootId,
				isReply: originalContent.parentContentId !== null
			}
		});

	} catch (error) {
		console.error('Failed to get thread:', error);
		
		// Provide specific error messages
		if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === '23503') {
			return json({ 
				error: 'Database constraint violation: The content may not exist or may be invalid.'
			}, { status: 404 });
		}
		
		return json({ 
			error: 'Internal server error occurred while fetching thread. Please try again or contact support if the problem persists.',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}