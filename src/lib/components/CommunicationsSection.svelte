<script>
	import MessagesView from './MessagesView.svelte';

	export let selectedProject = null;
	export let commsViewMode = 'dashboard';
	export let channels = [];
	export let allMessages = [];
	export let directorActivity = {};
	export let selectedMessage = null;
	export let showReplyDialog = false;
	export let replyToMessageId = null;
	export let formatTimeAgo;
	export let getMessageIcon;

	function switchToMessages() {
		commsViewMode = 'messages';
		// Trigger messages load here if needed
	}
</script>

{#if selectedProject}
	<div class="communications-section">
		<div class="comms-nav">
			<button 
				class="comms-nav-btn" 
				class:active={commsViewMode === 'dashboard'}
				on:click={() => commsViewMode = 'dashboard'}
			>
				📊 Dashboard
			</button>
			<button 
				class="comms-nav-btn" 
				class:active={commsViewMode === 'messages'}
				on:click={switchToMessages}
			>
				💬 Messages
			</button>
			<button 
				class="comms-nav-btn" 
				class:active={commsViewMode === 'channels'}
				on:click={() => commsViewMode = 'channels'}
			>
				📺 Channels
			</button>
		</div>

		<div class="comms-content">
			{#if commsViewMode === 'dashboard'}
				<div class="dashboard-grid">
					<div class="dashboard-card">
						<h3>📊 Channel Activity</h3>
						{#if directorActivity.channelStats?.length > 0}
							<div class="channel-stats-list">
								{#each directorActivity.channelStats as channelStat}
									<div class="activity-item">
										<span class="activity-channel">
											#{channelStat.name}
										</span>
										<span class="activity-count">{channelStat.messageCount} messages</span>
										<span class="activity-time">{formatTimeAgo(channelStat.lastActivity)}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="empty-note">No channel activity yet</p>
						{/if}
					</div>

					<div class="dashboard-card">
						<h3>📈 Recent Activity</h3>
						{#if directorActivity.recentActivity?.length > 0}
							<div class="recent-activity-list">
								{#each directorActivity.recentActivity.slice(0, 5) as activity}
									<div class="activity-item recent">
										<span class="activity-icon">{getMessageIcon(activity)}</span>
										<div class="activity-details">
											<span class="activity-summary">
												{activity.authorAgentId || 'System'} 
												{#if activity.channelName}in #{activity.channelName}{/if}
											</span>
											<span class="activity-preview">{activity.body.substring(0, 40)}...</span>
										</div>
										<span class="activity-time">{formatTimeAgo(activity.createdAt)}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="empty-note">No recent activity</p>
						{/if}
					</div>
				</div>

			{:else if commsViewMode === 'messages'}
				<MessagesView 
					messages={allMessages}
					bind:selectedMessage 
					bind:showReplyDialog 
					bind:replyToMessageId 
					{formatTimeAgo} 
				/>

			{:else if commsViewMode === 'channels'}
				<div class="channels-view">
					<div class="section-header">
						<h3>Communication Channels</h3>
					</div>
					
					{#if channels.length > 0}
						<div class="channels-grid">
							{#each channels as channel}
								<div class="channel-card">
									<h4>#{channel.name}</h4>
									<p>{channel.description || 'No description'}</p>
									<div class="channel-stats">
										<span class="stat">👥 {channel.memberCount || 0} members</span>
										<span class="stat">💬 {channel.messageCount || 0} messages</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty-state">
							<h4>📺 No channels yet</h4>
							<p>Communication channels will appear here</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.communications-section {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: white;
		border-radius: 8px;
		overflow: hidden;
	}

	.comms-nav {
		display: flex;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
		padding: 0;
	}

	.comms-nav-btn {
		background: none;
		border: none;
		padding: 12px 20px;
		cursor: pointer;
		font-weight: 500;
		color: #6b7280;
		border-bottom: 2px solid transparent;
		transition: all 0.2s ease;
	}

	.comms-nav-btn:hover {
		color: #374151;
		background: #f3f4f6;
	}

	.comms-nav-btn.active {
		color: #2563eb;
		border-bottom-color: #2563eb;
		background: white;
	}

	.comms-content {
		flex: 1;
		overflow: hidden;
	}

	.dashboard-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		padding: 20px;
		height: 100%;
	}

	.dashboard-card {
		background: #fafbfc;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 16px;
		overflow-y: auto;
	}

	.dashboard-card h3 {
		margin: 0 0 16px 0;
		font-size: 16px;
		font-weight: 600;
		color: #374151;
	}

	.channel-stats-list, .recent-activity-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.activity-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px;
		background: white;
		border-radius: 6px;
		border: 1px solid #f3f4f6;
	}

	.activity-item.recent {
		padding: 12px;
	}

	.activity-channel {
		font-weight: 500;
		color: #374151;
		min-width: 100px;
	}

	.activity-count {
		font-size: 14px;
		color: #6b7280;
		flex: 1;
	}

	.activity-time {
		font-size: 12px;
		color: #9ca3af;
		min-width: 80px;
		text-align: right;
	}

	.activity-icon {
		font-size: 18px;
		min-width: 24px;
	}

	.activity-details {
		flex: 1;
		min-width: 0;
	}

	.activity-summary {
		display: block;
		font-weight: 500;
		color: #374151;
		font-size: 14px;
	}

	.activity-preview {
		display: block;
		font-size: 13px;
		color: #6b7280;
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-note {
		color: #6b7280;
		font-style: italic;
		margin: 0;
	}

	.channels-view {
		padding: 20px;
	}

	.section-header h3 {
		margin: 0 0 16px 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}

	.channels-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.channel-card {
		background: #fafbfc;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 16px;
	}

	.channel-card h4 {
		margin: 0 0 8px 0;
		color: #374151;
		font-size: 16px;
	}

	.channel-card p {
		margin: 0 0 12px 0;
		color: #6b7280;
		font-size: 14px;
	}

	.channel-stats {
		display: flex;
		gap: 12px;
	}

	.stat {
		font-size: 12px;
		color: #6b7280;
	}

	.empty-state {
		text-align: center;
		color: #6b7280;
		padding: 40px 20px;
	}

	.empty-state h4 {
		margin: 0 0 8px 0;
		color: #374151;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}
</style>