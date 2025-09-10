<script lang="ts">
	export let selectedProject: any;
	export let prompts: any[] = [];
	export let promptsByType: Record<string, any[]> = {};

	let showCreatePromptDialog = false;
	let showEditPromptDialog = false;
	let showUpdateTemplateDialog = false;
	let selectedPromptForTemplate: any = null;
	let newPrompt = { name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };
	let editPrompt = { id: 0, name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };

	async function loadPrompts() {
		if (!selectedProject) {
			prompts = [];
			promptsByType = {};
			return;
		}
		try {
			const response = await fetch(`/api/prompts?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				prompts = data.prompts || [];
				promptsByType = data.promptsByType || {};
			}
		} catch (error) {
			console.error('Failed to load prompts:', error);
			prompts = [];
			promptsByType = {};
		}
	}

	function openCreatePromptDialog() {
		newPrompt = { name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };
		showCreatePromptDialog = true;
	}

	function closeCreatePromptDialog() {
		showCreatePromptDialog = false;
		newPrompt = { name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };
	}

	async function createPrompt() {
		if (!newPrompt.name.trim() || !newPrompt.content.trim() || !selectedProject) return;
		
		try {
			const response = await fetch('/api/prompts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newPrompt.name,
					type: newPrompt.type,
					content: newPrompt.content,
					projectId: selectedProject.id,
					orderIndex: newPrompt.orderIndex
				})
			});
			if (response.ok) {
				const prompt = await response.json();
				prompts = [...prompts, prompt];
				await loadPrompts(); // Refresh to get updated grouping
				closeCreatePromptDialog();
			}
		} catch (error) {
			console.error('Failed to create prompt:', error);
		}
	}

	function openEditPromptDialog(prompt: any) {
		editPrompt = {
			id: prompt.id,
			name: prompt.name,
			type: prompt.type,
			content: prompt.content,
			premade: prompt.premade,
			orderIndex: prompt.orderIndex
		};
		showEditPromptDialog = true;
	}

	function closeEditPromptDialog() {
		showEditPromptDialog = false;
		editPrompt = { id: 0, name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };
	}

	async function updatePrompt() {
		if (!editPrompt.name.trim() || !editPrompt.content.trim() || !editPrompt.id) return;
		
		try {
			const response = await fetch(`/api/prompts/${editPrompt.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editPrompt)
			});
			if (response.ok) {
				await loadPrompts(); // Refresh the prompts
				closeEditPromptDialog();
			}
		} catch (error) {
			console.error('Failed to update prompt:', error);
		}
	}

	async function deletePrompt(promptId: number) {
		if (!confirm('Are you sure you want to delete this prompt?')) return;
		
		try {
			const response = await fetch(`/api/prompts/${promptId}`, {
				method: 'DELETE'
			});
			if (response.ok) {
				await loadPrompts(); // Refresh the prompts
			}
		} catch (error) {
			console.error('Failed to delete prompt:', error);
		}
	}

	function openUpdateTemplateDialog(prompt: any) {
		selectedPromptForTemplate = prompt;
		showUpdateTemplateDialog = true;
	}

	async function updateTemplate() {
		if (!selectedPromptForTemplate) return;
		
		try {
			const response = await fetch(`/api/templates/${selectedPromptForTemplate.templateId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: selectedPromptForTemplate.content,
					name: selectedPromptForTemplate.name,
					type: selectedPromptForTemplate.type
				})
			});
			
			if (response.ok) {
				const result = await response.json();
				showUpdateTemplateDialog = false;
				selectedPromptForTemplate = null;
				
				// Show success message
				alert(`Template updated successfully! ${result.affectedCount || 0} prompts across projects will use the new template content.`);
				
				await loadPrompts();
			} else {
				console.error('Failed to update template');
				alert('Failed to update template. Please try again.');
			}
		} catch (error) {
			console.error('Error updating template:', error);
			alert('Failed to update template. Please try again.');
		}
	}

	// Load prompts when selectedProject changes
	$: if (selectedProject) {
		loadPrompts();
	}

	// Export functions needed by parent
	export { loadPrompts };
</script>

<div class="prompts-section">
	<div class="section-header">
		<h2>Custom Prompt Management</h2>
		<p class="section-description">Manage custom prompts and role descriptions. Premade prompts (channel instructions, ticketing system) are managed in the Roles section.</p>
		<button class="btn-primary" on:click={openCreatePromptDialog}>
			➕ Create Custom Prompt
		</button>
	</div>

	{#if Object.keys(promptsByType).length > 0}
		{#each Object.entries(promptsByType) as [type, typePrompts]}
			<div class="prompt-type-section">
				<div class="prompt-type-header">
					<h3>{type.replace(/_/g, ' ').toUpperCase()}</h3>
					<span class="prompt-count">({typePrompts.length})</span>
				</div>
				
				<div class="prompt-list">
					{#each typePrompts as prompt}
						<div class="prompt-card">
							<div class="prompt-card-header">
								<div class="prompt-info">
									<h4 class="prompt-name">{prompt.name}</h4>
									{#if prompt.premade}
										<span class="prompt-badge premade">Premade</span>
									{:else if prompt.templateId}
										<span class="prompt-badge template">Template</span>
									{:else}
										<span class="prompt-badge custom">Custom</span>
									{/if}
								</div>
								<div class="prompt-actions">
									{#if prompt.templateId}
										<button 
											class="btn-template" 
											on:click={() => openUpdateTemplateDialog(prompt)}
											title="Update the original template with this content"
										>📝 Update Template</button>
									{/if}
									<button 
										class="btn-secondary" 
										on:click={() => openEditPromptDialog(prompt)}
										title="Edit prompt"
									>✏️</button>
									<button 
										class="btn-danger" 
										on:click={() => deletePrompt(prompt.id)}
										title="Delete prompt"
									>🗑️</button>
								</div>
							</div>
							
							<div class="prompt-preview">
								{prompt.content ? prompt.content.substring(0, 200) + '...' : 'No content'}
							</div>
							
							<div class="prompt-metadata">
								<span class="prompt-order">Order: #{prompt.orderIndex}</span>
								<span class="prompt-created">
									{#if prompt.createdAt}
										Created: {new Date(prompt.createdAt).toLocaleDateString()}
									{/if}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{:else}
		<div class="empty-prompts">
			<div class="empty-icon">💭</div>
			<h4>No Custom Prompts Yet</h4>
			<p>Create your first custom prompt to get started with advanced role management.</p>
			<button class="btn-primary" on:click={openCreatePromptDialog}>
				Create First Prompt
			</button>
		</div>
	{/if}
</div>

<!-- Create Prompt Dialog -->
{#if showCreatePromptDialog}
	<div class="dialog-overlay" on:click={closeCreatePromptDialog}>
		<div class="dialog large-dialog" on:click|stopPropagation>
			<h3>Create New Prompt</h3>
			
			<div class="form-group">
				<label for="prompt-name">Prompt Name</label>
				<input 
					id="prompt-name"
					type="text" 
					bind:value={newPrompt.name} 
					placeholder="Enter prompt name"
					class="form-input"
				/>
			</div>
			
			<div class="form-group">
				<label for="prompt-type">Type</label>
				<select id="prompt-type" bind:value={newPrompt.type} class="form-select">
					<option value="custom">Custom</option>
					<option value="role_description">Role Description</option>
					<option value="instruction">Instruction</option>
					<option value="template">Template</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="prompt-content">Content</label>
				<textarea 
					id="prompt-content"
					bind:value={newPrompt.content} 
					placeholder="Enter prompt content"
					class="form-textarea large"
					rows="10"
				></textarea>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeCreatePromptDialog}>Cancel</button>
				<button 
					class="btn-primary" 
					on:click={createPrompt}
					disabled={!newPrompt.name.trim() || !newPrompt.content.trim()}
				>
					Create Prompt
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Prompt Dialog -->
{#if showEditPromptDialog}
	<div class="dialog-overlay" on:click={closeEditPromptDialog}>
		<div class="dialog large-dialog" on:click|stopPropagation>
			<h3>Edit Prompt</h3>
			
			<div class="form-group">
				<label for="edit-prompt-name">Prompt Name</label>
				<input 
					id="edit-prompt-name"
					type="text" 
					bind:value={editPrompt.name} 
					placeholder="Enter prompt name"
					class="form-input"
				/>
			</div>
			
			<div class="form-group">
				<label for="edit-prompt-type">Type</label>
				<select id="edit-prompt-type" bind:value={editPrompt.type} class="form-select">
					<option value="custom">Custom</option>
					<option value="role_description">Role Description</option>
					<option value="instruction">Instruction</option>
					<option value="template">Template</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="edit-prompt-content">Content</label>
				<textarea 
					id="edit-prompt-content"
					bind:value={editPrompt.content} 
					placeholder="Enter prompt content"
					class="form-textarea large"
					rows="10"
				></textarea>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeEditPromptDialog}>Cancel</button>
				<button 
					class="btn-primary" 
					on:click={updatePrompt}
					disabled={!editPrompt.name.trim() || !editPrompt.content.trim()}
				>
					Update Prompt
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Update Template Dialog -->
{#if showUpdateTemplateDialog}
	<div class="dialog-overlay" on:click={() => showUpdateTemplateDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>⚠️ Update Template</h3>
			
			{#if selectedPromptForTemplate}
				<div class="warning-section">
					<p><strong>Warning:</strong> This will update the original template with the content from this prompt.</p>
					<p>This action will affect <strong>all projects</strong> that use this template.</p>
					
					<div class="template-info">
						<h4>Template: {selectedPromptForTemplate.name}</h4>
						<p><strong>Current content preview:</strong></p>
						<div class="content-preview">
							{selectedPromptForTemplate.content ? selectedPromptForTemplate.content.substring(0, 200) + '...' : 'No content'}
						</div>
					</div>
				</div>
			{/if}
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showUpdateTemplateDialog = false}>Cancel</button>
				<button class="btn-warning" on:click={updateTemplate}>
					Yes, Update Template
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.prompts-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.section-header {
		border-bottom: 1px solid #e5e5e5;
		padding-bottom: 16px;
	}

	.section-header h2 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 24px;
	}

	.section-description {
		margin: 0 0 16px 0;
		color: #666;
		font-size: 14px;
		line-height: 1.4;
	}

	.prompt-type-section {
		margin-bottom: 32px;
	}

	.prompt-type-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
		padding-bottom: 8px;
		border-bottom: 2px solid #f0f0f0;
	}

	.prompt-type-header h3 {
		margin: 0;
		color: #333;
		font-size: 18px;
		font-weight: 600;
	}

	.prompt-count {
		background: #e7f3ff;
		color: #0066cc;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 500;
	}

	.prompt-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
		gap: 16px;
	}

	.prompt-card {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 16px;
		transition: all 0.2s ease;
	}

	.prompt-card:hover {
		border-color: #007acc;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.prompt-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
		gap: 16px;
	}

	.prompt-info {
		flex: 1;
		min-width: 0;
	}

	.prompt-name {
		margin: 0 0 8px 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
		word-break: break-word;
	}

	.prompt-badge {
		font-size: 11px;
		padding: 4px 8px;
		border-radius: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.prompt-badge.premade {
		background: #e8f5e8;
		color: #2d7d2d;
		border: 1px solid #4caf50;
	}

	.prompt-badge.custom {
		background: #e7f3ff;
		color: #0066cc;
		border: 1px solid #007acc;
	}

	.prompt-badge.template {
		background: #fff3e0;
		color: #e65100;
		border: 1px solid #ff9800;
	}

	.prompt-actions {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-shrink: 0;
	}

	.prompt-actions button {
		padding: 6px 8px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s ease;
	}

	.btn-template {
		background: #fff3e0;
		color: #e65100;
		border: 1px solid #ff9800;
	}

	.btn-template:hover {
		background: #ffe0b2;
	}

	.btn-secondary {
		background: #6c757d;
		color: white;
	}

	.btn-secondary:hover {
		background: #5a6268;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
	}

	.btn-danger:hover {
		background: #c82333;
	}

	.prompt-preview {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		padding: 12px;
		font-family: monospace;
		font-size: 13px;
		line-height: 1.4;
		color: #666;
		margin-bottom: 12px;
		word-break: break-word;
	}

	.prompt-metadata {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: #888;
		gap: 16px;
	}

	.prompt-order {
		font-weight: 500;
	}

	.prompt-created {
		flex-shrink: 0;
	}

	.empty-prompts {
		text-align: center;
		padding: 60px 20px;
		color: #666;
		border: 2px dashed #e5e5e5;
		border-radius: 12px;
		background: #fafafa;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.6;
	}

	.empty-prompts h4 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 18px;
	}

	.empty-prompts p {
		margin: 0 0 24px 0;
		font-size: 14px;
		line-height: 1.4;
	}

	.btn-primary {
		background: #007acc;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.btn-primary:hover {
		background: #005a9e;
	}

	.btn-primary:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	/* Dialog Styles */
	.dialog-overlay {
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

	.dialog {
		background: white;
		border-radius: 8px;
		padding: 24px;
		max-width: 500px;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		width: 90%;
	}

	.large-dialog {
		max-width: 800px;
	}

	.dialog h3 {
		margin: 0 0 24px 0;
		color: #333;
		font-size: 18px;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-weight: 500;
		color: #333;
		font-size: 14px;
	}

	.form-input, .form-select {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		box-sizing: border-box;
	}

	.form-input:focus, .form-select:focus {
		outline: none;
		border-color: #007acc;
		box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
	}

	.form-textarea {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		font-family: monospace;
		resize: vertical;
		box-sizing: border-box;
	}

	.form-textarea:focus {
		outline: none;
		border-color: #007acc;
		box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
	}

	.form-textarea.large {
		min-height: 200px;
	}

	.dialog-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid #e5e5e5;
	}

	.cancel-btn {
		background: #6c757d;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.cancel-btn:hover {
		background: #5a6268;
	}

	.btn-warning {
		background: #dc3545;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.btn-warning:hover {
		background: #c82333;
	}

	.warning-section {
		background: #fff3cd;
		border: 1px solid #ffeaa7;
		border-radius: 4px;
		padding: 16px;
		margin-bottom: 16px;
	}

	.warning-section p {
		margin: 0 0 8px 0;
		color: #856404;
		font-size: 14px;
	}

	.template-info {
		margin-top: 16px;
		padding: 16px;
		background: white;
		border-radius: 4px;
		border: 1px solid #e5e5e5;
	}

	.template-info h4 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 16px;
	}

	.content-preview {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		padding: 8px;
		font-family: monospace;
		font-size: 12px;
		color: #666;
		margin-top: 8px;
	}
</style>