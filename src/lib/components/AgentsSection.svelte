<script>
	export let roles = [];
	export let agents = [];
	export let selectedAgent = null;
	export let selectedRoleType = '';
	export let selectedModel = 'sonnet';
	export let selectedProject = null;
	export let launchAgent = () => {};
	export let killAgent = () => {};
	export let onAgentSelect = () => {};
	export let showStartupPromptEditor = false;
	export let loadStartupPrompt = () => {};

	function formatHeartbeat(timestamp) {
		if (!timestamp) return 'Never';
		return new Date(timestamp).toLocaleTimeString();
	}
</script>

<div class="agents-section">
	<div class="section-header">
		<h2>🤖 Agent Management</h2>
		<div class="agent-controls">
			<select bind:value={selectedRoleType} class="role-selector">
				{#if roles.length === 0}
					<option value="">No roles available</option>
				{:else}
					<option value="">Select role...</option>
					{#each roles as role}
						<option value={role.name}>{role.name}</option>
					{/each}
				{/if}
			</select>
			
			<select bind:value={selectedModel} class="model-selector">
				<option value="sonnet">Sonnet</option>
				<option value="opus">Opus</option>
				<option value="haiku">Haiku</option>
			</select>
			
			<button 
				class="btn-primary" 
				on:click={launchAgent}
				disabled={!selectedRoleType || !selectedProject}
			>
				🚀 Launch Agent
			</button>
		</div>
	</div>

	<div class="agents-content">
		<div class="agents-left">
			<div class="agents-panel">
				<div class="agents-header">
					<h3>All Agents ({agents.length})</h3>
					<button class="btn-secondary" on:click={() => { loadStartupPrompt(); showStartupPromptEditor = true; }}>
						⚙️ Startup Prompt
					</button>
				</div>
				
				<!-- Agent List -->
				<div class="agent-list">
					{#each agents as agent}
						<div 
							class="agent-item"
							class:active={selectedAgent?.id === agent.id}
							on:click={() => onAgentSelect(agent)}
						>
							<div class="agent-header">
								<div class="agent-id-section">
									<span class="agent-status-indicator status-{agent.status}"></span>
									<span class="agent-id">{agent.id}</span>
								</div>
								<span class="agent-status status-{agent.status}">{agent.status}</span>
							</div>
							<div class="agent-details">
								<div class="agent-detail-row">
									<span class="agent-role">{agent.roleType}</span>
									<span class="agent-model">{agent.model}</span>
								</div>
								<div class="agent-detail-row">
									<span class="agent-heartbeat">
										Last seen: {formatHeartbeat(agent.lastHeartbeat)}
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>

				{#if agents.length === 0}
					<div class="empty-state">
						<div class="empty-icon">🤖</div>
						<p>No agents launched yet</p>
						<p class="empty-hint">Select a role and model, then launch your first agent</p>
					</div>
				{/if}
			</div>
		</div>

		<div class="agents-right">
			{#if selectedAgent}
				<div class="agent-details-panel">
					<div class="agent-details-header">
						<h3>{selectedAgent.id}</h3>
						<div class="agent-actions">
							<button class="btn-secondary">💬 Send Command</button>
							<button class="btn-danger" on:click={killAgent}>🗲 Kill Agent</button>
						</div>
					</div>
					
					<div class="agent-info-grid">
						<div class="info-card">
							<h4>Status</h4>
							<div class="status-display status-{selectedAgent.status}">
								{selectedAgent.status}
							</div>
						</div>
						
						<div class="info-card">
							<h4>Role</h4>
							<p>{selectedAgent.roleType}</p>
						</div>
						
						<div class="info-card">
							<h4>Model</h4>
							<p>{selectedAgent.model}</p>
						</div>
						
						<div class="info-card">
							<h4>Session</h4>
							<p>{selectedAgent.tmuxSession || 'Not available'}</p>
						</div>
						
						<div class="info-card">
							<h4>Workspace</h4>
							<p class="workspace-path">{selectedAgent.worktreePath || 'Not assigned'}</p>
						</div>
						
						<div class="info-card">
							<h4>Last Heartbeat</h4>
							<p>{formatHeartbeat(selectedAgent.lastHeartbeat)}</p>
						</div>
					</div>
				</div>
			{:else}
				<div class="no-agent-selected">
					<div class="empty-icon">👈</div>
					<h4>No agent selected</h4>
					<p>Select an agent from the list to view details and manage it</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.agents-section {
		padding: 20px;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid #e5e7eb;
	}

	.section-header h2 {
		margin: 0;
		font-size: 24px;
		font-weight: 700;
		color: #111827;
	}

	.agent-controls {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.role-selector, .model-selector {
		background: white;
		border: 1px solid #d1d5db;
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 14px;
	}

	.role-selector {
		min-width: 150px;
	}

	.model-selector {
		min-width: 100px;
	}

	.btn-primary, .btn-secondary, .btn-danger {
		padding: 8px 16px;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.btn-primary:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.btn-secondary:hover {
		background: #e5e7eb;
	}

	.btn-danger {
		background: #fee2e2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}

	.btn-danger:hover {
		background: #fecaca;
	}

	.agents-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		flex: 1;
		overflow: hidden;
	}

	.agents-panel {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.agents-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid #e5e7eb;
	}

	.agents-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #111827;
	}

	.agent-list {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	.agent-item {
		padding: 16px 20px;
		border-bottom: 1px solid #f3f4f6;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.agent-item:hover {
		background: #f9fafb;
	}

	.agent-item.active {
		background: #eff6ff;
		border-left: 4px solid #3b82f6;
	}

	.agent-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.agent-id-section {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.agent-status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.agent-status-indicator.status-active {
		background: #16a34a;
	}

	.agent-status-indicator.status-launching {
		background: #f59e0b;
	}

	.agent-status-indicator.status-inactive {
		background: #6b7280;
	}

	.agent-status-indicator.status-error {
		background: #dc2626;
	}

	.agent-id {
		font-weight: 600;
		color: #111827;
	}

	.agent-status {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.agent-status.status-active {
		background: #dcfce7;
		color: #16a34a;
	}

	.agent-status.status-launching {
		background: #fef3c7;
		color: #f59e0b;
	}

	.agent-status.status-inactive {
		background: #f3f4f6;
		color: #6b7280;
	}

	.agent-status.status-error {
		background: #fee2e2;
		color: #dc2626;
	}

	.agent-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.agent-detail-row {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 13px;
		color: #6b7280;
	}

	.agent-role {
		font-weight: 500;
		color: #374151;
	}

	.agent-model {
		color: #6b7280;
	}

	.agent-heartbeat {
		color: #9ca3af;
		font-size: 12px;
	}

	.agents-right {
		display: flex;
		flex-direction: column;
	}

	.agent-details-panel {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.agent-details-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid #e5e7eb;
	}

	.agent-details-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #111827;
	}

	.agent-actions {
		display: flex;
		gap: 8px;
	}

	.agent-info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		padding: 20px;
		flex: 1;
	}

	.info-card {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 16px;
	}

	.info-card h4 {
		margin: 0 0 8px 0;
		font-size: 14px;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.info-card p {
		margin: 0;
		color: #374151;
		font-weight: 500;
	}

	.workspace-path {
		font-size: 12px !important;
		font-family: monospace;
		word-break: break-all;
	}

	.status-display {
		padding: 6px 12px;
		border-radius: 4px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 14px;
	}

	.status-display.status-active {
		background: #dcfce7;
		color: #16a34a;
	}

	.status-display.status-launching {
		background: #fef3c7;
		color: #f59e0b;
	}

	.status-display.status-inactive {
		background: #f3f4f6;
		color: #6b7280;
	}

	.status-display.status-error {
		background: #fee2e2;
		color: #dc2626;
	}

	.empty-state, .no-agent-selected {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		text-align: center;
		color: #6b7280;
		height: 100%;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.6;
	}

	.empty-state p, .no-agent-selected p {
		margin: 8px 0;
		font-size: 16px;
	}

	.empty-hint {
		font-size: 14px !important;
		color: #9ca3af !important;
	}

	.no-agent-selected h4 {
		margin: 0 0 8px 0;
		color: #374151;
		font-size: 18px;
		font-weight: 600;
	}
</style>