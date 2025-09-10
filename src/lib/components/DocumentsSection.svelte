<script>
	import { onMount } from 'svelte';

	export let selectedProject;

	let documents = [];
	let roles = [];
	let selectedDocument = null;
	let documentReplies = [];
	let showCreateDocumentDialog = false;
	let showReplyToDocumentDialog = false;
	let newDocument = { 
		title: '', 
		body: '', 
		type: 'document', 
		documentSlug: '', 
		authorAgentId: '', 
		squadId: '',
		readingAssignments: [] 
	};
	let documentReplyContent = '';
	let replyToContentId = null;
	let documentReadingAssignments = [];
	let loading = false;
	let error = null;

	onMount(async () => {
		if (selectedProject) {
			await loadDocuments();
			await loadRoles();
		}
	});

	$: if (selectedProject) {
		loadDocuments();
		loadRoles();
	}

	async function loadDocuments() {
		if (!selectedProject?.id) return;
		
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/content?type=document`);
			if (response.ok) {
				documents = await response.json();
				
				// Load reading assignments for each document
				for (let document of documents) {
					await loadDocumentReadingAssignments(document);
				}
			} else {
				error = 'Failed to load documents';
			}
		} catch (err) {
			error = 'Failed to load documents: ' + err.message;
		} finally {
			loading = false;
		}
	}

	async function loadRoles() {
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/roles`);
			if (response.ok) {
				roles = await response.json();
			}
		} catch (err) {
			console.error('Failed to load roles:', err);
		}
	}

	async function loadDocumentReadingAssignments(document) {
		try {
			const response = await fetch(`/api/content/${document.id}/reading-assignments`);
			if (response.ok) {
				const assignments = await response.json();
				document.readingAssignments = assignments;
			}
		} catch (err) {
			console.error('Failed to load reading assignments for document:', err);
		}
	}

	async function loadDocumentReplies() {
		if (!selectedDocument?.id) return;

		try {
			const response = await fetch(`/api/content/${selectedDocument.id}/replies`);
			if (response.ok) {
				documentReplies = await response.json();
			}
		} catch (err) {
			console.error('Failed to load document replies:', err);
		}
	}

	async function onDocumentSelect(document) {
		selectedDocument = document;
		await loadDocumentReplies();
	}

	function openCreateDocumentDialog() {
		newDocument = { 
			title: '', 
			body: '', 
			type: 'document', 
			documentSlug: '', 
			authorAgentId: '', 
			squadId: '',
			readingAssignments: [] 
		};
		documentReadingAssignments = [];
		showCreateDocumentDialog = true;
		error = null;
	}

	async function createDocument() {
		if (!newDocument.title || !newDocument.body) {
			error = 'Please fill in all required fields';
			return;
		}

		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/content`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					...newDocument,
					readingAssignments: documentReadingAssignments
				})
			});

			if (response.ok) {
				const createdDocument = await response.json();
				documents = [...documents, createdDocument];
				showCreateDocumentDialog = false;
				newDocument = { 
					title: '', 
					body: '', 
					type: 'document', 
					documentSlug: '', 
					authorAgentId: '', 
					squadId: '',
					readingAssignments: [] 
				};
				documentReadingAssignments = [];
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to create document';
			}
		} catch (err) {
			error = 'Failed to create document: ' + err.message;
		}
	}

	function openReplyDialog(document) {
		selectedDocument = document;
		replyToContentId = document.id;
		documentReplyContent = '';
		showReplyToDocumentDialog = true;
		error = null;
	}

	async function replyToDocument() {
		if (!documentReplyContent) {
			error = 'Please enter a reply message';
			return;
		}

		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/content`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					type: 'reply',
					title: `Reply to: ${selectedDocument.title}`,
					body: documentReplyContent,
					parentContentId: replyToContentId
				})
			});

			if (response.ok) {
				await loadDocumentReplies();
				showReplyToDocumentDialog = false;
				documentReplyContent = '';
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to reply to document';
			}
		} catch (err) {
			error = 'Failed to reply to document: ' + err.message;
		}
	}

	async function markDocumentAsRead() {
		if (!selectedDocument) return;

		try {
			const response = await fetch(`/api/content/${selectedDocument.id}/mark-read`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					agentId: 'human-director'
				})
			});

			if (response.ok) {
				// Refresh the document's reading assignments
				await loadDocumentReadingAssignments(selectedDocument);
				// Update the documents list
				const index = documents.findIndex(d => d.id === selectedDocument.id);
				if (index >= 0) {
					documents[index] = { ...selectedDocument };
					documents = [...documents];
				}
			}
		} catch (err) {
			console.error('Failed to mark document as read:', err);
		}
	}

	function addDocumentReadingAssignment() {
		documentReadingAssignments = [
			...documentReadingAssignments,
			{ assignedToType: 'role', assignedTo: '' }
		];
	}

	function removeDocumentReadingAssignment(index) {
		documentReadingAssignments = documentReadingAssignments.filter((_, i) => i !== index);
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString();
	}
