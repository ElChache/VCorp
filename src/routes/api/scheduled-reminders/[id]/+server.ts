import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { scheduledReminders } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/scheduled-reminders/[id] - Get a specific scheduled reminder
export async function GET({ params }) {
	try {
		const reminderId = parseInt(params.id);
		
		const [reminder] = await db
			.select()
			.from(scheduledReminders)
			.where(eq(scheduledReminders.id, reminderId))
			.limit(1);

		if (!reminder) {
			return json({ error: 'Scheduled reminder not found' }, { status: 404 });
		}

		return json(reminder);

	} catch (error) {
		console.error('Failed to fetch scheduled reminder:', error);
		return json({ error: 'Failed to fetch scheduled reminder' }, { status: 500 });
	}
}

// PUT /api/scheduled-reminders/[id] - Update a scheduled reminder
export async function PUT({ params, request }) {
	try {
		const reminderId = parseInt(params.id);
		const { name, targetRoleType, message, frequencyMinutes, isActive } = await request.json();

		if (!name || !targetRoleType || !message || !frequencyMinutes) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const [updatedReminder] = await db
			.update(scheduledReminders)
			.set({
				name,
				targetRoleType,
				message,
				frequencyMinutes: parseInt(frequencyMinutes),
				isActive,
				updatedAt: new Date()
			})
			.where(eq(scheduledReminders.id, reminderId))
			.returning();

		if (!updatedReminder) {
			return json({ error: 'Scheduled reminder not found' }, { status: 404 });
		}

		return json(updatedReminder);

	} catch (error) {
		console.error('Failed to update scheduled reminder:', error);
		return json({ error: 'Failed to update scheduled reminder' }, { status: 500 });
	}
}

// DELETE /api/scheduled-reminders/[id] - Delete a scheduled reminder
export async function DELETE({ params }) {
	try {
		const reminderId = parseInt(params.id);
		
		const [deletedReminder] = await db
			.delete(scheduledReminders)
			.where(eq(scheduledReminders.id, reminderId))
			.returning();

		if (!deletedReminder) {
			return json({ error: 'Scheduled reminder not found' }, { status: 404 });
		}

		return json({ success: true });

	} catch (error) {
		console.error('Failed to delete scheduled reminder:', error);
		return json({ error: 'Failed to delete scheduled reminder' }, { status: 500 });
	}
}