import { db } from '$lib/db/index.js';
import { content, agents, projects } from '$lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Document, Project } from '$lib/utils/documentTypes.js';
import { 
  deleteDocumentFile, 
  writeDocumentFile, 
  documentFileExists, 
  getDocumentFilePath 
} from '$lib/utils/documentFileUtils.js';

export interface Agent {
  id: string;
  roleType: string;
  isHumanDirector?: boolean;
}

export interface DocumentOperationResult {
  success: boolean;
  message: string;
  document?: Document;
  filePath?: string;
  error?: string;
  fallbackToDbDelete?: boolean;
}

/**
 * Permission checking utilities
 */
export function canUpdateDocument(agent: Agent, document: Document): boolean {
  // Author can always update
  if (document.authorAgentId === agent.id) return true;
  
  // Human director can always update any document
  if (agent.isHumanDirector) return true;
  
  // Role-based permissions - leadership roles can update any document
  if (['product-manager', 'lead-developer', 'system-architect'].includes(agent.roleType)) return true;
  
  return false;
}

export function canDeleteDocument(agent: Agent, document: Document): boolean {
  // Same logic as update for now - could be more restrictive later
  return canUpdateDocument(agent, document);
}

/**
 * Gets a document by ID with type safety
 */
export async function getDocumentById(documentId: number): Promise<Document | null> {
  const result = await db
    .select()
    .from(content)
    .where(and(
      eq(content.id, documentId),
      eq(content.type, 'document')
    ))
    .limit(1);

  return result[0] || null;
}

/**
 * Gets an agent by ID
 */
export async function getAgentById(agentId: string): Promise<Agent | null> {
  const result = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  return result[0] || null;
}

/**
 * Gets a project by ID
 */
export async function getProjectById(projectId: number): Promise<Project | null> {
  const result = await db
    .select({ id: projects.id, name: projects.name, path: projects.path })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return result[0] || null;
}

/**
 * Updates a document in the database and optionally syncs to file
 */
export async function updateDocumentContent(
  documentId: number,
  updateData: { title?: string; body?: string },
  syncToFile: boolean = true
): Promise<DocumentOperationResult> {
  try {
    // Update document in database
    const updateFields: any = {
      updatedAt: new Date()
    };

    if (updateData.title) updateFields.title = updateData.title;
    if (updateData.body) updateFields.body = updateData.body;

    const updatedDocument = await db
      .update(content)
      .set(updateFields)
      .where(eq(content.id, documentId))
      .returning();

    const document = updatedDocument[0] as Document;

    if (syncToFile) {
      // Get project for file operations
      const project = await getProjectById(document.projectId);
      if (project) {
        const fileResult = await writeDocumentFile(document, project.path);
        if (fileResult.success) {
          console.log(`📄 Updated file for document: ${fileResult.filePath}`);
        } else {
          console.warn(`Could not update file for document ${documentId}: ${fileResult.error}`);
        }
      }
    }

    return {
      success: true,
      message: 'Document updated successfully',
      document
    };

  } catch (error: any) {
    console.error('Error updating document:', error);
    return {
      success: false,
      message: 'Failed to update document',
      error: error.message
    };
  }
}

/**
 * Soft deletes a document in the database
 */
export async function softDeleteDocument(documentId: number): Promise<DocumentOperationResult> {
  try {
    const document = await getDocumentById(documentId);
    if (!document) {
      return {
        success: false,
        message: 'Document not found'
      };
    }

    await db
      .update(content)
      .set({
        title: `[DELETED] ${document.title}`,
        body: '[This document has been deleted]',
        updatedAt: new Date()
      })
      .where(eq(content.id, documentId));

    return {
      success: true,
      message: 'Document deleted (soft delete)',
      document
    };

  } catch (error: any) {
    console.error('Error soft deleting document:', error);
    return {
      success: false,
      message: 'Failed to delete document',
      error: error.message
    };
  }
}

/**
 * Hard deletes a document from the database
 */
export async function hardDeleteDocument(documentId: number): Promise<DocumentOperationResult> {
  try {
    const document = await getDocumentById(documentId);
    if (!document) {
      return {
        success: false,
        message: 'Document not found'
      };
    }

    await db
      .delete(content)
      .where(eq(content.id, documentId));

    return {
      success: true,
      message: 'Document permanently deleted from database',
      document
    };

  } catch (error: any) {
    console.error('Error hard deleting document:', error);
    return {
      success: false,
      message: 'Failed to permanently delete document',
      error: error.message
    };
  }
}

/**
 * Deletes a document by removing its file (triggers file watcher sync)
 * Falls back to database soft delete if file operations fail
 */
export async function deleteDocumentViaFile(
  documentId: number,
  agentId: string
): Promise<DocumentOperationResult> {
  try {
    // Get document
    const document = await getDocumentById(documentId);
    if (!document) {
      return {
        success: false,
        message: 'Document not found'
      };
    }

    // Get agent and check permissions
    const agent = await getAgentById(agentId);
    if (!agent) {
      return {
        success: false,
        message: 'Agent not found'
      };
    }

    if (!canDeleteDocument(agent, document)) {
      return {
        success: false,
        message: 'Permission denied - only document author and leadership roles can delete documents'
      };
    }

    // Get project for file operations
    const project = await getProjectById(document.projectId);
    if (!project) {
      return {
        success: false,
        message: 'Project not found'
      };
    }

    // Try to delete the file first (this triggers file watcher sync)
    const fileResult = await deleteDocumentFile(document, project.path);
    
    if (fileResult.success) {
      console.log(`📄 Deleted file for document ${documentId}: ${fileResult.filePath}`);
      
      return {
        success: true,
        message: 'Document file deleted - will be automatically removed from database by file sync',
        filePath: fileResult.filePath,
        document
      };
    } else {
      // File deletion failed - fall back to database hard delete
      console.warn(`Could not delete file for document ${documentId}: ${fileResult.error}`);
      
      const dbResult = await hardDeleteDocument(documentId);
      
      return {
        ...dbResult,
        message: dbResult.success 
          ? 'Document deleted in database (file not found or inaccessible)'
          : 'Failed to delete document file and database record',
        fallbackToDbDelete: true,
        filePath: fileResult.filePath
      };
    }

  } catch (error: any) {
    console.error('Error deleting document via file:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
}

/**
 * Validates document data for creation/updates
 */
export function validateDocumentData(data: {
  title?: string;
  body?: string;
  type?: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      errors.push('Title is required and cannot be empty');
    }
    if (data.title && data.title.length > 255) {
      errors.push('Title cannot exceed 255 characters');
    }
  }

  if (data.body !== undefined) {
    if (!data.body || data.body.trim().length === 0) {
      errors.push('Content is required and cannot be empty');
    }
  }

  if (data.type !== undefined) {
    const validTypes = ['document', 'specification', 'ticket'];
    if (!validTypes.includes(data.type)) {
      errors.push('Invalid document type');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}