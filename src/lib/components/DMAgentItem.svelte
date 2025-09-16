<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let agent: any;
	export let active: boolean = false;
	export let formatMessageTime: (timestamp: string) => string;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	function handleClick() {
		dispatch('select', agent);
	}
</script>

<div 
	class="dm-agent-item"
	class:active
	on:click={handleClick}
>
	<div class="dm-agent-header">
		<div class="dm-agent-name-section">
			<span class="dm-agent-name">{agent.id}</span>
			{#if agent.unreadCount > 0}
				<span class="unread-badge">{agent.unreadCount}</span>
			{/if}
		</div>
		<span class="dm-agent-role">{agent.roleType}</span>
	</div>
	{#if agent.lastMessageAt}
		<div class="dm-agent-details">
			<span class="dm-last-message-time">{formatMessageTime(agent.lastMessageAt)}</span>
		</div>
		{#if agent.lastMessage}
			<div class="dm-last-message-preview">
				{agent.lastMessage.length > 60 ? agent.lastMessage.substring(0, 60) + '...' : agent.lastMessage}
			</div>
		{/if}
	{/if}
</div>

<style>
	.dm-agent-item {
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
		transition: all 0.2s ease;
		cursor: pointer;
		user-select: none;
	}
	.dm-agent-item:hover {
		border-color: #007acc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}
	.dm-agent-item.active {
		border-color: #007acc;
		background: #f0f8ff;
	}
	.dm-agent-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}
	.dm-agent-name-section {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dm-agent-name {
		font-weight: 500;
		color: #333;
	}
	.unread-badge {
		background: #ef4444;
		color: white;
		border-radius: 12px;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 600;
		min-width: 18px;
		text-align: center;
		line-height: 1.2;
	}
	.dm-agent-role {
		font-size: 12px;
		color: #666;
		background: #f3f4f6;
		padding: 2px 6px;
		border-radius: 10px;
	}
	.dm-agent-details {
		display: flex;
		gap: 8px;
		font-size: 12px;
		color: #666;
	}
	.dm-last-message-time {
		font-size: 12px;
		color: #666;
	}
	.dm-last-message-preview {
		font-size: 12px;
		color: #888;
		margin-top: 4px;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}
</style>