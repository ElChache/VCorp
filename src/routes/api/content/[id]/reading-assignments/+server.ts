import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, roles } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/content/[id]/reading-assignments - Get reading assignments for content
export async function GET({ params }) {
	try {
		const contentId = parseInt(params.id);
		
		if (!contentId) {
			return json({ error: 'Content ID is required' }, { status: 400 });
		}

		// Get reading assignments for this content
		const assignments = await db
			.select({
				id: readingAssignments.id,
				assignedToType: readingAssignments.assignedToType,
				assignedTo: readingAssignments.assignedTo,
				assignedAt: readingAssignments.assignedAt,
			})
			.from(readingAssignments)
			.where(eq(readingAssignments.contentId, contentId));

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
						.where(eq(agents.roleType, assignment.assignedTo));
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

		return json(assignmentsWithStatus);
	} catch (error) {
		console.error('Failed to load reading assignments:', error);
		return json({ error: 'Failed to load reading assignments' }, { status: 500 });
	}
}

// POST /api/content/[id]/reading-assignments - Add reading assignments to existing content
export async function POST({ params, request }) {
	try {
		const contentId = parseInt(params.id);
		
		if (!contentId) {
			return json({ error: 'Content ID is required' }, { status: 400 });
		}

		const { assignments } = await request.json();

		if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
			return json({ error: 'assignments array is required' }, { status: 400 });
		}

		// Validate content exists
		const [existingContent] = await db
			.select({ id: content.id })
			.from(content)
			.where(eq(content.id, contentId))
			.limit(1);

		if (!existingContent) {
			return json({ error: 'Content not found' }, { status: 404 });
		}

		// Validate assignment structure
		for (const assignment of assignments) {
			if (!assignment.assignedToType || !assignment.assignedTo) {
				return json({ 
					error: 'Each assignment must have assignedToType and assignedTo' 
				}, { status: 400 });
			}
			if (!['agent', 'role', 'squad'].includes(assignment.assignedToType)) {
				return json({ 
					error: 'assignedToType must be agent, role, or squad' 
				}, { status: 400 });
			}
		}

		// Create reading assignments
		const assignmentPromises = assignments.map(async (assignment) => {
			return await db
				.insert(readingAssignments)
				.values({
					contentId: contentId,
					assignedToType: assignment.assignedToType,
					assignedTo: assignment.assignedTo,
				})
				.returning();
		});

		const createdAssignments = await Promise.all(assignmentPromises);

		// Get summary of who was assigned
		const assignmentSummary = assignments.map((assignment, index) => ({
			type: assignment.assignedToType,
			target: assignment.assignedTo,
			assignmentId: createdAssignments[index][0].id
		}));

		return json({
			assignments: assignmentSummary,
			success: true,
			message: `${assignments.length} reading assignment(s) created successfully`
		});

	} catch (error) {
		console.error('Failed to create reading assignments:', error);
		return json({ error: 'Failed to create reading assignments' }, { status: 500 });
	}
}