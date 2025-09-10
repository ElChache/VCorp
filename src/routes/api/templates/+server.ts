import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { promptTemplates } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/templates - Get all prompt templates
export async function GET() {
	try {
		const templates = await db
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
			.orderBy(promptTemplates.type, promptTemplates.name);

		return json({
			templates,
			totalCount: templates.length
		});
	} catch (error) {
		console.error('Failed to fetch templates:', error);
		return json({ error: 'Failed to fetch templates' }, { status: 500 });
	}
}