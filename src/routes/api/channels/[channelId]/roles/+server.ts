import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { channels, roles, channelRoleAssignments, content, readingAssignments } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/channels/[channelId]/roles - Get roles assigned to a channel
export async function GET({ params }) {
	try {
		const channelId = parseInt(params.channelId);

		if (isNaN(channelId)) {
			return json({ error: 'Invalid channel ID' }, { status: 400 });
		}

		// Get assigned roles with role details
		const assignedRoles = await db
			.select({
				assignmentId: channelRoleAssignments.id,
				roleId: roles.id,
				roleName: roles.name,
				roleTemplateId: roles.templateId,
				isActive: roles.isActive,
			})
			.from(channelRoleAssignments)
			.innerJoin(roles, eq(channelRoleAssignments.roleId, roles.id))
			.where(eq(channelRoleAssignments.channelId, channelId));

		// Get the channel info for context
		const [channel] = await db
			.select()
			.from(channels)
			.where(eq(channels.id, channelId))
			.limit(1);

		if (!channel) {
			return json({ error: 'Channel not found' }, { status: 404 });
		}

		// Get all roles in the project for potential assignment
		const allProjectRoles = await db
			.select()
			.from(roles)
			.where(eq(roles.projectId, channel.projectId));

		// Mark which roles are assigned
		const rolesWithAssignment = allProjectRoles.map(role => ({
			...role,
			isAssigned: assignedRoles.some(assigned => assigned.roleId === role.id),
			assignmentId: assignedRoles.find(assigned => assigned.roleId === role.id)?.assignmentId || null,
		}));

		return json({
			channel: {
				id: channel.id,
				name: channel.name,
				projectId: channel.projectId,
			},
			assignedRoles,
			allRoles: rolesWithAssignment,
		});
	} catch (error) {
		console.error('Failed to get channel roles:', error);
		return json({ error: 'Failed to get channel roles' }, { status: 500 });
	}
}

// POST /api/channels/[channelId]/roles - Assign a role to a channel
export async function POST({ params, request }) {
	try {
		const channelId = parseInt(params.channelId);
		const { roleId } = await request.json();

		if (isNaN(channelId)) {
			return json({ error: 'Invalid channel ID' }, { status: 400 });
		}

		if (!roleId || isNaN(parseInt(roleId))) {
			return json({ error: 'Valid role ID is required' }, { status: 400 });
		}

		const roleIdInt = parseInt(roleId);

		// Check if assignment already exists
		const [existingAssignment] = await db
			.select()
			.from(channelRoleAssignments)
			.where(and(
				eq(channelRoleAssignments.channelId, channelId),
				eq(channelRoleAssignments.roleId, roleIdInt)
			))
			.limit(1);

		if (existingAssignment) {
			return json({ error: 'Role is already assigned to this channel' }, { status: 400 });
		}

		// Verify channel and role exist and are in the same project
		const [channel] = await db
			.select()
			.from(channels)
			.where(eq(channels.id, channelId))
			.limit(1);

		const [role] = await db
			.select()
			.from(roles)
			.where(eq(roles.id, roleIdInt))
			.limit(1);

		if (!channel) {
			return json({ error: 'Channel not found' }, { status: 404 });
		}

		if (!role) {
			return json({ error: 'Role not found' }, { status: 404 });
		}

		if (channel.projectId !== role.projectId) {
			return json({ error: 'Channel and role must be in the same project' }, { status: 400 });
		}

		// Create the assignment
		const [newAssignment] = await db
			.insert(channelRoleAssignments)
			.values({
				channelId,
				roleId: roleIdInt,
			})
			.returning();

		// Create notification message about channel access
		const [notificationMessage] = await db
			.insert(content)
			.values({
				projectId: channel.projectId,
				channelId: null, // This is a direct notification, not in a channel
				type: 'message',
				title: 'Channel Access Granted',
				body: `You now have access to the **#${channel.name}** channel. ${channel.description ? `\n\n${channel.description}` : ''}`,
				authorAgentId: null, // System notification
			})
			.returning();

		// Create reading assignment for the specific role
		await db
			.insert(readingAssignments)
			.values({
				contentId: notificationMessage.id,
				assignedToType: 'role',
				assignedTo: role.name,
			});

		return json(newAssignment, { status: 201 });
	} catch (error) {
		console.error('Failed to assign role to channel:', error);
		return json({ error: 'Failed to assign role to channel' }, { status: 500 });
	}
}