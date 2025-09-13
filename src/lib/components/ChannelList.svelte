<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ChannelItem from './ChannelItem.svelte';

	// Props
	export let channels: any[] = [];
	export let selectedChannel: any = null;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	function handleChannelSelect(event: CustomEvent) {
		dispatch('channelSelect', event.detail);
	}
</script>

<div class="channels-sidebar">
	<div class="channels-header">
		<h3>Channels ({channels.length})</h3>
	</div>
	
	<div class="channel-list">
		{#each channels.sort((a, b) => (b.isForHumanDirector ? 1 : 0) - (a.isForHumanDirector ? 1 : 0)) as channel}
			<ChannelItem 
				{channel}
				selected={selectedChannel?.id === channel.id}
				on:select={handleChannelSelect}
			/>
		{/each}
	</div>
</div>

<style>
	.channels-sidebar {
		width: 300px;
		border-right: 1px solid #e5e7eb;
		background: #f9fafb;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	
	.channels-header {
		padding: 16px;
		border-bottom: 1px solid #e5e7eb;
		background: white;
	}
	
	.channels-header h3 {
		margin: 0;
		color: #374151;
		font-size: 16px;
		font-weight: 600;
	}
	
	.channel-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
</style>