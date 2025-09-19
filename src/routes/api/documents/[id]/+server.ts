import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { 
  deleteDocumentViaFile, 
  hardDeleteDocument,
  updateDocumentContent,
  getDocumentById,
  getAgentById,
  canDeleteDocument,
  canUpdateDocument,
  validateDocumentData
} from '$lib/services/documentService.js';

// Permission check functions are now in documentService

// GET - Retrieve document by ID
export const GET: RequestHandler = async ({ params }) => {
  try {
    if (!params.id) {
      return json({ error: 'Document ID is required' }, { status: 400 });
    }
    
    const documentId = parseInt(params.id as string);
    if (isNaN(documentId)) {
      return json({ error: 'Invalid document ID' }, { status: 400 });
    }

    const document = await getDocumentById(documentId);
    if (!document) {
      return json({ error: 'Document not found' }, { status: 404 });
    }

    return json(document);
  } catch (error: unknown) {
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

    // Get agent and document
    const [agent, document] = await Promise.all([
      getAgentById(agentId),
      getDocumentById(documentId)
    ]);

    if (!agent) {
      return json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!document) {
      return json({ error: 'Document not found' }, { status: 404 });
    }

    // Check permissions
    if (!canUpdateDocument(agent, document)) {
      return json({ 
        error: 'Permission denied - only document author and leadership roles can update documents' 
      }, { status: 403 });
    }

    // Parse and validate request body
    const updateData = await request.json();
    const { title, body } = updateData;

    // Validate the update data
    const validation = validateDocumentData({ title, body });
    if (!validation.isValid) {
      return json({ 
        error: 'Validation failed',
        details: validation.errors
      }, { status: 400 });
    }

    if (!title && !body) {
      return json({ error: 'Must provide either title or content to update' }, { status: 400 });
    }

    // Update document using service
    const result = await updateDocumentContent(documentId, { title, body }, true);

    if (!result.success) {
      return json({ error: result.message }, { status: 500 });
    }

    return json({
      success: true,
      document: result.document,
      message: result.message
    });

  } catch (error: unknown) {
    console.error('Error updating document:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// DELETE - Delete document by removing the file (triggers auto-sync)
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

    // Check for hard delete flag
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Hard delete - completely remove from database (no file deletion)
      const result = await hardDeleteDocument(documentId);
      
      if (!result.success) {
        return json({ error: result.message }, { status: 500 });
      }

      return json({
        success: true,
        message: result.message
      });
    } else {
      // Normal delete - remove the file, let file watcher handle DB sync
      const result = await deleteDocumentViaFile(documentId, agentId);
      
      if (!result.success) {
        // Return appropriate status code based on error type
        let statusCode = 500;
        if (result.message.includes('not found')) statusCode = 404;
        if (result.message.includes('Permission denied')) statusCode = 403;
        
        return json({ error: result.message }, { status: statusCode });
      }

      return json({
        success: true,
        message: result.message,
        filePath: result.filePath,
        fallbackToDbDelete: result.fallbackToDbDelete
      });
    }

  } catch (error: unknown) {
    console.error('Error deleting document:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};