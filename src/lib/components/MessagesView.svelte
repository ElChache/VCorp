<script>
	export let messages = [];
	export let selectedMessage = null;
	export let showReplyDialog = false;
	export let replyToMessageId = null;
	export let formatTimeAgo;

	function handleReply(message) {
		selectedMessage = message;
		replyToMessageId = message.id;
		showReplyDialog = true;
	}
</script>

<div class="messages-view-clean">
	{#if messages.length > 0}
		<div class="messages-toolbar">
			<div class="message-stats">
				<span class="stat-item">
					<span class="stat-number">{messages.length}</span>
					<span class="stat-label">messages</span>
				</span>
				<span class="stat-item">
					<span class="stat-number">{messages.filter(m => m.readingAssignments.length > 0).length}</span>
					<span class="stat-label">with assignments</span>
				</span>
			</div>
		</div>
		
		<div class="messages-grid">
			{#each messages as message}
				<div class="message-row">
					<div class="message-header">
						<div class="message-title-line">
							{#if message.title && message.title.trim()}
								<strong>{message.title}</strong>
							{:else}
								<span class="message-type">{message.type}</span>
							{/if}
							{#if message.isReply}
								<span class="reply-badge">Reply</span>
							{/if}
						</div>
						<div class="message-source-line">
							<span class="message-source">
								{#if message.authorAgentId}
									{message.authorAgentId}
								{:else}
									Director
								{/if}
							</span>
							{#if message.channelName}
								<span class="channel-name">#{message.channelName}</span>
							{:else if message.isDM}
								<span class="dm-badge">DM</span>
							{/if}
							<span class="message-time">{formatTimeAgo(message.createdAt)}</span>
						</div>
					</div>
					
					{#if message.body && message.body.trim()}
						<div class="message-body">
							{message.body.length > 200 
								? message.body.substring(0, 200) + '...' 
								: message.body
							}
						</div>
					{/if}
					
					{#if message.readingAssignments && message.readingAssignments.length > 0}
						<div class="reading-assignments">
							{#each message.readingAssignments as assignment}
								<div class="assignment-chip">
									<span class="assignment-target">{assignment.assignedToType}: {assignment.assignedTo}</span>
									<span class="assignment-status" class:fully-read={assignment.isFullyRead}>
										{assignment.readCount}/{assignment.totalTargets}
									</span>
								</div>
							{/each}
						</div>
					{/if}
					
					<div class="message-actions">
						<button 
							class="action-btn reply-btn" 
							on:click={() => handleReply(message)}
						>
							Reply
						</button>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state-clean">
			<div class="empty-icon">💬</div>
			<h4>No messages</h4>
			<p>Team messages and replies will appear here</p>
		</div>
	{/if}
</div>

<style>
	.messages-view-clean {
		background: #fafbfc;
		border-radius: 8px;
		padding: 0;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.messages-toolbar {
		background: white;
		border-bottom: 1px solid #e5e7eb;
		padding: 16px 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-radius: 8px 8px 0 0;
	}

	.message-stats {
		display: flex;
		gap: 24px;
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 14px;
	}

	.stat-number {
		font-weight: 600;
		color: #374151;
	}

	.stat-label {
		color: #6b7280;
	}

	.messages-grid {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	.message-row {
		background: white;
		border-bottom: 1px solid #f3f4f6;
		padding: 16px 20px;
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
		transition: background-color 0.15s ease;
	}

	.message-row:hover {
		background: #f9fafb;
	}

	.message-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.message-title-line {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		line-height: 1.4;
	}

	.message-title-line strong {
		color: #111827;
		font-weight: 600;
	}

	.message-type {
		color: #6b7280;
		font-size: 13px;
		text-transform: capitalize;
		background: #f3f4f6;
		padding: 2px 8px;
		border-radius: 4px;
	}

	.reply-badge {
		background: #dbeafe;
		color: #1d4ed8;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
	}

	.message-source-line {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: #6b7280;
	}

	.message-source {
		font-weight: 500;
		color: #374151;
	}

	.channel-name {
		background: #f3f4f6;
		padding: 2px 6px;
		border-radius: 4px;
		color: #4b5563;
	}

	.dm-badge {
		background: #fef3c7;
		color: #92400e;
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 500;
	}

	.message-time {
		margin-left: auto;
		color: #9ca3af;
	}

	.message-body {
		font-size: 14px;
		line-height: 1.5;
		color: #374151;
		padding: 8px 0;
		border-left: 3px solid #e5e7eb;
		padding-left: 12px;
		margin-left: 4px;
	}

	.reading-assignments {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 4px;
	}

	.assignment-chip {
		background: #f3f4f6;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 6px 10px;
		font-size: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.assignment-target {
		color: #4b5563;
		font-weight: 500;
	}

	.assignment-status {
		background: #fee2e2;
		color: #dc2626;
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 600;
		font-size: 11px;
	}

	.assignment-status.fully-read {
		background: #dcfce7;
		color: #16a34a;
	}

	.message-actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}

	.action-btn {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
	}

	.reply-btn:hover {
		background: #dbeafe;
		border-color: #93c5fd;
		color: #1d4ed8;
	}

	.empty-state-clean {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 300px;
		text-align: center;
		color: #6b7280;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state-clean h4 {
		margin: 0 0 8px 0;
		color: #374151;
		font-weight: 600;
	}

	.empty-state-clean p {
		margin: 0;
		font-size: 14px;
	}
</style>