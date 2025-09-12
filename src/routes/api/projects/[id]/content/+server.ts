import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, agents, phases, roles, readingAssignments } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET({ params, url }) {
	try {
		const projectId = parseInt(params.id);
		const type = url.searchParams.get('type');
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		let query = db
			.select()
			.from(content)
			.where(eq(content.projectId, projectId));

		// Filter by type if specified (e.g., "phase")
		if (type) {
			query = query.where(and(
				eq(content.projectId, projectId),
				eq(content.type, type)
			));
		}

		const results = await query;

		return json(results);
	} catch (error) {
		console.error('Failed to fetch content:', error);
		return json({ error: 'Failed to fetch content' }, { status: 500 });
	}
}

export async function POST({ params, request }) {
	try {
		const projectId = parseInt(params.id);
		const body = await request.json();
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		const { 
			type, 
			title, 
			body: contentBody, 
			documentSlug, 
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
				assignedToRoleType,
				phaseStatus,
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
			} catch (assignmentError) {
				console.error('Failed to create reading assignments:', assignmentError);
				// Don't fail the entire request if reading assignment creation fails
			}
		}

		return json(newContent);
	} catch (error) {
		console.error('Failed to create content:', error);
		return json({ error: 'Failed to create content' }, { status: 500 });
	}
}