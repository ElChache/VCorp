<script lang="ts">
	export let selectedProject: any;
	export let roles: any[] = [];
	export let selectedRole: any = null;

	let rolePrompts: any[] = [];
	let roleChannels: any = null;
	let roleFinalPrompt: string = '';
	let draggedIndex: number | null = null;
	let availablePromptsForRole: any[] = [];
	let showAddPromptToRoleDialog = false;

	async function loadRoles() {
		if (!selectedProject) {
			roles = [];
			return;
		}
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/roles`);
			if (response.ok) {
				roles = await response.json();
				selectedRole = roles.length > 0 ? roles[0] : null;
				if (selectedRole) {
					await loadRolePrompts();
				}
			}
		} catch (error) {
			console.error('Failed to load roles:', error);
			roles = [];
		}
	}

	async function loadRolePrompts() {
		if (!selectedRole) {
			rolePrompts = [];
			roleChannels = null;
			roleFinalPrompt = '';
			return;
		}
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/prompts`);
			if (response.ok) {
				rolePrompts = await response.json();
			} else {
				rolePrompts = [];
			}
		} catch (error) {
			rolePrompts = [];
		}
		
		await loadRoleFinalPrompt();
		
		await loadRoleChannels();
	}

	async function loadRoleFinalPrompt() {
		if (!selectedRole) {
			roleFinalPrompt = '';
			return;
		}
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/final-prompt`);
			if (response.ok) {
				const data = await response.json();
				roleFinalPrompt = data.finalPrompt;
			}
		} catch (error) {
			roleFinalPrompt = 'Error loading final prompt';
		}
	}

	async function loadRoleChannels() {
		if (!selectedRole) {
			roleChannels = null;
			return;
		}
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/channels`);
			if (response.ok) {
				roleChannels = await response.json();
			}
		} catch (error) {
			roleChannels = null;
		}
	}

	async function addChannelToRole(channelId: number) {
		if (!selectedRole) return;
		try {
			const response = await fetch(`/api/channels/${channelId}/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roleId: selectedRole.id.toString() })
			});
			if (response.ok) {
				await loadRoleChannels(); // Refresh the channel assignments
			}
		} catch (error) {
			console.error('Failed to add channel to role:', error);
		}
	}

	async function removeChannelFromRole(assignmentId: number) {
		try {
			const assignedChannel = roleChannels?.assignedChannels?.find(c => c.assignmentId === assignmentId);
			if (!assignedChannel) return;
			const response = await fetch(`/api/channels/${assignedChannel.channelId}/roles/${assignmentId}`, {
				method: 'DELETE'
			});
			if (response.ok) {
				await loadRoleChannels(); // Refresh the channel assignments
			}
		} catch (error) {
			console.error('Failed to remove channel from role:', error);
		}
	}

	async function refreshSelectedRoleContent() {
		if (!selectedRole || !selectedProject) return;
		try {
			const currentRoleId = selectedRole.id;
			
			// Reload all roles to get updated content
			const response = await fetch(`/api/projects/${selectedProject.id}/roles`);
			if (response.ok) {
				roles = await response.json();
				// Find and update the selected role
				selectedRole = roles.find(role => role.id === currentRoleId) || null;
			}
		} catch (error) {
			console.error('Failed to refresh role content:', error);
		}
	}

	async function openAddPromptToRoleDialog() {
		if (!selectedRole || !selectedProject) return;
		try {
			// Get all available prompts for this project
			const response = await fetch(`/api/projects/${selectedProject.id}/prompts`);
			if (response.ok) {
				const allPrompts = await response.json();
				// Filter out prompts already assigned to this role
				const currentPromptIds = rolePrompts.filter(p => p.source === 'role').map(p => p.id);
				availablePromptsForRole = allPrompts.filter(p => !currentPromptIds.includes(p.id));
				showAddPromptToRoleDialog = true;
			}
		} catch (error) {
			console.error('Failed to load available prompts:', error);
		}
	}

	async function addPromptToRole(promptId: number) {
		if (!selectedRole) return;
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/prompts/assign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ promptId })
			});
			if (response.ok) {
				await loadRolePrompts();
				await loadRoleFinalPrompt();
				showAddPromptToRoleDialog = false;
			}
		} catch (error) {
			console.error('Failed to add prompt to role:', error);
		}
	}

	async function removePromptFromRole(promptId: number) {
		if (!selectedRole) return;
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/prompts/unassign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ promptId })
			});
			if (response.ok) {
				await loadRolePrompts();
				await loadRoleFinalPrompt();
			}
		} catch (error) {
			console.error('Failed to remove prompt from role:', error);
		}
	}

	async function onRoleSelect(role: any) {
		selectedRole = role;
		await loadRolePrompts();
	}

	// Drag and drop functions
	function handleDragStart(event: DragEvent, index: number) {
		draggedIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	async function handleDrop(event: DragEvent, targetIndex: number) {
		event.preventDefault();
		
		if (draggedIndex === null || draggedIndex === targetIndex) {
			draggedIndex = null;
			return;
		}
		
		const reorderedPrompts = [...rolePrompts];
		const [draggedItem] = reorderedPrompts.splice(draggedIndex, 1);
		reorderedPrompts.splice(targetIndex, 0, draggedItem);
		
		// Update the order indexes
		reorderedPrompts.forEach((prompt, index) => {
			prompt.orderIndex = index;
		});
		
		rolePrompts = reorderedPrompts;
		draggedIndex = null;
		
		// Save the new order
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/prompts`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompts: rolePrompts })
			});
			
			if (response.ok) {
				await loadRolePrompts();
				await loadRoleFinalPrompt();
				await refreshSelectedRoleContent();
			}
		} catch (error) {
			console.error('Failed to update prompt order:', error);
		}
	}

	// Load roles when selectedProject changes
	$: if (selectedProject) {
		loadRoles();
	}

	// Export functions needed by parent
	export { loadRoles, refreshSelectedRoleContent };
