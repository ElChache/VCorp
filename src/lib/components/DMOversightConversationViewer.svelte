<script lang="ts">
	import { formatMessageTime } from '$lib/utils/messageOperations';

	// Props
	export let selectedAgent: any = null;
	export let conversationData: any = null;
	export let isLoading = false;

	// Reactive values from conversation data
	$: conversations = conversationData?.conversations || [];
	$: totalDmMessages = conversationData?.totalDmMessages || 0;
	$: conversationPartners = conversationData?.conversationPartners || 0;

	// Format role type for display
	function formatRoleType(roleType: string) {
		return roleType.split('-').map(word => 
			word.charAt(0).toUpperCase() + word.slice(1)
		).join(' ');
	}
</script>

<div class="conversations-column">
	{#if selectedAgent}
		<div class="column-header">
			<h4>💬 {formatRoleType(selectedAgent.roleType)} DMs</h4>
			<div class="conversation-stats">
				<span>{totalDmMessages} messages</span>
				<span>•</span>
				<span>{conversationPartners} partners</span>
			</div>
		</div>

		{#if isLoading}
			<div class="loading">Loading conversations...</div>
		{:else if conversations.length === 0}
			<div class="no-conversations">
				<p>🤐 This agent hasn't sent any DMs to other agents</p>
			</div>
		{:else}
			<div class="conversations-list">
				{#each conversations as conversation}
					<div class="conversation-group">
						<div class="conversation-header">
							<div class="partner-info">
								<span class="partner-role">
									{formatRoleType(conversation.otherAgentRole)}
								</span>
								<span class="partner-id">({conversation.otherAgentId})</span>
							</div>
							<div class="conversation-meta">
								<span class="message-count">{conversation.messageCount} messages</span>
								<span class="last-activity">
									Last: {formatMessageTime(conversation.lastMessageAt)}
								</span>
							</div>
						</div>
						
						<div class="messages-in-conversation">
							{#each conversation.messages as message}
								<div class="dm-message {message.direction}">
									<div class="message-header">
										<span class="direction-indicator">
											{message.direction === 'sent' ? '→' : '←'}
										</span>
										<span class="message-role">
											{formatRoleType(message.authorRoleType)}
										</span>
										<span class="message-time">
											{formatMessageTime(message.createdAt)}
										</span>
									</div>
									
									<div class="message-content">
										{#if message.title}
											<div class="message-title">{message.title}</div>
										{/if}
										<div class="message-body">{message.body}</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<div class="no-selection">
			<div class="no-selection-content">
				<h4>👈 Select an agent</h4>
				<p>Choose an agent from the left to view their DM conversations with other team members.</p>
				<div class="selection-tip">
					<strong>💡 Tip:</strong> Agents with higher DM counts have been more active in private communications.
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.conversations-column {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.column-header {
		padding: 1rem;
		border-bottom: 1px solid #e5e5e5;
		background: #f8f9fa;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.column-header h4 {
		margin: 0;
		font-size: 1rem;
		color: #333;
	}

	.conversation-stats {
		color: #666;
		font-size: 0.8rem;
	}

	.conversations-list {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.conversation-group {
		margin-bottom: 2rem;
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		overflow: hidden;
	}

	.conversation-header {
		padding: 1rem;
		background: #f8f9fa;
		border-bottom: 1px solid #e5e5e5;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.partner-role {
		font-weight: 600;
		color: #333;
	}

	.partner-id {
		color: #666;
		font-size: 0.8rem;
		font-family: monospace;
	}

	.conversation-meta {
		color: #666;
		font-size: 0.8rem;
	}

	.messages-in-conversation {
		max-height: 400px;
		overflow-y: auto;
	}

	.dm-message {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f0f0f0;
	}

	.dm-message.sent {
		background: #f0f8ff;
	}

	.dm-message:last-child {
		border-bottom: none;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		font-size: 0.8rem;
	}

	.direction-indicator {
		font-weight: 600;
		color: #007bff;
	}

	.message-role {
		font-weight: 600;
		color: #333;
	}

	.message-time {
		color: #666;
	}

	.message-title {
		font-weight: 600;
		color: #333;
		margin-bottom: 0.25rem;
	}

	.message-body {
		color: #333;
		line-height: 1.4;
		white-space: pre-wrap;
	}

	.no-selection {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.no-selection-content {
		text-align: center;
		max-width: 400px;
	}

	.no-selection-content h4 {
		margin: 0 0 1rem 0;
		color: #666;
	}

	.no-selection-content p {
		color: #666;
		margin: 0 0 1.5rem 0;
		line-height: 1.5;
	}

	.selection-tip {
		padding: 1rem;
		background: #f0f8ff;
		border-radius: 8px;
		border-left: 4px solid #007bff;
	}

	.selection-tip strong {
		color: #007bff;
	}

	.no-conversations {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		font-style: italic;
		padding: 2rem;
	}

	.loading {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}
</style>