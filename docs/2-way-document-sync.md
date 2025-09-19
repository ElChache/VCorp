# 2-Way Document Sync System

VCorp implements a sophisticated 2-way synchronization system between the file system and database for documents and tickets. This system ensures that documents remain consistent whether they are created, modified, or deleted through the UI or directly in the file system.

## Architecture Overview

The sync system consists of three main components:

1. **File Watcher** - Monitors file system changes using `chokidar`
2. **Document Service** - Handles business logic and database operations  
3. **File Utilities** - Manages file system operations and path resolution

## How 2-Way Sync Works

### File → Database Sync

When files are **created, modified, or deleted** in the file system:

1. **File Watcher Detection**: `MonitoringManager` detects changes via `chokidar` file watching
2. **Event Processing**: Processes `add`, `change`, and `unlink` events for `.md` files
3. **Path Analysis**: Determines document type and extracts metadata from file path
4. **Database Sync**: Updates database records to match file system state

```typescript
// File watcher events trigger database updates
.on('add', (path) => this.handleFileAdd(path))
.on('change', (path) => this.handleFileChange(path))  
.on('unlink', (path) => this.handleFileDelete(path))
```

### Database → File Sync

When documents are **created or updated** through the UI:

1. **API Request**: User actions trigger API calls to `/api/documents/*`
2. **Database Update**: Document service updates database records
3. **File Sync**: Utility functions write changes to corresponding files
4. **Loop Prevention**: Modification timestamps prevent infinite sync loops

```typescript
// API updates trigger file writes
const result = await updateDocumentContent(documentId, updateData, true);
// syncToFile parameter controls whether to write to file system
```

## File Organization & Path Logic

### Public Documents
- **Location**: `docs/*.md`
- **Slug**: Simple filename (e.g., `api-spec.md` → `api-spec`)
- **Database**: `documentSlug` field contains the slug
- **Access**: Shared across all agents

### Private Documents  
- **Location**: `agent_workspaces/{AGENT_ID}/docs/*.md`
- **Slug**: Namespaced format `{agent_id}-{filename}`
- **Database**: `authorAgentId` field identifies owner
- **Access**: Restricted to owning agent

## Path Resolution Logic

The system uses smart path resolution to handle both document types:

```typescript
export function getDocumentFilePath(document: Document, projectPath: string): string | null {
  if (document.documentSlug) {
    // Public document: docs/slug.md
    return join(projectPath, 'docs', `${document.documentSlug}.md`);
  } 
  
  if (document.authorAgentId) {
    // Private document: agent_workspaces/agent/docs/filename.md
    const filename = extractFilenameFromDocument(document);
    return join(projectPath, 'agent_workspaces', document.authorAgentId, 'docs', `${filename}.md`);
  }
  
  return null;
}
```

## Document Operations

### Document Creation

1. **UI Creation**: Form submission → API → Database → File creation
2. **File Creation**: New file → File watcher → Database creation

### Document Updates

1. **UI Updates**: Edit form → API → Database + File update
2. **File Updates**: Direct edit → File watcher → Database update

### Document Deletion

1. **UI Deletion**: Delete button → API → File deletion → File watcher → Database soft delete
2. **File Deletion**: Direct deletion → File watcher → Database soft delete

## Sync Conflict Resolution

### Loop Prevention
- **Modification Tracking**: System tracks file modification times
- **Recent Change Detection**: Ignores changes made within 1 second by sync system
- **Timestamp Comparison**: Prevents circular updates between file and database

### Error Handling
- **File Access Errors**: Falls back to database-only operations
- **Permission Issues**: Graceful degradation with user feedback
- **Missing Directories**: Auto-creation of required directory structure

## Key Features

### Slug Management
- **Public Documents**: Direct slug-to-filename mapping
- **Private Documents**: Automatic namespacing to prevent conflicts
- **Filename Extraction**: Smart parsing of namespaced slugs

### Soft Deletion
- **File Deletion**: Triggers database soft delete with `[DELETED]` prefix
- **Data Preservation**: Original content preserved for audit purposes
- **UI Updates**: Automatic removal from document lists

### Permission Integration
- **Role-Based Access**: Leadership roles can modify any document
- **Author Rights**: Document authors retain full control
- **Permission Validation**: Consistent across UI and API operations

## Utility Functions

### Core File Operations
```typescript
// Check if document file exists
documentFileExists(document, projectPath): Promise<boolean>

// Read document content from file
readDocumentFile(document, projectPath): Promise<string | null>

// Write document content to file
writeDocumentFile(document, projectPath, content?): Promise<Result>

// Delete document file
deleteDocumentFile(document, projectPath): Promise<Result>
```

### Path Utilities
```typescript
// Get full file system path
getDocumentFilePath(document, projectPath): string | null

// Get display path for UI
getDocumentFileDisplayPath(document): string

// Extract filename from document metadata
extractFilenameFromDocument(document): string
```

## Technical Implementation

### File Watcher Configuration
```typescript
chokidar.watch([
  `${projectPath}/docs/**/*.md`,
  `${projectPath}/agent_workspaces/**/docs/**/*.md`,
  `${projectPath}/tickets/**/*.md`
], {
  ignored: /[\/\\]\./,
  persistent: true,
  ignoreInitial: true
})
```

### Database Schema Integration
```sql
-- Documents table
content: {
  id: number,
  title: string,
  body: string,
  documentSlug?: string,  -- For public documents
  authorAgentId?: string, -- For private documents
  type: 'document' | 'ticket',
  projectId: number,
  createdAt: Date,
  updatedAt: Date
}
```

## Best Practices

### For Developers
1. **Always use utility functions** for file operations
2. **Handle both sync directions** in API endpoints
3. **Validate paths** before file operations
4. **Use proper error handling** with fallback strategies

### For Content Management
1. **Prefer UI operations** for complex documents
2. **Use direct file editing** for bulk operations
3. **Understand slug implications** when moving files
4. **Monitor sync logs** for troubleshooting

## Troubleshooting

### Common Issues
- **Sync Loops**: Check modification timestamp logic
- **Permission Errors**: Verify file system permissions
- **Missing Files**: Check path resolution logic
- **Slug Conflicts**: Validate uniqueness constraints

### Debug Commands
```bash
# Monitor file watcher events
grep "File.*event" logs/app.log

# Check sync statistics  
curl /api/monitoring/status

# Validate document paths
node -e "console.log(getDocumentFilePath(document, projectPath))"
```

This 2-way sync system provides seamless integration between file-based workflows and database-driven UI operations, ensuring consistency and reliability across all document management scenarios.