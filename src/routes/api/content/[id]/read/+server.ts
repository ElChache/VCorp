import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// PUT /api/content/[id]/read - Mark content as read for an agent
export async function PUT({ params, request }) {
	try {
		const contentId = params.id;
		const { 
			agentId,
			acknowledged = false 
		} = await request.json();

		// Validate contentId
		const parsedContentId = parseInt(contentId);
		if (isNaN(parsedContentId) || parsedContentId <= 0) {
			return json({ 
				error: 'Invalid content ID: must be a positive integer'
			}, { status: 400 });
		}

		// Validate required fields
		if (!agentId) {
			return json({ 
				error: 'Missing required field: agentId must be provided'
			}, { status: 400 });
		}

		// Validate agent exists (unless director)
		if (!['director', 'human-director'].includes(agentId)) {
			const [agent] = await db
				.select({ id: agents.id })
				.from(agents)
				.where(eq(agents.id, agentId))
				.limit(1);
			
			if (!agent) {
				return json({ 
					error: `Agent '${agentId}' not found`
				}, { status: 404 });
			}
		}

		// Verify content exists
		const [targetContent] = await db
			.select({
				id: content.id,
				projectId: content.projectId,
				type: content.type,
				title: content.title
			})
			.from(content)
			.where(eq(content.id, parsedContentId))
			.limit(1);

		if (!targetContent) {
			return json({ 
				error: `Content with ID ${parsedContentId} not found`
			}, { status: 404 });
		}

		// Find reading assignments for this content and agent
		// This covers direct agent assignments, role assignments, and squad assignments
		const assignments = await db
			.select({
				id: readingAssignments.id,
				assignedToType: readingAssignments.assignedToType,
				assignedTo: readingAssignments.assignedTo,
			})
			.from(readingAssignments)
			.where(eq(readingAssignments.contentId, parsedContentId));

		if (assignments.length === 0) {
			return json({ 
				error: `No reading assignments found for content ${parsedContentId}`
			}, { status: 404 });
		}

		// Filter assignments that apply to this agent
		// For now, we'll handle direct agent assignments and assume role/squad matching
		// In a full implementation, you'd query the agent's role/squad memberships
		const relevantAssignments = assignments.filter(assignment => {
			if (assignment.assignedToType === 'agent') {
				return assignment.assignedTo === agentId;
			}
			// For role/squad assignments, we'd need to check agent membership
			// For now, assume they match (this would need proper role checking)
			return true;
		});

		if (relevantAssignments.length === 0) {
			return json({ 
				error: `No reading assignments found for agent ${agentId} on content ${parsedContentId}`
			}, { status: 404 });
		}

		// Mark all relevant assignments as read
		let createdReads = [];
		for (const assignment of relevantAssignments) {
			// Check if already marked as read
			const [existingRead] = await db
				.select({ id: readingAssignmentReads.id })
				.from(readingAssignmentReads)
				.where(and(
					eq(readingAssignmentReads.readingAssignmentId, assignment.id),
					eq(readingAssignmentReads.agentId, agentId)
				))
				.limit(1);

			if (!existingRead) {
				// Create new read record
				const [newRead] = await db
					.insert(readingAssignmentReads)
					.values({
						readingAssignmentId: assignment.id,
						agentId: agentId,
						acknowledged: acknowledged,
					})
					.returning();

				createdReads.push({
					readingAssignmentId: assignment.id,
					assignedToType: assignment.assignedToType,
					assignedTo: assignment.assignedTo,
					readId: newRead.id,
					readAt: newRead.readAt,
					acknowledged: newRead.acknowledged
				});
			}
		}

		if (createdReads.length === 0) {
			return json({ 
				message: `Content ${parsedContentId} already marked as read by agent ${agentId}`,
				contentId: parsedContentId,
				agentId: agentId,
				alreadyRead: true
			});
		}

		return json({
			message: `Content ${parsedContentId} marked as read by agent ${agentId}`,
			contentId: parsedContentId,
			agentId: agentId,
			content: {
				id: targetContent.id,
				type: targetContent.type,
				title: targetContent.title
			},
			readRecords: createdReads,
			acknowledged: acknowledged
		});

	} catch (error) {
		console.error('Failed to mark content as read:', error);
		
		return json({ 
			error: 'Internal server error occurred while marking content as read',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}

// GET /api/content/[id]/read?agentId=be_001 - Check if content is read by agent  
export async function GET({ params, url }) {
	try {
		const contentId = params.id;
		const agentId = url.searchParams.get('agentId');

		// Validate contentId
		const parsedContentId = parseInt(contentId);
		if (isNaN(parsedContentId) || parsedContentId <= 0) {
			return json({ 
				error: 'Invalid content ID: must be a positive integer'
			}, { status: 400 });
		}

		if (!agentId) {
			return json({ 
				error: 'Missing required parameter: agentId'
			}, { status: 400 });
		}

		// Get all reading assignments and their read status for this content and agent
		const readStatus = await db
			.select({
				assignmentId: readingAssignments.id,
				assignedToType: readingAssignments.assignedToType,
				assignedTo: readingAssignments.assignedTo,
				assignedAt: readingAssignments.assignedAt,
				readId: readingAssignmentReads.id,
				readAt: readingAssignmentReads.readAt,
				acknowledged: readingAssignmentReads.acknowledged,
			})
			.from(readingAssignments)
			.leftJoin(
				readingAssignmentReads, 
				and(
					eq(readingAssignments.id, readingAssignmentReads.readingAssignmentId),
					eq(readingAssignmentReads.agentId, agentId)
				)
			)
			.where(eq(readingAssignments.contentId, parsedContentId));

		const hasReads = readStatus.some(status => status.readId !== null);
		const allRead = readStatus.every(status => 
			status.assignedToType !== 'agent' || 
			status.assignedTo !== agentId || 
			status.readId !== null
		);

		return json({
			contentId: parsedContentId,
			agentId: agentId,
			isRead: hasReads,
			allAssignmentsRead: allRead,
			assignments: readStatus.map(status => ({
				assignmentId: status.assignmentId,
				assignedToType: status.assignedToType,
				assignedTo: status.assignedTo,
				assignedAt: status.assignedAt,
				isRead: status.readId !== null,
				readAt: status.readAt,
				acknowledged: status.acknowledged
			}))
		});

	} catch (error) {
		console.error('Failed to get read status:', error);
		
		return json({ 
			error: 'Internal server error occurred while getting read status',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}