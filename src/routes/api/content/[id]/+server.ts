import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ params }) {
	try {
		const contentId = parseInt(params.id);
		
		if (isNaN(contentId)) {
			return json({ error: 'Invalid content ID' }, { status: 400 });
		}

		const [result] = await db
			.select()
			.from(content)
			.where(eq(content.id, contentId))
			.limit(1);

		if (!result) {
			return json({ error: 'Content not found' }, { status: 404 });
		}

		return json(result);
	} catch (error) {
		console.error('Failed to fetch content:', error);
		return json({ error: 'Failed to fetch content' }, { status: 500 });
	}
}

export async function PUT({ params, request }) {
	try {
		const contentId = parseInt(params.id);
		const body = await request.json();
		
		if (isNaN(contentId)) {
			return json({ error: 'Invalid content ID' }, { status: 400 });
		}

		const { title, body: contentBody, documentSlug, phaseStatus, requiredInputs, expectedOutputs, assignedToRoleType } = body;

		const updated = await db
			.update(content)
			.set({
				title: title || undefined,
				body: contentBody || undefined,
				documentSlug: documentSlug || undefined,
				phaseStatus: phaseStatus || undefined,
				requiredInputs: requiredInputs || undefined,
				expectedOutputs: expectedOutputs || undefined,
				assignedToRoleType: assignedToRoleType || undefined,
				updatedAt: new Date()
			})
			.where(eq(content.id, contentId))
			.returning();

		if (updated.length === 0) {
			return json({ error: 'Content not found' }, { status: 404 });
		}

		return json(updated[0]);
	} catch (error) {
		console.error('Failed to update content:', error);
		return json({ error: 'Failed to update content' }, { status: 500 });
	}
}

export async function DELETE({ params }) {
	try {
		const contentId = parseInt(params.id);
		
		if (isNaN(contentId)) {
			return json({ error: 'Invalid content ID' }, { status: 400 });
		}

		const deleted = await db
			.delete(content)
			.where(eq(content.id, contentId))
			.returning();

		if (deleted.length === 0) {
			return json({ error: 'Content not found' }, { status: 404 });
		}

		return json({ success: true, message: 'Content deleted successfully' });
	} catch (error) {
		console.error('Failed to delete content:', error);
		return json({ error: 'Failed to delete content' }, { status: 500 });
	}
}