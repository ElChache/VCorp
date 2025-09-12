import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, channels } from '$lib/db/schema';
import { eq, or, and, isNull, desc, sql } from 'drizzle-orm';

// GET /api/director/inbox - Get all messages for human director with priority organization
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		// Get messages from two sources:
		// 1. Messages with reading assignments to director/human-director
		const assignedMessages = await db
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
					eq(content.projectId, parseInt(projectId)),
					or(
						and(
							eq(readingAssignments.assignedToType, 'agent'),
							or(
								eq(readingAssignments.assignedTo, 'director'),
								eq(readingAssignments.assignedTo, 'human-director')
							)
						),
						and(
							eq(readingAssignments.assignedToType, 'role'),
							eq(readingAssignments.assignedTo, 'human-director')
						)
					)
				)
			);

		// 2. Messages from director channels (isForHumanDirector = true)
		const directorChannelMessages = await db
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
				
				// No assignment info for channel messages
				assignmentId: sql<number>`null`,
				assignedToType: sql<string>`null`,
				assignedTo: sql<string>`null`,
				assignedAt: sql<Date>`null`,
				
				// Channel info
				channelName: channels.name,
				isDirectorChannel: channels.isForHumanDirector,
			})
			.from(content)
			.innerJoin(channels, eq(content.channelId, channels.id))
			.where(
				and(
					eq(content.projectId, parseInt(projectId)),
					eq(channels.isForHumanDirector, true)
				)
			);

		// Combine and deduplicate messages (in case a director channel message also has assignments)
		const allMessages = [...assignedMessages, ...directorChannelMessages];
		const uniqueMessages = allMessages.reduce((acc, message) => {
			const existing = acc.find(m => m.messageId === message.messageId);
			if (existing) {
				// Keep the version with assignment info if available
				if (message.assignmentId && !existing.assignmentId) {
					const index = acc.indexOf(existing);
					acc[index] = message;
				}
			} else {
				acc.push(message);
			}
			return acc;
		}, [] as typeof allMessages);

		// Sort by creation date
		const directorMessages = uniqueMessages.sort((a, b) => 
			new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);

		// Check read status for each message
		const messagesWithStatus = await Promise.all(
			directorMessages.map(async (message) => {
				let readRecord = null;
				
				// Only check read status for messages with assignments
				if (message.assignmentId) {
					[readRecord] = await db
						.select({
							readAt: readingAssignmentReads.readAt,
							acknowledged: readingAssignmentReads.acknowledged,
						})
						.from(readingAssignmentReads)
						.where(and(
							eq(readingAssignmentReads.readingAssignmentId, message.assignmentId),
							or(
								eq(readingAssignmentReads.agentId, 'director'),
								eq(readingAssignmentReads.agentId, 'human-director')
							)
						))
						.limit(1);
				}

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
					// For assignment-based messages, check read record
					// For director channel messages without assignments, mark as read if authored by director
					isRead: message.assignmentId ? !!readRecord : (message.authorAgentId === 'human-director'),
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