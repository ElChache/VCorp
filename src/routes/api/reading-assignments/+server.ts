import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { readingAssignments } from '$lib/db/schema';

// POST /api/reading-assignments - Create a new reading assignment
export async function POST({ request }) {
	try {
		const { contentId, assignedToType, assignedTo } = await request.json();

		if (!contentId || !assignedToType || !assignedTo) {
			return json({ error: 'contentId, assignedToType, and assignedTo are required' }, { status: 400 });
		}

		// Validate assignedToType
		if (!['role', 'agent', 'squad'].includes(assignedToType)) {
			return json({ error: 'assignedToType must be role, agent, or squad' }, { status: 400 });
		}

		console.log(`📋 Creating reading assignment: ${assignedToType}:${assignedTo} for content ${contentId}`);

		const [newAssignment] = await db
			.insert(readingAssignments)
			.values({
				contentId: parseInt(contentId),
				assignedToType,
				assignedTo
			})
			.returning();

		return json({
			success: true,
			assignment: newAssignment
		});

	} catch (error) {
		console.error('Failed to create reading assignment:', error);
		return json({ error: 'Failed to create reading assignment' }, { status: 500 });
	}
}