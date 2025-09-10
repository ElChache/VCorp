import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content } from '$lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export async function GET({ params }) {
	try {
		const documentId = parseInt(params.id);
		
		if (isNaN(documentId)) {
			return json({ error: 'Invalid document ID' }, { status: 400 });
		}

		// Get all replies for this document and its nested threads
		// First get direct replies to the document
		const directReplies = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				parentContentId: content.parentContentId,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt
			})
			.from(content)
			.where(and(
				eq(content.type, 'reply'),
				eq(content.parentContentId, documentId)
			))
			.orderBy(desc(content.createdAt));

		// Get all nested replies (replies to replies) by getting all replies where parentContentId is one of the reply IDs
		let allReplies = [...directReplies];
		if (directReplies.length > 0) {
			const replyIds = directReplies.map(r => r.id);
			const nestedReplies = await db
				.select({
					id: content.id,
					title: content.title,
					body: content.body,
					parentContentId: content.parentContentId,
					authorAgentId: content.authorAgentId,
					createdAt: content.createdAt
				})
				.from(content)
				.where(and(
					eq(content.type, 'reply'),
					inArray(content.parentContentId, replyIds)
				))
				.orderBy(desc(content.createdAt));
			
			allReplies = [...directReplies, ...nestedReplies];
		}

		// Build nested structure
		const buildReplyTree = (replies: any[], parentId: number | null = documentId) => {
			return replies
				.filter(reply => reply.parentContentId === parentId)
				.map(reply => ({
					...reply,
					replies: buildReplyTree(replies, reply.id)
				}));
		};

		const nestedReplies = buildReplyTree(allReplies);

		return json(nestedReplies);
	} catch (error) {
		console.error('Failed to fetch document replies:', error);
		return json({ error: 'Failed to fetch document replies' }, { status: 500 });
	}
}

export async function POST({ params, request }) {
	try {
		const documentId = parseInt(params.id);
		const { body, authorAgentId, parentContentId } = await request.json();
		
		if (isNaN(documentId)) {
			return json({ error: 'Invalid document ID' }, { status: 400 });
		}

		if (!body?.trim()) {
			return json({ error: 'Reply body is required' }, { status: 400 });
		}

		// Get the original document to inherit project ID
		const [document] = await db
			.select({
				projectId: content.projectId
			})
			.from(content)
			.where(eq(content.id, documentId))
			.limit(1);

		if (!document) {
			return json({ error: 'Document not found' }, { status: 404 });
		}

		// Create the reply
		const [newReply] = await db
			.insert(content)
			.values({
				projectId: document.projectId,
				parentContentId: parentContentId || documentId,
				type: 'reply',
				title: null, // Replies don't have titles
				body: body.trim(),
				authorAgentId: (authorAgentId && authorAgentId !== 'human-director') ? authorAgentId : null,
			})
			.returning();

		return json(newReply, { status: 201 });
	} catch (error) {
		console.error('Failed to create reply:', error);
		return json({ error: 'Failed to create reply' }, { status: 500 });
	}
}