<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let agents: any[] = [];
	export let selectedAgent: any = null;
	export let isLoading = false;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Handle agent selection
	function selectAgent(agent: any) {
		dispatch('agentSelect', agent);
	}

	// Get activity indicator class
	function getActivityClass(agent: any) {
		if (agent.recentDmCount > 5) return 'high-activity';
		if (agent.recentDmCount > 0) return 'recent-activity';
		return '';
	}

	// Format role type for display
	function formatRoleType(roleType: string) {
		return roleType.split('-').map(word => 
			word.charAt(0).toUpperCase() + word.slice(1)
		).join(' ');
	}
</script>

<div class="agents-column">
	<div class="column-header">
		<h4>📋 Agents</h4>
		<span class="agent-count">{agents.length} agents</span>
	</div>
	
	<div class="agents-list">
		{#if isLoading}
			<div class="loading">Loading agents...</div>
		{:else if agents.length === 0}
			<div class="no-agents">
				<p>No agents found</p>
			</div>
		{:else}
			{#each agents as agent}
				<div 
					class="agent-item {getActivityClass(agent)}"
					class:selected={selectedAgent?.id === agent.id}
					on:click={() => selectAgent(agent)}
					role="button"
					tabindex="0"
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							selectAgent(agent);
						}
					}}
				>
					<div class="agent-info">
						<div class="agent-name">{formatRoleType(agent.roleType)}</div>
						<div class="agent-id">{agent.id}</div>
						<div class="agent-status status-{agent.status}">{agent.status}</div>
					</div>
					
					<div class="dm-stats">
						<div class="total-dms">
							<span class="dm-count">{agent.totalDmCount}</span>
							<span class="dm-label">total DMs</span>
						</div>
						{#if agent.recentDmCount > 0}
							<div class="recent-dms">
								<span class="recent-count">{agent.recentDmCount}</span>
								<span class="recent-label">recent</span>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.agents-column {
		width: 300px;
		border-right: 1px solid #e5e5e5;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.column-header {
		padding: 1rem;
		border-bottom: 1px solid #e5e5e5;
		background: #f8f9fa;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.column-header h4 {
		margin: 0;
		font-size: 1rem;
		color: #333;
	}

	.agent-count {
		color: #666;
		font-size: 0.8rem;
	}

	.agents-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.agent-item {
		padding: 0.75rem;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		margin-bottom: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		background: white;
	}

	.agent-item:hover {
		border-color: #007bff;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.agent-item:focus {
		outline: 2px solid #007bff;
		outline-offset: 2px;
	}

	.agent-item.selected {
		border-color: #007bff;
		background: #f0f8ff;
	}

	.agent-item.high-activity {
		border-left: 4px solid #dc3545;
	}

	.agent-item.recent-activity {
		border-left: 4px solid #ffc107;
	}

	.agent-info {
		margin-bottom: 0.5rem;
	}

	.agent-name {
		font-weight: 600;
		color: #333;
	}

	.agent-id {
		font-size: 0.8rem;
		color: #666;
		font-family: monospace;
	}

	.agent-status {
		font-size: 0.7rem;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		font-weight: 600;
		margin-top: 2px;
		display: inline-block;
	}

	.status-active { background: #d4edda; color: #155724; }
	.status-idle { background: #fff3cd; color: #856404; }
	.status-offline { background: #f8d7da; color: #721c24; }

	.dm-stats {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
	}

	.dm-count {
		font-weight: 600;
		color: #007bff;
		font-size: 1.1rem;
	}

	.recent-count {
		font-weight: 600;
		color: #dc3545;
	}

	.dm-label, .recent-label {
		color: #666;
		margin-left: 2px;
	}

	.loading, .no-agents {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #666;
		font-style: italic;
		padding: 2rem;
	}
</style>