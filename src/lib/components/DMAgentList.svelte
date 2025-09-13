<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import DMAgentItem from './DMAgentItem.svelte';

	// Props
	export let dmAgents: any[] = [];
	export let selectedDMAgent: any = null;
	export let formatMessageTime: (timestamp: string) => string;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	function handleDMAgentSelect(event: CustomEvent) {
		dispatch('agentSelect', event.detail);
	}

	function handleSendMessage() {
		dispatch('sendMessage');
	}
</script>

<div class="dm-agents-panel">
	<div class="dm-agents-header">
		<h3>Agents ({dmAgents.length})</h3>
		<button 
			class="btn-primary btn-sm"
			on:click={handleSendMessage}
			title="Send Message"
		>
			✉️ Send Message
		</button>
	</div>
	
	<div class="dm-agent-list">
		{#each dmAgents as agent}
			<DMAgentItem 
				{agent}
				active={selectedDMAgent?.id === agent.id}
				{formatMessageTime}
				on:select={handleDMAgentSelect}
			/>
		{/each}
		{#if dmAgents.length === 0}
			<div class="no-dm-agents">
				<p>No direct message conversations yet.</p>
				<p>Send a message to an agent to start!</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.dm-agents-panel {
		background: #f9fafb;
		border-right: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 300px;
	}
	
	.dm-agents-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid #e5e7eb;
		background: white;
	}
	
	.dm-agents-header h3 {
		margin: 0;
		color: #374151;
		font-size: 16px;
		font-weight: 600;
	}
	
	.btn-primary {
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}
	
	.btn-primary:hover {
		background: #2563eb;
	}
	
	.btn-sm {
		padding: 6px 12px;
		font-size: 13px;
	}
	
	.dm-agent-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	
	.no-dm-agents {
		text-align: center;
		color: #6b7280;
		padding: 20px;
		font-size: 14px;
	}
	
	.no-dm-agents p {
		margin: 0 0 8px 0;
	}
	
	.no-dm-agents p:last-child {
		margin-bottom: 0;
	}
</style>