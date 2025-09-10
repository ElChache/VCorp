<script>
	export let channels = [];
	export let selectedProject = null;
	
	let showCreateChannelDialog = false;
	let newChannel = { name: '', description: '', isDirectorChannel: false };
	
	async function createChannel() {
		if (!selectedProject || !newChannel.name.trim()) return;
		
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
				const createdChannel = await response.json();
				channels = [...channels, createdChannel];
				showCreateChannelDialog = false;
				newChannel = { name: '', description: '', isDirectorChannel: false };
			}
		} catch (error) {
			console.error('Failed to create channel:', error);
		}
	}
	
	async function deleteChannel(channelId) {
		if (!confirm('Are you sure you want to delete this channel?')) return;
		
		try {
			const response = await fetch(`/api/channels/${channelId}`, {
				method: 'DELETE'
			});
			
			if (response.ok) {
				channels = channels.filter(c => c.id !== channelId);
			}
		} catch (error) {
			console.error('Failed to delete channel:', error);
		}
	}
</script>

<div class="channels-section">
	<div class="section-header">
		<h2>📺 Channels Management</h2>
		<button class="btn-primary" on:click={() => showCreateChannelDialog = true}>
			+ Create Channel
		</button>
	</div>
	
	{#if channels.length > 0}
		<div class="channels-grid">
			{#each channels as channel}
				<div class="channel-card" class:director={channel.isDirectorChannel}>
					<div class="channel-header">
						<h3>#{channel.name}</h3>
						<div class="channel-badges">
							{#if channel.isDirectorChannel}
								<span class="badge director">Director</span>
							{/if}
							<span class="badge members">{channel.memberCount || 0} members</span>
						</div>
					</div>
					
					{#if channel.description}
						<p class="channel-description">{channel.description}</p>
					{:else}
						<p class="no-description">No description</p>
					{/if}
					
					<div class="channel-stats">
						<div class="stat">
							<span class="stat-label">Messages:</span>
							<span class="stat-value">{channel.messageCount || 0}</span>
						</div>
						{#if channel.lastActivity}
							<div class="stat">
								<span class="stat-label">Last activity:</span>
								<span class="stat-value">{new Date(channel.lastActivity).toLocaleDateString()}</span>
							</div>
						{/if}
					</div>
					
					<div class="channel-actions">
						<button class="btn-secondary" on:click={() => alert('View channel functionality would go here')}>
							View
						</button>
						<button class="btn-danger" on:click={() => deleteChannel(channel.id)}>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<div class="empty-icon">📺</div>
			<h4>No channels created yet</h4>
			<p>Create your first communication channel to get started</p>
		</div>
	{/if}
</div>

<!-- Create Channel Dialog -->
{#if showCreateChannelDialog}
	<div class="modal-overlay" on:click={() => showCreateChannelDialog = false}>
		<div class="modal" on:click|stopPropagation>
			<h3>Create New Channel</h3>
			
			<div class="form-group">
				<label for="channelName">Channel Name</label>
				<input 
					id="channelName"
					type="text" 
					bind:value={newChannel.name} 
					placeholder="e.g. general, development, announcements"
				/>
			</div>
			
			<div class="form-group">
				<label for="channelDescription">Description</label>
				<textarea 
					id="channelDescription"
					bind:value={newChannel.description} 
					placeholder="What is this channel for?"
					rows="3"
				></textarea>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={newChannel.isDirectorChannel}
					/>
					<span>Director Channel (high priority)</span>
				</label>
			</div>
			
			<div class="modal-actions">
				<button class="btn-secondary" on:click={() => showCreateChannelDialog = false}>
					Cancel
				</button>
				<button class="btn-primary" on:click={createChannel} disabled={!newChannel.name.trim()}>
					Create Channel
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.channels-section {
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

	.channels-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 20px;
	}

	.channel-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 20px;
		transition: all 0.2s ease;
	}

	.channel-card:hover {
		border-color: #d1d5db;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	.channel-card.director {
		border-left: 4px solid #f59e0b;
		background: #fffbeb;
	}

	.channel-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.channel-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #111827;
		flex: 1;
	}

	.channel-badges {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.badge {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.badge.director {
		background: #fef3c7;
		color: #92400e;
	}

	.badge.members {
		background: #f3f4f6;
		color: #6b7280;
	}

	.channel-description {
		margin: 0 0 16px 0;
		color: #374151;
		font-size: 14px;
		line-height: 1.5;
	}

	.no-description {
		margin: 0 0 16px 0;
		color: #9ca3af;
		font-style: italic;
		font-size: 14px;
	}

	.channel-stats {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
		padding: 12px;
		background: #f9fafb;
		border-radius: 6px;
	}

	.stat {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 14px;
	}

	.stat-label {
		color: #6b7280;
	}

	.stat-value {
		color: #374151;
		font-weight: 500;
	}

	.channel-actions {
		display: flex;
		gap: 8px;
	}

	.btn-primary, .btn-secondary, .btn-danger {
		padding: 8px 16px;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.btn-primary:disabled {
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

	.empty-state {
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

	.empty-state h4 {
		margin: 0 0 8px 0;
		color: #374151;
		font-size: 18px;
		font-weight: 600;
	}

	.empty-state p {
		margin: 0;
		font-size: 16px;
	}

	/* Modal styles */
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

	.modal {
		background: white;
		padding: 24px;
		border-radius: 8px;
		min-width: 500px;
		max-width: 90vw;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal h3 {
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
	}

	.checkbox-label input[type="checkbox"] {
		width: auto !important;
		margin: 0;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid #e5e7eb;
	}
</style>