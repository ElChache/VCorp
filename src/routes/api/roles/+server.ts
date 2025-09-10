import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { roles, prompts, rolePromptCompositions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Get roles for a project
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		const projectRoles = await db
			.select()
			.from(roles)
			.where(eq(roles.projectId, parseInt(projectId)));

		return json(projectRoles);
	} catch (error) {
		console.error('Failed to fetch roles:', error);
		return json({ error: 'Failed to fetch roles' }, { status: 500 });
	}
}

// Create a role for a project
export async function POST({ request }) {
	try {
		const { projectId, name, content } = await request.json();

		if (!projectId || !name || !content) {
			return json({ error: 'Project ID, name, and content are required' }, { status: 400 });
		}

		const [newRole] = await db
			.insert(roles)
			.values({
				projectId: parseInt(projectId),
				name,
				content,
				templateId: null // Custom role
			})
			.returning();

		// Create a basic prompt for this role
		const [newPrompt] = await db
			.insert(prompts)
			.values({
				name: `${name} Prompt`,
				content: content,
				projectId: parseInt(projectId),
				version: 1
			})
			.returning();

		// Link the role to the prompt
		await db
			.insert(rolePromptCompositions)
			.values({
				roleId: newRole.id,
				promptId: newPrompt.id,
				orderIndex: 1
			});

		return json(newRole);
	} catch (error) {
		console.error('Failed to create role:', error);
		return json({ error: 'Failed to create role' }, { status: 500 });
	}
}