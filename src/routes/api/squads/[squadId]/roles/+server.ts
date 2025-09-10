import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { squadRoleAssignments, roles } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Get all roles assigned to a squad
export async function GET({ params }) {
	try {
		const { squadId } = params;
		
		if (!squadId) {
			return json({ error: 'Squad ID is required' }, { status: 400 });
		}

		const squadRoles = await db
			.select({
				id: squadRoleAssignments.id,
				squadId: squadRoleAssignments.squadId,
				roleId: squadRoleAssignments.roleId,
				roleName: roles.name,
				roleContent: roles.content,
				roleTemplateId: roles.templateId,
				createdAt: squadRoleAssignments.createdAt
			})
			.from(squadRoleAssignments)
			.innerJoin(roles, eq(squadRoleAssignments.roleId, roles.id))
			.where(eq(squadRoleAssignments.squadId, squadId));

		return json(squadRoles);
	} catch (error) {
		console.error('Failed to fetch squad roles:', error);
		return json({ error: 'Failed to fetch squad roles' }, { status: 500 });
	}
}

// Assign a role to a squad
export async function POST({ params, request }) {
	try {
		const { squadId } = params;
		const { roleId } = await request.json();
		
		if (!squadId || !roleId) {
			return json({ error: 'Squad ID and role ID are required' }, { status: 400 });
		}

		// Check if assignment already exists
		const existingAssignment = await db
			.select()
			.from(squadRoleAssignments)
			.where(and(
				eq(squadRoleAssignments.squadId, squadId),
				eq(squadRoleAssignments.roleId, roleId)
			))
			.limit(1);

		if (existingAssignment.length > 0) {
			return json({ error: 'Role is already assigned to this squad' }, { status: 400 });
		}

		const [newAssignment] = await db
			.insert(squadRoleAssignments)
			.values({
				squadId,
				roleId: parseInt(roleId)
			})
			.returning();

		// Get the full role details for response
		const [roleDetails] = await db
			.select()
			.from(roles)
			.where(eq(roles.id, newAssignment.roleId))
			.limit(1);

		return json({ 
			...newAssignment, 
			roleName: roleDetails.name,
			roleContent: roleDetails.content 
		});
	} catch (error) {
		console.error('Failed to assign role to squad:', error);
		return json({ error: 'Failed to assign role to squad' }, { status: 500 });
	}
}

// Remove a role from a squad
export async function DELETE({ params, request }) {
	try {
		const { squadId } = params;
		const { roleId } = await request.json();
		
		if (!squadId || !roleId) {
			return json({ error: 'Squad ID and role ID are required' }, { status: 400 });
		}

		const [deletedAssignment] = await db
			.delete(squadRoleAssignments)
			.where(and(
				eq(squadRoleAssignments.squadId, squadId),
				eq(squadRoleAssignments.roleId, parseInt(roleId))
			))
			.returning();

		if (!deletedAssignment) {
			return json({ error: 'Role assignment not found' }, { status: 404 });
		}

		return json({ success: true, deletedAssignment });
	} catch (error) {
		console.error('Failed to remove role from squad:', error);
		return json({ error: 'Failed to remove role from squad' }, { status: 500 });
	}
}