<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	// Props
	export let projectId: number | null = null;
	export let roleType: string = 'human-director';
	export let agentId: string = 'human-director';

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// State
	let templates: any[] = [];
	let selectedTemplateId: string = '';
	let isLoading = false;
	let isOpen = false;
	let searchTerm = '';
	let filteredTemplates: any[] = [];
	let dropdownElement: HTMLDivElement;
	let buttonElement: HTMLButtonElement;
	let openUpward = false;

	// Filter templates based on search
	$: filteredTemplates = templates.filter(template => 
		template.name.toLowerCase().includes(searchTerm.toLowerCase())
	);

	onMount(async () => {
		await loadTemplates();
	});

	async function loadTemplates() {
		if (!projectId) {
			console.log('❌ No projectId provided to QuickTemplateSelector');
			return;
		}
		
		console.log(`📧 Loading templates for project ${projectId}, role ${roleType}, agent ${agentId}`);
		isLoading = true;
		try {
			const response = await fetch(`/api/premade-messages?projectId=${projectId}&roleType=${roleType}`, {
				headers: {
					'X-Agent-ID': agentId
				}
			});
			
			if (response.ok) {
				const data = await response.json();
				templates = data.templates || [];
			} else {
				console.error('Failed to fetch templates:', response.statusText);
				templates = [];
			}
		} catch (error) {
			console.error('Failed to load templates:', error);
			templates = [];
		} finally {
			isLoading = false;
		}
	}

	async function selectTemplate(templateId: string) {
		if (!templateId || !projectId) return;
		
		try {
			const response = await fetch('/api/premade-messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Agent-ID': agentId
				},
				body: JSON.stringify({
					templateId,
					projectId
				})
			});
			
			if (response.ok) {
				const data = await response.json();
				dispatch('templateSelected', {
					templateId,
					resolvedContent: data.content,
					template: templates.find(t => t.id === templateId)
				});
			} else {
				console.error('Failed to resolve template:', response.statusText);
			}
			
			// Reset state
			selectedTemplateId = '';
			searchTerm = '';
			isOpen = false;
		} catch (error) {
			console.error('Failed to resolve template:', error);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isOpen = false;
		}
	}

	function checkDropdownPosition() {
		if (!buttonElement || !dropdownElement) return;
		
		const buttonRect = buttonElement.getBoundingClientRect();
		const dropdownHeight = 400; // max-height from CSS
		const spaceBelow = window.innerHeight - buttonRect.bottom;
		const spaceAbove = buttonRect.top;
		
		// Open upward if there's not enough space below but there is space above
		openUpward = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
	}

	function toggleDropdown() {
		isOpen = !isOpen;
		if (isOpen) {
			loadTemplates();
			// Check position after DOM update
			setTimeout(checkDropdownPosition, 0);
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="template-selector">
	<div class="selector-button-container">
		<button 
			type="button" 
			class="selector-button"
			bind:this={buttonElement}
			on:click={toggleDropdown}
			disabled={!projectId}
			title="Choose a premade message template"
		>
			📝 Templates
			<span class="dropdown-arrow" class:open={isOpen}>▼</span>
		</button>
		
		{#if isOpen}
			<div class="dropdown-menu" class:open-upward={openUpward} bind:this={dropdownElement}>
				<div class="dropdown-header">
					<input
						type="text"
						placeholder="Search templates..."
						bind:value={searchTerm}
						class="search-input"
					/>
				</div>
				
				<div class="dropdown-content">
					{#if isLoading}
						<div class="loading-item">Loading templates...</div>
					{:else if filteredTemplates.length === 0}
						<div class="empty-item">
							{searchTerm ? 'No templates match your search' : 'No templates found'}
						</div>
					{:else}
						{#each filteredTemplates as template}
							<button
								type="button"
								class="template-item"
								on:click={() => selectTemplate(template.id)}
							>
								<div class="template-name">{template.name}</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.template-selector {
		position: relative;
		display: inline-block;
	}

	.selector-button-container {
		position: relative;
	}

	.selector-button {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 100px;
	}

	.selector-button:hover:not(:disabled) {
		background: #e5e7eb;
		border-color: #9ca3af;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.selector-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dropdown-arrow {
		transition: transform 0.2s;
		font-size: 10px;
		color: #6b7280;
	}

	.dropdown-arrow.open {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		right: 0;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		min-width: 300px;
		max-height: 400px;
		overflow: hidden;
		margin-top: 2px;
	}

	.dropdown-menu.open-upward {
		top: auto;
		bottom: 100%;
		margin-top: 0;
		margin-bottom: 2px;
	}

	.dropdown-header {
		padding: 8px;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.search-input {
		width: 100%;
		padding: 6px 8px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 12px;
		outline: none;
	}

	.search-input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	.dropdown-content {
		max-height: 300px;
		overflow-y: auto;
	}

	.template-item {
		width: 100%;
		padding: 10px 12px;
		border: none;
		background: white;
		text-align: left;
		cursor: pointer;
		border-bottom: 1px solid #f3f4f6;
		transition: background-color 0.2s;
	}

	.template-item:hover {
		background: #f9fafb;
	}

	.template-item:last-child {
		border-bottom: none;
	}

	.template-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.template-name {
		font-weight: 500;
		color: #374151;
		font-size: 13px;
	}

	.template-category {
		font-size: 11px;
		color: #6b7280;
		background: #f3f4f6;
		padding: 2px 6px;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.template-description {
		font-size: 11px;
		color: #6b7280;
		line-height: 1.3;
	}

	.loading-item, .empty-item {
		padding: 12px;
		text-align: center;
		color: #6b7280;
		font-size: 12px;
		font-style: italic;
	}

	/* Click outside to close */
	.template-selector :global(body) {
		overflow: hidden;
	}
</style>