import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { prompts, rolePromptCompositions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/prompts/[id] - Get a specific prompt
export async function GET({ params }) {
	try {
		const promptId = parseInt(params.id);
		
		if (isNaN(promptId)) {
			return json({ error: 'Invalid prompt ID' }, { status: 400 });
		}

		const [prompt] = await db
			.select()
			.from(prompts)
			.where(eq(prompts.id, promptId))
			.limit(1);

		if (!prompt) {
			return json({ error: 'Prompt not found' }, { status: 404 });
		}

		return json(prompt);
	} catch (error) {
		console.error('Failed to fetch prompt:', error);
		return json({ error: 'Failed to fetch prompt' }, { status: 500 });
	}
}

// PUT /api/prompts/[id] - Update a prompt
export async function PUT({ params, request }) {
	try {
		const promptId = parseInt(params.id);
		const { name, type, content, premade, orderIndex } = await request.json();
		
		if (isNaN(promptId)) {
			return json({ error: 'Invalid prompt ID' }, { status: 400 });
		}

		if (!name?.trim() || !type?.trim() || !content?.trim()) {
			return json({ 
				error: 'name, type, and content are required' 
			}, { status: 400 });
		}

		// Check if prompt exists
		const [existingPrompt] = await db
			.select({ id: prompts.id })
			.from(prompts)
			.where(eq(prompts.id, promptId))
			.limit(1);

		if (!existingPrompt) {
			return json({ error: 'Prompt not found' }, { status: 404 });
		}

		// Update the prompt
		const [updatedPrompt] = await db
			.update(prompts)
			.set({
				name: name.trim(),
				type: type.trim(),
				content: content.trim(),
				premade: premade || null,
				orderIndex: orderIndex || 0,
			})
			.where(eq(prompts.id, promptId))
			.returning();

		return json(updatedPrompt);
	} catch (error) {
		console.error('Failed to update prompt:', error);
		return json({ error: 'Failed to update prompt' }, { status: 500 });
	}
}

// DELETE /api/prompts/[id] - Delete a prompt
export async function DELETE({ params }) {
	try {
		const promptId = parseInt(params.id);
		
		if (isNaN(promptId)) {
			return json({ error: 'Invalid prompt ID' }, { status: 400 });
		}

		// Check if prompt exists
		const [prompt] = await db
			.select({ id: prompts.id, name: prompts.name })
			.from(prompts)
			.where(eq(prompts.id, promptId))
			.limit(1);

		if (!prompt) {
			return json({ error: 'Prompt not found' }, { status: 404 });
		}

		// Delete role-prompt compositions first (foreign key constraint)
		await db
			.delete(rolePromptCompositions)
			.where(eq(rolePromptCompositions.promptId, promptId));

		// Delete the prompt
		await db
			.delete(prompts)
			.where(eq(prompts.id, promptId));

		return json({ 
			success: true, 
			message: `Prompt "${prompt.name}" deleted successfully` 
		});
	} catch (error) {
		console.error('Failed to delete prompt:', error);
		return json({ error: 'Failed to delete prompt' }, { status: 500 });
	}
}