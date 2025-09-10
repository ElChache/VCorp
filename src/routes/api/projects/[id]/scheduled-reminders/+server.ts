import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { scheduledReminders } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/projects/[id]/scheduled-reminders - Get all scheduled reminders for a project
export async function GET({ params }) {
	try {
		const projectId = parseInt(params.id);

		const reminders = await db
			.select()
			.from(scheduledReminders)
			.where(eq(scheduledReminders.projectId, projectId))
			.orderBy(scheduledReminders.createdAt);

		return json(reminders);

	} catch (error) {
		console.error('Failed to fetch scheduled reminders for project:', error);
		return json({ error: 'Failed to fetch scheduled reminders' }, { status: 500 });
	}
}

// POST /api/projects/[id]/scheduled-reminders - Create a new scheduled reminder for a project
export async function POST({ params, request }) {
	try {
		const projectId = parseInt(params.id);
		const { name, targetRoleType, message, frequencyMinutes, isActive = true } = await request.json();

		if (!name || !targetRoleType || !message || !frequencyMinutes) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const [newReminder] = await db
			.insert(scheduledReminders)
			.values({
				projectId,
				name,
				targetRoleType,
				message,
				frequencyMinutes: parseInt(frequencyMinutes),
				isActive
			})
			.returning();

		return json(newReminder, { status: 201 });

	} catch (error) {
		console.error('Failed to create scheduled reminder:', error);
		return json({ error: 'Failed to create scheduled reminder' }, { status: 500 });
	}
}