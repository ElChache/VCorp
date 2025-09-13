<script lang="ts">
	import { marked } from 'marked';
	import { createEventDispatcher } from 'svelte';

	// Props
	export let message: any;
	export let selectedThreadMessage: any = null;
	export let formatMessageTime: (timestamp: string) => string;
	export let isMessageFullyRead: (message: any) => boolean;
	export let isMessagePartiallyRead: (message: any) => boolean;
	export let toggleReadStatusTooltip: (event: MouseEvent, message: any) => void;
	export let startReply: (message: any) => void;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	function handleClick() {
		dispatch('select', message);
	}

	function handleReply() {
		startReply(message);
	}

	function handleReadStatusClick(event: MouseEvent) {
		toggleReadStatusTooltip(event, message);
	}
</script>

<div class="message" 
	class:ticket={message.type === 'ticket'} 
	class:selected={selectedThreadMessage?.id === message.id}
	on:click={handleClick}>
	<div class="message-indicator">
		{#if message.replies && message.replies.length > 0}
			<span class="replies-count">{message.replies.length}</span>
		{/if}
	</div>
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
			
			<div class="ticket-body markdown-content">
				{@html marked((message.body || '').replace(/\\n/g, '\n'))}
			</div>
			
			{#if message.updatedAt && message.updatedAt !== message.createdAt}
				<div class="ticket-updated">
					Last updated: {formatMessageTime(message.updatedAt)}
				</div>
			{/if}
		</div>
	{:else}
		<div class="message-content markdown-content">
			{#if message.title && message.title !== message.body}
				<strong>{message.title}</strong><br>
			{/if}
			{@html marked((message.body || '').replace(/\\n/g, '\n'))}
		</div>
		<div class="message-actions">
			{#if message.readingAssignments && message.readingAssignments.length > 0}
				<div class="read-status-icon-container" on:click={handleReadStatusClick}>
					<span class="read-status-icon" class:fully-read={isMessageFullyRead(message)} class:partially-read={isMessagePartiallyRead(message)}>
						{#if isMessageFullyRead(message)}
							✅
						{:else if isMessagePartiallyRead(message)}
							👀
						{:else}
							📩
						{/if}
					</span>
				</div>
			{/if}
			<button class="reply-btn" on:click={handleReply}>
				Reply
			</button>
		</div>
	{/if}
</div>

<style>
	.message {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
	}

	.message:hover {
		border-color: #3b82f6;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.message.selected {
		border-color: #3b82f6;
		background: #eff6ff;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
	}

	.message.ticket {
		border-left: 4px solid #f59e0b;
		background: #fffbeb;
	}

	.message.ticket.selected {
		background: #fef3c7;
	}

	.message-indicator {
		position: absolute;
		top: 8px;
		right: 8px;
	}

	.replies-count {
		background: #3b82f6;
		color: white;
		font-size: 11px;
		font-weight: 500;
		padding: 2px 6px;
		border-radius: 10px;
		min-width: 16px;
		text-align: center;
		display: inline-block;
	}

	.message-header {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-bottom: 8px;
		flex-wrap: wrap;
	}

	.message-author {
		font-weight: 600;
		color: #374151;
	}

	.message-time {
		font-size: 12px;
		color: #9ca3af;
	}

	.message-type.ticket-badge {
		background: #f59e0b;
		color: white;
		font-size: 10px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.message-content {
		margin-bottom: 8px;
		line-height: 1.5;
		color: #374151;
	}

	.message-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: space-between;
	}

	.read-status-icon-container {
		cursor: pointer;
		padding: 2px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.read-status-icon-container:hover {
		background-color: #f3f4f6;
	}

	.read-status-icon {
		font-size: 14px;
		opacity: 0.7;
		transition: opacity 0.2s ease;
	}

	.read-status-icon.fully-read {
		opacity: 1;
	}

	.read-status-icon.partially-read {
		opacity: 0.8;
	}

	.reply-btn {
		background: none;
		border: 1px solid #d1d5db;
		color: #6b7280;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s ease;
	}

	.reply-btn:hover {
		background: #f9fafb;
		border-color: #9ca3af;
		color: #374151;
	}

	/* Ticket-specific styles */
	.ticket-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ticket-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}

	.ticket-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #111827;
		flex: 1;
	}

	.ticket-badges {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.priority-badge, .status-badge {
		font-size: 10px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
	}

	.priority-badge.priority-high {
		background: #ef4444;
		color: white;
	}

	.priority-badge.priority-medium {
		background: #f59e0b;
		color: white;
	}

	.priority-badge.priority-low {
		background: #10b981;
		color: white;
	}

	.status-badge.status-open {
		background: #3b82f6;
		color: white;
	}

	.status-badge.status-in-progress {
		background: #f59e0b;
		color: white;
	}

	.status-badge.status-resolved {
		background: #10b981;
		color: white;
	}

	.status-badge.status-closed {
		background: #6b7280;
		color: white;
	}

	.ticket-assignment {
		display: flex;
		gap: 12px;
		align-items: center;
		font-size: 12px;
		color: #6b7280;
	}

	.assigned-role, .claimed-agent {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.ticket-body {
		line-height: 1.5;
		color: #374151;
	}

	.ticket-updated {
		font-size: 11px;
		color: #9ca3af;
		font-style: italic;
	}

	/* Markdown content styling */
	.markdown-content :global(p) {
		margin: 0 0 8px 0;
	}
	.markdown-content :global(p:last-child) {
		margin-bottom: 0;
	}
	.markdown-content :global(strong) {
		font-weight: 600;
		color: #111827;
	}
	.markdown-content :global(code) {
		background: #f3f4f6;
		padding: 2px 4px;
		border-radius: 3px;
		font-size: 0.9em;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
	}
</style>