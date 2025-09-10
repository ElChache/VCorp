import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, channels } from '$lib/db/schema';
import { eq, or, and, isNull, desc, sql } from 'drizzle-orm';

// GET /api/director/inbox - Get all messages for human director with priority organization
export async function GET() {
	try {
		// Get all messages assigned to director (either direct DMs or director channels)
		const directorMessages = await db
			.select({
				// Message info
				messageId: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				authorAgentId: content.authorAgentId,
				channelId: content.channelId,
				parentContentId: content.parentContentId,
				createdAt: content.createdAt,
				
				// Assignment info
				assignmentId: readingAssignments.id,
				assignedToType: readingAssignments.assignedToType,
				assignedTo: readingAssignments.assignedTo,
				assignedAt: readingAssignments.assignedAt,
				
				// Channel info (null for DMs)
				channelName: channels.name,
				isDirectorChannel: channels.isForHumanDirector,
			})
			.from(readingAssignments)
			.innerJoin(content, eq(readingAssignments.contentId, content.id))
			.leftJoin(channels, eq(content.channelId, channels.id))
			.where(
				and(
					eq(readingAssignments.assignedToType, 'agent'),
					eq(readingAssignments.assignedTo, 'director')
				)
			)
			.orderBy(desc(content.createdAt));

		// Check read status for each message
		const messagesWithStatus = await Promise.all(
			directorMessages.map(async (message) => {
				const [readRecord] = await db
					.select({
						readAt: readingAssignmentReads.readAt,
						acknowledged: readingAssignmentReads.acknowledged,
					})
					.from(readingAssignmentReads)
					.where(and(
						eq(readingAssignmentReads.readingAssignmentId, message.assignmentId),
						eq(readingAssignmentReads.agentId, 'director')
					))
					.limit(1);

				// Get thread context if this is a reply
				let parentMessage = null;
				if (message.parentContentId) {
					[parentMessage] = await db
						.select({
							id: content.id,
							title: content.title,
							body: content.body,
							type: content.type,
							authorAgentId: content.authorAgentId,
							createdAt: content.createdAt,
						})
						.from(content)
						.where(eq(content.id, message.parentContentId))
						.limit(1);
				}

				return {
					messageId: message.messageId,
					assignmentId: message.assignmentId,
					title: message.title,
					body: message.body,
					type: message.type,
					authorAgentId: message.authorAgentId,
					channelId: message.channelId,
					channelName: message.channelName,
					parentContentId: message.parentContentId,
					parentMessage,
					createdAt: message.createdAt,
					assignedAt: message.assignedAt,
					isRead: !!readRecord,
					readAt: readRecord?.readAt || null,
					acknowledged: readRecord?.acknowledged || false,
					isDM: !message.channelId,
					isReply: !!message.parentContentId,
					isDirectorChannel: !!message.isDirectorChannel,
					source: message.channelId 
						? (message.isDirectorChannel ? 'director-channel' : 'regular-channel')
						: 'direct-message'
				};
			})
		);

		// Separate into categories
		const unreadMessages = messagesWithStatus.filter(m => !m.isRead);
		const readMessages = messagesWithStatus.filter(m => m.isRead);

		// Categorize unread by urgency
		const urgentMessages = unreadMessages.filter(m => 
			m.source === 'direct-message' || m.source === 'director-channel'
		);
		const regularMessages = unreadMessages.filter(m => 
			m.source === 'regular-channel'
		);

		// Get activity stats
		const totalMessages = messagesWithStatus.length;
		const totalUnread = unreadMessages.length;
		const directMessages = messagesWithStatus.filter(m => m.isDM).length;
		const channelMessages = messagesWithStatus.filter(m => !m.isDM).length;
		const replies = messagesWithStatus.filter(m => m.isReply).length;

		return json({
			messages: messagesWithStatus,
			categorized: {
				urgent: urgentMessages,
				regular: regularMessages,
				read: readMessages
			},
			stats: {
				total: totalMessages,
				unread: totalUnread,
				urgent: urgentMessages.length,
				directMessages,
				channelMessages,
				replies,
				read: readMessages.length
			},
			summary: {
				needsImmediateAttention: urgentMessages.length > 0,
				hasNewActivity: totalUnread > 0,
				mostRecentActivity: messagesWithStatus[0]?.createdAt || null
			}
		});

	} catch (error) {
		console.error('Failed to load director inbox:', error);
		return json({ error: 'Failed to load director inbox' }, { status: 500 });
	}
}