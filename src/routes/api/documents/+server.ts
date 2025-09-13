import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// POST /api/documents - Create a new document
export async function POST({ request }) {
	try {
		const {
			projectId,
			authorAgentId,
			title,
			body,
			documentSlug, // Optional unique slug for referencing
			assignTo // Array of assignments: { type: 'agent'|'role'|'squad', target: 'be_001'|'Backend Developer'|'leadership' }
		} = await request.json();

		// Validate required fields
		if (!projectId) {
			return json({ 
				error: 'Missing required field: projectId must be provided'
			}, { status: 400 });
		}

		if (!body) {
			return json({ 
				error: 'Missing required field: body must be provided and cannot be empty'
			}, { status: 400 });
		}

		// Title is recommended for documents
		if (!title) {
			return json({ 
				error: 'Missing required field: title is required for documents'
			}, { status: 400 });
		}

		// Validate projectId is a valid number
		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Validate documentSlug if provided (must be unique per project)
		if (documentSlug) {
			if (typeof documentSlug !== 'string' || documentSlug.trim() === '') {
				return json({ 
					error: 'Invalid documentSlug: must be a non-empty string'
				}, { status: 400 });
			}

			// Check if slug already exists in this project
			const [existingDoc] = await db
				.select({ id: content.id })
				.from(content)
				.where(eq(content.documentSlug, documentSlug.trim()))
				.limit(1);

			if (existingDoc) {
				return json({ 
					error: `Document slug '${documentSlug.trim()}' already exists in this project`
				}, { status: 409 });
			}
		}

		// Validate assignment targets (if provided)
		if (assignTo && assignTo.length > 0) {
			if (!Array.isArray(assignTo)) {
				return json({ 
					error: 'Invalid assignTo format: must be an array of assignment objects'
				}, { status: 400 });
			}

			for (let i = 0; i < assignTo.length; i++) {
				const assignment = assignTo[i];
				
				if (!assignment || typeof assignment !== 'object') {
					return json({ 
						error: `Invalid assignment at index ${i}: must be an object with 'type' and 'target' properties`
					}, { status: 400 });
				}

				if (!assignment.type || !['agent', 'role', 'squad'].includes(assignment.type)) {
					return json({ 
						error: `Invalid assignment type at index ${i}: must be 'agent', 'role', or 'squad'`
					}, { status: 400 });
				}

				if (!assignment.target || typeof assignment.target !== 'string' || assignment.target.trim() === '') {
					return json({ 
						error: `Invalid target at index ${i}: must be a non-empty string`
					}, { status: 400 });
				}
			}
		}

		// Validate author agent exists (if provided)
		if (authorAgentId && !['director', 'human-director'].includes(authorAgentId)) {
			const [author] = await db
				.select({ id: agents.id, projectId: agents.projectId })
				.from(agents)
				.where(eq(agents.id, authorAgentId))
				.limit(1);
			
			if (!author) {
				return json({ 
					error: `Author agent '${authorAgentId}' not found`
				}, { status: 404 });
			}

			if (author.projectId !== parsedProjectId) {
				return json({ 
					error: `Author agent '${authorAgentId}' does not belong to project ${parsedProjectId}`
				}, { status: 403 });
			}
		}

		// Create the document
		const [newDocument] = await db
			.insert(content)
			.values({
				projectId: parsedProjectId,
				channelId: null, // Documents are not posted to channels
				parentContentId: null, // Documents are not replies
				type: 'document',
				title: title.trim(),
				body: body.trim(),
				documentSlug: documentSlug ? documentSlug.trim() : null,
				authorAgentId: authorAgentId || null,
			})
			.returning();

		// Helper function to resolve agent ID
		const resolveAgentId = async (target: string, type: string): Promise<string> => {
			if (type === 'agent' && target === 'human-director') {
				// Find the actual human director agent ID for this project
				const [humanDirector] = await db
					.select({ id: agents.id })
					.from(agents)
					.where(and(
						eq(agents.projectId, parsedProjectId),
						eq(agents.isHumanDirector, true)
					))
					.limit(1);
				
				return humanDirector?.id || target; // Fallback to original if not found
			}
			return target;
		};

		// Create reading assignments
		let assignmentSummary = [];
		
		// Only manual assignments for documents (no automatic channel assignments)
		if (assignTo && assignTo.length > 0) {
			const assignmentPromises = assignTo.map(async (assignment) => {
				const resolvedTarget = await resolveAgentId(assignment.target, assignment.type);
				
				return await db
					.insert(readingAssignments)
					.values({
						contentId: newDocument.id,
						assignedToType: assignment.type,
						assignedTo: resolvedTarget,
					})
					.returning();
			});

			const createdAssignments = await Promise.all(assignmentPromises);

			// Get summary of who was assigned
			assignmentSummary = assignTo.map((assignment, index) => ({
				type: assignment.type,
				target: assignment.target,
				assignmentId: createdAssignments[index][0].id
			}));
		}

		return json({
			id: newDocument.id,
			projectId: newDocument.projectId,
			type: newDocument.type,
			title: newDocument.title,
			body: newDocument.body,
			documentSlug: newDocument.documentSlug,
			authorAgentId: newDocument.authorAgentId,
			createdAt: newDocument.createdAt,
			updatedAt: newDocument.updatedAt,
			assignments: assignmentSummary
		}, { status: 201 });

	} catch (error) {
		console.error('Failed to create document:', error);
		
		// Provide more specific error messages based on the error type
		if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === '23503') {
			return json({ 
				error: 'Database constraint violation: One or more referenced entities may not exist or may be invalid'
			}, { status: 400 });
		}
		
		if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') {
			return json({ 
				error: 'Constraint violation: Document slug may already exist or other unique constraint failed'
			}, { status: 409 });
		}
		
		return json({ 
			error: 'Internal server error occurred while creating document',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		}, { status: 500 });
	}
}