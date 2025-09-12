<script>
	// Props for integration with main file
	export let selectedProject = null;
	export let channels = [];
	export let selectedChannel = null;
	export let roles = []; // for role assignments

	// Component-local variables
	let showCreateChannelDialog = false;
	let showEditChannelDialog = false;
	let showAssignmentDialog = false;
	let newChannel = { name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	let editChannel = { id: '', name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	let channelRoles = null;
	
	// Data for dropdowns
	let agents = [];
	let projectRoles = []; // Renamed to avoid conflict with exported roles prop
	let squads = [];

	// Channel management functions
	async function loadChannels() {
		if (!selectedProject) {
			channels = [];
			return;
		}

		try {
			const response = await fetch(`/api/channels?projectId=${selectedProject.id}`);
			if (response.ok) {
				const channelsData = await response.json();
				
				// Load message counts for each channel
				const channelsWithCounts = await Promise.all(
					channelsData.map(async (channel) => {
						try {
							const msgResponse = await fetch(`/api/channels/${channel.id}/messages?projectId=${selectedProject.id}`);
							if (msgResponse.ok) {
								const messages = await msgResponse.json();
								return {
									...channel,
									messageCount: messages.length,
									unreadCount: 0 // TODO: Calculate unread for human-director
								};
							}
						} catch (error) {
							console.error(`Failed to load messages for channel ${channel.id}:`, error);
						}
						return {
							...channel,
							messageCount: 0,
							unreadCount: 0
						};
					})
				);
				
				// Preserve the currently selected channel if it exists
				const currentSelectedId = selectedChannel?.id;
				channels = channelsWithCounts;
				
				// Try to find and preserve the currently selected channel
				if (currentSelectedId) {
					const stillExists = channels.find(c => c.id === currentSelectedId);
					selectedChannel = stillExists || (channels.length > 0 ? channels[0] : null);
				} else {
					selectedChannel = channels.length > 0 ? channels[0] : null;
				}
			}
		} catch (error) {
			console.error('Failed to load channels:', error);
			channels = [];
		}
	}




	function openCreateChannelDialog() {
		newChannel = { name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
		showCreateChannelDialog = true;
	}

	function closeCreateChannelDialog() {
		showCreateChannelDialog = false;
		newChannel = { name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	}

	async function createChannel() {
		if (!newChannel.name.trim() || !selectedProject) return;
		
		try {
			const response = await fetch('/api/channels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...newChannel,
					projectId: selectedProject.id
				})
			});
			
			if (response.ok) {
				const channel = await response.json();
				channels = [...channels, channel];
				selectedChannel = channel;
				closeCreateChannelDialog();
			}
		} catch (error) {
			console.error('Failed to create channel:', error);
		}
	}

	function openEditChannelDialog() {
		if (selectedChannel) {
			editChannel = {
				id: selectedChannel.id,
				name: selectedChannel.name,
				description: selectedChannel.description || '',
				promptForAgents: selectedChannel.promptForAgents || '',
				isMainChannel: selectedChannel.isMainChannel || false,
				isForHumanDirector: selectedChannel.isForHumanDirector || false
			};
			showEditChannelDialog = true;
		}
	}

	function closeEditChannelDialog() {
		showEditChannelDialog = false;
		editChannel = { id: '', name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	}

	async function updateChannel() {
		if (!editChannel.name.trim() || !editChannel.id.trim() || !selectedChannel) return;
		
		try {
			const response = await fetch(`/api/channels/${selectedChannel.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editChannel)
			});
			
			if (response.ok) {
				const updatedChannel = await response.json();
				const index = channels.findIndex(c => c.id === selectedChannel.id);
				if (index !== -1) {
					channels[index] = updatedChannel;
					selectedChannel = updatedChannel;
				}
				closeEditChannelDialog();
			}
		} catch (error) {
			console.error('Failed to update channel:', error);
		}
	}

	async function deleteChannel() {
		if (!selectedChannel) return;
		
		if (confirm(`Are you sure you want to delete channel "${selectedChannel.name}"?`)) {
			try {
				const response = await fetch(`/api/channels/${selectedChannel.id}`, {
					method: 'DELETE'
				});
				
				if (response.ok) {
					channels = channels.filter(c => c.id !== selectedChannel.id);
					selectedChannel = channels.length > 0 ? channels[0] : null;
				}
			} catch (error) {
				console.error('Failed to delete channel:', error);
			}
		}
	}

	// Channel role management functions
	async function loadChannelRoles() {
		if (!selectedChannel) {
			console.log('No selected channel, clearing roles');
			channelRoles = null;
			return;
		}

		console.log('Loading roles for channel:', selectedChannel.id);
		try {
			const url = `/api/channels/${selectedChannel.id}/roles`;
			console.log('Fetching URL:', url);
			const response = await fetch(url);
			console.log('Response status:', response.status);
			console.log('Response ok:', response.ok);
			
			if (response.ok) {
				const data = await response.json();
				console.log('Raw API response:', data);
				channelRoles = data;
				console.log('Channel roles assigned to state:', channelRoles);
			} else {
				const errorText = await response.text();
				console.error('Failed to load channel roles - response not ok:', response.status, errorText);
				channelRoles = null;
			}
		} catch (error) {
			console.error('Failed to load channel roles:', error);
			channelRoles = null;
		}
	}

	function onChannelSelect(channel) {
		selectedChannel = channel;
		loadChannelRoles();
	}

	async function loadChannelMessages() {
		if (!selectedChannel) {
			channelMessages = [];
			return;
		}

		try {
			const response = await fetch(`/api/channels/${selectedChannel.id}/messages`);
			if (response.ok) {
				const allMessages = await response.json();
				
				// Organize messages into threads (parent messages with their replies)
				const parentMessages = allMessages.filter(msg => !msg.parentContentId);
				const replies = allMessages.filter(msg => msg.parentContentId);
				
				// Add replies to their parent messages
				const messagesWithReplies = parentMessages.map(parent => ({
					...parent,
					replies: replies
						.filter(reply => reply.parentContentId === parent.id)
						.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
				}));
				
				// Sort parent messages by creation time (newest first)
				channelMessages = messagesWithReplies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
			} else {
				console.error('Failed to load channel messages:', response.status);
				channelMessages = [];
			}
		} catch (error) {
			console.error('Failed to load channel messages:', error);
			channelMessages = [];
		}
	}

	function formatMessageTime(timestamp) {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
		
		return date.toLocaleDateString();
	}
	

	async function assignRoleToChannel(roleId) {
		if (!selectedChannel) return;

		try {
			const response = await fetch(`/api/channels/${selectedChannel.id}/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roleId: roleId.toString() })
			});

			if (response.ok) {
				await loadChannelRoles(); // Refresh the role assignments
			}
		} catch (error) {
			console.error('Failed to assign role to channel:', error);
		}
	}

	async function removeRoleFromChannel(assignmentId) {
		if (!selectedChannel) return;

		try {
			const response = await fetch(`/api/channels/${selectedChannel.id}/roles/${assignmentId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadChannelRoles(); // Refresh the role assignments
			}
		} catch (error) {
			console.error('Failed to remove role from channel:', error);
		}
	}

	// Loading functions for assignment dropdowns
	async function loadAgents() {
		if (!selectedProject) {
			agents = [];
			return;
		}

		try {
			const response = await fetch(`/api/agents?projectId=${selectedProject.id}`);
			if (response.ok) {
				agents = await response.json();
			} else {
				console.error('Failed to load agents:', response.status);
				agents = [];
			}
		} catch (error) {
			console.error('Failed to load agents:', error);
			agents = [];
		}
	}

	async function loadProjectRoles() {
		if (!selectedProject) {
			projectRoles = [];
			return;
		}

		try {
			const response = await fetch(`/api/roles?projectId=${selectedProject.id}`);
			if (response.ok) {
				projectRoles = await response.json();
			} else {
				console.error('Failed to load roles:', response.status);
				projectRoles = [];
			}
		} catch (error) {
			console.error('Failed to load roles:', error);
			projectRoles = [];
		}
	}

	async function loadSquads() {
		if (!selectedProject) {
			squads = [];
			return;
		}

		try {
			const response = await fetch(`/api/squads?projectId=${selectedProject.id}`);
			if (response.ok) {
				squads = await response.json();
			} else {
				console.error('Failed to load squads:', response.status);
				squads = [];
			}
		} catch (error) {
			console.error('Failed to load squads:', error);
			squads = [];
		}
	}


	// Load channels when the selected project changes
	$: if (selectedProject) {
		loadChannels();
		loadAgents();
		loadProjectRoles();
		loadSquads();
	}
</script>

<div class="channels-section">

	<div class="channels-content">
		<div class="channels-left">
			<div class="channels-panel">
				<div class="channels-header">
					<h3>Channels ({channels.length})</h3>
					<button class="btn-icon" on:click={openCreateChannelDialog} title="Create Channel">
						+
					</button>
				</div>
				
				<div class="channel-list">
					{#each channels.sort((a, b) => (b.isForHumanDirector ? 1 : 0) - (a.isForHumanDirector ? 1 : 0)) as channel}
						<div 
							class="channel-item"
							class:active={selectedChannel?.id === channel.id}
							on:click={() => onChannelSelect(channel)}
						>
							<div class="channel-header">
								<span class="channel-name">#{channel.name}</span>
								{#if channel.isForHumanDirector}
									<span class="channel-badge human-director">👤 Human</span>
								{/if}
								{#if channel.isMainChannel}
									<span class="channel-badge">Main</span>
								{/if}
							</div>
							<div class="channel-details">
								<span class="channel-stats">
									{channel.messageCount || 0} messages
									{#if channel.unreadCount > 0}
										• <span class="unread-count">{channel.unreadCount} unread</span>
									{/if}
								</span>
							</div>
						</div>
					{/each}
				</div>

				{#if channels.length === 0}
					<p class="empty-state">No channels created yet</p>
				{/if}
			</div>
		</div>

		<div class="channels-right">
			{#if selectedChannel}
				<div class="channel-details-panel">
					<div class="channel-details-header">
						<h3>#{selectedChannel.name}</h3>
					</div>

					<div class="channel-info">
						<div class="settings-view">
								<div class="channel-actions-section">
									<div class="settings-actions">
										<button class="btn-secondary" on:click={openEditChannelDialog}>✏️ Edit Channel</button>
										<button class="btn-danger" on:click={deleteChannel}>🗑️ Delete Channel</button>
									</div>
								</div>
								<div class="info-section">
									<h4>Name</h4>
									<p>{selectedChannel.name}</p>
								</div>

								{#if selectedChannel.description}
									<div class="info-section">
										<h4>Description</h4>
										<p>{selectedChannel.description}</p>
									</div>
								{/if}

								{#if selectedChannel.promptForAgents}
									<div class="info-section">
										<h4>Agent Prompt</h4>
										<div class="prompt-preview">
											{selectedChannel.promptForAgents}
										</div>
									</div>
								{/if}

								<div class="info-section">
									<h4>Settings</h4>
									<p>
										{#if selectedChannel.isMainChannel}
											<span class="status-badge default">Main Channel</span>
										{:else}
											<span class="status-badge">Regular Channel</span>
										{/if}
									</p>
								</div>

								<div class="info-section">
									<h4>Role Assignments</h4>
									{#if selectedChannel.isMainChannel}
										<div class="public-channel-message">
											<p><strong>This is a public channel</strong> - accessible to all roles in the project.</p>
											<p>No role assignments needed as all team members can access this channel.</p>
										</div>
									{:else if channelRoles}
										<div class="role-assignments">
											<div class="assigned-roles">
												<h5>Assigned Roles ({channelRoles.assignedRoles?.length || 0})</h5>
												{#if channelRoles.assignedRoles && channelRoles.assignedRoles.length > 0}
													<div class="role-list">
														{#each channelRoles.assignedRoles as assignedRole}
															<div class="role-item assigned">
																<div class="role-info">
																	<span class="role-name">{assignedRole.roleName}</span>
																	{#if !assignedRole.isActive}
																		<span class="role-status inactive">Inactive</span>
																	{/if}
																</div>
																<button 
																	class="btn-remove"
																	on:click={() => removeRoleFromChannel(assignedRole.assignmentId)}
																	title="Remove role from channel"
																>×</button>
															</div>
														{/each}
													</div>
												{:else}
													<p class="no-roles">No roles assigned to this channel</p>
												{/if}
											</div>

											<div class="available-roles">
												<h5>Available Roles</h5>
												{#if channelRoles.allRoles}
													{@const unassignedRoles = channelRoles.allRoles.filter(role => !role.isAssigned)}
													{console.log('=== ROLE AVAILABILITY DEBUG ===', {
														allRoles: channelRoles.allRoles,
														unassignedRoles: unassignedRoles,
														assignedRoles: channelRoles.assignedRoles
													})}
													{#if unassignedRoles.length > 0}
														<div class="role-list">
															{#each unassignedRoles as role}
																<div class="role-item available">
																	<div class="role-info">
																		<span class="role-name">{role.name}</span>
																		{#if !role.isActive}
																			<span class="role-status inactive">Inactive</span>
																		{/if}
																	</div>
																	<button 
																		class="btn-add"
																		on:click={() => assignRoleToChannel(role.id)}
																		title="Assign role to channel"
																	>+</button>
																</div>
															{/each}
														</div>
													{:else}
														<p class="no-roles">All roles are assigned</p>
													{/if}
												{/if}
											</div>
										</div>
									{:else}
										<p class="loading">Loading role assignments...</p>
									{/if}
								</div>
							</div>
						</div>
					</div>
			{:else}
				<div class="empty-selection">
					<p>Select a channel to view details</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Create Channel Dialog -->
{#if showCreateChannelDialog}
	<div class="dialog-overlay" on:click={closeCreateChannelDialog}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Create New Channel</h3>
			
			<div class="form-group">
				<label for="channel-name">Name:</label>
				<input 
					id="channel-name"
					type="text" 
					bind:value={newChannel.name} 
					placeholder="Enter channel name"
				/>
			</div>
			
			<div class="form-group">
				<label for="channel-description">Description:</label>
				<textarea 
					id="channel-description"
					bind:value={newChannel.description} 
					placeholder="Channel description (optional)"
					rows="3"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="channel-prompt">Agent Prompt:</label>
				<textarea 
					id="channel-prompt"
					bind:value={newChannel.promptForAgents} 
					placeholder="When should agents use this channel? (optional)"
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={newChannel.isMainChannel}
					/>
					Set as main channel
				</label>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={newChannel.isForHumanDirector}
					/>
					👤 For Human Director communication
				</label>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeCreateChannelDialog}>Cancel</button>
				<button class="create-btn" on:click={createChannel} disabled={!newChannel.name.trim()}>
					Create Channel
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Channel Dialog -->
{#if showEditChannelDialog}
	<div class="dialog-overlay" on:click={closeEditChannelDialog}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Edit Channel</h3>
			
			<div class="form-group">
				<label for="edit-channel-id">Channel ID:</label>
				<input 
					id="edit-channel-id"
					type="text" 
					bind:value={editChannel.id} 
					placeholder="Enter channel ID"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="edit-channel-name">Name:</label>
				<input 
					id="edit-channel-name"
					type="text" 
					bind:value={editChannel.name} 
					placeholder="Enter channel name"
				/>
			</div>
			
			<div class="form-group">
				<label for="edit-channel-description">Description:</label>
				<textarea 
					id="edit-channel-description"
					bind:value={editChannel.description} 
					placeholder="Channel description (optional)"
					rows="3"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="edit-channel-prompt">Agent Prompt:</label>
				<textarea 
					id="edit-channel-prompt"
					bind:value={editChannel.promptForAgents} 
					placeholder="When should agents use this channel? (optional)"
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={editChannel.isMainChannel}
					/>
					Set as main channel
				</label>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={editChannel.isForHumanDirector}
					/>
					👤 For Human Director communication
				</label>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeEditChannelDialog}>Cancel</button>
				<button class="create-btn" on:click={updateChannel} disabled={!editChannel.name.trim() || !editChannel.id.trim()}>
					Update Channel
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.channels-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
		height: calc(100vh - 140px);
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

	.channels-content {
		display: flex;
		gap: 20px;
		flex: 1;
		overflow: hidden;
	}

	.channels-left {
		width: 400px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-y: auto;
	}

	.channels-right {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.channels-panel {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 16px;
	}

	.channels-panel h3 {
		margin: 0 0 12px 0;
		color: #333;
	}

	.channels-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.channels-header h3 {
		margin: 0;
	}

	.channel-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.channel-item {
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: all 0.2s ease;
		cursor: pointer;
		user-select: none;
	}

	.channel-item:hover {
		border-color: #007acc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.channel-item.active {
		border-color: #007acc;
		background: #f0f8ff;
	}

	.channel-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.channel-id {
		font-family: monospace;
		font-weight: 500;
		color: #333;
		background: #f0f0f0;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.channel-badge {
		background: #28a745;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 500;
	}

	.channel-badge.human-director {
		background: #f59e0b;
		color: white;
	}

	.channel-details {
		display: flex;
		gap: 8px;
		font-size: 12px;
		color: #666;
	}

	.channel-name {
		font-weight: 500;
		color: #333;
	}

	.channel-stats {
		font-size: 12px;
		color: #666;
	}

	.unread-count {
		color: #ef4444;
		font-weight: 600;
	}

	.channel-details-panel {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.channel-details-header {
		padding: 0;
		border-bottom: 1px solid #e5e5e5;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.channel-details-header h3 {
		margin: 0;
		font-family: monospace;
	}
	
	/* Channel view toggle styles */
	.channel-view-toggle {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	
	.view-toggle-btn {
		padding: 6px 12px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		color: #666;
		transition: all 0.2s;
	}
	
	.view-toggle-btn:hover {
		background: #f5f5f5;
		border-color: #ccc;
	}
	
	.view-toggle-btn.active {
		background: #007acc;
		border-color: #007acc;
		color: white;
	}
	
	.view-toggle-btn.settings-btn {
		padding: 6px 8px;
		min-width: 32px;
		text-align: center;
	}

	.channel-info {
		flex: 1;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		overflow-y: auto;
		min-height: 0;
	}

	.info-section h4 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 14px;
		font-weight: 600;
	}

	.info-section p {
		margin: 0;
		color: #666;
		line-height: 1.4;
	}

	.prompt-preview {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		padding: 12px;
		font-family: monospace;
		font-size: 13px;
		line-height: 1.4;
		color: #333;
		white-space: pre-wrap;
	}

	.status-badge {
		background: #e7f3ff;
		color: #0066cc;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 500;
	}

	.status-badge.default {
		background: #e8f5e8;
		color: #2d7d2d;
	}

	/* Role Assignment Styles */
	.public-channel-message {
		padding: 16px;
		background: #e8f5e8;
		border: 1px solid #4caf50;
		border-radius: 6px;
		color: #2e7d32;
	}

	.public-channel-message p {
		margin: 0 0 8px 0;
	}

	.public-channel-message p:last-child {
		margin-bottom: 0;
	}

	.role-assignments {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.assigned-roles,
	.available-roles {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 16px;
	}

	.assigned-roles h5,
	.available-roles h5 {
		margin: 0 0 12px 0;
		color: #333;
		font-size: 14px;
		font-weight: 600;
	}

	.role-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.role-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.role-item.assigned {
		border-left: 3px solid #28a745;
	}

	.role-item.available {
		border-left: 3px solid #007acc;
	}

	.role-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
	}

	.role-name {
		font-weight: 500;
		color: #333;
		font-size: 14px;
	}

	.role-status {
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.role-status.inactive {
		color: #dc3545;
	}

	.btn-add,
	.btn-remove {
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: bold;
		font-size: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.btn-add {
		background: #007acc;
		color: white;
	}

	.btn-add:hover {
		background: #0056a3;
	}

	.btn-remove {
		background: #dc3545;
		color: white;
	}

	.btn-remove:hover {
		background: #c82333;
	}

	.no-roles {
		color: #666;
		font-style: italic;
		text-align: center;
		margin: 0;
		padding: 16px;
	}

	.loading {
		font-size: 13px;
		color: #666;
		font-style: italic;
		margin: 0;
	}
	
	/* Messages view styles */
	.messages-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0;
		margin: 0;
	}
	
	.messages-container {
		flex: 1;
		overflow-y: auto;
		margin-bottom: 16px;
		padding: 0;
	}
	
	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0;
	}
	
	.message {
		background: transparent;
		border: none;
		border-radius: 0;
		padding: 6px 16px;
		box-shadow: none;
		transition: background-color 0.1s ease;
	}
	
	.message:hover {
		background: #f8f9fa;
	}
	
	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 1px;
		font-size: 12px;
		gap: 8px;
	}
	
	.message-author {
		font-weight: 600;
		color: #007acc;
	}
	
	.message-time {
		color: #999;
	}
	
	.message-content {
		font-size: 14px;
		line-height: 1.3;
		color: #333;
		margin-bottom: 1px;
	}

	/* Ticket-specific styles */
	.message.ticket {
		border-left: 4px solid #ff9800;
		background: #fefaf6;
	}

	.ticket-badge {
		background: #ff9800;
		color: white;
		font-size: 10px;
		font-weight: bold;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.ticket-info {
		margin-top: 8px;
	}

	.ticket-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.ticket-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
		flex: 1;
	}

	.ticket-badges {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
		margin-left: 12px;
	}

	.priority-badge, .status-badge {
		font-size: 10px;
		font-weight: bold;
		padding: 3px 8px;
		border-radius: 12px;
		text-transform: uppercase;
	}

	.priority-badge.priority-critical {
		background: #f44336;
		color: white;
	}

	.priority-badge.priority-high {
		background: #ff9800;
		color: white;
	}

	.priority-badge.priority-medium {
		background: #2196f3;
		color: white;
	}

	.priority-badge.priority-low {
		background: #4caf50;
		color: white;
	}

	.status-badge.status-open {
		background: #e3f2fd;
		color: #1976d2;
	}

	.status-badge.status-in-progress {
		background: #fff3e0;
		color: #f57c00;
	}

	.status-badge.status-blocked {
		background: #ffebee;
		color: #d32f2f;
	}

	.status-badge.status-ready-for-review {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.status-badge.status-reviewing {
		background: #fce4ec;
		color: #c2185b;
	}

	.status-badge.status-review-passed {
		background: #e8f5e8;
		color: #388e3c;
	}

	.status-badge.status-needs-attention {
		background: #fff8e1;
		color: #f57c00;
	}

	.status-badge.status-resolved {
		background: #e8f5e8;
		color: #388e3c;
	}

	.status-badge.status-closed {
		background: #f5f5f5;
		color: #757575;
	}

	.ticket-assignment {
		display: flex;
		gap: 12px;
		margin-bottom: 12px;
		font-size: 12px;
	}

	.assigned-role, .claimed-agent {
		background: #f5f5f5;
		padding: 4px 8px;
		border-radius: 4px;
		color: #666;
		font-weight: 500;
	}

	.claimed-agent {
		background: #e3f2fd;
		color: #1976d2;
	}

	.ticket-body {
		font-size: 14px;
		line-height: 1.4;
		color: #333;
		margin-bottom: 8px;
	}

	.ticket-updated {
		font-size: 11px;
		color: #999;
		font-style: italic;
	}
	
	.message-assignments {
		margin-top: 8px;
		padding: 8px;
		background: #f0f8ff;
		border-left: 3px solid #007acc;
		border-radius: 0 4px 4px 0;
		font-size: 11px;
		color: #666;
	}
	
	.assignment {
		margin-bottom: 8px;
	}
	
	.assignment:last-child {
		margin-bottom: 0;
	}
	
	.assignment-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}
	
	.assignment-target {
		font-weight: 600;
		color: #333;
	}
	
	.read-status {
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 10px;
		font-weight: 500;
	}
	
	.read-status.fully-read {
		background: #d4edda;
		color: #155724;
	}
	
	.read-status.partially-read {
		background: #fff3cd;
		color: #856404;
	}
	
	.read-status.unread {
		background: #f8d7da;
		color: #721c24;
		font-weight: 600;
	}
	
	.agents-status {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	
	.agent-status {
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 8px;
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		font-weight: 500;
	}
	
	.agent-status.read {
		background: #cce5ff;
		border-color: #b3d4fc;
		color: #004085;
	}
	
	.agent-status.acknowledged {
		background: #d1e7dd;
		border-color: #badbcc;
		color: #0f5132;
	}
	
	.no-messages {
		text-align: center;
		padding: 40px 20px;
		color: #999;
	}
	
	.no-messages p {
		margin: 8px 0;
	}
	
	.message-input-container {
		border-top: 1px solid #e5e5e5;
		padding-top: 16px;
	}
	
	.message-input-wrapper {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}
	
	.message-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		background: #f9f9f9;
	}
	
	.message-input:disabled {
		background: #f5f5f5;
		color: #999;
	}
	
	.send-btn {
		padding: 8px 16px;
		background: #007acc;
		color: white;
		border: none;
		border-radius: 4px;
		font-weight: 500;
		cursor: pointer;
	}
	
	.send-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}
	
	.input-note {
		font-size: 12px;
		color: #999;
		font-style: italic;
		margin: 0;
		text-align: center;
	}
	
	/* Settings view styles */
	.settings-view {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	
	.channel-actions-section {
		border-bottom: 1px solid #e5e5e5;
		padding-bottom: 16px;
		margin-bottom: 4px;
	}
	
	.settings-actions {
		display: flex;
		gap: 8px;
	}
	
	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: #666;
	}
	
	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	.empty-selection {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #666;
	}

	.empty-selection p {
		font-size: 16px;
		margin: 0;
	}

	/* Button styles */
	.btn-primary, .btn-secondary, .btn-danger, .create-btn, .cancel-btn {
		padding: 8px 16px;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.btn-primary, .create-btn {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover:not(:disabled), .create-btn:hover:not(:disabled) {
		background: #2563eb;
	}

	.btn-primary:disabled, .create-btn:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.btn-secondary:hover {
		background: #e5e7eb;
	}

	.btn-danger {
		background: #fee2e2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}

	.btn-danger:hover {
		background: #fecaca;
	}

	.cancel-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.cancel-btn:hover {
		background: #e5e7eb;
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
		padding: 24px;
		border-radius: 8px;
		min-width: 500px;
		max-width: 90vw;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.dialog h3 {
		margin: 0 0 20px 0;
		color: #111827;
		font-size: 18px;
		font-weight: 600;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 6px;
		color: #374151;
		font-weight: 500;
		font-size: 14px;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 14px;
		box-sizing: border-box;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 1px #3b82f6;
	}

	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		margin-bottom: 0 !important;
		font-weight: 500;
	}

	.checkbox-label input[type="checkbox"] {
		width: auto !important;
		margin: 0;
	}

	.dialog-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid #e5e7eb;
	}

	/* Reply functionality styles */
	.message-actions {
		margin-top: 1px;
		display: flex;
		gap: 4px;
		align-items: center;
	}

	.reply-btn {
		background: transparent;
		border: none;
		color: #64748b;
		padding: 2px 4px;
		border-radius: 3px;
		font-size: 11px;
		cursor: pointer;
		transition: all 0.1s ease;
		text-decoration: none;
		opacity: 0.7;
	}

	.reply-btn:hover {
		background: #e2e8f0;
		color: #334155;
		opacity: 1;
	}

	.reply-input-container {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 12px;
		margin-top: 12px;
	}

	.reply-context {
		margin-bottom: 8px;
	}

	.reply-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.reply-icon {
		font-size: 14px;
	}

	.reply-label {
		font-size: 14px;
		color: #374151;
		flex: 1;
	}

	.cancel-reply-btn {
		background: none;
		border: none;
		color: #9ca3af;
		cursor: pointer;
		font-size: 16px;
		padding: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cancel-reply-btn:hover {
		color: #374151;
	}

	.reply-preview {
		font-size: 12px;
		color: #6b7280;
		font-style: italic;
		padding: 4px 0;
	}

	.reply-input-wrapper {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.reply-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 14px;
	}

	.reply-input:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	/* Message replies/threads styles */
	.message-replies {
		margin-top: 16px;
		margin-left: 24px;
		padding-left: 16px;
		border-left: 3px solid #d1d5db;
		background: linear-gradient(to right, #f8fafc 0%, transparent 20%);
		border-radius: 0 8px 8px 0;
		position: relative;
	}

	.message-replies::before {
		content: "↳";
		position: absolute;
		left: -8px;
		top: 8px;
		color: #9ca3af;
		font-size: 14px;
		font-weight: bold;
	}

	.replies-header {
		margin-bottom: 12px;
		padding-bottom: 6px;
		border-bottom: 1px solid #e5e7eb;
	}

	.replies-count {
		font-size: 12px;
		color: #6b7280;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.reply-message {
		background: transparent;
		border: none;
		border-radius: 0;
		padding: 6px 16px;
		margin-bottom: 2px;
		box-shadow: none;
		position: relative;
		transition: background-color 0.1s ease;
	}
	
	.reply-message:hover {
		background: #f8f9fa;
	}

	.reply-message::before {
		content: "";
		position: absolute;
		left: -4px;
		top: 50%;
		transform: translateY(-50%);
		width: 2px;
		height: 60%;
		background: #3b82f6;
		border-radius: 1px;
	}

	.reply-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.reply-author {
		font-weight: 500;
		font-size: 12px;
		color: #374151;
	}

	.reply-time {
		font-size: 11px;
		color: #9ca3af;
	}

	.reply-content {
		font-size: 13px;
		color: #374151;
		line-height: 1.4;
	}

	/* Messages container scrolling and layout */
	.messages-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		padding: 0;
		margin: 0;
	}

	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 0;
		max-height: calc(100vh - 300px); /* Adjust based on your layout */
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Improve message spacing and add bottom margin for input area */
	.message {
		margin-bottom: 1px;
	}

	.message:last-child {
		margin-bottom: 8px;
	}

	/* Assignment section styles */
	.assignment-section {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 6px;
		padding: 12px;
		margin-bottom: 12px;
	}

	.assignment-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.assignment-label {
		font-size: 14px;
		font-weight: 600;
		color: #495057;
	}

	.add-assignment-btn {
		background: #007acc;
		color: white;
		border: none;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.add-assignment-btn:hover {
		background: #0056a3;
	}

	.assignment-row {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-bottom: 8px;
	}

	.assignment-row:last-child {
		margin-bottom: 0;
	}

	.assignment-type-select {
		width: 100px;
		padding: 4px 8px;
		border: 1px solid #ced4da;
		border-radius: 4px;
		font-size: 12px;
		background: white;
	}

	.assignment-target-select {
		flex: 1;
		padding: 4px 8px;
		border: 1px solid #ced4da;
		border-radius: 4px;
		font-size: 12px;
		background: white;
	}

	.remove-assignment-btn {
		background: #dc3545;
		color: white;
		border: none;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.remove-assignment-btn:hover {
		background: #c82333;
	}

	.no-assignments {
		color: #6c757d;
		font-size: 12px;
		font-style: italic;
		margin: 0;
		text-align: center;
		padding: 8px;
	}

	.assignment-dialog {
		width: 500px;
		max-height: 80vh;
	}
	
	.assignment-options {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.option-section h4 {
		margin: 0 0 0.5rem 0;
		color: #374151;
		font-size: 0.9rem;
		font-weight: 600;
	}
	
	.option-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 150px;
		overflow-y: auto;
	}
	
	.option-item {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		text-align: left;
		transition: all 0.15s;
	}
	
	.option-item:hover {
		background: #e5e7eb;
		border-color: #d1d5db;
	}
	
	.btn-icon {
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		color: #495057;
		padding: 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		min-width: 2rem;
		min-height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.btn-icon:hover {
		background: #e9ecef;
		border-color: #adb5bd;
	}
	
	.channels-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	
	.channels-header h3 {
		margin: 0;
	}
	
	.assignment-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	
	.assignment-badge {
		background: #e3f2fd;
		border: 1px solid #2196f3;
		color: #1565c0;
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	
	.assignment-badge.role {
		background: #f3e5f5;
		border-color: #9c27b0;
		color: #7b1fa2;
	}
	
	.assignment-badge.agent {
		background: #e8f5e8;
		border-color: #4caf50;
		color: #2e7d32;
	}
	
	.assignment-badge.squad {
		background: #fff3e0;
		border-color: #ff9800;
		color: #e65100;
	}
	
	.remove-badge {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0;
		margin-left: 0.125rem;
		opacity: 0.7;
	}
	
	.remove-badge:hover {
		opacity: 1;
	}
	
	.message-input-wrapper {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	
	.assign-btn {
		flex-shrink: 0;
	}
</style>

<!-- Assignment Dialog -->
{#if showAssignmentDialog}
	<div class="dialog-overlay" on:click={() => showAssignmentDialog = false}>
		<div class="dialog assignment-dialog" on:click|stopPropagation>
			<div class="dialog-header">
				<h3>Add Assignment</h3>
				<button class="close-btn" on:click={() => showAssignmentDialog = false}>×</button>
			</div>
			
			<div class="dialog-body">
				<div class="assignment-options">
					<div class="option-section">
						<h4>Roles</h4>
						<div class="option-list">
							{#each projectRoles as role}
								<button class="option-item" on:click={() => createAssignment('role', role.name)}>
									👥 {role.name}
								</button>
							{/each}
						</div>
					</div>
					
					<div class="option-section">
						<h4>Agents</h4>
						<div class="option-list">
							<button class="option-item" on:click={() => createAssignment('agent', 'director')}>
								👤 director (Human Director)
							</button>
							{#each agents as agent}
								<button class="option-item" on:click={() => createAssignment('agent', agent.id)}>
									🤖 {agent.id} ({agent.roleType})
								</button>
							{/each}
						</div>
					</div>
					
					<div class="option-section">
						<h4>Squads</h4>
						<div class="option-list">
							{#each squads as squad}
								<button class="option-item" on:click={() => createAssignment('squad', squad.name)}>
									👨‍👩‍👧‍👦 {squad.name}
								</button>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}