</script>

<div class="documents-section">
	<div class="section-header">
		<h2>📄 Documents</h2>
		<button 
			class="btn-primary"
			on:click={openCreateDocumentDialog}
		>
			📝 Create Document
		</button>
	</div>

	{#if error}
		<div class="error-banner">
			{error}
		</div>
	{/if}
	
	<div class="documents-layout">
		<div class="documents-sidebar">
			<div class="documents-list">
				{#if loading}
					<div class="loading">Loading documents...</div>
				{:else if documents.length > 0}
					{#each documents as document}
						<div 
							class="document-item"
							class:selected={selectedDocument?.id === document.id}
							on:click={() => onDocumentSelect(document)}
						>
							<div class="document-header">
								<h4>{document.title}</h4>
								<span class="document-type">{document.type}</span>
							</div>
							<div class="document-meta">
								<span class="author">{document.authorAgentId || 'Unknown'}</span>
								<span class="date">{formatDate(document.createdAt)}</span>
							</div>
							{#if document.readingAssignments?.length > 0}
								{@const assignmentsByType = document.readingAssignments.reduce((groups, assignment) => {
									const key = assignment.assignedToType;
									if (!groups[key]) groups[key] = [];
									groups[key].push(assignment);
									return groups;
								}, {})}
								<div class="reading-status-section document-assignments">
									<h5>📋 Reading Assignments ({document.readingAssignments.length})</h5>
									<div class="assignments-grouped">
										{#each Object.entries(assignmentsByType) as [type, assignments]}
											<div class="assignment-group">
												<div class="group-header">
													<span class="group-type-icon">
														{#if type === 'role'}👥{:else if type === 'agent'}🤖{:else if type === 'squad'}👨‍👩‍👧‍👦{/if}
													</span>
													<strong>{type.charAt(0).toUpperCase() + type.slice(1)}s</strong>
													<span class="group-count">({assignments.length})</span>
												</div>
												<div class="assignment-items">
													{#each assignments as assignment}
														<div class="assignment-item" class:fully-read={assignment.isFullyRead}>
															<div class="assignment-info">
																<span class="assignment-name">{assignment.assignedTo}</span>
																<div class="read-indicators">
																	<span class="read-count" class:all-read={assignment.isFullyRead}>
																		{assignment.readCount || 0}/{assignment.totalTargets || 1}
																	</span>
																	<div class="read-status-indicator" class:read={assignment.isFullyRead}>
																		{assignment.isFullyRead ? '✅' : '⏳'}
																	</div>
																</div>
															</div>
														</div>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="empty-state">
						<h3>No Documents Yet</h3>
						<p>Create your first document to get started.</p>
						<button class="btn-secondary" on:click={openCreateDocumentDialog}>
							Create Document
						</button>
					</div>
				{/if}
			</div>
		</div>
		
		<div class="document-viewer">
			{#if selectedDocument}
				<div class="document-content">
					<div class="document-header-full">
						<h1>{selectedDocument.title}</h1>
						<div class="document-meta-full">
							<span class="document-type-badge">{selectedDocument.type}</span>
							<span class="author">by {selectedDocument.authorAgentId || 'Unknown'}</span>
							<span class="date">{formatDate(selectedDocument.createdAt)}</span>
							{#if selectedDocument.readingAssignments?.some(assignment => assignment.assignedTo === 'human-director' && assignment.reads?.length === 0)}
								<button 
									class="btn-secondary btn-sm"
									on:click={markDocumentAsRead}
								>
									Mark as Read
								</button>
							{/if}
							<button 
								class="btn-secondary btn-sm"
								on:click={() => openReplyDialog(selectedDocument)}
							>
								💬 Reply
							</button>
						</div>
					</div>
					
					<div class="document-body">
						{@html selectedDocument.body.replace(/\n/g, '<br>')}
					</div>

					{#if documentReplies.length > 0}
						<div class="document-replies">
							<h3>Replies ({documentReplies.length})</h3>
							{#each documentReplies as reply}
								<div class="reply-item">
									<div class="reply-header">
										<strong>{reply.authorAgentId || 'Unknown'}</strong>
										<span class="reply-date">{formatDate(reply.createdAt)}</span>
									</div>
									<div class="reply-body">
										{@html reply.body.replace(/\n/g, '<br>')}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<div class="no-document-selected">
					<h3>Select a document to view</h3>
					<p>Choose a document from the sidebar to view its content and manage reading assignments.</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Create Document Dialog -->
{#if showCreateDocumentDialog}
	<div class="modal-overlay" on:click={() => showCreateDocumentDialog = false}>
		<div class="modal-content large" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Create New Document</h3>
				<button class="modal-close" on:click={() => showCreateDocumentDialog = false}>×</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="doc-title">Title *</label>
					<input 
						type="text" 
						id="doc-title"
						bind:value={newDocument.title} 
						placeholder="Enter document title"
						autofocus
					/>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="doc-type">Type</label>
						<select id="doc-type" bind:value={newDocument.type}>
							<option value="document">Document</option>
							<option value="specification">Specification</option>
							<option value="report">Report</option>
							<option value="announcement">Announcement</option>
						</select>
					</div>

					<div class="form-group">
						<label for="doc-slug">Document Slug</label>
						<input 
							type="text" 
							id="doc-slug"
							bind:value={newDocument.documentSlug} 
							placeholder="unique-document-id"
						/>
					</div>
				</div>

				<div class="form-group">
					<label for="doc-body">Content *</label>
					<textarea 
						id="doc-body"
						bind:value={newDocument.body} 
						placeholder="Enter document content"
						rows="10"
					></textarea>
				</div>

				<div class="form-group">
					<label>Reading Assignments</label>
					<div class="reading-assignments-section">
						{#each documentReadingAssignments as assignment, index}
							<div class="assignment-row">
								<select bind:value={assignment.assignedToType}>
									<option value="role">Role</option>
									<option value="agent">Agent</option>
									<option value="squad">Squad</option>
								</select>
								{#if assignment.assignedToType === 'role'}
									<select bind:value={assignment.assignedTo}>
										<option value="">Select Role</option>
										{#each roles as role}
											<option value={role.id}>{role.name}</option>
										{/each}
									</select>
								{:else}
									<input 
										type="text" 
										bind:value={assignment.assignedTo} 
										placeholder="Enter {assignment.assignedToType} name"
									/>
								{/if}
								<button 
									type="button" 
									class="btn-danger btn-sm"
									on:click={() => removeDocumentReadingAssignment(index)}
								>
									Remove
								</button>
							</div>
						{/each}
						<button 
							type="button" 
							class="btn-secondary btn-sm"
							on:click={addDocumentReadingAssignment}
						>
							+ Add Assignment
						</button>
					</div>
				</div>
			</div>

			<div class="modal-actions">
				<button class="btn-secondary" on:click={() => showCreateDocumentDialog = false}>
					Cancel
				</button>
				<button class="btn-primary" on:click={createDocument}>
					Create Document
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Reply to Document Dialog -->
{#if showReplyToDocumentDialog}
	<div class="modal-overlay" on:click={() => showReplyToDocumentDialog = false}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Reply to: {selectedDocument?.title}</h3>
				<button class="modal-close" on:click={() => showReplyToDocumentDialog = false}>×</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="reply-content">Reply *</label>
					<textarea 
						id="reply-content"
						bind:value={documentReplyContent} 
						placeholder="Enter your reply"
						rows="6"
						autofocus
					></textarea>
				</div>
			</div>

			<div class="modal-actions">
				<button class="btn-secondary" on:click={() => showReplyToDocumentDialog = false}>
					Cancel
				</button>
				<button class="btn-primary" on:click={replyToDocument}>
					Send Reply
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.documents-section {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.documents-layout {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 20px;
		height: 100%;
		flex: 1;
		min-height: 0;
	}

	.documents-sidebar {
		border-right: 1px solid #ddd;
		padding: 1rem;
		overflow-y: auto;
	}

	.documents-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.document-item {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 12px;
		cursor: pointer;
		transition: all 0.2s;
		background: white;
	}

	.document-item:hover {
		border-color: #007bff;
		box-shadow: 0 2px 4px rgba(0,123,255,0.1);
	}

	.document-item.selected {
		border-color: #007bff;
		background-color: #f8f9ff;
		box-shadow: 0 2px 8px rgba(0,123,255,0.15);
	}

	.document-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 8px;
	}

	.document-header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #333;
	}

	.document-type {
		background: #e9ecef;
		color: #495057;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
	}

	.document-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		color: #6b7280;
		margin-bottom: 8px;
	}

	.author {
		font-weight: 500;
	}

	.document-assignments {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid #e5e7eb;
	}

	.document-assignments h5 {
		margin: 0 0 8px 0;
		font-size: 0.875rem;
		color: #374151;
	}

	.assignment-group {
		margin-bottom: 8px;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.75rem;
		color: #6b7280;
		margin-bottom: 4px;
	}

	.group-count {
		color: #9ca3af;
	}

	.assignment-items {
		margin-left: 1rem;
	}

	.assignment-item {
		padding: 4px 0;
	}

	.assignment-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.assignment-name {
		font-size: 0.75rem;
		color: #374151;
	}

	.read-indicators {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.read-count {
		font-size: 0.7rem;
		color: #6b7280;
	}

	.read-count.all-read {
		color: #059669;
		font-weight: 600;
	}

	.read-status-indicator {
		font-size: 0.75rem;
	}

	.document-viewer {
		padding: 1rem;
		overflow-y: auto;
	}

	.document-header-full {
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.document-header-full h1 {
		margin: 0 0 1rem 0;
		font-size: 2rem;
		font-weight: 700;
		color: #111827;
	}

	.document-meta-full {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.document-type-badge {
		background: #3b82f6;
		color: white;
		padding: 4px 12px;
		border-radius: 16px;
		font-size: 0.875rem;
		font-weight: 500;
		text-transform: capitalize;
	}

	.document-body {
		font-size: 1rem;
		line-height: 1.7;
		color: #374151;
		margin-bottom: 2rem;
		white-space: pre-wrap;
	}

	.document-replies {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid #e5e7eb;
	}

	.document-replies h3 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
	}

	.reply-item {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.reply-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.reply-header strong {
		color: #374151;
	}

	.reply-date {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.reply-body {
		color: #374151;
		line-height: 1.5;
	}

	.empty-state, .no-document-selected {
		text-align: center;
		padding: 3rem 1rem;
		color: #6b7280;
	}

	.empty-state h3, .no-document-selected h3 {
		margin: 0 0 0.5rem 0;
		color: #374151;
	}

	.loading {
		text-align: center;
		padding: 2rem;
		color: #6b7280;
	}

	.error-banner {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #dc2626;
		padding: 1rem;
		margin: 1rem;
		border-radius: 6px;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		margin: 1rem;
	}

	.modal-content.large {
		max-width: 800px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: #6b7280;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-close:hover {
		color: #374151;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.25rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: 2px solid #3b82f6;
		outline-offset: -1px;
		border-color: #3b82f6;
	}

	.reading-assignments-section {
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 1rem;
	}

	.assignment-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.assignment-row select {
		width: auto;
		min-width: 100px;
	}

	.assignment-row input {
		flex: 1;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid #e5e7eb;
	}

	.btn-primary, .btn-secondary, .btn-danger {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid transparent;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover {
		background: #2563eb;
	}

	.btn-secondary {
		background: white;
		color: #374151;
		border-color: #d1d5db;
	}

	.btn-secondary:hover {
		background: #f9fafb;
	}

	.btn-danger {
		background: #dc2626;
		color: white;
	}

	.btn-danger:hover {
		background: #b91c1c;
	}

	.btn-sm {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
	}
</style>