import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/content/[id]/replies - Get all replies to a specific content item
export async function GET({ params }) {
	try {
		const contentId = parseInt(params.id);
		
		if (isNaN(contentId)) {
			return json({ error: 'Invalid content ID' }, { status: 400 });
		}

		// Verify parent content exists
		const [parentContent] = await db
			.select()
			.from(content)
			.where(eq(content.id, contentId))
			.limit(1);

		if (!parentContent) {
			return json({ error: 'Content not found' }, { status: 404 });
		}

		// Get all replies to this content
		const replies = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				authorAgentId: content.authorAgentId,
				channelId: content.channelId,
				parentContentId: content.parentContentId,
				createdAt: content.createdAt,
			})
			.from(content)
			.where(eq(content.parentContentId, contentId))
			.orderBy(content.createdAt);

		// For each reply, get reading assignments and read status
		const repliesWithAssignments = await Promise.all(
			replies.map(async (reply) => {
				// Get reading assignments for this reply
				const assignments = await db
					.select({
						id: readingAssignments.id,
						assignedToType: readingAssignments.assignedToType,
						assignedTo: readingAssignments.assignedTo,
						assignedAt: readingAssignments.assignedAt,
					})
					.from(readingAssignments)
					.where(eq(readingAssignments.contentId, reply.id));

				// Get read status for each assignment
				const assignmentsWithReads = await Promise.all(
					assignments.map(async (assignment) => {
						const reads = await db
							.select({
								agentId: readingAssignmentReads.agentId,
								readAt: readingAssignmentReads.readAt,
								acknowledged: readingAssignmentReads.acknowledged,
							})
							.from(readingAssignmentReads)
							.where(eq(readingAssignmentReads.readingAssignmentId, assignment.id));

						return {
							...assignment,
							readBy: reads,
							readCount: reads.length
						};
					})
				);

				return {
					...reply,
					readingAssignments: assignmentsWithReads
				};
			})
		);

		return json({
			parentContent: {
				id: parentContent.id,
				title: parentContent.title,
				type: parentContent.type,
				authorAgentId: parentContent.authorAgentId,
				createdAt: parentContent.createdAt
			},
			replies: repliesWithAssignments,
			totalReplies: replies.length
		});

	} catch (error) {
		console.error('Failed to fetch replies:', error);
		return json({ error: 'Failed to fetch replies' }, { status: 500 });
	}
}