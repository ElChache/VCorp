import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { content, agents, projects } from '$lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';
import { promises as fs } from 'fs';
import { join } from 'path';

// Permission check functions
function checkDocumentUpdatePermission(agent: any, document: any): boolean {
  // Author can always update
  if (document.authorAgentId === agent.id) return true;
  
  // Role-based permissions - leadership roles can update any document
  if (['product-manager', 'lead-developer', 'system-architect'].includes(agent.roleType)) return true;
  
  return false;
}

function checkDocumentDeletePermission(agent: any, document: any): boolean {
  // Same logic as update for now - could be more restrictive later
  return checkDocumentUpdatePermission(agent, document);
}

// GET - Retrieve document by ID
export const GET: RequestHandler = async ({ params }) => {
  try {
    const documentId = parseInt(params.id as string);
    if (isNaN(documentId)) {
      return json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const document = await db
      .select()
      .from(content)
      .where(and(
        eq(content.id, documentId),
        eq(content.type, 'document')
      ))
      .limit(1);

    if (document.length === 0) {
      return json({ error: 'Document not found' }, { status: 404 });
    }

    return json(document[0]);
  } catch (error) {
    console.error('Error fetching document:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// PUT - Update document
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const documentId = parseInt(params.id as string);
    if (isNaN(documentId)) {
      return json({ error: 'Invalid document ID' }, { status: 400 });
    }

    // Get agent from header
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return json({ error: 'Missing X-Agent-ID header' }, { status: 400 });
    }

    // Get agent information
    const agentResult = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agentResult.length === 0) {
      return json({ error: 'Agent not found' }, { status: 404 });
    }

    const agent = agentResult[0];

    // Get document
    const documentResult = await db
      .select()
      .from(content)
      .where(and(
        eq(content.id, documentId),
        eq(content.type, 'document')
      ))
      .limit(1);

    if (documentResult.length === 0) {
      return json({ error: 'Document not found' }, { status: 404 });
    }

    const document = documentResult[0];

    // Check permissions
    const canUpdate = checkDocumentUpdatePermission(agent, document);
    if (!canUpdate) {
      return json({ 
        error: 'Permission denied - only document author and leadership roles can update documents' 
      }, { status: 403 });
    }

    // Parse request body
    const updateData = await request.json();
    const { title, body: newContent } = updateData;

    if (!title && !newContent) {
      return json({ error: 'Must provide either title or content to update' }, { status: 400 });
    }

    // Update document with edit tracking
    const updateFields: any = {
      updatedAt: new Date()
    };

    if (title) updateFields.title = title;
    if (newContent) updateFields.body = newContent;

    const updatedDocument = await db
      .update(content)
      .set(updateFields)
      .where(eq(content.id, documentId))
      .returning();

    // Update file if it exists
    try {
      const [project] = await db
        .select({ path: projects.path })
        .from(projects)
        .where(eq(projects.id, updatedDocument[0].projectId))
        .limit(1);

      if (project?.path) {
        let filePath: string;

        if (updatedDocument[0].documentSlug) {
          // Document with slug in /docs/
          filePath = join(project.path, 'docs', `${updatedDocument[0].documentSlug}.md`);
        } else if (updatedDocument[0].authorAgentId) {
          // Document without slug in agent workspace
          // Try to find existing file by checking if it exists
          const safeTitle = document.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
          
          filePath = join(
            project.path, 
            'agent_workspaces', 
            updatedDocument[0].authorAgentId, 
            'docs', 
            `${safeTitle}.md`
          );
        }

        if (filePath) {
          try {
            // Check if file exists
            await fs.access(filePath);
            
            // Update file content
            const fileContent = `# ${updatedDocument[0].title}\n\n${updatedDocument[0].body}`;
            await fs.writeFile(filePath, fileContent);
            console.log(`📄 Updated file for document: ${filePath}`);
          } catch (err) {
            // File doesn't exist, skip update
            console.log(`File doesn't exist for document ${documentId}, skipping file update`);
          }
        }
      }
    } catch (fileError) {
      // Log error but don't fail the API request
      console.error('Failed to update file for document:', fileError);
    }

    return json({
      success: true,
      document: updatedDocument[0],
      message: 'Document updated successfully'
    });

  } catch (error) {
    console.error('Error updating document:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// DELETE - Delete document (soft delete by default)
export const DELETE: RequestHandler = async ({ params, request }) => {
  try {
    const documentId = parseInt(params.id as string);
    if (isNaN(documentId)) {
      return json({ error: 'Invalid document ID' }, { status: 400 });
    }

    // Get agent from header
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return json({ error: 'Missing X-Agent-ID header' }, { status: 400 });
    }

    // Get agent information
    const agentResult = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agentResult.length === 0) {
      return json({ error: 'Agent not found' }, { status: 404 });
    }

    const agent = agentResult[0];

    // Get document
    const documentResult = await db
      .select()
      .from(content)
      .where(and(
        eq(content.id, documentId),
        eq(content.type, 'document')
      ))
      .limit(1);

    if (documentResult.length === 0) {
      return json({ error: 'Document not found' }, { status: 404 });
    }

    const document = documentResult[0];

    // Check permissions
    const canDelete = checkDocumentDeletePermission(agent, document);
    if (!canDelete) {
      return json({ 
        error: 'Permission denied - only document author and leadership roles can delete documents' 
      }, { status: 403 });
    }

    // Check for hard delete flag
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Hard delete - completely remove from database
      await db
        .delete(content)
        .where(eq(content.id, documentId));

      return json({
        success: true,
        message: 'Document permanently deleted'
      });
    } else {
      // Soft delete - mark as deleted but keep in database
      await db
        .update(content)
        .set({
          title: `[DELETED] ${document.title}`,
          body: '[This document has been deleted]',
          updatedAt: new Date()
        })
        .where(eq(content.id, documentId));

      return json({
        success: true,
        message: 'Document deleted (soft delete)'
      });
    }

  } catch (error) {
    console.error('Error deleting document:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};