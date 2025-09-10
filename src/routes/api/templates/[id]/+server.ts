import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { promptTemplates, prompts } from '$lib/db/schema';
import { eq, count } from 'drizzle-orm';

// GET /api/templates/[id] - Get a specific template
export async function GET({ params }) {
	try {
		const templateId = parseInt(params.id);
		
		if (isNaN(templateId)) {
			return json({ error: 'Invalid template ID' }, { status: 400 });
		}

		const [template] = await db
			.select({
				id: promptTemplates.id,
				name: promptTemplates.name,
				type: promptTemplates.type,
				content: promptTemplates.content,
				premade: promptTemplates.premade,
				isGlobal: promptTemplates.isGlobal,
				version: promptTemplates.version,
				createdAt: promptTemplates.createdAt,
			})
			.from(promptTemplates)
			.where(eq(promptTemplates.id, templateId))
			.limit(1);

		if (!template) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		// Get count of prompts using this template
		const [promptCount] = await db
			.select({ count: count() })
			.from(prompts)
			.where(eq(prompts.templateId, templateId));

		return json({
			...template,
			promptCount: promptCount.count || 0
		});
	} catch (error) {
		console.error('Failed to fetch template:', error);
		return json({ error: 'Failed to fetch template' }, { status: 500 });
	}
}

// PUT /api/templates/[id] - Update a template
export async function PUT({ params, request }) {
	try {
		const templateId = parseInt(params.id);
		const { name, type, content } = await request.json();
		
		if (isNaN(templateId)) {
			return json({ error: 'Invalid template ID' }, { status: 400 });
		}

		if (!name?.trim() || !type?.trim() || !content?.trim()) {
			return json({ 
				error: 'name, type, and content are required' 
			}, { status: 400 });
		}

		// Verify template exists
		const [existingTemplate] = await db
			.select({ id: promptTemplates.id, version: promptTemplates.version })
			.from(promptTemplates)
			.where(eq(promptTemplates.id, templateId))
			.limit(1);

		if (!existingTemplate) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		// Get count of existing prompts using this template
		const [promptCount] = await db
			.select({ count: count() })
			.from(prompts)
			.where(eq(prompts.templateId, templateId));

		// Update the template with incremented version
		const [updatedTemplate] = await db
			.update(promptTemplates)
			.set({
				name: name.trim(),
				type: type.trim(),
				content: content.trim(),
				version: existingTemplate.version + 1
			})
			.where(eq(promptTemplates.id, templateId))
			.returning();

		return json({
			success: true,
			template: updatedTemplate,
			affectedCount: promptCount.count || 0,
			message: `Template updated successfully. ${promptCount.count || 0} existing prompts use this template.`
		});

	} catch (error) {
		console.error('Failed to update template:', error);
		return json({ error: 'Failed to update template' }, { status: 500 });
	}
}