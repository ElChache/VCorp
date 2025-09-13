<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let channel: any;
	export let selected: boolean = false;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	function handleClick() {
		dispatch('select', channel);
	}
</script>

<div 
	class="channel-item"
	class:selected
	on:click={handleClick}
>
	<div class="channel-header">
		<span class="channel-name">#{channel.name}</span>
		{#if channel.isForHumanDirector}
			<span class="channel-badge human-director">👤</span>
		{/if}
	</div>
	<div class="channel-meta">
		<span class="message-count">{channel.messageCount || 0} messages</span>
		{#if channel.unreadCount > 0}
			<span class="unread-count">{channel.unreadCount} unread</span>
		{/if}
	</div>
</div>

<style>
	.channel-item {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 12px;
		cursor: pointer;
		transition: all 0.2s;
		background: white;
	}
	.channel-item:hover {
		border-color: #007bff;
		box-shadow: 0 2px 4px rgba(0,123,255,0.1);
	}
	.channel-item.selected {
		border-color: #007bff;
		background-color: #f8f9ff;
		box-shadow: 0 2px 8px rgba(0,123,255,0.15);
	}
	.channel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}
	.channel-name {
		font-weight: 600;
		color: #333;
		font-size: 0.9rem;
	}
	.channel-badge {
		font-size: 0.7rem;
		padding: 2px 6px;
		border-radius: 8px;
		background: #e9ecef;
		color: #495057;
	}
	.channel-badge.human-director {
		background: #fee2e2;
		color: #dc2626;
	}
	.channel-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.75rem;
		color: #6b7280;
	}
	.message-count {
		font-weight: 500;
	}
	.unread-count {
		color: #ef4444;
		font-weight: 600;
		background: #fef2f2;
		padding: 2px 6px;
		border-radius: 8px;
	}
</style>