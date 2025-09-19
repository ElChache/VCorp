<script lang="ts">
	export let documentSlugs: string[] = [];
	export let label: string = 'Documents';
	export let selectedProject: any;
	export let onUpdate: (slugs: string[]) => void;

	let availableDocuments: any[] = [];
	let showAddDialog = false;
	let newSlugInput = '';
	let selectedSlugFromList = '';
	let isLoadingDocuments = false;

	// Load available document slugs when component mounts or project changes
	$: if (selectedProject) {
		loadAvailableDocuments();
	}

	async function loadAvailableDocuments() {
		if (!selectedProject?.id) return;
		
		isLoadingDocuments = true;
		try {
			const response = await fetch(`/api/documents/slugs?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				availableDocuments = data.slugs || [];
			} else {
				console.error('Failed to load document slugs');
				availableDocuments = [];
			}
		} catch (error) {
			console.error('Error loading document slugs:', error);
			availableDocuments = [];
		} finally {
			isLoadingDocuments = false;
		}
	}

	function removeDocument(slug: string) {
		const updatedSlugs = documentSlugs.filter(s => s !== slug);
		onUpdate(updatedSlugs);
	}

	function addDocument() {
		const slugToAdd = newSlugInput.trim() || selectedSlugFromList;
		
		if (!slugToAdd) {
			alert('Please enter a document slug or select one from the list');
			return;
		}

		if (documentSlugs.includes(slugToAdd)) {
			alert('This document is already in the list');
			return;
		}

		const updatedSlugs = [...documentSlugs, slugToAdd];
		onUpdate(updatedSlugs);
		
		// Reset form
		newSlugInput = '';
		selectedSlugFromList = '';
		showAddDialog = false;
	}

	function cancelAdd() {
		newSlugInput = '';
		selectedSlugFromList = '';
		showAddDialog = false;
	}

	// Filter available documents to exclude already selected ones
	$: filteredAvailableDocuments = availableDocuments.filter(doc => 
		!documentSlugs.includes(doc.slug)
	);
</script>

<div class="document-manager">
	<div class="header">
		<h4>{label}</h4>
		<button class="add-btn" on:click={() => showAddDialog = true} title="Add document">
			+ Add
		</button>
	</div>

	{#if documentSlugs.length > 0}
		<div class="document-list">
			{#each documentSlugs as slug}
				<div class="document-item">
					<span class="document-slug">{slug}</span>
					<button class="remove-btn" on:click={() => removeDocument(slug)} title="Remove document">
						×
					</button>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<span>No documents specified</span>
		</div>
	{/if}

	{#if showAddDialog}
		<div class="add-dialog">
			<div class="dialog-header">
				<h5>Add Document</h5>
			</div>
			
			<div class="input-section">
				<label for="manual-slug">Enter document slug manually:</label>
				<input 
					id="manual-slug"
					type="text" 
					bind:value={newSlugInput}
					placeholder="e.g., api-specification"
					class="slug-input"
				/>
			</div>

			<div class="or-divider">
				<span>OR</span>
			</div>

			<div class="select-section">
				<label for="existing-slug">Choose from existing documents:</label>
				{#if isLoadingDocuments}
					<div class="loading">Loading documents...</div>
				{:else if filteredAvailableDocuments.length > 0}
					<select id="existing-slug" bind:value={selectedSlugFromList} class="slug-select">
						<option value="">Select a document...</option>
						{#each filteredAvailableDocuments as doc}
							<option value={doc.slug}>
								{#if doc.isPublic}
									📄 {doc.title} ({doc.slug})
								{:else}
									👤 {doc.title} ({doc.slug})
								{/if}
							</option>
						{/each}
					</select>
				{:else}
					<div class="no-documents">No available documents found</div>
				{/if}
			</div>

			<div class="dialog-buttons">
				<button class="add-confirm-btn" on:click={addDocument}>
					Add Document
				</button>
				<button class="cancel-btn" on:click={cancelAdd}>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.document-manager {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.add-btn {
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 4px;
		padding: 4px 8px;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.add-btn:hover {
		background: #2563eb;
	}

	.document-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.document-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
	}

	.document-slug {
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		color: #374151;
	}

	.remove-btn {
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 4px;
		width: 20px;
		height: 20px;
		cursor: pointer;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s ease;
	}

	.remove-btn:hover {
		background: #dc2626;
	}

	.empty-state {
		padding: 1rem;
		text-align: center;
		color: #6b7280;
		font-style: italic;
		background: #f9fafb;
		border: 1px dashed #d1d5db;
		border-radius: 4px;
	}

	.add-dialog {
		margin-top: 1rem;
		padding: 1rem;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.dialog-header h5 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.input-section, .select-section {
		margin-bottom: 1rem;
	}

	.input-section label, .select-section label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.slug-input, .slug-select {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 0.875rem;
		transition: border-color 0.2s ease;
	}

	.slug-input:focus, .slug-select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.or-divider {
		text-align: center;
		margin: 1rem 0;
		position: relative;
		color: #6b7280;
		font-size: 0.875rem;
	}

	.or-divider::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 1px;
		background: #e5e7eb;
		z-index: 1;
	}

	.or-divider span {
		background: white;
		padding: 0 1rem;
		position: relative;
		z-index: 2;
	}

	.loading, .no-documents {
		padding: 0.5rem;
		text-align: center;
		color: #6b7280;
		font-style: italic;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
	}

	.dialog-buttons {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 1rem;
	}

	.add-confirm-btn {
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 4px;
		padding: 0.5rem 1rem;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.add-confirm-btn:hover {
		background: #2563eb;
	}

	.cancel-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		padding: 0.5rem 1rem;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.cancel-btn:hover {
		background: #e5e7eb;
		border-color: #9ca3af;
	}
</style>