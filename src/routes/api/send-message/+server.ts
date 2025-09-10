import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents, roles } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/send-message - Send a message with automatic reading assignments
export async function POST({ request }) {
	try {
		const {
			projectId,
			authorAgentId,
			title,
			body,
			channelId, // Optional - null for DMs
			parentContentId, // Optional - for replies to other messages/content
			type = 'message', // 'message', 'document', 'announcement', 'report', 'reply'
			assignTo // Array of assignments: { type: 'agent'|'role'|'squad', target: 'be_001'|'Backend Developer'|'leadership' }
		} = await request.json();

		// Validate required fields
		if (!projectId || !body || !assignTo || assignTo.length === 0) {
			return json({ 
				error: 'projectId, body, and at least one assignTo target are required' 
			}, { status: 400 });
		}

		// Validate assignment targets
		for (const assignment of assignTo) {
			if (!assignment.type || !assignment.target) {
				return json({ 
					error: 'Each assignTo must have type and target' 
				}, { status: 400 });
			}
			if (!['agent', 'role', 'squad'].includes(assignment.type)) {
				return json({ 
					error: 'assignTo type must be agent, role, or squad' 
				}, { status: 400 });
			}
		}

		// Validate author agent exists (if provided)
		if (authorAgentId) {
			const [author] = await db
				.select({ id: agents.id })
				.from(agents)
				.where(eq(agents.id, authorAgentId))
				.limit(1);
			
			if (!author) {
				return json({ error: 'Author agent not found' }, { status: 400 });
			}
		}

		// Check if any assignments target the reserved "director" agent ID
		const hasDirectorAssignment = assignTo.some(assignment => 
			assignment.type === 'agent' && assignment.target === 'director'
		);

		// If targeting director, ensure this is a DM (no channelId)
		if (hasDirectorAssignment && channelId) {
			return json({ 
				error: 'Messages to director must be sent as direct messages (no channel)' 
			}, { status: 400 });
		}

		// Validate parent content exists if this is a reply
		if (parentContentId) {
			const [parentContent] = await db
				.select({ id: content.id, projectId: content.projectId })
				.from(content)
				.where(eq(content.id, parentContentId))
				.limit(1);
			
			if (!parentContent) {
				return json({ error: 'Parent content not found' }, { status: 400 });
			}
			
			// Ensure reply is in the same project as parent
			if (parentContent.projectId !== parseInt(projectId)) {
				return json({ error: 'Reply must be in the same project as parent content' }, { status: 400 });
			}
		}

		// Create the message
		const [newMessage] = await db
			.insert(content)
			.values({
				projectId: parseInt(projectId),
				channelId: channelId ? parseInt(channelId) : null,
				parentContentId: parentContentId ? parseInt(parentContentId) : null,
				type: type,
				title: title || null,
				body,
				authorAgentId: authorAgentId || null,
			})
			.returning();

		// Create reading assignments
		const assignmentPromises = assignTo.map(async (assignment) => {
			return await db
				.insert(readingAssignments)
				.values({
					contentId: newMessage.id,
					assignedToType: assignment.type,
					assignedTo: assignment.target,
				})
				.returning();
		});

		const createdAssignments = await Promise.all(assignmentPromises);

		// Get summary of who was assigned
		const assignmentSummary = assignTo.map((assignment, index) => ({
			type: assignment.type,
			target: assignment.target,
			assignmentId: createdAssignments[index][0].id
		}));

		return json({
			message: newMessage,
			assignments: assignmentSummary,
			success: true,
			isDM: !channelId,
			isReply: !!parentContentId,
			parentContentId: parentContentId || null
		});

	} catch (error) {
		console.error('Failed to send message:', error);
		return json({ error: 'Failed to send message' }, { status: 500 });
	}
}