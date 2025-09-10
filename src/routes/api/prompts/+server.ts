import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { prompts, projects } from '$lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// GET /api/prompts?projectId=123 - Get all prompts for a project
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		const projectPrompts = await db
			.select({
				id: prompts.id,
				name: prompts.name,
				type: prompts.type,
				content: prompts.content,
				premade: prompts.premade,
				templateId: prompts.templateId,
				orderIndex: prompts.orderIndex,
				createdAt: prompts.createdAt,
			})
			.from(prompts)
			.where(and(
				eq(prompts.projectId, parseInt(projectId)),
				// Only show non-premade prompts (custom prompts and role descriptions)
				// Premade prompts are now managed in the Roles section
				isNull(prompts.premade)
			))
			.orderBy(prompts.type, prompts.orderIndex, prompts.name);

		// Since we're filtering out premade prompts, we can return the prompts as-is
		const processedPrompts = projectPrompts;

		// Group by type for easier management
		const promptsByType = processedPrompts.reduce((acc, prompt) => {
			if (!acc[prompt.type]) {
				acc[prompt.type] = [];
			}
			acc[prompt.type].push(prompt);
			return acc;
		}, {} as Record<string, any[]>);

		return json({
			prompts: processedPrompts,
			promptsByType,
			totalCount: processedPrompts.length
		});
	} catch (error) {
		console.error('Failed to fetch prompts:', error);
		return json({ error: 'Failed to fetch prompts' }, { status: 500 });
	}
}

// POST /api/prompts - Create a new prompt
export async function POST({ request }) {
	try {
		const { projectId, name, type, content, premade, orderIndex } = await request.json();

		if (!projectId || !name?.trim() || !type?.trim() || !content?.trim()) {
			return json({ 
				error: 'projectId, name, type, and content are required' 
			}, { status: 400 });
		}

		// Verify project exists
		const [project] = await db
			.select({ id: projects.id })
			.from(projects)
			.where(eq(projects.id, parseInt(projectId)))
			.limit(1);

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		// Create the prompt
		const [newPrompt] = await db
			.insert(prompts)
			.values({
				projectId: parseInt(projectId),
				templateId: null, // Custom prompt, no template
				name: name.trim(),
				type: type.trim(),
				content: content.trim(),
				premade: premade || null,
				orderIndex: orderIndex || 0,
			})
			.returning();

		return json(newPrompt, { status: 201 });
	} catch (error) {
		console.error('Failed to create prompt:', error);
		return json({ error: 'Failed to create prompt' }, { status: 500 });
	}
}