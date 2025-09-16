import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { prompts } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET({ url }: RequestEvent) {
	try {
		const projectId = url.searchParams.get('projectId');
		const slug = url.searchParams.get('slug');

		if (!projectId || !slug) {
			return json({ error: 'Project ID and slug are required' }, { status: 400 });
		}

		// Find prompt by slug in the specified project
		const [prompt] = await db
			.select()
			.from(prompts)
			.where(and(
				eq(prompts.projectId, parseInt(projectId)),
				eq(prompts.slug, slug)
			))
			.limit(1);

		if (!prompt) {
			return json({ error: 'Prompt not found' }, { status: 404 });
		}

		return json(prompt);
	} catch (error: unknown) {
		console.error('Failed to fetch prompt by slug:', error);
		return json({ error: 'Failed to fetch prompt' }, { status: 500 });
	}
}