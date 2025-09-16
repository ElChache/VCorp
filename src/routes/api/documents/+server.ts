import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents, projects } from '$lib/db/schema';
import { eq, and, or, gte, desc, sql } from 'drizzle-orm';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

// GET /api/documents - List documents for a project with query options
export async function GET({ url }) {
	try {
		const projectId = parseInt(url.searchParams.get('projectId') || '');
		const authorId = url.searchParams.get('authorId');
		const search = url.searchParams.get('search');
		const since = url.searchParams.get('since');
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		if (limit > 100) {
			return json({ error: 'Limit cannot exceed 100' }, { status: 400 });
		}

		// Build base query conditions
		const conditions = [
			eq(content.projectId, projectId),
			eq(content.type, 'document')
		];

		// Add author filter
		if (authorId) {
			conditions.push(eq(content.authorAgentId, authorId));
		}

		// Add date filter
		if (since) {
			const sinceDate = new Date(since);
			if (!isNaN(sinceDate.getTime())) {
				conditions.push(gte(content.createdAt, sinceDate));
			}
		}

		// Build query
		let query = db
			.select({
				id: content.id,
				title: content.title,
				body: search ? content.body : sql`LEFT(${content.body}, 200) as body`, // Truncate body unless searching
				documentSlug: content.documentSlug,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt
			})
			.from(content)
			.where(and(...conditions))
			.orderBy(desc(content.updatedAt))
			.limit(limit)
			.offset(offset);

		// Add search filter if provided
		if (search) {
			const searchConditions = [
				...conditions,
				or(
					sql`${content.title} ILIKE ${'%' + search + '%'}`,
					sql`${content.body} ILIKE ${'%' + search + '%'}`
				)
			];
			
			query = db
				.select({
					id: content.id,
					title: content.title,
					body: content.body,
					documentSlug: content.documentSlug,
					authorAgentId: content.authorAgentId,
					createdAt: content.createdAt,
					updatedAt: content.updatedAt
				})
				.from(content)
				.where(and(...searchConditions))
				.orderBy(desc(content.updatedAt))
				.limit(limit)
				.offset(offset);
		}

		const documents = await query;

		return json({
			documents,
			pagination: {
				limit,
				offset,
				total: documents.length,
				hasMore: documents.length === limit
			},
			filters: {
				authorId: authorId || null,
				search: search || null,
				since: since || null
			}
		});
	} catch (error) {
		console.error('Failed to fetch documents:', error);
		return json({ error: 'Failed to fetch documents' }, { status: 500 });
	}
}

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

		// Create file for the document based on slug presence
		try {
			// Get project path
			const [project] = await db
				.select({ path: projects.path })
				.from(projects)
				.where(eq(projects.id, parsedProjectId))
				.limit(1);

			if (project?.path) {
				let filePath: string;
				let fileContent = `# ${newDocument.title}\n\n${newDocument.body}`;

				if (newDocument.documentSlug) {
					// Document with slug goes to /docs/
					filePath = join(project.path, 'docs', `${newDocument.documentSlug}.md`);
				} else {
					// Document without slug goes to agent's current worktree
					if (newDocument.authorAgentId) {
						// Get agent's current worktree
						const [agent] = await db
							.select({ worktreePath: agents.worktreePath })
							.from(agents)
							.where(eq(agents.id, newDocument.authorAgentId))
							.limit(1);
						
						if (agent?.worktreePath) {
							// Generate a filename from title or use timestamp
							const safeTitle = newDocument.title
								.toLowerCase()
								.replace(/[^a-z0-9]+/g, '-')
								.replace(/^-+|-+$/g, '')
								.substring(0, 50);
							const filename = safeTitle || `document-${Date.now()}`;
							
							// Use the agent's worktree path
							filePath = join(
								agent.worktreePath,
								'docs', 
								`${filename}.md`
							);
						} else {
							// Fallback to agent workspace if no worktree
							const safeTitle = newDocument.title
								.toLowerCase()
								.replace(/[^a-z0-9]+/g, '-')
								.replace(/^-+|-+$/g, '')
								.substring(0, 50);
							const filename = safeTitle || `document-${Date.now()}`;
							
							filePath = join(
								project.path, 
								'agent_workspaces', 
								newDocument.authorAgentId, 
								'docs', 
								`${filename}.md`
							);
						}
					} else {
						// No author and no slug - skip file creation
						console.log('Document has no slug and no author, skipping file creation');
						filePath = null;
					}
				}

				if (filePath) {
					// Ensure directory exists
					await fs.mkdir(dirname(filePath), { recursive: true });
					
					// Write the file
					await fs.writeFile(filePath, fileContent);
					console.log(`📄 Created file for document: ${filePath}`);
				}
			} else {
				console.warn(`Project ${parsedProjectId} has no local path, skipping file creation`);
			}
		} catch (fileError) {
			// Log error but don't fail the API request
			console.error('Failed to create file for document:', fileError);
			// Continue - file creation is best effort
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