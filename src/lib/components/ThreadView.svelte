<script lang="ts">
	import { marked } from 'marked';
	import { createEventDispatcher } from 'svelte';

	// Props passed from parent
	export let selectedProject: any = null;
	export let selectedThreadMessage: any = null;
	export let isThreadsColumnOpen: boolean = false;
	export let replyContent: string = '';
	export let formatMessageTime: (timestamp: string) => string;
	export let isMessageFullyRead: (message: any) => boolean;
	export let isMessagePartiallyRead: (message: any) => boolean;
	export let toggleReadStatusTooltip: (event: MouseEvent, message: any) => void;

	// Internal state
	let threadReplies: any[] = [];
	let threadTree: any[] = [];

	// Event dispatcher for parent communication
	const dispatch = createEventDispatcher();

	// Thread management functions (colocated from main component)
	async function loadThreadReplies(message: any) {
		if (!message?.id) {
			threadReplies = [];
			return;
		}

		try {
			// Use dedicated thread endpoint to get ALL replies for this message
			const response = await fetch(`/api/content/${message.id}/thread`);
			if (response.ok) {
				const data = await response.json();
				// The thread API returns replies directly
				threadReplies = data.replies || [];
			}
		} catch (err) {
			console.error('Failed to load thread replies:', err);
			threadReplies = [];
		}
	}

	// Build flat comment list sorted by timestamp - all replies are to the selected message
	function buildThreadTree(replies: any[]) {
		return replies
			.map((reply: any) => ({ ...reply, children: [] }))
			.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	}

	function closeThreadsColumn() {
		dispatch('close');
	}

	function handleSendReply() {
		dispatch('sendReply');
	}

	function handleReplyKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (replyContent.trim()) {
				handleSendReply();
			}
		}
	}

	// Update thread replies when new updates come in
	export function updateThreadReplies(updates: any) {
		if (selectedThreadMessage && updates.replies?.length > 0) {
			const relevantReplies = updates.replies.filter(
				(reply: any) => reply.parentContentId === selectedThreadMessage.id
			);
			if (relevantReplies.length > 0) {
				console.log(`🔄 Adding ${relevantReplies.length} new replies to thread ${selectedThreadMessage.id}`);
				// Add new replies to existing thread replies, avoiding duplicates
				const existingIds = new Set(threadReplies.map(r => r.id));
				const newReplies = relevantReplies.filter(reply => !existingIds.has(reply.id));
				if (newReplies.length > 0) {
					threadReplies = [...threadReplies, ...newReplies].sort(
						(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);
				}
			}
		}
	}

	// Reactive statement to rebuild thread tree when replies change
	$: threadTree = buildThreadTree(threadReplies);

	// Load thread replies when selected message changes
	$: if (selectedThreadMessage) {
		loadThreadReplies(selectedThreadMessage);
	}
</script>

<div class="threads-column" class:open={isThreadsColumnOpen}>
	{#if selectedThreadMessage}
		<div class="threads-header">
			<h3>💬 Thread ({threadReplies.length})</h3>
			<button class="close-threads-btn" on:click={closeThreadsColumn} title="Close thread">
				×
			</button>
		</div>
		
		<div class="threads-container">
			<div class="original-message">
				<div class="message-header">
					<span class="message-author">
						{selectedThreadMessage.authorAgentId || 'System'}
					</span>
					<span class="message-time">{formatMessageTime(selectedThreadMessage.createdAt)}</span>
					{#if selectedThreadMessage.readingAssignments && selectedThreadMessage.readingAssignments.length > 0}
						<div class="read-status-icon-container" 
							 on:click={(e) => toggleReadStatusTooltip(e, selectedThreadMessage)}>
							<span class="read-status-icon" class:fully-read={isMessageFullyRead(selectedThreadMessage)} class:partially-read={isMessagePartiallyRead(selectedThreadMessage)}>
								{#if isMessageFullyRead(selectedThreadMessage)}
									✅
								{:else if isMessagePartiallyRead(selectedThreadMessage)}
									👀
								{:else}
									📩
								{/if}
							</span>
						</div>
					{/if}
				</div>
				<div class="message-content markdown-content">
					{#if selectedThreadMessage.title && selectedThreadMessage.title !== selectedThreadMessage.body}
						<strong>{selectedThreadMessage.title}</strong><br>
					{/if}
					{@html marked((selectedThreadMessage.body || '').replace(/\\n/g, '\n'))}
				</div>
			</div>
			
			{#if threadTree.length > 0}
				{#each threadTree as reply}
					<div class="thread-reply">
						<div class="message-header">
							<span class="message-author">
								{reply.authorAgentId === 'human-director' ? 'Human Director' : reply.authorAgentId || 'System'}
							</span>
							<span class="message-time">{formatMessageTime(reply.createdAt)}</span>
							{#if reply.readingAssignments && reply.readingAssignments.length > 0}
								<div class="read-status-icon-container" 
									 on:click={(e) => toggleReadStatusTooltip(e, reply)}>
									<span class="read-status-icon" class:fully-read={isMessageFullyRead(reply)} class:partially-read={isMessagePartiallyRead(reply)}>
										{#if isMessageFullyRead(reply)}
											✅
										{:else if isMessagePartiallyRead(reply)}
											👀
										{:else}
											📩
										{/if}
									</span>
								</div>
							{/if}
						</div>
						<div class="message-content markdown-content">
							{@html marked((reply.body || '').replace(/\\n/g, '\n'))}
						</div>
					</div>
				{/each}
			{:else}
				<div class="no-replies">
					<p>No replies yet. Start the discussion!</p>
				</div>
			{/if}
		</div>

		<!-- Add Reply Form -->
		<div class="add-reply-form">
			<textarea 
				bind:value={replyContent} 
				placeholder="Add a reply..."
				rows="3"
				class="reply-input"
				on:keydown={handleReplyKeydown}
			></textarea>
			<button 
				class="btn-primary btn-sm" 
				on:click={handleSendReply}
				disabled={!replyContent.trim()}
			>
				💬 Reply
			</button>
		</div>
	{:else}
		<div class="no-thread-selected">
			<p>Select a message to view thread</p>
		</div>
	{/if}
</div>

<style>
	.threads-column {
		position: absolute;
		top: 0;
		right: -400px;
		width: 400px;
		height: 100%;
		background: white;
		border-left: 1px solid #e5e7eb;
		box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
		transition: right 0.3s ease-in-out;
		z-index: 10;
		display: flex;
		flex-direction: column;
	}

	.threads-column.open {
		right: 0;
	}

	.threads-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.threads-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #374151;
	}

	.close-threads-btn {
		background: none;
		border: none;
		font-size: 18px;
		color: #6b7280;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.close-threads-btn:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.threads-container {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.original-message {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 12px;
		border-left: 4px solid #3b82f6;
	}

	.thread-reply {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 12px;
		margin-left: 16px;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-size: 14px;
	}

	.message-author {
		font-weight: 600;
		color: #374151;
	}

	.message-time {
		font-size: 12px;
		color: #9ca3af;
	}

	.message-content {
		line-height: 1.5;
		color: #374151;
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

	.no-replies {
		text-align: center;
		color: #6b7280;
		padding: 20px;
		font-style: italic;
	}

	.no-thread-selected {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #9ca3af;
		font-size: 14px;
	}

	.add-reply-form {
		border-top: 1px solid #e5e7eb;
		padding: 16px;
		background: #f9fafb;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.reply-input {
		width: 100%;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 14px;
		font-family: inherit;
		resize: vertical;
		transition: border-color 0.2s ease;
	}

	.reply-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s ease;
		align-self: flex-start;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.btn-primary:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.btn-sm {
		padding: 8px 16px;
		font-size: 14px;
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