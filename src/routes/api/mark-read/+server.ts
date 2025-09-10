import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { readingAssignmentReads, readingAssignments, content, agents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/mark-read - Mark a message as read by an agent
export async function POST({ request }) {
	try {
		const { agentId, messageId, acknowledged = false } = await request.json();

		if (!agentId || !messageId) {
			return json({ error: 'agentId and messageId are required' }, { status: 400 });
		}

		// Verify agent exists
		const [agent] = await db
			.select({ id: agents.id, roleType: agents.roleType })
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);

		if (!agent) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		// Find the reading assignment that targets this agent for this message
		const relevantAssignments = await db
			.select({
				id: readingAssignments.id,
				assignedToType: readingAssignments.assignedToType,
				assignedTo: readingAssignments.assignedTo,
			})
			.from(readingAssignments)
			.where(eq(readingAssignments.contentId, parseInt(messageId)));

		// Find which assignment applies to this agent
		let targetAssignmentId = null;
		for (const assignment of relevantAssignments) {
			if (assignment.assignedToType === 'agent' && assignment.assignedTo === agentId) {
				targetAssignmentId = assignment.id;
				break;
			} else if (assignment.assignedToType === 'role' && assignment.assignedTo === agent.roleType) {
				targetAssignmentId = assignment.id;
				break;
			}
			// TODO: Add squad logic when squads are implemented
		}

		if (!targetAssignmentId) {
			return json({ error: 'No reading assignment found for this agent and message' }, { status: 404 });
		}

		// Check if already read
		const [existingRead] = await db
			.select({ id: readingAssignmentReads.id })
			.from(readingAssignmentReads)
			.where(and(
				eq(readingAssignmentReads.readingAssignmentId, targetAssignmentId),
				eq(readingAssignmentReads.agentId, agentId)
			))
			.limit(1);

		if (existingRead) {
			// Update existing record
			const [updatedRead] = await db
				.update(readingAssignmentReads)
				.set({ 
					acknowledged,
					readAt: new Date() // Update read time
				})
				.where(eq(readingAssignmentReads.id, existingRead.id))
				.returning();

			return json({
				success: true,
				action: 'updated',
				readRecord: updatedRead
			});
		} else {
			// Create new read record
			const [newRead] = await db
				.insert(readingAssignmentReads)
				.values({
					readingAssignmentId: targetAssignmentId,
					agentId,
					acknowledged,
				})
				.returning();

			return json({
				success: true,
				action: 'created',
				readRecord: newRead
			});
		}

	} catch (error) {
		console.error('Failed to mark message as read:', error);
		return json({ error: 'Failed to mark message as read' }, { status: 500 });
	}
}