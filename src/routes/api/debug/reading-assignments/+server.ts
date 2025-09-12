import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { readingAssignments, content } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'projectId is required' }, { status: 400 });
		}

		// Get recent reading assignments for this project
		const assignments = await db
			.select({
				assignmentId: readingAssignments.id,
				contentId: readingAssignments.contentId,
				assignedToType: readingAssignments.assignedToType,
				assignedTo: readingAssignments.assignedTo,
				assignedAt: readingAssignments.assignedAt,
				messageTitle: content.title,
				messageBody: content.body,
				messageAuthor: content.authorAgentId,
				messageCreatedAt: content.createdAt
			})
			.from(readingAssignments)
			.innerJoin(content, eq(readingAssignments.contentId, content.id))
			.where(eq(content.projectId, parseInt(projectId)))
			.orderBy(desc(readingAssignments.assignedAt))
			.limit(20);

		return json({
			total: assignments.length,
			assignments
		});
	} catch (error) {
		console.error('Failed to fetch reading assignments:', error);
		return json({ error: 'Failed to fetch reading assignments' }, { status: 500 });
	}
}