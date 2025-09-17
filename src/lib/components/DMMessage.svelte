<script lang="ts">
	import { marked } from 'marked';
	import { createEventDispatcher } from 'svelte';
	import { markMessageAsRead, isUnreadByHumanDirector, hasUnreadAssignmentForHumanDirector } from '$lib/utils/messageOperations';
	import { isMessageFromHumanDirector } from '$lib/utils/humanDirectorClientHelpers';

	// Props
	export let message: any;
	export let formatMessageTime: (timestamp: string) => string;
	export let isMessageFullyRead: (message: any) => boolean;
	export let isMessagePartiallyRead: (message: any) => boolean;
	export let toggleReadStatusTooltip: (event: MouseEvent, message: any) => void;
	
	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Check if this is an outgoing message (from human-director)
	$: isOutgoingMessage = isMessageFromHumanDirector(message);
	$: isUnread = isUnreadByHumanDirector(message);
	
	// Force reactivity - ensure UI updates when message prop changes
	$: if (message.id === 72 || message.id === 73) {
		console.log(`🔄 DMMessage reactivity for ${message.id}:`, { isUnread, readingAssignments: message.readingAssignments });
	}
	
	// Debug logging for message 72 (the one we just sent)
	$: if (message.id === 72) {
		console.log('Message 72 debug:', {
			id: message.id,
			authorAgentId: message.authorAgentId,
			isOutgoingMessage,
			isUnread,
			readingAssignments: message.readingAssignments,
			shouldShowButton: !isOutgoingMessage && isUnread,
			assignment0: message.readingAssignments?.[0],
			lastUpdated: new Date().toISOString()
		});
	}
	

	function handleReadStatusClick(event: MouseEvent) {
		toggleReadStatusTooltip(event, message);
	}

	async function handleMarkAsRead() {
		console.log('🔄 Marking message as read:', message.id);
		await markMessageAsRead(message);
		console.log('✅ Mark as read completed for message:', message.id);
		// Force UI update by triggering reactivity
	}
</script>

<div class="message" class:reply={message.parentContentId}>
	<div class="message-header">
		<span class="message-author">{message.authorAgentId || 'System'}</span>
		<div class="message-header-right">
			<span class="message-time">{formatMessageTime(message.createdAt)}</span>
			{#if message.readingAssignments && message.readingAssignments.length > 0 && isOutgoingMessage}
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
		</div>
	</div>
	
	<div class="message-content markdown-content">
		{#if message.title && message.title !== message.body}
			<strong>{message.title}</strong><br>
		{/if}
		{@html marked((message.body || '').replace(/\\n/g, '\n'))}
	</div>
	
	<div class="message-actions">
		{#if !isOutgoingMessage && isUnread}
			<button class="mark-read-btn" on:click={handleMarkAsRead}>
				📖 Mark as Read
			</button>
		{/if}
	</div>
</div>

<style>
	.message {
		border-bottom: 1px solid #f0f0f0;
		padding: 16px;
		margin-bottom: 8px;
		background: white;
		border-radius: 8px;
		transition: background-color 0.2s ease;
	}
	.message:hover {
		background-color: #f9fafb;
	}
	.message.reply {
		background: #f8fafc;
		border-left: 3px solid #3b82f6;
		padding-left: 13px;
	}
	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}
	.message-author {
		font-weight: 600;
		color: #374151;
	}
	.message-header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.message-time {
		font-size: 12px;
		color: #9ca3af;
	}
	.message-content {
		margin-bottom: 12px;
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
	.mark-read-btn {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.2s ease;
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.mark-read-btn:hover {
		background: #2563eb;
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