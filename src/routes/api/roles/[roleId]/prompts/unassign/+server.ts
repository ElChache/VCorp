import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { rolePromptCompositions, prompts, roles } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/roles/[roleId]/prompts/unassign - Remove a prompt assignment from a role
export async function POST({ params, request }) {
	try {
		const roleId = parseInt(params.roleId);
		const { promptId } = await request.json();
		
		if (isNaN(roleId) || !promptId) {
			return json({ error: 'Role ID and Prompt ID are required' }, { status: 400 });
		}

		// Verify role exists
		const [role] = await db
			.select({ id: roles.id })
			.from(roles)
			.where(eq(roles.id, roleId))
			.limit(1);

		if (!role) {
			return json({ error: 'Role not found' }, { status: 404 });
		}

		// Verify prompt exists and get its details
		const [prompt] = await db
			.select({ 
				id: prompts.id, 
				premade: prompts.premade,
				name: prompts.name 
			})
			.from(prompts)
			.where(eq(prompts.id, parseInt(promptId)))
			.limit(1);

		if (!prompt) {
			return json({ error: 'Prompt not found' }, { status: 404 });
		}

		if (prompt.premade !== null) {
			return json({ error: 'Cannot unassign premade prompts - they are managed automatically' }, { status: 400 });
		}

		// Check if assignment exists
		const existingAssignment = await db
			.select({ id: rolePromptCompositions.id })
			.from(rolePromptCompositions)
			.where(and(
				eq(rolePromptCompositions.roleId, roleId),
				eq(rolePromptCompositions.promptId, parseInt(promptId))
			))
			.limit(1);

		if (existingAssignment.length === 0) {
			return json({ error: 'Prompt is not assigned to this role' }, { status: 400 });
		}

		// Remove the assignment
		await db
			.delete(rolePromptCompositions)
			.where(and(
				eq(rolePromptCompositions.roleId, roleId),
				eq(rolePromptCompositions.promptId, parseInt(promptId))
			));

		return json({
			success: true,
			message: `Prompt "${prompt.name}" successfully removed from role`
		});

	} catch (error) {
		console.error('Failed to remove prompt from role:', error);
		return json({ error: 'Failed to remove prompt from role' }, { status: 500 });
	}
}