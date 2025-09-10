import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { roles } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ params }) {
	try {
		const projectId = parseInt(params.id);
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		const projectRoles = await db
			.select()
			.from(roles)
			.where(eq(roles.projectId, projectId))
			.orderBy(roles.name);

		return json(projectRoles);
	} catch (error) {
		console.error('Failed to fetch roles:', error);
		return json({ error: 'Failed to fetch roles' }, { status: 500 });
	}
}