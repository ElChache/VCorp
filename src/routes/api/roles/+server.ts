import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { roles, prompts, rolePromptCompositions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { standardDeveloperPermissions } from '$lib/templates/permissions';

// Get roles for a project
export async function GET({ url }: RequestEvent) {
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
export async function POST({ request }: RequestEvent) {
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
				templateId: null, // Custom role
				permissions: JSON.stringify(standardDeveloperPermissions) // Default to standard developer permissions for custom roles
			})
			.returning();

		// Create a basic prompt for this role
		const [newPrompt] = await db
			.insert(prompts)
			.values({
				name: `${name} Prompt`,
				slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_prompt`,
				type: 'role_prompt',
				content: content,
				projectId: parseInt(projectId),
				templateId: null,
				premade: null,
				isGlobal: false,
				orderIndex: 0
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