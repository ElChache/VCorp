import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { channelRoleAssignments, channels, roles, content, readingAssignments } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// DELETE /api/channels/[channelId]/roles/[assignmentId] - Remove a role assignment from a channel
export async function DELETE({ params }) {
	try {
		const channelId = parseInt(params.channelId);
		const assignmentId = parseInt(params.assignmentId);

		if (isNaN(channelId)) {
			return json({ error: 'Invalid channel ID' }, { status: 400 });
		}

		if (isNaN(assignmentId)) {
			return json({ error: 'Invalid assignment ID' }, { status: 400 });
		}

		// Get assignment details before deleting for notification
		const [assignmentToDelete] = await db
			.select({
				assignment: channelRoleAssignments,
				channel: channels,
				role: roles,
			})
			.from(channelRoleAssignments)
			.leftJoin(channels, eq(channelRoleAssignments.channelId, channels.id))
			.leftJoin(roles, eq(channelRoleAssignments.roleId, roles.id))
			.where(eq(channelRoleAssignments.id, assignmentId))
			.limit(1);

		if (!assignmentToDelete) {
			return json({ error: 'Assignment not found' }, { status: 404 });
		}

		// Verify it was for the correct channel (security check)
		if (assignmentToDelete.assignment.channelId !== channelId) {
			return json({ error: 'Assignment does not belong to this channel' }, { status: 400 });
		}

		// Delete the assignment
		const [deletedAssignment] = await db
			.delete(channelRoleAssignments)
			.where(eq(channelRoleAssignments.id, assignmentId))
			.returning();

		// Create notification message about channel access removal
		if (assignmentToDelete.channel && assignmentToDelete.role) {
			const [notificationMessage] = await db
				.insert(content)
				.values({
					projectId: assignmentToDelete.channel.projectId,
					channelId: null, // This is a direct notification, not in a channel
					type: 'message',
					title: 'Channel Access Removed',
					body: `You no longer have access to the **#${assignmentToDelete.channel.name}** channel.`,
					authorAgentId: null, // System notification
				})
				.returning();

			// Create reading assignment for the specific role
			await db
				.insert(readingAssignments)
				.values({
					contentId: notificationMessage.id,
					assignedToType: 'role',
					assignedTo: assignmentToDelete.role.name,
				});
		}

		return json({ 
			success: true, 
			message: 'Role assignment removed from channel',
			deletedAssignment 
		});
	} catch (error) {
		console.error('Failed to remove role assignment:', error);
		return json({ error: 'Failed to remove role assignment' }, { status: 500 });
	}
}