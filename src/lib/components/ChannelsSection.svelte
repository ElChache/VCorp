<script>
	// Props for integration with main file
	export let selectedProject = null;
	export let channels = [];
	export let selectedChannel = null;
	export let roles = []; // for role assignments

	// Component-local variables
	let showCreateChannelDialog = false;
	let showEditChannelDialog = false;
	let newChannel = { name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	let editChannel = { id: '', name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	let channelRoles = null;
	let channelViewMode = 'messages'; // Default to messages view
	let channelMessages = [];

	// Channel management functions
	async function loadChannels() {
		if (!selectedProject) {
			channels = [];
			return;
		}

		try {
			const response = await fetch(`/api/channels?projectId=${selectedProject.id}`);
			if (response.ok) {
				channels = await response.json();
				selectedChannel = channels.length > 0 ? channels[0] : null;
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
		console.log('=== CHANNEL SELECTION DEBUG ===');
		console.log('Channel selected:', channel);
		console.log('Previous selectedChannel:', selectedChannel);
		selectedChannel = channel;
		channelViewMode = 'messages'; // Reset to messages view when selecting a new channel
		console.log('New selectedChannel:', selectedChannel);
		console.log('About to call loadChannelRoles...');
		loadChannelRoles();
		loadChannelMessages();
		console.log('=== END CHANNEL SELECTION DEBUG ===');
	}

	async function loadChannelMessages() {
		if (!selectedChannel) {
			channelMessages = [];
			return;
		}

		try {
			const response = await fetch(`/api/channels/${selectedChannel.id}/messages`);
			if (response.ok) {
				channelMessages = await response.json();
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
	
	function switchToMessagesView() {
		channelViewMode = 'messages';
	}
	
	function switchToSettingsView() {
		channelViewMode = 'settings';
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

	// Load channels when the selected project changes
	$: if (selectedProject) {
		loadChannels();
	}
</script>

<div class="channels-section">
	<div class="section-header">
		<h2>Channel Management</h2>
		<button class="btn-primary" on:click={openCreateChannelDialog}>
			➕ Create Channel
		</button>
	</div>

	<div class="channels-content">
		<div class="channels-left">
			<div class="channels-panel">
				<div class="channels-header">
					<h3>Channels ({channels.length})</h3>
				</div>
				
				<div class="channel-list">
					{#each channels.sort((a, b) => (b.isForHumanDirector ? 1 : 0) - (a.isForHumanDirector ? 1 : 0)) as channel}
						<div 
							class="channel-item"
							class:active={selectedChannel?.id === channel.id}
							on:click={() => onChannelSelect(channel)}
						>
							<div class="channel-header">
								<span class="channel-id">#{channel.id}</span>
								{#if channel.isForHumanDirector}
									<span class="channel-badge human-director">👤 Human</span>
								{/if}
								{#if channel.isMainChannel}
									<span class="channel-badge">Main</span>
								{/if}
							</div>
							<div class="channel-details">
								<span class="channel-name">{channel.name}</span>
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
						<div class="channel-view-toggle">
							<button 
								class="view-toggle-btn" 
								class:active={channelViewMode === 'messages'}
								on:click={switchToMessagesView}
							>💬 Messages</button>
							<button 
								class="view-toggle-btn settings-btn" 
								class:active={channelViewMode === 'settings'}
								on:click={switchToSettingsView}
								title="Channel Settings"
							>⚙️</button>
						</div>
					</div>

					<div class="channel-info">
						{#if channelViewMode === 'messages'}
							<div class="messages-view">
								<!-- Messages view placeholder for now -->
								<div class="messages-container">
									<div class="messages-list">
										{#if channelMessages.length > 0}
											{#each channelMessages as message}
												<div class="message" class:ticket={message.type === 'ticket'}>
													<div class="message-header">
														<span class="message-author">{message.authorAgentId || 'System'}</span>
														{#if message.type === 'ticket'}
															<span class="message-type ticket-badge">🎫 TICKET</span>
														{/if}
														<span class="message-time">{formatMessageTime(message.createdAt)}</span>
													</div>
													
													{#if message.type === 'ticket'}
														<div class="ticket-info">
															<div class="ticket-header">
																<h4 class="ticket-title">{message.title}</h4>
																<div class="ticket-badges">
																	{#if message.priority}
																		<span class="priority-badge priority-{message.priority}">{message.priority.toUpperCase()}</span>
																	{/if}
																	{#if message.status}
																		<span class="status-badge status-{message.status.replace('_', '-')}">{message.status.replace('_', ' ').toUpperCase()}</span>
																	{/if}
																</div>
															</div>
															
															<div class="ticket-assignment">
																{#if message.assignedToRoleType}
																	<span class="assigned-role">👥 {message.assignedToRoleType}</span>
																{/if}
																{#if message.claimedByAgent}
																	<span class="claimed-agent">👤 {message.claimedByAgent}</span>
																{/if}
															</div>
															
															<div class="ticket-body">
																{message.body}
															</div>
															
															{#if message.updatedAt && message.updatedAt !== message.createdAt}
																<div class="ticket-updated">
																	Last updated: {formatMessageTime(message.updatedAt)}
																</div>
															{/if}
														</div>
													{:else}
														<div class="message-content">
															{#if message.title && message.title !== message.body}
																<strong>{message.title}</strong><br>
															{/if}
															{message.body}
														</div>
													{/if}
													{#if message.readingAssignments && message.readingAssignments.length > 0}
														<div class="message-assignments">
															{#each message.readingAssignments as assignment}
																<div class="assignment">
																	<div class="assignment-header">
																		<span class="assignment-target">📋 {assignment.assignedTo}</span>
																		<span class="read-status" class:fully-read={assignment.isFullyRead} class:partially-read={assignment.readCount > 0 && !assignment.isFullyRead} class:unread={assignment.readCount === 0}>
																			{assignment.readCount}/{assignment.totalTargets} read
																		</span>
																	</div>
																	{#if assignment.targetAgents.length > 0}
																		<div class="agents-status">
																			{#each assignment.targetAgents as agentId}
																				{@const readInfo = assignment.readBy.find(r => r.agentId === agentId)}
																				<span class="agent-status" class:read={readInfo} class:acknowledged={readInfo?.acknowledged}>
																					{agentId}
																				</span>
																			{/each}
																		</div>
																	{/if}
																</div>
															{/each}
														</div>
													{/if}
												</div>
											{/each}
										{:else}
											<div class="no-messages">
												<p>No messages in this channel yet.</p>
												<p>Start the conversation!</p>
											</div>
										{/if}
									</div>
								</div>
								<div class="message-input-container">
									<div class="message-input-wrapper">
										<input 
											type="text" 
											class="message-input" 
											placeholder="Type a message..." 
											disabled
										/>
										<button class="send-btn" disabled>Send</button>
									</div>
									<p class="input-note">Real-time messaging coming soon...</p>
								</div>
							</div>
						{:else if channelViewMode === 'settings'}
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
						{/if}
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

	.channel-details-panel {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.channel-details-header {
		padding: 16px;
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
	}
	
	.messages-container {
		flex: 1;
		overflow-y: auto;
		margin-bottom: 16px;
	}
	
	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 8px 0;
	}
	
	.message {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 12px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}
	
	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
		font-size: 12px;
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
		line-height: 1.4;
		color: #333;
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
</style>