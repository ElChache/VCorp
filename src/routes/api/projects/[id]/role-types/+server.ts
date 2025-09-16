import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET({ params }) {
	try {
		const projectId = parseInt(params.id);
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		// Get all unique role types from phases in this project with their counts
		const roleTypesFromPhases = await db
			.select({
				roleType: content.assignedToRoleType,
				count: sql<number>`COUNT(*)`,
				activeCount: sql<number>`SUM(CASE WHEN ${content.phaseStatus} = 'active' THEN 1 ELSE 0 END)`,
				blockedCount: sql<number>`SUM(CASE WHEN ${content.phaseStatus} = 'blocked' THEN 1 ELSE 0 END)`
			})
			.from(content)
			.where(sql`${content.projectId} = ${projectId} AND ${content.type} = 'phase' AND ${content.assignedToRoleType} IS NOT NULL`)
			.groupBy(content.assignedToRoleType)
			.orderBy(content.assignedToRoleType);

		return json(roleTypesFromPhases);
	} catch (error) {
		console.error('Failed to fetch role types:', error);
		return json({ error: 'Failed to fetch role types' }, { status: 500 });
	}
}