import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { readingAssignments, readingAssignmentReads } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST({ params, request }) {
	try {
		const documentId = parseInt(params.id);
		const { agentId, acknowledged = true } = await request.json();
		
		if (isNaN(documentId)) {
			return json({ error: 'Invalid document ID' }, { status: 400 });
		}

		if (!agentId) {
			return json({ error: 'Agent ID is required' }, { status: 400 });
		}

		// Find all reading assignments for this document that apply to this agent
		const assignments = await db
			.select({
				id: readingAssignments.id,
				assignedToType: readingAssignments.assignedToType,
				assignedTo: readingAssignments.assignedTo
			})
			.from(readingAssignments)
			.where(eq(readingAssignments.contentId, documentId));

		// Filter assignments that apply to this agent
		// This would need to be enhanced to check role/squad assignments
		const applicableAssignments = assignments.filter(assignment => {
			if (assignment.assignedToType === 'agent') {
				return assignment.assignedTo === agentId;
			}
			// TODO: Add logic for role and squad assignments
			return false;
		});

		if (applicableAssignments.length === 0) {
			return json({ error: 'No reading assignments found for this agent' }, { status: 404 });
		}

		// Mark as read for all applicable assignments
		for (const assignment of applicableAssignments) {
			// Check if already marked as read
			const existingRead = await db
				.select()
				.from(readingAssignmentReads)
				.where(and(
					eq(readingAssignmentReads.readingAssignmentId, assignment.id),
					eq(readingAssignmentReads.agentId, agentId)
				))
				.limit(1);

			if (existingRead.length === 0) {
				// Create new read record
				await db
					.insert(readingAssignmentReads)
					.values({
						readingAssignmentId: assignment.id,
						agentId,
						acknowledged
					});
			} else {
				// Update existing read record
				await db
					.update(readingAssignmentReads)
					.set({ acknowledged, readAt: new Date() })
					.where(and(
						eq(readingAssignmentReads.readingAssignmentId, assignment.id),
						eq(readingAssignmentReads.agentId, agentId)
					));
			}
		}

		return json({ success: true, markedAssignments: applicableAssignments.length });
	} catch (error) {
		console.error('Failed to mark document as read:', error);
		return json({ error: 'Failed to mark document as read' }, { status: 500 });
	}
}