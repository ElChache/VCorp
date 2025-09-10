import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Delete all agents for a project (for testing/cleanup)
export async function DELETE({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		const deletedAgents = await db
			.delete(agents)
			.where(eq(agents.projectId, parseInt(projectId)))
			.returning();

		console.log(`🧹 Cleaned up ${deletedAgents.length} agents from project ${projectId}`);

		return json({ 
			success: true, 
			message: `Deleted ${deletedAgents.length} agents`,
			deletedAgents 
		});
	} catch (error) {
		console.error('Failed to cleanup agents:', error);
		return json({ error: 'Failed to cleanup agents' }, { status: 500 });
	}
}