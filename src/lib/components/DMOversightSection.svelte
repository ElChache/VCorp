<script lang="ts">
	import DMOversightAgentList from '$lib/components/DMOversightAgentList.svelte';
	import DMOversightConversationViewer from '$lib/components/DMOversightConversationViewer.svelte';
	import { dmOversightAgents, dmOversightConversations, isLoading, error } from '$lib/stores/contentStore';
	import { contentActions } from '$lib/stores/contentStore';

	// Props
	export let selectedProject: any = null;

	// State
	let selectedAgent: any = null;
	let isLoadingConversations = false;

	// Handle agent selection
	async function handleAgentSelect(event: CustomEvent) {
		selectedAgent = event.detail;
		isLoadingConversations = true;
		
		try {
			await contentActions.loadDMOversightConversations(selectedProject.id, selectedAgent.id);
		} catch (err) {
			console.error('Failed to load conversations:', err);
		} finally {
			isLoadingConversations = false;
		}
	}

	// Get conversation data for selected agent
	$: conversationData = selectedAgent ? $dmOversightConversations[selectedAgent.id] : null;
</script>

<div class="dm-oversight-container">
	<div class="dm-oversight-header">
		<h3>🔍 DM Oversight</h3>
		<p class="oversight-description">
			Monitor inter-agent direct message communication to maintain project visibility
		</p>
	</div>

	{#if $isLoading && $dmOversightAgents.length === 0}
		<div class="loading">Loading agents...</div>
	{:else if $error}
		<div class="error">⚠️ {$error}</div>
	{:else}
		<div class="dm-oversight-content">
			<DMOversightAgentList 
				agents={$dmOversightAgents}
				{selectedAgent}
				isLoading={$isLoading}
				on:agentSelect={handleAgentSelect}
			/>
			
			<DMOversightConversationViewer 
				{selectedAgent}
				{conversationData}
				isLoading={isLoadingConversations}
			/>
		</div>
	{/if}
</div>

<style>
	.dm-oversight-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.dm-oversight-header {
		padding: 1rem;
		border-bottom: 1px solid #e5e5e5;
		background: #f8f9fa;
	}

	.dm-oversight-header h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		color: #333;
	}

	.oversight-description {
		margin: 0;
		color: #666;
		font-size: 0.9rem;
	}

	.dm-oversight-content {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.loading, .error {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.error {
		color: #dc3545;
	}
</style>