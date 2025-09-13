<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import DMMessage from './DMMessage.svelte';

	// Props
	export let selectedDMAgent: any = null;
	export let dmMessages: any[] = [];
	export let replyingToMessage: any = null;
	export let replyContent: string = '';
	export let newDMContent: string = '';
	export let formatMessageTime: (timestamp: string) => string;
	export let isMessageFullyRead: (message: any) => boolean;
	export let isMessagePartiallyRead: (message: any) => boolean;
	export let toggleReadStatusTooltip: (event: MouseEvent, message: any) => void;
	export let startReply: (message: any) => void;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	function handleSendReply() {
		dispatch('sendReply');
	}

	function handleCancelReply() {
		dispatch('cancelReply');
	}

	function handleSendDM() {
		dispatch('sendDM');
	}

	function handleReplyKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSendReply();
		}
	}

	function handleDMKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSendDM();
		}
	}
</script>

{#if selectedDMAgent}
	<div class="dm-messages-view">
		<div class="dm-messages-container">
			<div class="dm-messages-list">
				{#if dmMessages.length > 0}
					{#each dmMessages as message}
						<DMMessage 
							{message}
							{formatMessageTime}
							{isMessageFullyRead}
							{isMessagePartiallyRead}
							{toggleReadStatusTooltip}
							{startReply}
						/>
							
						<!-- Reply input interface -->
						{#if replyingToMessage && replyingToMessage.id === message.id}
							<div class="reply-input-container">
								<div class="reply-input-wrapper">
									<input 
										type="text" 
										bind:value={replyContent}
										placeholder="Type your reply..."
										on:keydown={handleReplyKeydown}
									/>
									<button 
										class="send-reply-btn" 
										on:click={handleSendReply}
										disabled={!replyContent.trim()}
									>
										Reply
									</button>
									<button class="cancel-reply-btn" on:click={handleCancelReply}>×</button>
								</div>
							</div>
						{/if}
					{/each}
				{:else}
					<div class="no-messages">
						<p>No messages with {selectedDMAgent.id} yet.</p>
						<p>Start the conversation!</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- DM Input -->
		<div class="dm-input-container">
			<div class="dm-input-wrapper">
				<input 
					type="text" 
					bind:value={newDMContent}
					placeholder="Type a message..."
					on:keydown={handleDMKeydown}
				/>
				<button 
					class="send-btn" 
					on:click={handleSendDM}
					disabled={!newDMContent.trim()}
				>
					Send
				</button>
			</div>
		</div>
	</div>
{:else}
	<div class="dm-placeholder">
		<h3>📩 Direct Messages</h3>
		<p>Select an agent from the left to view your conversation.</p>
	</div>
{/if}

<style>
	.dm-messages-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: white;
	}
	
	.dm-messages-container {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	
	.dm-messages-list {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	
	.no-messages {
		text-align: center;
		color: #6b7280;
		padding: 40px 20px;
		font-size: 14px;
	}
	
	.no-messages p {
		margin: 0 0 8px 0;
	}
	
	.no-messages p:last-child {
		margin-bottom: 0;
	}
	
	/* Reply input styles */
	.reply-input-container {
		margin-top: 8px;
		margin-bottom: 16px;
		padding: 12px;
		background: #f8fafc;
		border-radius: 8px;
		border-left: 3px solid #3b82f6;
	}
	
	.reply-input-wrapper {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	
	.reply-input-wrapper input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 14px;
	}
	
	.send-reply-btn {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}
	
	.send-reply-btn:hover:not(:disabled) {
		background: #2563eb;
	}
	
	.send-reply-btn:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}
	
	.cancel-reply-btn {
		background: #ef4444;
		color: white;
		border: none;
		padding: 8px 12px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}
	
	.cancel-reply-btn:hover {
		background: #dc2626;
	}
	
	/* Main DM input styles */
	.dm-input-container {
		border-top: 1px solid #e5e7eb;
		padding: 16px;
		background: #f9fafb;
	}
	
	.dm-input-wrapper {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	
	.dm-input-wrapper input {
		flex: 1;
		padding: 12px 16px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 14px;
		transition: border-color 0.2s ease;
	}
	
	.dm-input-wrapper input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}
	
	.send-btn {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 12px 20px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}
	
	.send-btn:hover:not(:disabled) {
		background: #2563eb;
	}
	
	.send-btn:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}
	
	/* Placeholder styles */
	.dm-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #6b7280;
		text-align: center;
		padding: 40px;
	}
	
	.dm-placeholder h3 {
		margin: 0 0 12px 0;
		font-size: 18px;
		font-weight: 600;
	}
	
	.dm-placeholder p {
		margin: 0;
		font-size: 14px;
	}
</style>