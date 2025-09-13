<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ChannelMessage from './ChannelMessage.svelte';

	// Props
	export let selectedChannel: any = null;
	export let channelMessages: any[] = [];
	export let selectedThreadMessage: any = null;
	export let newMessageContent: string = '';
	export let formatMessageTime: (timestamp: string) => string;
	export let isMessageFullyRead: (message: any) => boolean;
	export let isMessagePartiallyRead: (message: any) => boolean;
	export let toggleReadStatusTooltip: (event: MouseEvent, message: any) => void;
	export let startReply: (message: any) => void;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	function handleMessageSelect(event: CustomEvent) {
		dispatch('messageSelect', event.detail);
	}

	function handleSendMessage() {
		dispatch('sendMessage');
	}

	function handleMessageKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	}
</script>

{#if selectedChannel}
	<div class="messages-view">
		<div class="messages-container">
			<div class="messages-list">
				{#if channelMessages.length > 0}
					{#each channelMessages.filter(msg => !msg.parentContentId) as message}
						<ChannelMessage 
							{message}
							{selectedThreadMessage}
							{formatMessageTime}
							{isMessageFullyRead}
							{isMessagePartiallyRead}
							{toggleReadStatusTooltip}
							{startReply}
							on:select={handleMessageSelect}
						/>
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
					bind:value={newMessageContent}
					on:keydown={handleMessageKeydown}
				/>
				<button 
					class="send-btn" 
					on:click={handleSendMessage}
					disabled={!newMessageContent.trim()}
				>
					Send
				</button>
			</div>
			<p class="input-note">Press Enter to send message</p>
		</div>
	</div>
{:else}
	<div class="communications-placeholder">
		<h3>💬 Communications</h3>
		<p>Select a channel from the left to start chatting.</p>
	</div>
{/if}

<style>
	.messages-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: white;
	}

	.messages-container {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.messages-list {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
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

	/* Message input styles */
	.message-input-container {
		border-top: 1px solid #e5e7eb;
		padding: 16px;
		background: #f9fafb;
	}

	.message-input-wrapper {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.message-input {
		flex: 1;
		padding: 12px 16px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 14px;
		transition: border-color 0.2s ease;
	}

	.message-input:focus {
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

	.input-note {
		margin: 8px 0 0 0;
		font-size: 12px;
		color: #6b7280;
	}

	/* Placeholder styles */
	.communications-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #6b7280;
		text-align: center;
		padding: 40px;
	}

	.communications-placeholder h3 {
		margin: 0 0 12px 0;
		font-size: 18px;
		font-weight: 600;
	}

	.communications-placeholder p {
		margin: 0;
		font-size: 14px;
	}

</style>