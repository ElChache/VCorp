import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { scheduledReminders } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/scheduled-reminders - Get all scheduled reminders
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		const reminders = await db
			.select()
			.from(scheduledReminders)
			.where(eq(scheduledReminders.projectId, parseInt(projectId)))
			.orderBy(scheduledReminders.createdAt);

		return json(reminders);

	} catch (error) {
		console.error('Failed to fetch scheduled reminders:', error);
		return json({ error: 'Failed to fetch scheduled reminders' }, { status: 500 });
	}
}

// POST /api/scheduled-reminders - Create a new scheduled reminder
export async function POST({ request }) {
	try {
		const { projectId, name, targetRoleType, message, frequencyMinutes, isActive = true } = await request.json();

		if (!projectId || !name || !targetRoleType || !message || !frequencyMinutes) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const [newReminder] = await db
			.insert(scheduledReminders)
			.values({
				projectId: parseInt(projectId),
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