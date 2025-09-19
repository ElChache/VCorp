import { promises as fs } from 'fs';
import { join } from 'path';
import type { Document, Project } from './documentTypes.js';
import { 
  extractFilenameFromDocument, 
  createFilenameFromTitle 
} from './documentTypes.js';

/**
 * Constructs the file system path for a document based on its properties
 * Handles both public documents (with slug) and private documents (in agent workspaces)
 */
export function getDocumentFilePath(document: Document, projectPath: string): string | null {
  if (!projectPath) {
    return null;
  }

  // Normalize project path (remove trailing slash)
  const normalizedProjectPath = projectPath.endsWith('/') 
    ? projectPath.slice(0, -1) 
    : projectPath;

  if (document.documentSlug) {
    // Public document with slug in /docs/
    return join(normalizedProjectPath, 'docs', `${document.documentSlug}.md`);
  } 
  
  if (document.authorAgentId) {
    // Private document in agent workspace
    const filename = extractFilenameFromDocument(document);
    return join(
      normalizedProjectPath,
      'agent_workspaces',
      document.authorAgentId,
      'docs',
      `${filename}.md`
    );
  }
  
  return null;
}


/**
 * Checks if a document file exists in the file system
 */
export async function documentFileExists(document: Document, projectPath: string): Promise<boolean> {
  const filePath = getDocumentFilePath(document, projectPath);
  if (!filePath) {
    return false;
  }
  
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the content of a document file
 */
export async function readDocumentFile(document: Document, projectPath: string): Promise<string | null> {
  const filePath = getDocumentFilePath(document, projectPath);
  if (!filePath) {
    return null;
  }
  
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Writes content to a document file, creating directories if needed
 */
export async function writeDocumentFile(
  document: Document, 
  projectPath: string, 
  content?: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const filePath = getDocumentFilePath(document, projectPath);
  if (!filePath) {
    return { success: false, error: 'Could not determine file path for document' };
  }
  
  try {
    // Ensure directory exists
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    await fs.mkdir(dir, { recursive: true });
    
    // Create file content with title as first line
    const fileContent = content || `# ${document.title}\n\n${document.body}`;
    
    await fs.writeFile(filePath, fileContent);
    return { success: true, filePath };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message,
      filePath 
    };
  }
}

/**
 * Deletes a document file from the file system
 */
export async function deleteDocumentFile(
  document: Document, 
  projectPath: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const filePath = getDocumentFilePath(document, projectPath);
  if (!filePath) {
    return { success: false, error: 'Could not determine file path for document' };
  }
  
  try {
    // Check if file exists before trying to delete
    await fs.access(filePath);
    
    // Delete the file
    await fs.unlink(filePath);
    
    return { success: true, filePath };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return { success: false, error: 'File does not exist', filePath };
    }
    return { 
      success: false, 
      error: error.message,
      filePath 
    };
  }
}

