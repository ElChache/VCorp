<script>
	import { onMount } from 'svelte';
	import { marked } from 'marked';

	export let selectedProject;

	let documents = [];
	let roleTypes = [];
	let agents = [];
	let squads = [];
	let selectedDocument = null;
	let documentReplies = [];
	let showCreateDocumentDialog = false;
	let showAssignReadingDialog = false;
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
	let newReadingAssignments = [];
	let loading = false;
	let error = null;

	onMount(async () => {
		if (selectedProject) {
			await loadDocuments();
			await loadRoleTypes();
			await loadAgents();
			await loadSquads();
		}
	});

	$: if (selectedProject) {
		loadDocuments();
		loadRoleTypes();
		loadAgents();
		loadSquads();
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

	async function loadRoleTypes() {
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/role-types`);
			if (response.ok) {
				roleTypes = await response.json();
			}
		} catch (err) {
			console.error('Failed to load role types:', err);
		}
	}

	async function loadAgents() {
		try {
			const response = await fetch(`/api/agents?projectId=${selectedProject.id}`);
			if (response.ok) {
				agents = await response.json();
			}
		} catch (err) {
			console.error('Failed to load agents:', err);
		}
	}

	async function loadSquads() {
		try {
			const response = await fetch(`/api/squads?projectId=${selectedProject.id}`);
			if (response.ok) {
				squads = await response.json();
			}
		} catch (err) {
			console.error('Failed to load squads:', err);
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
			// Use content updates API to get replies with full reading assignment data
			const response = await fetch(`/api/content/updates?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				// Filter replies for this specific document
				documentReplies = data.updates.replies?.filter(reply => 
					reply.parentContentId === selectedDocument.id
				) || [];
			}
		} catch (err) {
			console.error('Failed to load document replies:', err);
		}
	}

	async function onDocumentSelect(document) {
		selectedDocument = document;
		replyToContentId = document.id; // Set this for the comment form
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


	async function replyToDocument() {
		if (!documentReplyContent) {
			error = 'Please enter a reply message';
			return;
		}

		try {
			const response = await fetch('/api/send-message', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					projectId: selectedProject.id,
					type: 'reply',
					title: `Reply to: ${selectedDocument.title}`,
					body: documentReplyContent,
					parentContentId: replyToContentId,
					authorAgentId: 'human-director'
				})
			});

			if (response.ok) {
				await loadDocumentReplies();
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

	function openAssignReadingDialog(document) {
		selectedDocument = document;
		newReadingAssignments = [];
		showAssignReadingDialog = true;
		error = null;
	}

	function addNewReadingAssignment() {
		newReadingAssignments = [
			...newReadingAssignments,
			{ assignedToType: 'role', assignedTo: '' }
		];
	}

	function removeNewReadingAssignment(index) {
		newReadingAssignments = newReadingAssignments.filter((_, i) => i !== index);
	}

	async function assignReadingToDocument() {
		if (!selectedDocument || newReadingAssignments.length === 0) {
			error = 'Please add at least one reading assignment';
			return;
		}

		// Validate assignments
		for (const assignment of newReadingAssignments) {
			if (!assignment.assignedToType || !assignment.assignedTo) {
				error = 'Please fill in all assignment fields';
				return;
			}
		}

		try {
			const response = await fetch(`/api/content/${selectedDocument.id}/reading-assignments`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					assignments: newReadingAssignments
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
				showAssignReadingDialog = false;
				newReadingAssignments = [];
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to assign reading';
			}
		} catch (err) {
			error = 'Failed to assign reading: ' + err.message;
		}
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString();
	}

	function formatTimeAgo(timestamp) {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
		
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
		
		return date.toLocaleDateString('en-US', { 
			month: 'short', 
			day: 'numeric', 
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
		});
	}

	// Build flat comment list sorted by timestamp - all replies are to the document
	function buildCommentTree(comments) {
		// All comments are top-level (replies to document), just sort by timestamp
		return comments
			.map(comment => ({ ...comment, children: [] }))
			.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
	}

	$: commentTree = buildCommentTree(documentReplies);

	// Helper functions for read status (same as CommunicationsSection)
	function isMessageFullyRead(message) {
		if (!message.readingAssignments) return false;
		// Only consider assignments that have actual target agents
		const assignmentsWithTargets = message.readingAssignments.filter((assignment) => assignment.totalTargets > 0);
		if (assignmentsWithTargets.length === 0) return false;
		return assignmentsWithTargets.every((assignment) => assignment.isFullyRead);
	}

	function isMessagePartiallyRead(message) {
		if (!message.readingAssignments) return false;
		// Only consider assignments that have actual target agents
		const assignmentsWithTargets = message.readingAssignments.filter((assignment) => assignment.totalTargets > 0);
		return assignmentsWithTargets.some((assignment) => assignment.readCount > 0 && !assignment.isFullyRead);
	}

	// Tooltip variables
	let tooltip = null;

	// Global click handler to dismiss tooltip when clicking elsewhere
	function handleGlobalClick(event) {
		if (tooltip && !tooltip.contains(event.target)) {
			// Clicked outside tooltip, hide it
			document.body.removeChild(tooltip);
			tooltip = null;
			document.removeEventListener('click', handleGlobalClick);
		}
	}

	// Toggle tooltip with agent read status
	function toggleReadStatusTooltip(event, message) {
		// If tooltip is already open, close it
		if (tooltip) {
			document.body.removeChild(tooltip);
			tooltip = null;
			document.removeEventListener('click', handleGlobalClick);
			return;
		}

		// Create tooltip content
		const tooltipContent = createTooltipContent(message);
		
		// Create new tooltip
		tooltip = document.createElement('div');
		tooltip.className = 'read-status-tooltip';
		tooltip.innerHTML = tooltipContent;
		
		document.body.appendChild(tooltip);
		
		// Position tooltip
		const rect = event.target.getBoundingClientRect();
		tooltip.style.position = 'fixed';
		tooltip.style.left = `${rect.left + rect.width + 4}px`;
		tooltip.style.top = `${rect.top - tooltip.offsetHeight / 2 + rect.height / 2}px`;
		tooltip.style.zIndex = '1000';
		tooltip.style.pointerEvents = 'auto';
		
		// Ensure tooltip doesn't go off-screen
		const tooltipRect = tooltip.getBoundingClientRect();
		if (tooltipRect.right > window.innerWidth) {
			tooltip.style.left = `${rect.left - tooltip.offsetWidth - 4}px`;
		}
		if (tooltipRect.top < 0) {
			tooltip.style.top = '8px';
		}
		
		// Add global click handler to dismiss when clicking elsewhere
		setTimeout(() => {
			document.addEventListener('click', handleGlobalClick);
		}, 0);
	}

	// Create tooltip content showing agent read status
	function createTooltipContent(message) {
		if (!message.readingAssignments) return '';
		
		let content = '<div class="tooltip-header">Read Status</div>';
		
		// Group all agents from all assignments
		const allAgents = new Map();
		
		message.readingAssignments.forEach((assignment) => {
			if (assignment.targetAgents && assignment.readBy) {
				assignment.targetAgents.forEach((agentId) => {
					const readInfo = assignment.readBy.find((read) => read.agentId === agentId);
					allAgents.set(agentId, {
						hasRead: !!readInfo,
						readAt: readInfo?.readAt,
						acknowledged: readInfo?.acknowledged
					});
				});
			}
		});
		
		// Convert to sorted array
		const agentEntries = Array.from(allAgents.entries()).sort(([a], [b]) => a.localeCompare(b));
		
		content += '<div class="agents-list">';
		agentEntries.forEach(([agentId, status]) => {
			const icon = status.hasRead ? '✅' : '⏳';
			const className = status.hasRead ? 'agent-read' : 'agent-unread';
			const readTime = status.hasRead && status.readAt ? ` (${new Date(status.readAt).toLocaleString()})` : '';
			content += `<div class="agent-status ${className}">
				<span class="agent-icon">${icon}</span>
				<span class="agent-name">${agentId}</span>
				<span class="read-time">${readTime}</span>
			</div>`;
		});
		content += '</div>';
		
		return content;
	}

</script>

{#snippet commentWithReplies(comment, depth)}
	<div class="comment-thread">
		<div class="message">
			<div class="message-header">
				<span class="message-author">
					{#if comment.authorAgentId === 'human-director'}
						Human Director
					{:else if comment.authorAgentId}
						{comment.authorAgentId}
					{:else}
						Human Director
					{/if}
				</span>
				<span class="message-time">{formatTimeAgo(comment.createdAt)}</span>
				{#if comment.readingAssignments && comment.readingAssignments.length > 0}
					<div class="read-status-icon-container" 
						 on:click={(e) => toggleReadStatusTooltip(e, comment)}>
						<span class="read-status-icon" class:fully-read={isMessageFullyRead(comment)} class:partially-read={isMessagePartiallyRead(comment)}>
							{#if isMessageFullyRead(comment)}
								✅
							{:else if isMessagePartiallyRead(comment)}
								👀
							{:else}
								📩
							{/if}
						</span>
					</div>
				{/if}
			</div>
			<div class="message-content markdown-content">
				{@html marked((comment.body || '').replace(/\\n/g, '\n'))}
			</div>
		</div>
	</div>
{/snippet}

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
		<!-- Column 1: Documents List (Narrower) -->
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
		
		<!-- Column 2: Document Content -->
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
								on:click={() => openAssignReadingDialog(selectedDocument)}
							>
								📋 Assign Reading
							</button>
						</div>
					</div>
					
					<div class="document-body markdown-content">
						{@html marked((selectedDocument.body || '').replace(/\\n/g, '\n'))}
					</div>
				</div>
			{:else}
				<div class="no-document-selected">
					<h3>Select a document to view</h3>
					<p>Choose a document from the sidebar to view its content and manage reading assignments.</p>
				</div>
			{/if}
		</div>

		<!-- Column 3: Comments/Discussion -->
		<div class="comments-column">
			{#if selectedDocument}
				<div class="comments-header">
					<h3>💬 Discussion ({documentReplies.length})</h3>
				</div>
				
				<div class="comments-container">
					{#if commentTree.length > 0}
						{#each commentTree as comment}
							{@render commentWithReplies(comment, 0)}
						{/each}
					{:else}
						<div class="no-comments">
							<p>No comments yet. Start the discussion!</p>
						</div>
					{/if}
				</div>

				<!-- Add Comment Form -->
				<div class="add-comment-form">
					<textarea 
						bind:value={documentReplyContent} 
						placeholder="Add a comment..."
						rows="3"
						class="comment-input"
						on:keydown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								if (documentReplyContent.trim()) {
									replyToDocument();
								}
							}
						}}
					></textarea>
					<button 
						class="btn-primary btn-sm" 
						on:click={replyToDocument}
						disabled={!documentReplyContent.trim()}
					>
						💬 Comment
					</button>
				</div>
			{:else}
				<div class="no-document-comments">
					<p>Select a document to view comments</p>
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
										<option value="">Select Role Type</option>
										{#each roleTypes as roleType}
											<option value={roleType.roleType}>{roleType.roleType} ({roleType.count} agents)</option>
										{/each}
									</select>
								{:else if assignment.assignedToType === 'agent'}
									<select bind:value={assignment.assignedTo}>
										<option value="">Select Agent</option>
										{#each agents as agent}
											<option value={agent.id}>{agent.id} ({agent.roleType})</option>
										{/each}
									</select>
								{:else if assignment.assignedToType === 'squad'}
									<select bind:value={assignment.assignedTo}>
										<option value="">Select Squad</option>
										{#each squads as squad}
											<option value={squad.templateId}>{squad.name}</option>
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


<!-- Assign Reading Dialog -->
{#if showAssignReadingDialog}
	<div class="modal-overlay" on:click={() => showAssignReadingDialog = false}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Assign Reading: {selectedDocument?.title}</h3>
				<button class="modal-close" on:click={() => showAssignReadingDialog = false}>×</button>
			</div>

			<div class="modal-body">
				<p class="modal-description">
					Assign this document to agents, roles, or squads for reading. They will receive notifications to read this document.
				</p>

				<div class="form-group">
					<label>Reading Assignments</label>
					<div class="reading-assignments-section">
						{#each newReadingAssignments as assignment, index}
							<div class="assignment-row">
								<select bind:value={assignment.assignedToType}>
									<option value="role">Role</option>
									<option value="agent">Agent</option>
									<option value="squad">Squad</option>
								</select>
								{#if assignment.assignedToType === 'role'}
									<select bind:value={assignment.assignedTo}>
										<option value="">Select Role Type</option>
										{#each roleTypes as roleType}
											<option value={roleType.roleType}>{roleType.roleType} ({roleType.count} agents)</option>
										{/each}
									</select>
								{:else if assignment.assignedToType === 'agent'}
									<select bind:value={assignment.assignedTo}>
										<option value="">Select Agent</option>
										{#each agents as agent}
											<option value={agent.id}>{agent.id} ({agent.roleType})</option>
										{/each}
									</select>
								{:else if assignment.assignedToType === 'squad'}
									<select bind:value={assignment.assignedTo}>
										<option value="">Select Squad</option>
										{#each squads as squad}
											<option value={squad.templateId}>{squad.name}</option>
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
									on:click={() => removeNewReadingAssignment(index)}
								>
									Remove
								</button>
							</div>
						{/each}
						{#if newReadingAssignments.length === 0}
							<p class="no-assignments">No reading assignments added yet.</p>
						{/if}
						<button 
							type="button" 
							class="btn-secondary btn-sm"
							on:click={addNewReadingAssignment}
						>
							+ Add Assignment
						</button>
					</div>
				</div>
			</div>

			<div class="modal-actions">
				<button class="btn-secondary" on:click={() => showAssignReadingDialog = false}>
					Cancel
				</button>
				<button class="btn-primary" on:click={assignReadingToDocument}>
					Assign Reading
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
		grid-template-columns: 300px 1fr 350px;
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

	.modal-description {
		color: #6b7280;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.no-assignments {
		text-align: center;
		color: #9ca3af;
		font-style: italic;
		padding: 1rem;
		margin: 0;
	}

	/* Markdown Content Styling */
	.markdown-content {
		line-height: 1.6;
	}

	.markdown-content h1,
	.markdown-content h2,
	.markdown-content h3,
	.markdown-content h4,
	.markdown-content h5,
	.markdown-content h6 {
		margin: 1.5em 0 0.5em 0;
		font-weight: 600;
		color: #111827;
	}

	.markdown-content h1 {
		font-size: 1.875rem;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 0.5rem;
	}

	.markdown-content h2 {
		font-size: 1.5rem;
	}

	.markdown-content h3 {
		font-size: 1.25rem;
	}

	.markdown-content h4 {
		font-size: 1.125rem;
	}

	.markdown-content p {
		margin: 1em 0;
	}

	.markdown-content ul,
	.markdown-content ol {
		margin: 1em 0;
		padding-left: 2em;
	}

	.markdown-content li {
		margin: 0.25em 0;
	}

	.markdown-content blockquote {
		margin: 1em 0;
		padding: 0.5em 1em;
		border-left: 4px solid #d1d5db;
		background: #f9fafb;
		color: #6b7280;
	}

	.markdown-content code {
		background: #f3f4f6;
		padding: 0.125em 0.25em;
		border-radius: 0.25rem;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875em;
		color: #dc2626;
	}

	.markdown-content pre {
		background: #1f2937;
		color: #f9fafb;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin: 1em 0;
	}

	.markdown-content pre code {
		background: none;
		padding: 0;
		color: inherit;
		font-size: 0.875rem;
	}

	.markdown-content table {
		border-collapse: collapse;
		width: 100%;
		margin: 1em 0;
	}

	.markdown-content th,
	.markdown-content td {
		border: 1px solid #d1d5db;
		padding: 0.5em;
		text-align: left;
	}

	.markdown-content th {
		background: #f9fafb;
		font-weight: 600;
	}

	.markdown-content a {
		color: #2563eb;
		text-decoration: underline;
	}

	.markdown-content a:hover {
		color: #1d4ed8;
	}

	.markdown-content strong {
		font-weight: 600;
	}

	.markdown-content em {
		font-style: italic;
	}

	.markdown-content hr {
		border: none;
		border-top: 1px solid #e5e7eb;
		margin: 2em 0;
	}
	/* Comments Column Styles */
	.comments-column {
		border-left: 1px solid #e5e7eb;
		background: #f9fafb;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.comments-header {
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
		background: white;
	}

	.comments-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.comments-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.no-comments, .no-document-comments {
		text-align: center;
		padding: 2rem 1rem;
		color: #6b7280;
		font-style: italic;
	}

	/* Message styling - matching communications center exactly */
	.message {
		padding: 0.5rem 0;
		border-bottom: 2px solid #d1d5db;
		margin-bottom: 0.25rem;
	}

	.message:last-child {
		border-bottom: 2px solid #d1d5db;
	}


	.message-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.125rem;
	}

	.message-author {
		font-weight: 700;
		color: #1f2937;
		font-size: 0.8rem;
	}

	.message-time {
		font-size: 0.7rem;
		color: #6b7280;
	}

	.message-content {
		font-size: 0.85rem;
		line-height: 1.4;
		color: #374151;
		margin: 0;
	}

	.message-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.replies-count {
		font-size: 0.75rem;
		color: #6b7280;
		font-style: italic;
	}


	/* Add Comment Form */
	.add-comment-form {
		padding: 1rem;
		border-top: 1px solid #e5e7eb;
		background: white;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.comment-input {
		resize: vertical;
		min-height: 60px;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		font-family: inherit;
	}

	.comment-input:focus {
		outline: 2px solid #3b82f6;
		outline-offset: -1px;
		border-color: #3b82f6;
	}

	.comment-input::placeholder {
		color: #9ca3af;
	}

	/* Markdown content in comments - matching communications center */
	.comments-container .markdown-content h1,
	.comments-container .markdown-content h2,
	.comments-container .markdown-content h3,
	.comments-container .markdown-content h4,
	.comments-container .markdown-content h5,
	.comments-container .markdown-content h6 {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
		font-weight: 600;
		color: #111827;
	}

	.comments-container .markdown-content h1 { font-size: 1.25rem; }
	.comments-container .markdown-content h2 { font-size: 1.125rem; }
	.comments-container .markdown-content h3 { font-size: 1rem; }
	.comments-container .markdown-content h4 { font-size: 0.875rem; }

	.comments-container .markdown-content p {
		margin-bottom: 0.5rem;
		line-height: 1.5;
	}

	.comments-container .markdown-content code {
		background-color: #f3f4f6;
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace;
		font-size: 0.8125rem;
	}

	.comments-container .markdown-content pre {
		background-color: #f3f4f6;
		padding: 0.75rem;
		border-radius: 6px;
		overflow-x: auto;
		margin: 0.5rem 0;
	}

	.comments-container .markdown-content pre code {
		background: none;
		padding: 0;
	}

	.comments-container .markdown-content ul,
	.comments-container .markdown-content ol {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}

	.comments-container .markdown-content li {
		margin: 0.25rem 0;
	}

	.comments-container .markdown-content blockquote {
		border-left: 4px solid #d1d5db;
		padding-left: 1rem;
		margin: 0.5rem 0;
		color: #6b7280;
		font-style: italic;
	}

	.comments-container .markdown-content a {
		color: #3b82f6;
		text-decoration: underline;
	}

	.comments-container .markdown-content a:hover {
		color: #1d4ed8;
	}

	.comments-container .markdown-content strong {
		font-weight: 600;
	}

	.comments-container .markdown-content em {
		font-style: italic;
	}

	/* Simple flat comment styling */
	.comment-thread {
		margin-bottom: 0;
	}

	/* Read status icon (same as CommunicationsSection) */
	.read-status-icon-container {
		display: inline-flex;
		align-items: center;
		margin-left: 8px;
		padding: 4px;
		cursor: pointer;
		border-radius: 6px;
		transition: background-color 0.2s ease;
		min-width: 32px;
		min-height: 24px;
		justify-content: center;
	}
	
	.read-status-icon-container:hover {
		background-color: rgba(0, 0, 0, 0.05);
	}
	
	.read-status-icon {
		font-size: 16px;
		transition: all 0.2s ease;
		user-select: none;
	}
	
	.read-status-icon-container:hover .read-status-icon {
		transform: scale(1.1);
	}

	/* Tooltip styles (same as CommunicationsSection) */
	:global(.read-status-tooltip) {
		background: #1f2937;
		color: white;
		padding: 8px 12px;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		font-size: 12px;
		max-width: 300px;
		min-width: 200px;
		pointer-events: auto;
		user-select: none;
	}
	
	:global(.read-status-tooltip .tooltip-header) {
		font-weight: 600;
		margin-bottom: 6px;
		color: #f3f4f6;
		font-size: 13px;
	}
	
	:global(.read-status-tooltip .agents-list) {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	
	:global(.read-status-tooltip .agent-status) {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
	}
	
	:global(.read-status-tooltip .agent-icon) {
		width: 16px;
		font-size: 11px;
	}
	
	:global(.read-status-tooltip .agent-name) {
		font-weight: 500;
		flex-grow: 1;
	}
	
	:global(.read-status-tooltip .read-time) {
		font-size: 10px;
		color: #9ca3af;
	}
	
	:global(.read-status-tooltip .agent-read) {
		color: #10b981;
	}
	
	:global(.read-status-tooltip .agent-unread) {
		color: #f59e0b;
	}
</style>