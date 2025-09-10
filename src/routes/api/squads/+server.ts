import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { squads, squadRoleAssignments, roles } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Get all squads for a project
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		const projectSquads = await db
			.select()
			.from(squads)
			.where(eq(squads.projectId, parseInt(projectId)));

		return json(projectSquads);
	} catch (error) {
		console.error('Failed to fetch squads:', error);
		return json({ error: 'Failed to fetch squads' }, { status: 500 });
	}
}

// Create a squad for a project  
export async function POST({ request }) {
	try {
		const { projectId, squadId, name } = await request.json();

		if (!projectId || !squadId || !name) {
			return json({ error: 'Project ID, squad ID, and name are required' }, { status: 400 });
		}

		const [newSquad] = await db
			.insert(squads)
			.values({
				id: squadId,
				projectId: parseInt(projectId),
				templateId: 'default',
				name
			})
			.returning();

		return json(newSquad);
	} catch (error) {
		console.error('Failed to create squad:', error);
		return json({ error: 'Failed to create squad' }, { status: 500 });
	}
}

// Update a squad
export async function PUT({ request }) {
	try {
		const { squadId, name } = await request.json();

		if (!squadId || !name) {
			return json({ error: 'Squad ID and name are required' }, { status: 400 });
		}

		const [updatedSquad] = await db
			.update(squads)
			.set({ name })
			.where(eq(squads.id, squadId))
			.returning();

		if (!updatedSquad) {
			return json({ error: 'Squad not found' }, { status: 404 });
		}

		return json(updatedSquad);
	} catch (error) {
		console.error('Failed to update squad:', error);
		return json({ error: 'Failed to update squad' }, { status: 500 });
	}
}

// Delete a squad
export async function DELETE({ request }) {
	try {
		const { squadId } = await request.json();

		if (!squadId) {
			return json({ error: 'Squad ID is required' }, { status: 400 });
		}

		// First delete all squad-role assignments
		await db
			.delete(squadRoleAssignments)
			.where(eq(squadRoleAssignments.squadId, squadId));

		// Then delete the squad
		const [deletedSquad] = await db
			.delete(squads)
			.where(eq(squads.id, squadId))
			.returning();

		if (!deletedSquad) {
			return json({ error: 'Squad not found' }, { status: 404 });
		}

		return json({ success: true, deletedSquad });
	} catch (error) {
		console.error('Failed to delete squad:', error);
		return json({ error: 'Failed to delete squad' }, { status: 500 });
	}
}