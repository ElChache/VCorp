import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { readingAssignmentReads } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/reading-assignments/mark-read - Mark a reading assignment as read by an agent
export async function POST({ request }) {
	try {
		const { assignmentId, agentId } = await request.json();

		if (!assignmentId || !agentId) {
			return json({ 
				error: 'assignmentId and agentId are required' 
			}, { status: 400 });
		}

		// Create or update read record - use a simpler approach
		try {
			const [readRecord] = await db
				.insert(readingAssignmentReads)
				.values({
					readingAssignmentId: parseInt(assignmentId),
					agentId: agentId,
					acknowledged: true
				})
				.returning();
			
			return json({
				success: true,
				readRecord
			});
		} catch (insertError) {
			// If insert fails due to conflict, try update
			console.log('Insert failed, trying update:', insertError);
			
			const [readRecord] = await db
				.update(readingAssignmentReads)
				.set({
					readAt: new Date(),
					acknowledged: true
				})
				.where(and(
					eq(readingAssignmentReads.readingAssignmentId, parseInt(assignmentId)),
					eq(readingAssignmentReads.agentId, agentId)
				))
				.returning();
				
			return json({
				success: true,
				readRecord: readRecord || { updated: true }
			});
		}

	} catch (error) {
		console.error('Failed to mark assignment as read:', error);
		return json({ error: 'Failed to mark assignment as read' }, { status: 500 });
	}
}