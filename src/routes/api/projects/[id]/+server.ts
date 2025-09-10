import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { projects, roles, prompts, rolePromptCompositions, channels, content, readingAssignments, readingAssignmentReads, agents, tasks, roleAssignments, channelRoleAssignments, squads, squadPromptAssignments, rolePromptOrders } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// GET /api/projects/[id] - Get project details
export async function GET({ params }) {
	try {
		const projectId = parseInt(params.id);
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		const [project] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, projectId))
			.limit(1);

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		return json(project);
	} catch (error) {
		console.error('Failed to get project:', error);
		return json({ error: 'Failed to get project' }, { status: 500 });
	}
}

export async function DELETE({ params }) {
	try {
		const projectId = parseInt(params.id);
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		// Check if project exists
		const [project] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, projectId))
			.limit(1);

		if (!project) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		// Delete all related data in correct order using sql template literals
		await db.execute(sql`DELETE FROM reading_assignment_reads WHERE reading_assignment_id IN (
			SELECT ra.id FROM reading_assignments ra 
			JOIN content c ON ra.content_id = c.id 
			WHERE c.project_id = ${projectId}
		)`);
		
		await db.execute(sql`DELETE FROM reading_assignments WHERE content_id IN (
			SELECT id FROM content WHERE project_id = ${projectId}
		)`);
		
		await db.execute(sql`DELETE FROM content WHERE project_id = ${projectId}`);
		
		await db.execute(sql`DELETE FROM channel_role_assignments WHERE channel_id IN (
			SELECT id FROM channels WHERE project_id = ${projectId}
		)`);
		
		await db.execute(sql`DELETE FROM channels WHERE project_id = ${projectId}`);
		
		await db.execute(sql`DELETE FROM squad_role_assignments WHERE squad_id IN (
			SELECT id FROM squads WHERE project_id = ${projectId}
		)`);
		
		await db.execute(sql`DELETE FROM squads WHERE project_id = ${projectId}`);
		
		await db.execute(sql`DELETE FROM role_prompt_orders WHERE role_id IN (
			SELECT id FROM roles WHERE project_id = ${projectId}
		)`);
		
		await db.execute(sql`DELETE FROM squad_prompt_assignments WHERE squad_id IN (
			SELECT id FROM squads WHERE project_id = ${projectId}
		)`);
		
		await db.execute(sql`DELETE FROM role_prompt_compositions WHERE role_id IN (
			SELECT id FROM roles WHERE project_id = ${projectId}
		)`);
		
		await db.execute(sql`DELETE FROM prompts WHERE project_id = ${projectId}`);
		await db.execute(sql`DELETE FROM agents WHERE project_id = ${projectId}`);
		await db.execute(sql`DELETE FROM tasks WHERE project_id = ${projectId}`);
		await db.execute(sql`DELETE FROM role_assignments WHERE project_id = ${projectId}`);
		await db.execute(sql`DELETE FROM roles WHERE project_id = ${projectId}`);

		// Finally delete the project
		const deleted = await db
			.delete(projects)
			.where(eq(projects.id, projectId))
			.returning();

		return json({ success: true, message: 'Project and all related data deleted successfully' });
	} catch (error) {
		console.error('Failed to delete project:', error);
		return json({ error: 'Failed to delete project' }, { status: 500 });
	}
}

export async function PUT({ params, request }) {
	try {
		const projectId = parseInt(params.id);
		const body = await request.json();
		const { name, description, path } = body;
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		if (!name?.trim()) {
			return json({ error: 'Project name is required' }, { status: 400 });
		}

		if (!path?.trim()) {
			return json({ error: 'Project path is required' }, { status: 400 });
		}

		const updated = await db
			.update(projects)
			.set({
				name: name.trim(),
				description: description?.trim() || null,
				path: path.trim(),
				updatedAt: new Date()
			})
			.where(eq(projects.id, projectId))
			.returning();

		if (updated.length === 0) {
			return json({ error: 'Project not found' }, { status: 404 });
		}

		return json(updated[0]);
	} catch (error) {
		console.error('Failed to update project:', error);
		return json({ error: 'Failed to update project' }, { status: 500 });
	}
}