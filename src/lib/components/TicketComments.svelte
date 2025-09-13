<script lang="ts">
	import { marked } from 'marked';
	import { createEventDispatcher } from 'svelte';
	import { replies } from '$lib/stores/contentStore';

	// Props passed from parent
	export let selectedProject: any = null;
	export let selectedTicket: any = null;
	export let isCommentsColumnOpen: boolean = false;
	export let replyContent: string = '';
	export let formatMessageTime: (timestamp: string) => string;

	// Internal state
	let ticketComments: any[] = [];

	// Event dispatcher for parent communication
	const dispatch = createEventDispatcher();

	// Load ticket comments from content store
	$: if (selectedTicket && $replies) {
		ticketComments = $replies
			.filter(reply => reply.parentContentId === selectedTicket.id)
			.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	}

	function closeCommentsColumn() {
		dispatch('close');
	}

	function handleSendComment() {
		dispatch('sendComment');
	}

	function handleCommentKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (replyContent.trim()) {
				handleSendComment();
			}
		}
	}

	// Public method to update comments when new updates come in
	export function updateTicketComments(updates: any) {
		if (selectedTicket && updates.replies?.length > 0) {
			const relevantComments = updates.replies.filter(
				(reply: any) => reply.parentContentId === selectedTicket.id
			);
			if (relevantComments.length > 0) {
				console.log(`🔄 Adding ${relevantComments.length} new comments to ticket ${selectedTicket.id}`);
				// Content store will automatically update via reactive statement above
			}
		}
	}
</script>

<div class="comments-column" class:open={isCommentsColumnOpen}>
	{#if selectedTicket}
		<div class="comments-header">
			<h3>💬 Comments ({ticketComments.length})</h3>
			<button class="close-comments-btn" on:click={closeCommentsColumn} title="Close comments">
				×
			</button>
		</div>
		
		<div class="comments-container">
			<div class="original-ticket">
				<div class="ticket-header">
					<div class="ticket-title">{selectedTicket.title}</div>
					<div class="ticket-meta">
						<span class="ticket-author">{selectedTicket.authorAgentId || 'System'}</span>
						<span class="ticket-time">{formatMessageTime(selectedTicket.createdAt)}</span>
					</div>
				</div>
				<div class="ticket-content markdown-content">
					{@html marked((selectedTicket.body || '').replace(/\\n/g, '\n'))}
				</div>
				<div class="ticket-badges">
					<span class="badge priority-{selectedTicket.priority}">
						{selectedTicket.priority}
					</span>
					<span class="badge status-{selectedTicket.status}">
						{selectedTicket.status?.replace('_', ' ')}
					</span>
					<span class="badge role-assigned">
						{selectedTicket.assignedToRoleType}
					</span>
				</div>
			</div>
			
			{#if ticketComments.length > 0}
				{#each ticketComments as comment}
					<div class="ticket-comment">
						<div class="comment-header">
							<span class="comment-author">
								{comment.authorAgentId === 'human-director' ? 'Human Director' : comment.authorAgentId || 'System'}
							</span>
							<span class="comment-time">{formatMessageTime(comment.createdAt)}</span>
						</div>
						<div class="comment-content markdown-content">
							{@html marked((comment.body || '').replace(/\\n/g, '\n'))}
						</div>
					</div>
				{/each}
			{:else}
				<div class="no-comments">
					<p>No comments yet. Start the discussion!</p>
				</div>
			{/if}
		</div>

		<!-- Add Comment Form -->
		<div class="add-comment-form">
			<textarea 
				bind:value={replyContent} 
				placeholder="Add a comment..."
				rows="3"
				class="comment-input"
				on:keydown={handleCommentKeydown}
			></textarea>
			<button 
				class="btn-primary btn-sm" 
				on:click={handleSendComment}
				disabled={!replyContent.trim()}
			>
				💬 Comment
			</button>
		</div>
	{:else}
		<div class="no-ticket-selected">
			<p>Select a ticket to view comments</p>
		</div>
	{/if}
</div>

<style>
	.comments-column {
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

	.comments-column.open {
		right: 0;
	}

	.comments-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.comments-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #374151;
	}

	.close-comments-btn {
		background: none;
		border: none;
		font-size: 18px;
		color: #6b7280;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.close-comments-btn:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.comments-container {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.original-ticket {
		background: #fef7f0;
		border: 1px solid #fed7aa;
		border-radius: 8px;
		padding: 16px;
		border-left: 4px solid #f59e0b;
	}

	.ticket-header {
		margin-bottom: 12px;
	}

	.ticket-title {
		font-size: 16px;
		font-weight: 600;
		color: #374151;
		margin-bottom: 8px;
	}

	.ticket-meta {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: #6b7280;
	}

	.ticket-author {
		font-weight: 500;
	}

	.ticket-content {
		margin-bottom: 12px;
		line-height: 1.5;
		color: #374151;
	}

	.ticket-badges {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.badge {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 600;
		text-transform: capitalize;
	}

	.badge.priority-low { background: #f3f4f6; color: #6b7280; }
	.badge.priority-medium { background: #dbeafe; color: #1d4ed8; }
	.badge.priority-high { background: #fef3c7; color: #d97706; }
	.badge.priority-critical { background: #fee2e2; color: #dc2626; }

	.badge.status-open { background: #d1fae5; color: #065f46; }
	.badge.status-in_progress { background: #dbeafe; color: #1e40af; }
	.badge.status-blocked { background: #fee2e2; color: #991b1b; }
	.badge.status-resolved { background: #f3f4f6; color: #374151; }
	.badge.status-closed { background: #e5e7eb; color: #6b7280; }

	.badge.role-assigned {
		background: #ede9fe;
		color: #7c3aed;
	}

	.ticket-comment {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 12px;
		margin-left: 16px;
	}

	.comment-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-size: 14px;
	}

	.comment-author {
		font-weight: 600;
		color: #374151;
	}

	.comment-time {
		font-size: 12px;
		color: #9ca3af;
	}

	.comment-content {
		line-height: 1.5;
		color: #374151;
	}

	.no-comments {
		text-align: center;
		color: #6b7280;
		padding: 20px;
		font-style: italic;
	}

	.no-ticket-selected {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #9ca3af;
		font-size: 14px;
	}

	.add-comment-form {
		border-top: 1px solid #e5e7eb;
		padding: 16px;
		background: #f9fafb;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.comment-input {
		width: 100%;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 14px;
		font-family: inherit;
		resize: vertical;
		transition: border-color 0.2s ease;
	}

	.comment-input:focus {
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