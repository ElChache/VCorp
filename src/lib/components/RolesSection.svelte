<script>
	export let roles = [];
	export let selectedRole = null;
	export let rolePrompts = [];
	export let roleFinalPrompt = '';
	export let loadRolePrompts = () => {};
	export let openAddPromptToRoleDialog = () => {};
	export let handleDragStart = () => {};
	export let handleDragOver = () => {};
	export let handleDrop = () => {};
	export let removePromptFromRole = () => {};
	export let draggedIndex = null;

	function onRoleChange() {
		loadRolePrompts();
	}
</script>

<div class="roles-section">
	<div class="section-header">
		<h2>🎭 Roles Management</h2>
		<div class="role-controls">
			<select bind:value={selectedRole} on:change={onRoleChange} class="role-selector">
				{#if roles.length === 0}
					<option value={null}>No roles</option>
				{:else}
					<option value={null}>Select a role...</option>
					{#each roles as role}
						<option value={role}>{role.name}</option>
					{/each}
				{/if}
			</select>
		</div>
	</div>
	
	{#if selectedRole}
		<div class="role-content">
			<div class="final-prompt-section">
				<h4>Final Role Prompt (All Components)</h4>
				<textarea 
					bind:value={roleFinalPrompt}
					class="role-textarea"
					readonly
					rows="20"
				></textarea>
			</div>
			
			<div class="prompt-composition-section">
				<div class="section-header-with-action">
					<h4>Prompt Composition</h4>
					<button class="btn-primary" on:click={openAddPromptToRoleDialog}>
						➕ Add Prompt
					</button>
				</div>
				
				<div class="prompt-composition">
					{#if rolePrompts.length > 0}
						{#each rolePrompts as prompt, index}
							<div 
								class="prompt-item"
								class:dragging={draggedIndex === index}
								draggable="true"
								on:dragstart={(e) => handleDragStart(e, index)}
								on:dragover={handleDragOver}
								on:drop={(e) => handleDrop(e, index)}
							>
								<div class="prompt-header">
									<span class="prompt-order">#{index + 1}</span>
									<span class="prompt-name">{prompt.name}</span>
									{#if prompt.isPremade || prompt.premade}
										<span class="prompt-badge premade">Premade</span>
									{:else}
										<span class="prompt-badge custom">Custom</span>
									{/if}
								</div>
								
								<div class="prompt-preview">
									{prompt.content ? prompt.content.substring(0, 200) + '...' : 'No content'}
								</div>
								
								<div class="prompt-actions">
									<span class="drag-handle">⋮⋮</span>
									<button 
										class="btn-danger-small" 
										on:click={() => removePromptFromRole(prompt.id)}
									>
										Remove
									</button>
								</div>
							</div>
						{/each}
					{:else}
						<div class="empty-prompts">
							<p>No prompts assigned to this role yet.</p>
							<button class="btn-primary" on:click={openAddPromptToRoleDialog}>
								Add First Prompt
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="no-role-selected">
			<div class="empty-icon">🎭</div>
			<h4>No role selected</h4>
			<p>Select a role from the dropdown to view and manage its prompts</p>
		</div>
	{/if}
</div>

<style>
	.roles-section {
		padding: 20px;
		height: 100%;
		overflow-y: auto;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid #e5e7eb;
	}

	.section-header h2 {
		margin: 0;
		font-size: 24px;
		font-weight: 700;
		color: #111827;
	}

	.role-controls {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.role-selector {
		background: white;
		border: 1px solid #d1d5db;
		padding: 8px 12px;
		border-radius: 4px;
		min-width: 200px;
		font-size: 14px;
	}

	.role-selector:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 1px #3b82f6;
	}

	.role-content {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.final-prompt-section h4,
	.section-header-with-action h4 {
		margin: 0 0 12px 0;
		font-size: 16px;
		font-weight: 600;
		color: #374151;
	}

	.role-textarea {
		width: 100%;
		padding: 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
		font-size: 13px;
		line-height: 1.5;
		background: #f9fafb;
		color: #374151;
		resize: vertical;
		box-sizing: border-box;
	}

	.section-header-with-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.prompt-composition {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.prompt-item {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 16px;
		cursor: move;
		transition: all 0.2s ease;
	}

	.prompt-item:hover {
		border-color: #d1d5db;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.prompt-item.dragging {
		opacity: 0.5;
		transform: rotate(2deg);
	}

	.prompt-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}

	.prompt-order {
		background: #3b82f6;
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		min-width: 24px;
		text-align: center;
	}

	.prompt-name {
		font-weight: 600;
		color: #111827;
		flex: 1;
	}

	.prompt-badge {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.prompt-badge.premade {
		background: #dbeafe;
		color: #2563eb;
	}

	.prompt-badge.custom {
		background: #d1fae5;
		color: #065f46;
	}

	.prompt-preview {
		color: #6b7280;
		font-size: 14px;
		line-height: 1.4;
		margin-bottom: 12px;
		padding: 8px;
		background: #f9fafb;
		border-radius: 4px;
		border-left: 3px solid #e5e7eb;
	}

	.prompt-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.drag-handle {
		color: #9ca3af;
		font-size: 16px;
		cursor: grab;
	}

	.drag-handle:active {
		cursor: grabbing;
	}

	.btn-primary, .btn-danger-small {
		padding: 6px 12px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover {
		background: #2563eb;
	}

	.btn-danger-small {
		background: #fee2e2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}

	.btn-danger-small:hover {
		background: #fecaca;
	}

	.empty-prompts {
		text-align: center;
		padding: 40px 20px;
		color: #6b7280;
		border: 2px dashed #e5e7eb;
		border-radius: 8px;
	}

	.empty-prompts p {
		margin: 0 0 16px 0;
		font-size: 16px;
	}

	.no-role-selected {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 20px;
		text-align: center;
		color: #6b7280;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.6;
	}

	.no-role-selected h4 {
		margin: 0 0 8px 0;
		color: #374151;
		font-size: 18px;
		font-weight: 600;
	}

	.no-role-selected p {
		margin: 0;
		font-size: 16px;
	}
</style>