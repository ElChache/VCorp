import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments } from '$lib/db/schema';
import { eq, and, or, isNull, sql, desc } from 'drizzle-orm';

// GET /api/messages/conversation - Get all DM messages between two agents
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		const agent1 = url.searchParams.get('agent1');
		const agent2 = url.searchParams.get('agent2');
		const showAll = url.searchParams.get('showAll') === 'true'; // Default to false (limit 50)
		
		if (!projectId || !agent1 || !agent2) {
			return json({ error: 'projectId, agent1, and agent2 are required' }, { status: 400 });
		}

		// Get DM messages and replies (channelId = null) authored by either agent
		const messages = await db
			.select({
				id: content.id,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				parentContentId: content.parentContentId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
			})
			.from(content)
			.where(and(
				eq(content.projectId, parseInt(projectId)),
				isNull(content.channelId),
				or(
					// Messages/replies from agent1
					eq(content.authorAgentId, agent1),
					// Messages/replies from agent2
					eq(content.authorAgentId, agent2),
					// Handle null authorAgentId case - treat as agent2 (it_kim_8681) based on context
					and(
						isNull(content.authorAgentId),
						or(
							eq(content.type, 'message'),
							eq(content.type, 'reply')
						)
					)
				)
			))
			.orderBy(desc(content.createdAt));

		// Filter messages that are actually between these two agents (check reading assignments)
		const conversationMessages = [];
		
		for (const message of messages) {
			// For each message, get the reading assignments
			const assignments = await db
				.select({
					id: readingAssignments.id,
					assignedToType: readingAssignments.assignedToType,
					assignedTo: readingAssignments.assignedTo,
					assignedAt: readingAssignments.assignedAt,
				})
				.from(readingAssignments)
				.where(eq(readingAssignments.contentId, message.id));

			// Check if this message is part of the conversation between agent1 and agent2
			let includeMessage = false;

			// Messages from agent1 to agent2
			if (message.authorAgentId === agent1) {
				includeMessage = assignments.some(a => 
					(a.assignedToType === 'agent' && a.assignedTo === agent2) ||
					(a.assignedToType === 'role' && a.assignedTo === agent2)
				);
			}
			
			// Messages from agent2 to agent1 
			else if (message.authorAgentId === agent2) {
				includeMessage = assignments.some(a => 
					(a.assignedToType === 'agent' && a.assignedTo === agent1) ||
					(a.assignedToType === 'role' && a.assignedTo === agent1)
				);
			}
			
			// Handle null authorAgentId - check assignments to determine direction
			else if (message.authorAgentId === null) {
				includeMessage = assignments.some(a => 
					(a.assignedToType === 'agent' && (a.assignedTo === agent1 || a.assignedTo === agent2)) ||
					(a.assignedToType === 'role' && (a.assignedTo === agent1 || a.assignedTo === agent2))
				);
			}

			// Include message if it's part of the conversation
			if (includeMessage) {
				conversationMessages.push({
					...message,
					readingAssignments: assignments
				});
			}
		}

		// Sort by creation time (newest first for limiting)
		conversationMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		// Apply limit after filtering if not showing all messages
		let limitedMessages = conversationMessages;
		if (!showAll) {
			limitedMessages = conversationMessages.slice(0, 20);
		}

		// Sort messages chronologically (oldest first) for display
		const filteredMessages = limitedMessages.reverse();
		
		// Get total count of messages for pagination info
		let totalCount = conversationMessages.length;
		if (!showAll) {
			// Total count is the full conversation length before limiting
			totalCount = conversationMessages.length;
		}

		return json({
			messages: filteredMessages,
			pagination: {
				showing: filteredMessages.length,
				total: totalCount,
				hasMore: !showAll && totalCount > 20,
				showingAll: showAll
			}
		});
	} catch (error) {
		console.error('Failed to load conversation:', error);
		return json({ error: 'Failed to load conversation' }, { status: 500 });
	}
}