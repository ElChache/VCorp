import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, agents, phases, roles, readingAssignments } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET({ params, url }: RequestEvent) {
	try {
		if (!params.id) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}
		const projectId = parseInt(params.id || '');
		const type = url.searchParams.get('type');
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		const query = db
			.select()
			.from(content)
			.where(eq(content.projectId, projectId));

		// Filter by type if specified (e.g., "phase")
		let results;
		if (type) {
			results = await db
				.select()
				.from(content)
				.where(and(
					eq(content.projectId, projectId),
					eq(content.type, type)
				));
		} else {
			results = await query;
		}

		return json(results);
	} catch (error: unknown) {
		console.error('Failed to fetch content:', error);
		return json({ error: 'Failed to fetch content' }, { status: 500 });
	}
}

export async function POST({ params, request }: RequestEvent) {
	try {
		if (!params.id) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}
		const projectId = parseInt(params.id || '');
		const body = await request.json();
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		const { 
			type, 
			title, 
			body: contentBody, 
			documentSlug, 
			authorAgentId,
			assignedToRoleType, 
			phaseStatus, 
			requiredInputs, 
			expectedOutputs,
			readingAssignments 
		} = body;

		if (!type || !title) {
			return json({ error: 'Type and title are required' }, { status: 400 });
		}

		// Create the content
		const [newContent] = await db
			.insert(content)
			.values({
				projectId,
				type,
				title,
				body: contentBody || '',
				documentSlug,
				authorAgentId,
				assignedToRoleType,
				phaseStatus: type === 'phase' ? 'draft' : phaseStatus, // Force phases to draft
				requiredInputs,
				expectedOutputs,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning();

		// Create reading assignments if provided
		if (readingAssignments && readingAssignments.length > 0) {
			try {
				for (const assignment of readingAssignments) {
					if (assignment.assignedTo && assignment.assignedTo.trim()) {
						await db
							.insert(readingAssignments)
							.values({
								contentId: newContent.id,
								assignedToType: assignment.assignedToType,
								assignedTo: assignment.assignedTo
							});
					}
				}
			} catch (assignmentError: unknown) {
				console.error('Failed to create reading assignments:', assignmentError);
				// Don't fail the entire request if reading assignment creation fails
			}
		}

		return json(newContent);
	} catch (error: unknown) {
		console.error('Failed to create content:', error);
		return json({ error: 'Failed to create content' }, { status: 500 });
	}
}