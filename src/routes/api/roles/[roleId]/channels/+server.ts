import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { roles, channels, channelRoleAssignments } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/roles/[roleId]/channels - Get channels accessible to a role
export async function GET({ params }) {
	try {
		let role;
		const roleParam = decodeURIComponent(params.roleId);
		const roleId = parseInt(roleParam);

		// Try to find role by ID first (numeric)
		if (!isNaN(roleId)) {
			[role] = await db
				.select()
				.from(roles)
				.where(eq(roles.id, roleId))
				.limit(1);
		} 
		// If not a number or not found by ID, try to find by role type name
		if (!role) {
			[role] = await db
				.select()
				.from(roles)
				.where(eq(roles.name, roleParam))
				.limit(1);
		}

		if (!role) {
			return json({ error: 'Role not found' }, { status: 404 });
		}

		// Get channels assigned to this role
		const assignedChannels = await db
			.select({
				assignmentId: channelRoleAssignments.id,
				channelId: channels.id,
				channelName: channels.name,
				description: channels.description,
				isMainChannel: channels.isMainChannel,
			})
			.from(channelRoleAssignments)
			.innerJoin(channels, eq(channelRoleAssignments.channelId, channels.id))
			.where(eq(channelRoleAssignments.roleId, role.id));

		// Get all main channels (public channels accessible to all roles)
		const mainChannelsQuery = await db
			.select()
			.from(channels)
			.where(and(
				eq(channels.projectId, role.projectId),
				eq(channels.isMainChannel, true)
			));

		const mainChannels = mainChannelsQuery.map(channel => ({
			assignmentId: null,
			channelId: channel.id,
			channelName: channel.name,
			description: channel.description,
			isMainChannel: channel.isMainChannel,
		}));

		// Combine assigned channels and main channels
		const allAccessibleChannels = [...assignedChannels, ...mainChannels];

		// Get all channels in the project for potential assignment
		const allProjectChannels = await db
			.select()
			.from(channels)
			.where(eq(channels.projectId, role.projectId));

		// Mark which channels are assigned or accessible
		const channelsWithAssignment = allProjectChannels.map(channel => {
			const isAssigned = assignedChannels.some(assigned => assigned.channelId === channel.id);
			const isMainChannel = channel.isMainChannel;
			return {
				...channel,
				isAssigned: isAssigned || isMainChannel, // Main channels are always "assigned"
				assignmentId: assignedChannels.find(assigned => assigned.channelId === channel.id)?.assignmentId || null,
			};
		});

		return json({
			role: {
				id: role.id,
				name: role.name,
				projectId: role.projectId,
			},
			assignedChannels: allAccessibleChannels,
			allChannels: channelsWithAssignment,
		});
	} catch (error) {
		console.error('Failed to get role channels:', error);
		return json({ error: 'Failed to get role channels' }, { status: 500 });
	}
}