import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents } from '$lib/db/schema';
import { eq, and, or, like, desc, sql } from 'drizzle-orm';

// GET /api/tickets/search - Search tickets with relevance scoring
export async function GET({ url }: RequestEvent) {
	try {
		const query = url.searchParams.get('q');
		const projectId = url.searchParams.get('projectId');
		const agentId = url.searchParams.get('agentId');
		const status = url.searchParams.get('status');
		const priority = url.searchParams.get('priority');
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		if (!query || query.trim().length < 2) {
			return json({ 
				error: 'Search query must be at least 2 characters long'
			}, { status: 400 });
		}

		// Validate projectId if provided
		if (projectId) {
			const parsedProjectId = parseInt(projectId);
			if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
				return json({ 
					error: 'Invalid projectId: must be a positive integer'
				}, { status: 400 });
			}
		}

		// Build base conditions
		let conditions = [eq(content.type, 'ticket')];

		if (projectId) {
			conditions.push(eq(content.projectId, parseInt(projectId)));
		}

		if (status) {
			conditions.push(eq(content.status, status));
		}

		if (priority) {
			conditions.push(eq(content.priority, priority));
		}

		// Search in title and body
		const searchPattern = `%${query}%`;
		const titleCondition = like(content.title, searchPattern);
		const bodyCondition = like(content.body, searchPattern);
		conditions.push(
			or(titleCondition, bodyCondition)!
		);

		// Get matching tickets
		const tickets = await db
			.select({
				id: content.id,
				projectId: content.projectId,
				type: content.type,
				title: content.title,
				body: content.body,
				status: content.status,
				priority: content.priority,
				assignedToRoleType: content.assignedToRoleType,
				claimedByAgent: content.claimedByAgent,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt
			})
			.from(content)
			.where(and(...conditions))
			.orderBy(desc(content.updatedAt))
			.limit(limit)
			.offset(offset);

		// If agentId provided, filter to assigned tickets
		let filteredTickets = tickets;
		if (agentId) {
			// Get agent's role type for role-based assignments
			const [agent] = await db
				.select({ roleType: agents.roleType })
				.from(agents)
				.where(eq(agents.id, agentId))
				.limit(1);

			// Get tickets assigned to this agent
			const assignedTicketIds = await db
				.select({ contentId: readingAssignments.contentId })
				.from(readingAssignments)
				.where(
					and(
						sql`${readingAssignments.contentId} IN (${tickets.map(t => t.id).join(',') || 'NULL'})`,
						or(
							and(
								eq(readingAssignments.assignedToType, 'agent'),
								eq(readingAssignments.assignedTo, agentId)
							),
							agent?.roleType ? and(
								eq(readingAssignments.assignedToType, 'role'),
								eq(readingAssignments.assignedTo, agent.roleType)
							) : sql`false`
						)
					)
				);

			const assignedIds = new Set(assignedTicketIds.map(a => a.contentId));
			
			filteredTickets = tickets.filter(ticket => 
				ticket.claimedByAgent === agentId || assignedIds.has(ticket.id)
			);
		}

		// Calculate relevance scores and snippets
		const scoredTickets = filteredTickets.map(ticket => {
			const titleMatches = countMatches(ticket.title || '', query);
			const bodyMatches = countMatches(ticket.body, query);
			const relevanceScore = (titleMatches * 3) + bodyMatches; // Title matches weighted higher

			const snippet = generateSearchSnippet(ticket.body, query, 150);

			return {
				...ticket,
				relevanceScore,
				snippet,
				matchLocations: {
					title: titleMatches > 0,
					body: bodyMatches > 0
				}
			};
		});

		// Sort by relevance score
		scoredTickets.sort((a, b) => b.relevanceScore - a.relevanceScore);

		// Get total count for pagination
		const [countResult] = await db
			.select({ count: sql`count(*)` })
			.from(content)
			.where(and(...conditions));

		return json({
			results: scoredTickets,
			query,
			total: Number(countResult.count),
			limit,
			offset
		});

	} catch (error) {
		console.error('Failed to search tickets:', error);
		return json({ 
			error: 'Failed to search tickets',
			details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
		}, { status: 500 });
	}
}

// Helper functions
function countMatches(text: string, query: string): number {
	if (!text) return 0;
	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();
	let count = 0;
	let index = 0;
	
	while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
		count++;
		index += lowerQuery.length;
	}
	
	return count;
}

function generateSearchSnippet(text: string, query: string, maxLength: number = 150): string {
	if (!text) return '';
	
	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const index = lowerText.indexOf(lowerQuery);
	
	if (index === -1) {
		// No match found, return beginning of text
		return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
	}
	
	// Calculate snippet bounds
	const beforeContext = 50;
	const start = Math.max(0, index - beforeContext);
	const end = Math.min(text.length, start + maxLength);
	
	let snippet = text.substring(start, end);
	
	// Add ellipsis if needed
	if (start > 0) snippet = '...' + snippet;
	if (end < text.length) snippet = snippet + '...';
	
	return snippet;
}