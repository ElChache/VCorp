import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, roles } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/channels/[id]/messages - Get messages for a channel
export async function GET({ params }) {
	try {
		const channelId = parseInt(params.id);
		
		if (!channelId) {
			return json({ error: 'Channel ID is required' }, { status: 400 });
		}

		// Get all messages for this channel, ordered by creation time
		const messages = await db
			.select({
				id: content.id,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
				// Ticket-specific fields
				status: content.status,
				priority: content.priority,
				assignedToRoleType: content.assignedToRoleType,
				claimedByAgent: content.claimedByAgent,
			})
			.from(content)
			.where(eq(content.channelId, channelId))
			.orderBy(content.createdAt);

		// For each message, get the reading assignments with read status
		const messagesWithAssignments = await Promise.all(
			messages.map(async (message) => {
				const assignments = await db
					.select({
						id: readingAssignments.id,
						assignedToType: readingAssignments.assignedToType,
						assignedTo: readingAssignments.assignedTo,
						assignedAt: readingAssignments.assignedAt,
					})
					.from(readingAssignments)
					.where(eq(readingAssignments.contentId, message.id));

				// For each assignment, determine which agents should read it and who has read it
				const assignmentsWithStatus = await Promise.all(
					assignments.map(async (assignment) => {
						let targetAgents = [];
						
						// Get agents that should read this assignment based on type
						if (assignment.assignedToType === 'agent') {
							// Direct agent assignment
							const agent = await db
								.select({ id: agents.id })
								.from(agents)
								.where(eq(agents.id, assignment.assignedTo))
								.limit(1);
							if (agent.length > 0) {
								targetAgents = [agent[0].id];
							}
						} else if (assignment.assignedToType === 'role') {
							// Role assignment - get all agents with this role type
							const roleAgents = await db
								.select({ id: agents.id })
								.from(agents)
								.innerJoin(roles, eq(agents.roleId, roles.id))
								.where(eq(roles.name, assignment.assignedTo));
							targetAgents = roleAgents.map(a => a.id);
						}
						// TODO: Add squad support later

						// Get which of these agents have actually read it
						const reads = await db
							.select({
								agentId: readingAssignmentReads.agentId,
								readAt: readingAssignmentReads.readAt,
								acknowledged: readingAssignmentReads.acknowledged,
							})
							.from(readingAssignmentReads)
							.where(eq(readingAssignmentReads.readingAssignmentId, assignment.id));

						const readByAgents = reads.map(r => r.agentId);
						const unreadAgents = targetAgents.filter(id => !readByAgents.includes(id));

						return {
							...assignment,
							targetAgents,
							readBy: reads,
							unreadAgents,
							totalTargets: targetAgents.length,
							readCount: reads.length,
							isFullyRead: unreadAgents.length === 0 && targetAgents.length > 0
						};
					})
				);

				return {
					...message,
					readingAssignments: assignmentsWithStatus
				};
			})
		);

		return json(messagesWithAssignments);
	} catch (error) {
		console.error('Failed to load channel messages:', error);
		return json({ error: 'Failed to load channel messages' }, { status: 500 });
	}
}

// POST /api/channels/[id]/messages - Create a message or ticket in a channel
export async function POST({ params, request }) {
	try {
		const channelId = parseInt(params.id);
		
		// Allow channelId = 0 for DM messages (treat as null)
		if (isNaN(channelId) || channelId < 0) {
			return json({ error: 'Valid Channel ID is required' }, { status: 400 });
		}

		const body = await request.json();
		const { 
			type, 
			title, 
			body: messageBody, 
			authorAgentId,
			projectId,
			// Ticket-specific fields
			priority,
			status,
			assignedToRoleType,
			claimedByAgent
		} = body;

		if (!type || !messageBody) {
			return json({ error: 'type and body are required' }, { status: 400 });
		}

		if (!projectId) {
			return json({ error: 'projectId is required' }, { status: 400 });
		}

		// Create the content
		const [newContent] = await db
			.insert(content)
			.values({
				projectId,
				channelId: channelId === 0 ? null : channelId,
				type,
				title,
				body: messageBody,
				authorAgentId,
				// Ticket-specific fields (null for non-tickets)
				status: type === 'ticket' ? status : null,
				priority: type === 'ticket' ? priority : null,
				assignedToRoleType: type === 'ticket' ? assignedToRoleType : null,
				claimedByAgent: type === 'ticket' ? claimedByAgent : null,
			})
			.returning();

		return json(newContent);
	} catch (error) {
		console.error('Failed to create content:', error);
		return json({ error: 'Failed to create content' }, { status: 500 });
	}
}