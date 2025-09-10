import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET({ url }) {
	try {
		const projectId = parseInt(url.searchParams.get('projectId') || '');
		
		if (isNaN(projectId)) {
			return json({ error: 'Invalid project ID' }, { status: 400 });
		}

		// Get all documents for the project
		const documents = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				documentSlug: content.documentSlug,
				authorAgentId: content.authorAgentId,
				squadId: content.squadId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt
			})
			.from(content)
			.where(and(
				eq(content.projectId, projectId),
				eq(content.type, 'document')
			))
			.orderBy(desc(content.createdAt));

		// Get reading assignments for each document
		const documentsWithAssignments = await Promise.all(
			documents.map(async (doc) => {
				const assignments = await db
					.select({
						id: readingAssignments.id,
						assignedToType: readingAssignments.assignedToType,
						assignedTo: readingAssignments.assignedTo,
						assignedAt: readingAssignments.assignedAt
					})
					.from(readingAssignments)
					.where(eq(readingAssignments.contentId, doc.id));

				// Get read status for each assignment
				const assignmentsWithReads = await Promise.all(
					assignments.map(async (assignment) => {
						const reads = await db
							.select({
								agentId: readingAssignmentReads.agentId,
								readAt: readingAssignmentReads.readAt,
								acknowledged: readingAssignmentReads.acknowledged
							})
							.from(readingAssignmentReads)
							.where(eq(readingAssignmentReads.readingAssignmentId, assignment.id));

						return {
							...assignment,
							reads
						};
					})
				);

				return {
					...doc,
					readingAssignments: assignmentsWithReads
				};
			})
		);

		return json(documentsWithAssignments);
	} catch (error) {
		console.error('Failed to fetch documents:', error);
		return json({ error: 'Failed to fetch documents' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const { projectId, title, body, type = 'document', documentSlug, authorAgentId, squadId, readingAssignments: assignments } = await request.json();

		if (!title?.trim() || !body?.trim()) {
			return json({ error: 'Title and body are required' }, { status: 400 });
		}

		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		// Create the document
		const [newDocument] = await db
			.insert(content)
			.values({
				projectId: parseInt(projectId),
				title: title.trim(),
				body: body.trim(),
				type,
				documentSlug: documentSlug || null,
				authorAgentId: (authorAgentId && authorAgentId !== 'human-director') ? authorAgentId : null,
				squadId: squadId || null,
			})
			.returning();

		// Create reading assignments if provided
		if (assignments && assignments.length > 0) {
			for (const assignment of assignments) {
				await db
					.insert(readingAssignments)
					.values({
						contentId: newDocument.id,
						assignedToType: assignment.assignedToType,
						assignedTo: assignment.assignedTo
					});
			}
		}

		return json(newDocument, { status: 201 });
	} catch (error) {
		console.error('Failed to create document:', error);
		return json({ error: 'Failed to create document' }, { status: 500 });
	}
}