</script>

<div class="roles-section">
	<div class="section-header">
		<div class="role-controls">
			<select bind:value={selectedRole} on:change={() => loadRolePrompts()} class="role-selector">
				{#if roles.length === 0}
					<option value={null}>No roles</option>
				{:else}
					{#each roles as role}
						<option value={role}>{role.name}</option>
					{/each}
				{/if}
			</select>
		</div>
	</div>
	
	{#if selectedRole}
		<div class="role-content">
			<h4>Final Role Prompt (All Components)</h4>
			<textarea 
				bind:value={roleFinalPrompt}
				class="role-textarea"
				readonly
				rows="20"
			></textarea>
			
			<div class="section-header-with-action">
				<h4>Prompt Composition</h4>
				{#if selectedRole}
					<button class="btn-secondary" on:click={openAddPromptToRoleDialog}>
						➕ Add Prompt
					</button>
				{/if}
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
									<span class="prompt-badge custom">Role Description</span>
								{/if}
								{#if prompt.source === 'role'}
									<span class="prompt-badge source-role">Role: {selectedRole?.name || 'Unknown'}</span>
								{:else if prompt.source === 'squad'}
									<span class="prompt-badge source-squad">Squad: {prompt.squadName || 'Unknown'}</span>
								{:else if prompt.source === 'global'}
									<span class="prompt-badge source-global">Global</span>
								{/if}
								<span class="prompt-type">{prompt.type}</span>
								<div class="prompt-actions">
									{#if prompt.source === 'role'}
										<button 
											class="btn-danger-small" 
											on:click={() => removePromptFromRole(prompt.id)}
											title="Remove this prompt from role"
										>×</button>
									{/if}
									<span class="drag-handle">⋮⋮</span>
								</div>
							</div>
							<div class="prompt-preview">
								{prompt.content.substring(0, 100)}...
							</div>
						</div>
					{/each}
				{:else}
					<p class="empty-state">No prompts assigned to this role</p>
				{/if}
			</div>
			
			<h4>Channel Access</h4>
			<div class="role-channels">
				{#if roleChannels}
					<div class="channel-assignments">
						<div class="assigned-channels">
							<h5>Accessible Channels ({roleChannels.assignedChannels?.length || 0})</h5>
							{#if roleChannels.assignedChannels && roleChannels.assignedChannels.length > 0}
								<div class="channel-list">
									{#each roleChannels.assignedChannels as assignedChannel}
										<div class="channel-item assigned">
											<div class="channel-info">
												<span class="channel-name">#{assignedChannel.channelName}</span>
												{#if assignedChannel.isMainChannel}
													<span class="channel-status public">Public</span>
												{/if}
											</div>
											{#if !assignedChannel.isMainChannel}
												<button 
													class="btn-remove"
													on:click={() => removeChannelFromRole(assignedChannel.assignmentId)}
													title="Remove channel access"
												>×</button>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<p class="no-channels">No channels accessible to this role</p>
							{/if}
						</div>
						
						<div class="available-channels">
							<h5>Available Channels</h5>
							{#if roleChannels.allChannels}
								{@const unassignedChannels = roleChannels.allChannels.filter(channel => !channel.isAssigned && !channel.isMainChannel)}
								{#if unassignedChannels.length > 0}
									<div class="channel-list">
										{#each unassignedChannels as channel}
											<div class="channel-item available">
												<div class="channel-info">
													<span class="channel-name">#{channel.name}</span>
													<span class="channel-desc">{channel.description}</span>
												</div>
												<button 
													class="btn-add"
													on:click={() => addChannelToRole(channel.id)}
													title="Grant channel access"
												>+</button>
											</div>
										{/each}
									</div>
								{:else}
									<p class="no-channels">All channels are accessible or public</p>
								{/if}
							{/if}
						</div>
					</div>
				{:else}
					<p>Loading channel access...</p>
				{/if}
			</div>
		</div>
	{:else}
		<div class="empty-selection">
			<p>Select a role to view details</p>
		</div>
	{/if}
</div>

{#if showAddPromptToRoleDialog}
	<div class="dialog-overlay" on:click={() => showAddPromptToRoleDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Add Prompt to Role</h3>
			
			{#if availablePromptsForRole.length > 0}
				<div class="prompt-selection-list">
					{#each availablePromptsForRole as prompt}
						<div class="prompt-selection-item">
							<div class="prompt-info">
								<h4>{prompt.name}</h4>
								<p class="prompt-preview">{prompt.content.substring(0, 100)}...</p>
							</div>
							<button 
								class="btn-primary"
								on:click={() => addPromptToRole(prompt.id)}
							>Add</button>
						</div>
					{/each}
				</div>
			{:else}
				<p>No available prompts to add to this role.</p>
				<p>Create new prompts in the Prompts section to assign them to roles.</p>
			{/if}
			
			<div class="dialog-actions">
				<button class="cancel-btn" on:click={() => showAddPromptToRoleDialog = false}>Cancel</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.roles-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.section-header {
		border-bottom: 1px solid #e5e5e5;
		padding-bottom: 16px;
	}

	.role-controls {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.role-selector {
		padding: 6px 12px;
		border: 1px solid #ccc;
		border-radius: 4px;
		min-width: 200px;
	}

	.empty-state {
		color: #666;
		font-style: italic;
		margin: 20px 0;
		text-align: center;
	}

	.empty-selection {
		text-align: center;
		color: #666;
		padding: 40px;
	}

	.role-content h4 {
		margin: 20px 0 8px 0;
		color: #333;
	}

	.role-textarea {
		width: 100%;
		padding: 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: monospace;
		font-size: 14px;
		resize: vertical;
	}

	.section-header-with-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 20px 0 8px 0;
	}

	.section-header-with-action h4 {
		margin: 0;
	}

	.btn-secondary {
		padding: 6px 12px;
		background: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.btn-secondary:hover {
		background: #5a6268;
	}

	.prompt-composition {
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
		background: #fafafa;
	}

	.prompt-item {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		margin-bottom: 8px;
		padding: 12px;
		cursor: move;
		transition: all 0.2s ease;
		user-select: none;
	}

	.prompt-item:hover {
		border-color: #007acc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.prompt-item.dragging {
		opacity: 0.5;
		transform: rotate(2deg);
	}

	.prompt-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		font-weight: 500;
	}

	.prompt-order {
		background: #007acc;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 12px;
		min-width: 24px;
		text-align: center;
	}

	.prompt-name {
		flex: 1;
		color: #333;
	}

	.prompt-type {
		font-size: 11px;
		color: #666;
		background: #f0f0f0;
		padding: 2px 6px;
		border-radius: 10px;
	}

	.drag-handle {
		color: #999;
		cursor: move;
		font-weight: bold;
		user-select: none;
	}

	.drag-handle:active {
		color: #333;
	}

	.prompt-preview {
		color: #666;
		font-size: 13px;
		line-height: 1.4;
		font-family: monospace;
		background: #f9f9f9;
		padding: 6px;
		border-radius: 3px;
		margin-top: 4px;
	}

	.prompt-badge {
		font-size: 11px;
		padding: 3px 8px;
		border-radius: 12px;
		font-weight: 500;
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

	.prompt-badge.source-role {
		background: #fff3e0;
		color: #e65100;
		border: 1px solid #ff9800;
	}
	
	.prompt-badge.source-squad {
		background: #f3e5f5;
		color: #7b1fa2;
		border: 1px solid #9c27b0;
	}
	
	.prompt-badge.source-global {
		background: #e8f5e8;
		color: #2e7d32;
		border: 1px solid #4caf50;
	}
	
	.prompt-actions {
		display: flex;
		gap: 4px;
		align-items: center;
	}
	
	.prompt-actions button {
		padding: 4px 8px;
		font-size: 12px;
		border-radius: 4px;
		border: none;
		cursor: pointer;
	}

	.btn-danger-small {
		background: #dc3545;
		color: white;
	}

	.btn-danger-small:hover {
		background: #c82333;
	}

	.role-channels {
		margin-top: 16px;
	}

	.channel-assignments {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	.assigned-channels, .available-channels {
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 16px;
		background: #f9f9f9;
	}

	.assigned-channels h5, .available-channels h5 {
		margin: 0 0 12px 0;
		color: #333;
		font-size: 14px;
		font-weight: 600;
	}

	.channel-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.channel-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
	}

	.channel-item.assigned {
		border-color: #28a745;
		background: #f8fff9;
	}

	.channel-item.available {
		border-color: #6c757d;
	}

	.channel-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.channel-name {
		font-weight: 500;
		color: #333;
	}

	.channel-desc {
		font-size: 12px;
		color: #666;
	}

	.channel-status.public {
		font-size: 10px;
		background: #e8f5e8;
		color: #2e7d32;
		padding: 2px 6px;
		border-radius: 8px;
		font-weight: 500;
	}

	.btn-remove, .btn-add {
		padding: 4px 8px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: bold;
	}

	.btn-remove {
		background: #dc3545;
		color: white;
	}

	.btn-remove:hover {
		background: #c82333;
	}

	.btn-add {
		background: #28a745;
		color: white;
	}

	.btn-add:hover {
		background: #218838;
	}

	.no-channels {
		color: #666;
		font-style: italic;
		text-align: center;
		padding: 20px 0;
	}

	/* Dialog styles */
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
		max-width: 600px;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
	}

	.dialog h3 {
		margin: 0 0 16px 0;
		color: #333;
	}

	.prompt-selection-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 16px 0;
		max-height: 400px;
		overflow-y: auto;
	}

	.prompt-selection-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		background: #f9f9f9;
	}

	.prompt-selection-item .prompt-info {
		flex: 1;
		margin-right: 16px;
	}

	.prompt-selection-item h4 {
		margin: 0 0 4px 0;
		color: #333;
		font-size: 14px;
	}

	.prompt-selection-item .prompt-preview {
		font-size: 12px;
		color: #666;
		margin: 4px 0 0 0;
		line-height: 1.4;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid #e5e5e5;
	}

	.btn-primary {
		padding: 6px 16px;
		background: #007acc;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.btn-primary:hover {
		background: #005a9e;
	}

	.cancel-btn {
		padding: 6px 16px;
		background: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.cancel-btn:hover {
		background: #5a6268;
	}
</style>