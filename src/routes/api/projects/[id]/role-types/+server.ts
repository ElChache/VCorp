import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET({ params }) {
	try {
		const projectId = parseInt(params.id);
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		// Get unique role types for this project (excluding Human Director)
		const roleTypes = await db
			.select({
				roleType: agents.roleType,
				count: sql<number>`count(*)`
			})
			.from(agents)
			.where(sql`${agents.projectId} = ${projectId} AND ${agents.roleType} != 'Human Director'`)
			.groupBy(agents.roleType)
			.orderBy(agents.roleType);

		return json(roleTypes);
	} catch (error) {
		console.error('Failed to fetch role types:', error);
		return json({ error: 'Failed to fetch role types' }, { status: 500 });
	}
}