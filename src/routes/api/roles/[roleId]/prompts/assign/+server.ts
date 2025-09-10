import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { rolePromptCompositions, prompts, roles } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/roles/[roleId]/prompts/assign - Assign a prompt to a role
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

		// Verify prompt exists and is not a premade prompt
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
			return json({ error: 'Cannot assign premade prompts to roles - they are managed automatically' }, { status: 400 });
		}

		// Check if assignment already exists
		const existingAssignment = await db
			.select({ id: rolePromptCompositions.id })
			.from(rolePromptCompositions)
			.where(and(
				eq(rolePromptCompositions.roleId, roleId),
				eq(rolePromptCompositions.promptId, parseInt(promptId))
			))
			.limit(1);

		if (existingAssignment.length > 0) {
			return json({ error: 'Prompt is already assigned to this role' }, { status: 400 });
		}

		// Get the highest order index for this role to append at the end
		const maxOrder = await db
			.select({ maxOrder: rolePromptCompositions.orderIndex })
			.from(rolePromptCompositions)
			.where(eq(rolePromptCompositions.roleId, roleId))
			.orderBy(rolePromptCompositions.orderIndex)
			.limit(1);

		const nextOrderIndex = (maxOrder[0]?.maxOrder || 0) + 1;

		// Create the assignment
		const [newAssignment] = await db
			.insert(rolePromptCompositions)
			.values({
				roleId: roleId,
				promptId: parseInt(promptId),
				orderIndex: nextOrderIndex
			})
			.returning();

		return json({
			success: true,
			assignment: newAssignment,
			message: `Prompt "${prompt.name}" successfully assigned to role`
		});

	} catch (error) {
		console.error('Failed to assign prompt to role:', error);
		return json({ error: 'Failed to assign prompt to role' }, { status: 500 });
	}
}