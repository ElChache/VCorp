import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, roles } from '$lib/db/schema';
import { eq, or, and, isNull } from 'drizzle-orm';

// GET /api/inbox?agentId=be_001 - Get all messages assigned to an agent
export async function GET({ url }) {
	try {
		const agentId = url.searchParams.get('agentId');
		
		if (!agentId) {
			return json({ error: 'Agent ID is required' }, { status: 400 });
		}

		// Handle special "director" agent ID for human director
		let agent;
		if (agentId === 'director') {
			agent = {
				id: 'director',
				roleType: 'Human Director',
				squadId: null,
				projectId: null // Director handles all projects
			};
		} else {
			// Verify regular agent exists and get their info
			const [foundAgent] = await db
				.select({
					id: agents.id,
					roleType: agents.roleType,
					squadId: agents.squadId,
					projectId: agents.projectId,
				})
				.from(agents)
				.where(eq(agents.id, agentId))
				.limit(1);

			if (!foundAgent) {
				return json({ error: 'Agent not found' }, { status: 404 });
			}
			agent = foundAgent;
		}

		// Get all reading assignments that target this agent:
		// 1. Direct agent assignments
		// 2. Role assignments (matching agent's role)
		// 3. Squad assignments (matching agent's squad) - TODO when squads are implemented
		const assignmentConditions = [
			and(
				eq(readingAssignments.assignedToType, 'agent'),
				eq(readingAssignments.assignedTo, agentId)
			),
			and(
				eq(readingAssignments.assignedToType, 'role'),
				eq(readingAssignments.assignedTo, agent.roleType)
			)
		];

		// Add squad condition if agent has a squad
		if (agent.squadId) {
			assignmentConditions.push(
				and(
					eq(readingAssignments.assignedToType, 'squad'),
					eq(readingAssignments.assignedTo, agent.squadId)
				)
			);
		}

		// Get all relevant reading assignments with their messages
		const assignedMessages = await db
			.select({
				// Assignment info
				assignmentId: readingAssignments.id,
				assignedToType: readingAssignments.assignedToType,
				assignedTo: readingAssignments.assignedTo,
				assignedAt: readingAssignments.assignedAt,
				
				// Message info
				messageId: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				authorAgentId: content.authorAgentId,
				channelId: content.channelId,
				parentContentId: content.parentContentId,
				createdAt: content.createdAt,
			})
			.from(readingAssignments)
			.innerJoin(content, eq(readingAssignments.contentId, content.id))
			.where(or(...assignmentConditions))
			.orderBy(content.createdAt); // Most recent first

		// For each message, check if this agent has read it
		const messagesWithStatus = await Promise.all(
			assignedMessages.map(async (message) => {
				const [readRecord] = await db
					.select({
						readAt: readingAssignmentReads.readAt,
						acknowledged: readingAssignmentReads.acknowledged,
					})
					.from(readingAssignmentReads)
					.where(and(
						eq(readingAssignmentReads.readingAssignmentId, message.assignmentId),
						eq(readingAssignmentReads.agentId, agentId)
					))
					.limit(1);

				return {
					messageId: message.messageId,
					title: message.title,
					body: message.body,
					type: message.type,
					authorAgentId: message.authorAgentId,
					channelId: message.channelId,
					parentContentId: message.parentContentId,
					createdAt: message.createdAt,
					assignedAt: message.assignedAt,
					assignmentType: message.assignedToType,
					assignmentTarget: message.assignedTo,
					isRead: !!readRecord,
					readAt: readRecord?.readAt || null,
					acknowledged: readRecord?.acknowledged || false,
					isDM: !message.channelId,
					isReply: !!message.parentContentId
				};
			})
		);

		// Separate read vs unread for easy consumption
		const unreadMessages = messagesWithStatus.filter(m => !m.isRead);
		const readMessages = messagesWithStatus.filter(m => m.isRead);

		// AUTO-MARK: Mark all unread messages as read before returning response
		if (unreadMessages.length > 0) {
			try {
				// Find all reading assignment IDs for unread messages
				const unreadAssignmentIds = unreadMessages.map(msg => {
					// Find the assignment ID for this message and agent
					return assignedMessages.find(am => am.messageId === msg.messageId)?.assignmentId;
				}).filter(Boolean);

				// Batch create read records for all unread assignments
				if (unreadAssignmentIds.length > 0) {
					const readRecordsToCreate = unreadAssignmentIds.map(assignmentId => ({
						readingAssignmentId: assignmentId,
						agentId: agentId,
						acknowledged: false,
					}));

					await db.insert(readingAssignmentReads).values(readRecordsToCreate);
					console.log(`Auto-marked ${unreadAssignmentIds.length} messages as read for agent ${agentId}`);
				}
			} catch (autoMarkError) {
				console.error('Failed to auto-mark messages as read:', autoMarkError);
				// Don't fail the request if auto-mark fails, just log it
			}
		}

		// Format response with different data for read vs unread
		const formattedReadMessages = readMessages.map(msg => ({
			messageId: msg.messageId,
			readAt: msg.readAt,
			type: msg.type,
			title: msg.title, // Include title for context
			createdAt: msg.createdAt
		}));

		const formattedUnreadMessages = unreadMessages.map(msg => ({
			messageId: msg.messageId,
			title: msg.title,
			body: msg.body,
			type: msg.type,
			authorAgentId: msg.authorAgentId,
			channelId: msg.channelId,
			parentContentId: msg.parentContentId,
			createdAt: msg.createdAt,
			assignedAt: msg.assignedAt,
			assignmentType: msg.assignmentType,
			assignmentTarget: msg.assignmentTarget,
			isDM: msg.isDM,
			isReply: msg.isReply,
			// These will be false since we just auto-marked them, but keeping structure
			isRead: false,
			readAt: null,
			acknowledged: false
		}));

		return json({
			agent: {
				id: agent.id,
				roleType: agent.roleType,
				squadId: agent.squadId
			},
			// Keep full messages array for backward compatibility (if needed)
			messages: messagesWithStatus,
			unreadMessages: formattedUnreadMessages,
			readMessages: formattedReadMessages,
			summary: {
				total: messagesWithStatus.length,
				unread: unreadMessages.length,
				read: readMessages.length,
				autoMarked: unreadMessages.length, // New field showing how many were auto-marked
				directAssignments: messagesWithStatus.filter(m => m.assignmentType === 'agent').length,
				roleAssignments: messagesWithStatus.filter(m => m.assignmentType === 'role').length,
				squadAssignments: messagesWithStatus.filter(m => m.assignmentType === 'squad').length
			}
		});

	} catch (error) {
		console.error('Failed to load inbox:', error);
		return json({ error: 'Failed to load inbox' }, { status: 500 });
	}
}