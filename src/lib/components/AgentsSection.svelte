<script>
	import { onMount } from 'svelte';
	
	export let selectedProject = null;
	
	let roles = [];
	let agents = [];
	let selectedAgent = null;
	let selectedRoleType = '';
	let selectedModel = 'sonnet';
	let showStartupPromptEditor = false;
	let startupPrompt = '';
	let agentOutput = '';
	let refreshInterval = null;
	let activeTab = 'console'; // Default to console tab

	onMount(async () => {
		if (selectedProject) {
			await loadRoles();
			await loadAgentsData();
		}
	});

	$: if (selectedProject) {
		loadRoles();
		loadAgentsData();
	}

	// Agent management functions
	async function launchAgent() {
		if (!selectedProject) {
			console.error('No project selected');
			return;
		}

		if (!selectedRoleType) {
			alert('Please select a role first');
			return;
		}

		try {
			const response = await fetch('/api/agents/launch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject.id,
					roleType: selectedRoleType,
					model: selectedModel
				})
			});

			if (response.ok) {
				console.log('Agent launched successfully');
				// Wait a moment for agent to potentially register, then reload
				setTimeout(async () => {
					await loadAgentsData();
				}, 2000);
			} else {
				const error = await response.json();
				console.error('Failed to launch agent:', error.error);
				alert(`Failed to launch agent: ${error.error}`);
			}
		} catch (error) {
			console.error('Error launching agent:', error);
			alert('Failed to launch agent');
		}
	}

	async function sendAgentHome() {
		if (!selectedAgent) {
			console.error('No agent selected');
			return;
		}
		
		if (!confirm(`Ask ${selectedAgent.id} to wrap up their day?\n\nThis will send them a polite message asking them to finish their current work and clock out when ready. They'll remain active until they choose to clock out.`)) {
			return;
		}
		
		try {
			const response = await fetch(`/api/agents/${selectedAgent.id}/send-home`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				console.log('Agent sent home successfully');
				await loadAgentsData();
			} else {
				const error = await response.json();
				console.error('Failed to send agent home:', error.error);
				alert(`Failed to send agent home: ${error.error}`);
			}
		} catch (error) {
			console.error('Error sending agent home:', error);
			alert('Failed to send agent home');
		}
	}

	async function forceAgentHome() {
		if (!selectedAgent) {
			console.error('No agent selected');
			return;
		}
		
		if (!confirm(`⚡ FORCE ${selectedAgent.id} home?\n\nThis will immediately terminate their session (for unresponsive agents). Their data and assignments will be preserved.\n\nUse this only if they didn't respond to the polite wrap-up request.`)) {
			return;
		}
		
		try {
			const response = await fetch(`/api/agents/${selectedAgent.id}/force-home`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				console.log('Agent forced home successfully');
				await loadAgentsData();
			} else {
				const error = await response.json();
				console.error('Failed to force agent home:', error.error);
				alert(`Failed to force agent home: ${error.error}`);
			}
		} catch (error) {
			console.error('Error forcing agent home:', error);
			alert('Failed to force agent home');
		}
	}

	async function bringAgentBack() {
		if (!selectedAgent) {
			console.error('No agent selected');
			return;
		}
		
		if (!confirm(`Bring ${selectedAgent.id} back?\n\nThis will start a new session for them to continue their existing work.`)) {
			return;
		}
		
		try {
			const response = await fetch(`/api/agents/${selectedAgent.id}/bring-back`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ projectId: selectedProject.id })
			});
			
			if (response.ok) {
				console.log('Agent brought back successfully');
				await loadAgentsData();
			} else {
				const error = await response.json();
				console.error('Failed to bring agent back:', error.error);
				alert(`Failed to bring agent back: ${error.error}`);
			}
		} catch (error) {
			console.error('Error bringing agent back:', error);
			alert('Failed to bring agent back');
		}
	}

	async function killAgent() {
		if (!selectedAgent) {
			console.error('No agent selected');
			return;
		}
		
		if (!confirm(`⚠️ PERMANENTLY DELETE agent ${selectedAgent.id}?\n\nThis will:\n- Kill their session\n- Remove them from the database\n- Remove all their content references\n\nThis action CANNOT be undone. Consider using Refresh instead.`)) {
			return;
		}
		
		try {
			const response = await fetch(`/api/agents/${selectedAgent.id}/kill`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ projectId: selectedProject.id })
			});
			
			if (response.ok) {
				console.log('Agent killed successfully');
				selectedAgent = null;
				await loadAgentsData();
			} else {
				const error = await response.json();
				console.error('Failed to kill agent:', error.error);
				alert(`Failed to kill agent: ${error.error}`);
			}
		} catch (error) {
			console.error('Error killing agent:', error);
			alert('Failed to kill agent');
		}
	}

	async function loadAgentsData() {
		if (!selectedProject) {
			agents = [];
			return;
		}

		try {
			const response = await fetch(`/api/agents?projectId=${selectedProject.id}`);
			if (response.ok) {
				agents = await response.json();
				// Update selectedAgent if it no longer exists
				if (selectedAgent && !agents.find(a => a.id === selectedAgent.id)) {
					selectedAgent = null;
				}
			} else {
				console.error('Failed to load agents');
				agents = [];
			}
		} catch (error) {
			console.error('Error loading agents:', error);
			agents = [];
		}
	}

	async function loadRoles() {
		if (!selectedProject) {
			roles = [];
			return;
		}

		try {
			const response = await fetch(`/api/roles?projectId=${selectedProject.id}`);
			if (response.ok) {
				roles = await response.json();
			} else {
				console.error('Failed to load roles');
				roles = [];
			}
		} catch (error) {
			console.error('Error loading roles:', error);
			roles = [];
		}
	}

	function onAgentSelect(agent) {
		selectedAgent = agent;
	}

	function loadStartupPrompt() {
		// This function loads startup prompt for the dialog
		console.log('Load startup prompt function called');
	}

	async function saveStartupPrompt() {
		try {
			const response = await fetch('/api/agents/startup-prompt', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ startupPrompt })
			});

			if (response.ok) {
				showStartupPromptEditor = false;
				console.log('Startup prompt saved successfully');
			} else {
				console.error('Failed to save startup prompt');
			}
		} catch (error) {
			console.error('Failed to save startup prompt:', error);
		}
	}

	function formatHeartbeat(timestamp) {
		if (!timestamp) return 'Never';
		return new Date(timestamp).toLocaleTimeString();
	}

	async function loadAgentOutput() {
		if (!selectedAgent || !selectedProject) {
			agentOutput = '';
			return;
		}

		try {
			const response = await fetch(`/api/agents/${selectedAgent.id}/output?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				agentOutput = data.output || '';
			} else {
				console.error('Failed to load agent output');
				agentOutput = 'Failed to load console output';
			}
		} catch (error) {
			console.error('Error loading agent output:', error);
			agentOutput = 'Error loading console output';
		}
	}

	function startOutputRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
		
		refreshInterval = setInterval(() => {
			if (selectedAgent) {
				loadAgentOutput();
			}
		}, 2000);
	}

	// Load output when agent is selected
	$: if (selectedAgent) {
		loadAgentOutput();
		startOutputRefresh();
	} else {
		agentOutput = '';
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}

	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});
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
							{#if selectedAgent.status === 'offline'}
								<button class="btn-primary" on:click={bringAgentBack}>🔄 Bring Back</button>
							{:else}
								<button class="btn-warning" on:click={sendAgentHome}>🏠 Send Home</button>
								<button class="btn-orange" on:click={forceAgentHome}>⚡ Force Home</button>
							{/if}
							<button class="btn-danger" on:click={killAgent}>🗲 Kill Agent</button>
						</div>
					</div>
					
					<!-- Tab Navigation -->
					<div class="tab-navigation">
						<button 
							class="tab-btn" 
							class:active={activeTab === 'console'}
							on:click={() => activeTab = 'console'}
						>
							🖥️ Console
						</button>
						<button 
							class="tab-btn" 
							class:active={activeTab === 'info'}
							on:click={() => activeTab = 'info'}
						>
							📊 Info
						</button>
					</div>

					<!-- Tab Content -->
					<div class="tab-content">
						{#if activeTab === 'console'}
							<!-- Console Tab -->
							<div class="console-section">
								<div class="console-header">
									<h4>Live Console Output</h4>
									<button class="btn-secondary" on:click={loadAgentOutput}>🔄 Refresh</button>
								</div>
								<textarea 
									bind:value={agentOutput}
									class="console-output"
									readonly
									placeholder="Console output will appear here..."
								></textarea>
							</div>
						{:else if activeTab === 'info'}
							<!-- Info Tab -->
							<div class="info-section">
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
						{/if}
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

<!-- Startup Prompt Editor Modal -->
{#if showStartupPromptEditor}
	<div class="modal-overlay" on:click={() => showStartupPromptEditor = false}>
		<div class="modal-content large-modal" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Agent Startup Prompt</h3>
				<button class="modal-close" on:click={() => showStartupPromptEditor = false}>×</button>
			</div>
			
			<div class="modal-body">
				<div class="form-group">
					<label for="startup-prompt">This prompt is sent to each agent when they launch:</label>
					<textarea 
						id="startup-prompt"
						bind:value={startupPrompt}
						placeholder="Enter the startup prompt for new agents..."
						rows="15"
					></textarea>
				</div>
			</div>
			
			<div class="modal-actions">
				<button class="btn-secondary" on:click={() => showStartupPromptEditor = false}>Cancel</button>
				<button class="btn-primary" on:click={saveStartupPrompt}>
					Save Prompt
				</button>
			</div>
		</div>
	</div>
{/if}

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

	.btn-primary, .btn-secondary, .btn-warning, .btn-orange, .btn-danger {
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

	.btn-warning {
		background: #fef3c7;
		color: #f59e0b;
		border: 1px solid #fde68a;
	}

	.btn-warning:hover {
		background: #fde68a;
	}

	.btn-orange {
		background: #fed7aa;
		color: #ea580c;
		border: 1px solid #fdba74;
	}

	.btn-orange:hover {
		background: #fdba74;
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
		overflow: hidden;
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

	.tab-navigation {
		display: flex;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.tab-btn {
		flex: 1;
		padding: 12px 16px;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		font-size: 14px;
		font-weight: 500;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tab-btn:hover {
		color: #374151;
		background: #f3f4f6;
	}

	.tab-btn.active {
		color: #3b82f6;
		background: white;
		border-bottom-color: #3b82f6;
	}

	.tab-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.console-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.info-section {
		flex: 1;
		overflow-y: auto;
	}

	.agent-info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		padding: 20px;
	}

	.console-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		background: #1f2937;
		color: white;
	}

	.console-header h4 {
		margin: 0;
		color: white;
		background: transparent;
		padding: 0;
		border: none;
		font-size: 14px;
	}

	.console-output {
		flex: 1;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 12px;
		background: #111827;
		color: #10b981;
		border: none;
		padding: 16px;
		margin: 0;
		resize: none;
		white-space: pre-wrap;
		overflow-y: auto;
		line-height: 1.4;
	}

	.console-output:focus {
		outline: none;
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

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		margin: 1rem;
	}

	.modal-content.large-modal {
		max-width: 800px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: #6b7280;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-close:hover {
		color: #374151;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		resize: vertical;
	}

	.form-group textarea:focus {
		outline: 2px solid #3b82f6;
		outline-offset: -1px;
		border-color: #3b82f6;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid #e5e7eb;
	}
</style>