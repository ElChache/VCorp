// Client-safe types and utilities for documents
export interface Document {
  id: number;
  title: string;
  body: string;
  documentSlug?: string | null;
  authorAgentId?: string | null;
  projectId: number;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: number;
  name: string;
  path: string;
}

/**
 * Extracts the filename for a document, handling namespaced slugs
 * For private documents, removes the agent ID prefix if present
 */
export function extractFilenameFromDocument(document: Document): string {
  // If we have a documentSlug, use it as the filename base
  if (document.documentSlug) {
    let filename = document.documentSlug;
    
    // If slug is namespaced (agent_id-filename), extract the filename part
    if (document.authorAgentId && filename.includes('-') && filename.startsWith(document.authorAgentId + '-')) {
      filename = filename.substring(document.authorAgentId.length + 1);
    }
    
    return filename;
  }
  
  // Fall back to creating filename from title
  return createFilenameFromTitle(document.title || 'untitled');
}

/**
 * Creates a safe filename from a document title
 */
export function createFilenameFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || 'untitled';
}

/**
 * Gets display information about where a document file is located
 */
export function getDocumentFileDisplayPath(document: Document): string {
  if (document.documentSlug) {
    return `docs/${document.documentSlug}.md`;
  }
  
  if (document.authorAgentId) {
    const filename = extractFilenameFromDocument(document);
    return `agent_workspaces/${document.authorAgentId}/docs/${filename}.md`;
  }
  
  return 'Unknown location';
}

/**
 * Determines if a document is public (has slug) or private (agent workspace)
 */
export function isPublicDocument(document: Document): boolean {
  return !!document.documentSlug;
}

/**
 * Determines if a document is private (in agent workspace)
 */
export function isPrivateDocument(document: Document): boolean {
  return !!document.authorAgentId && !document.documentSlug;
}