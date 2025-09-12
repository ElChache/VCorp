import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, roles, channels, squadRoleAssignments } from '$lib/db/schema';
import { eq, sql, or, and, gte } from 'drizzle-orm';

// GET /api/content/updates - Get incremental content updates since a timestamp
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		const since = url.searchParams.get('since'); // ISO timestamp
		
		if (!projectId) {
			return json({ 
				error: 'Missing required parameter: projectId must be provided'
			}, { status: 400 });
		}

		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Build the where condition - either new content or updated content
		let whereCondition;
		if (since) {
			const sinceDate = new Date(since);
			if (isNaN(sinceDate.getTime())) {
				return json({ 
					error: 'Invalid since parameter: must be a valid ISO timestamp'
				}, { status: 400 });
			}
			
			// Get content that was created OR updated since the timestamp
			whereCondition = and(
				eq(content.projectId, parsedProjectId),
				or(
					gte(content.createdAt, sinceDate),
					gte(content.updatedAt, sinceDate)
				)
			);
		} else {
			// If no timestamp provided, return recent content (last 1 hour as default)
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
			whereCondition = and(
				eq(content.projectId, parsedProjectId),
				or(
					gte(content.createdAt, oneHourAgo),
					gte(content.updatedAt, oneHourAgo)
				)
			);
		}

		// Get updated content with basic fields
		const updates = await db
			.select({
				id: content.id,
				projectId: content.projectId,
				channelId: content.channelId,
				parentContentId: content.parentContentId,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				squadId: content.squadId,
				// Ticket-specific fields
				status: content.status,
				priority: content.priority,
				assignedToRoleType: content.assignedToRoleType,
				claimedByAgent: content.claimedByAgent,
				// Phase-specific fields
				phaseStatus: content.phaseStatus,
				requiredInputs: content.requiredInputs,
				expectedOutputs: content.expectedOutputs,
				// Timestamps
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
			})
			.from(content)
			.where(whereCondition)
			.orderBy(content.updatedAt, content.createdAt);

		// For each updated content, get the reading assignments with read status
		const updatesWithAssignments = await Promise.all(
			updates.map(async (update) => {
				const assignments = await db
					.select({
						id: readingAssignments.id,
						assignedToType: readingAssignments.assignedToType,
						assignedTo: readingAssignments.assignedTo,
						assignedAt: readingAssignments.assignedAt,
					})
					.from(readingAssignments)
					.where(eq(readingAssignments.contentId, update.id));

				// For each assignment, determine which agents should read it and who has read it
				const assignmentsWithStatus = await Promise.all(
					assignments.map(async (assignment) => {
						let targetAgents: string[] = [];
						
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
								.where(and(
									eq(agents.roleType, assignment.assignedTo),
									eq(agents.projectId, parsedProjectId)
								));
							targetAgents = roleAgents.map(a => a.id);
						} else if (assignment.assignedToType === 'squad') {
							// Squad assignment - get all agents in this squad
							const squadAgents = await db
								.select({ id: agents.id })
								.from(agents)
								.where(and(
									eq(agents.squadId, assignment.assignedTo),
									eq(agents.projectId, parsedProjectId)
								));
							targetAgents = squadAgents.map(a => a.id);
						}

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
					...update,
					readingAssignments: assignmentsWithStatus
				};
			})
		);

		// Helper function to check if content is document-related
		const isDocumentRelated = async (content: any) => {
			// Direct document
			if (content.type === 'document') return true;
			
			// Reply to a document (need to check if parent is a document)
			if (content.parentContentId) {
				// First check in current updates batch
				const parentContent = updatesWithAssignments.find(u => u.id === content.parentContentId);
				if (parentContent && parentContent.type === 'document') return true;
				
				// If parent not found in current batch, check database
				try {
					const [parentFromDB] = await db
						.select({ type: content.type })
						.from(content)
						.where(eq(content.id, content.parentContentId))
						.limit(1);
					
					if (parentFromDB && parentFromDB.type === 'document') return true;
				} catch (error) {
					console.error('Error checking parent content type:', error);
				}
			}
			
			return false;
		};

		// Filter document-related content for direct messages (async processing needed)
		const directMessagesPromises = updatesWithAssignments.map(async (u) => {
			if (u.channelId !== null) return null; // Not a DM
			if (u.type === 'document') return null; // Direct document
			
			const isDocRelated = await isDocumentRelated(u);
			return isDocRelated ? null : u; // Return null if document-related, otherwise return content
		});
		
		const directMessagesResults = await Promise.all(directMessagesPromises);
		const directMessages = directMessagesResults.filter(u => u !== null);

		// Group updates by type for easier client processing  
		const groupedUpdates = {
			channelMessages: updatesWithAssignments.filter(u => u.channelId !== null),
			directMessages: directMessages,
			tickets: updatesWithAssignments.filter(u => u.type === 'ticket'),
			documents: updatesWithAssignments.filter(u => u.type === 'document'),
			replies: updatesWithAssignments.filter(u => u.parentContentId !== null),
			phases: updatesWithAssignments.filter(u => u.type === 'phase'),
			all: updatesWithAssignments
		};

		return json({
			updates: groupedUpdates,
			timestamp: new Date().toISOString(), // Current timestamp for next poll
			count: updatesWithAssignments.length,
			since: since || null
		});

	} catch (error: any) {
		console.error('Failed to get content updates:', error);
		
		// Provide more specific error messages based on the error type
		if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === '23503') {
			return json({ 
				error: 'Database constraint violation: The project may not exist or may be invalid. Please verify the project ID is correct.'
			}, { status: 404 });
		}
		
		return json({ 
			error: 'Internal server error occurred while fetching content updates. Please try again or contact support if the problem persists.',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}