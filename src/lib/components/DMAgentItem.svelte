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
		<span class="dm-agent-name">{agent.id}</span>
		<span class="dm-agent-role">{agent.roleType}</span>
	</div>
	{#if agent.lastMessageAt}
		<div class="dm-agent-details">
			<span class="dm-last-message">{formatMessageTime(agent.lastMessageAt)}</span>
		</div>
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
	.dm-agent-name {
		font-weight: 500;
		color: #333;
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
	.dm-last-message {
		font-size: 12px;
		color: #666;
	}
</style>