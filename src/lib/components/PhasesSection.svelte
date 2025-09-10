<script>
	export let selectedProject = null;
	export let phases = [];
	export let phasesByRole = {};
	export let showCreatePhaseDialog = false;
	
	let newPhase = { 
		roleType: 'backend_developer', 
		title: '', 
		body: '', 
		requiredInputs: '', 
		expectedOutputs: '' 
	};

	// Track expanded/collapsed state for each phase
	let expandedPhases = new Set();

	function togglePhaseExpanded(phaseId) {
		if (expandedPhases.has(phaseId)) {
			expandedPhases.delete(phaseId);
		} else {
			expandedPhases.add(phaseId);
		}
		expandedPhases = new Set(expandedPhases); // Trigger reactivity
	}

	// Simple markdown-to-HTML converter for basic formatting
	function renderMarkdown(text) {
		if (!text) return '';
		
		return text
			// Bold **text**
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			// Italic *text*
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			// Code `code`
			.replace(/`(.*?)`/g, '<code>$1</code>')
			// Line breaks
			.replace(/\n/g, '<br>')
			// Headers ### text
			.replace(/^### (.*$)/gm, '<h3>$1</h3>')
			.replace(/^## (.*$)/gm, '<h2>$1</h2>')
			.replace(/^# (.*$)/gm, '<h1>$1</h1>')
			// Bullet points - text
			.replace(/^- (.*$)/gm, '<li>$1</li>')
			// Wrap consecutive <li> in <ul>
			.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
	}

	async function loadPhases() {
		if (!selectedProject) {
			phases = [];
			phasesByRole = {};
			return;
		}
		
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/content?type=phase`);
			if (response.ok) {
				phases = await response.json();
				
				// Group phases by role type and sort by phaseOrder
				phasesByRole = {};
				phases.forEach(phase => {
					if (!phasesByRole[phase.assignedToRoleType]) {
						phasesByRole[phase.assignedToRoleType] = [];
					}
					phasesByRole[phase.assignedToRoleType].push(phase);
				});
				
				// Sort phases within each role by phaseOrder, then by title for consistent ordering
				Object.keys(phasesByRole).forEach(roleType => {
					phasesByRole[roleType].sort((a, b) => {
						const orderDiff = (a.phaseOrder || 0) - (b.phaseOrder || 0);
						if (orderDiff !== 0) return orderDiff;
						// Secondary sort by title for consistent ordering when phaseOrder is the same
						return (a.title || '').localeCompare(b.title || '');
					});
				});
			}
		} catch (error) {
			console.error('Error loading phases:', error);
		}
	}

	async function createPhase() {
		if (!newPhase.title.trim() || !selectedProject) return;
		
		try {
			// Generate document slug from title and role
			const slugBase = `${newPhase.roleType}-${newPhase.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
			
			const phaseData = {
				projectId: selectedProject.id,
				type: 'phase',
				title: newPhase.title,
				body: newPhase.body,
				documentSlug: slugBase,
				assignedToRoleType: newPhase.roleType,
				phaseStatus: 'draft',
				requiredInputs: newPhase.requiredInputs ? JSON.stringify(newPhase.requiredInputs.split(',').map(slug => slug.trim()).filter(slug => slug.length > 0)) : null,
				expectedOutputs: newPhase.expectedOutputs ? JSON.stringify(newPhase.expectedOutputs.split(',').map(slug => slug.trim()).filter(slug => slug.length > 0)) : null
			};

			const response = await fetch(`/api/projects/${selectedProject.id}/content`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(phaseData)
			});
			
			if (response.ok) {
				const phase = await response.json();
				phases = [...phases, phase];
				
				// Update phasesByRole and maintain sorting
				if (!phasesByRole[phase.assignedToRoleType]) {
					phasesByRole[phase.assignedToRoleType] = [];
				}
				phasesByRole[phase.assignedToRoleType].push(phase);
				
				// Re-sort phases for this role by phaseOrder, then by title
				phasesByRole[phase.assignedToRoleType].sort((a, b) => {
					const orderDiff = (a.phaseOrder || 0) - (b.phaseOrder || 0);
					if (orderDiff !== 0) return orderDiff;
					return (a.title || '').localeCompare(b.title || '');
				});
				
				showCreatePhaseDialog = false;
				newPhase = { 
					roleType: 'backend_developer', 
					title: '', 
					body: '', 
					requiredInputs: '', 
					expectedOutputs: '' 
				};
			}
		} catch (error) {
			console.error('Failed to create phase:', error);
		}
	}

	async function updatePhaseStatus(phase, newStatus) {
		try {
			const response = await fetch(`/api/phases/${phase.id}/status`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ newStatus: newStatus })
			});
			
			if (response.ok) {
				const result = await response.json();
				console.log('Phase status updated:', result.message);
				
				// Reload phases to get updated data and trigger auto-progression
				await loadPhases();
				
				// Trigger auto-progression logic
				await checkPhaseProgression();
			} else {
				const error = await response.json();
				console.error('Failed to update phase status:', error.error);
			}
		} catch (error) {
			console.error('Error updating phase status:', error);
		}
	}

	async function checkPhaseProgression() {
		// Auto-progression logic: when a phase becomes completed, 
		// check if there are any draft phases for the same role that can become active
		try {
			const response = await fetch(`/api/phases/auto-progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId: selectedProject.id })
			});
			
			if (response.ok) {
				// Reload phases to see the changes
				await loadPhases();
			}
		} catch (error) {
			console.error('Failed to check phase progression:', error);
		}
	}

	// Load phases when component mounts or project changes
	$: if (selectedProject) {
		loadPhases();
	}
</script>

<div class="phases-section">
	<div class="section-header">
		<h2>Phase Management</h2>
		<button class="btn-primary" on:click={() => showCreatePhaseDialog = true}>
			+ Create Phase
		</button>
	</div>

	<div class="phases-by-role">
		{#each Object.entries(phasesByRole).sort(([a], [b]) => a.localeCompare(b)) as [roleType, rolePhases]}
			<div class="role-section">
				<h3>{roleType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
				
				<div class="phase-list">
					{#each rolePhases as phase}
						<div class="phase-card" class:draft={phase.phaseStatus === 'draft'} class:approved={phase.phaseStatus === 'approved'} class:active={phase.phaseStatus === 'active'} class:completed={phase.phaseStatus === 'completed'} class:blocked={phase.phaseStatus === 'blocked'} class:expanded={expandedPhases.has(phase.id)}>
							<div class="phase-header" on:click={() => togglePhaseExpanded(phase.id)}>
								<h4>{phase.title}</h4>
								<div class="phase-controls" on:click|stopPropagation>
									<select 
										class="phase-status-select" 
										value={phase.phaseStatus} 
										on:change={(e) => updatePhaseStatus(phase, e.target.value)}
									>
										<option value="draft">Draft</option>
										<option value="approved">Approved</option>
										<option value="active">Active</option>
										<option value="completed">Completed</option>
										<option value="blocked">Blocked</option>
									</select>
								</div>
								<button class="expand-toggle" on:click|stopPropagation={() => togglePhaseExpanded(phase.id)}>
									{expandedPhases.has(phase.id) ? '▼' : '▶'}
								</button>
							</div>
							
							{#if expandedPhases.has(phase.id)}
								<div class="phase-body">
									{@html renderMarkdown(phase.body)}
								</div>
								
								{#if phase.requiredInputs || phase.expectedOutputs}
									<div class="phase-dependencies">
										{#if phase.requiredInputs}
											<div class="phase-inputs">
												<strong>Required Inputs:</strong> {JSON.parse(phase.requiredInputs).join(', ')}
											</div>
										{/if}
										{#if phase.expectedOutputs}
											<div class="phase-outputs">
												<strong>Expected Outputs:</strong> {JSON.parse(phase.expectedOutputs).join(', ')}
											</div>
										{/if}
									</div>
								{/if}
								
								<div class="phase-meta">
									<span class="phase-status-badge status-{phase.phaseStatus}">
										{phase.phaseStatus}
									</span>
									<span class="phase-created">
										Created: {new Date(phase.createdAt).toLocaleDateString()}
									</span>
								</div>
							{/if}
						</div>
					{/each}
				</div>
				
				{#if rolePhases.length === 0}
					<div class="empty-phases">
						<p>No phases defined for this role yet.</p>
					</div>
				{/if}
			</div>
		{/each}
		
		{#if Object.keys(phasesByRole).length === 0}
			<div class="empty-state">
				<h4>No phases created yet</h4>
				<p>Create your first phase to start organizing work by roles.</p>
			</div>
		{/if}
	</div>
</div>

{#if showCreatePhaseDialog}
	<div class="dialog-overlay" on:click={() => showCreatePhaseDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Create New Phase</h3>
			
			<div class="form-group">
				<label for="phase-role">Role Type:</label>
				<select 
					id="phase-role"
					bind:value={newPhase.roleType}
				>
					<option value="backend_developer">Backend Developer</option>
					<option value="frontend_developer">Frontend Developer</option>
					<option value="product_manager">Product Manager</option>
					<option value="architect">Architect</option>
					<option value="lead_developer">Lead Developer</option>
					<option value="ai_developer">AI Developer</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="phase-title">Title:</label>
				<input 
					id="phase-title"
					type="text" 
					bind:value={newPhase.title} 
					placeholder="Enter phase title"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="phase-body">Description:</label>
				<textarea 
					id="phase-body"
					bind:value={newPhase.body} 
					placeholder="Describe what this phase involves..."
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="phase-inputs">Required Inputs (Document Slugs):</label>
				<input 
					id="phase-inputs"
					type="text" 
					bind:value={newPhase.requiredInputs} 
					placeholder="pm-spec-document, design-wireframes (comma-separated slugs)"
				/>
				<small class="form-help">Optional: Document slugs that must be completed before this phase can start</small>
			</div>
			
			<div class="form-group">
				<label for="phase-outputs">Expected Outputs (Document Slugs):</label>
				<input 
					id="phase-outputs"
					type="text" 
					bind:value={newPhase.expectedOutputs} 
					placeholder="api-documentation, database-schema (comma-separated slugs)"
				/>
				<small class="form-help">Optional: Document slugs that this phase will produce</small>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showCreatePhaseDialog = false}>Cancel</button>
				<button class="create-btn" on:click={createPhase} disabled={!newPhase.title.trim()}>
					Create Phase
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.phases-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
		height: 100%;
		padding: 20px;
		overflow-y: auto;
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

	.btn-primary {
		background: #2563eb;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.btn-primary:hover {
		background: #1d4ed8;
	}

	.phases-by-role {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.role-section h3 {
		margin: 0 0 16px 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
		text-transform: capitalize;
	}

	.phase-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.phase-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 16px;
		transition: all 0.2s ease;
		border-left: 4px solid #e5e5e5;
	}

	.phase-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		border-color: #ddd;
	}

	.phase-card.draft {
		border-left-color: #999;
		background: #fafafa;
	}

	.phase-card.approved {
		border-left-color: #2196f3;
		background: #f8fafe;
	}

	.phase-card.active {
		border-left-color: #ff9800;
		background: #fffbf0;
		box-shadow: 0 2px 8px rgba(255, 152, 0, 0.2);
	}

	.phase-card.completed {
		border-left-color: #4caf50;
		background: #f8fff8;
	}

	.phase-card.blocked {
		border-left-color: #f44336;
		background: #fffafa;
	}

	.phase-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0;
		cursor: pointer;
		padding: 16px;
		margin: -16px;
		border-radius: 6px;
		transition: background-color 0.2s ease;
	}

	.phase-header:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.phase-header h4 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
		flex: 1;
		margin-right: 12px;
	}

	.expand-toggle {
		background: none;
		border: none;
		font-size: 12px;
		color: #666;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition: all 0.2s ease;
		margin-left: 8px;
	}

	.expand-toggle:hover {
		background-color: rgba(0, 0, 0, 0.1);
		color: #333;
	}

	.phase-card.expanded .phase-header {
		margin-bottom: 12px;
	}

	.phase-controls {
		flex-shrink: 0;
	}

	.phase-status-select {
		padding: 6px 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		background: white;
		color: #333;
		cursor: pointer;
	}

	.phase-body {
		margin-bottom: 16px;
		color: #444;
		line-height: 1.6;
		padding-top: 12px;
	}

	.phase-body p {
		margin: 0 0 12px 0;
	}

	.phase-body p:last-child {
		margin-bottom: 0;
	}

	.phase-body h1, .phase-body h2, .phase-body h3 {
		margin: 16px 0 8px 0;
		color: #333;
	}

	.phase-body h1 {
		font-size: 18px;
	}

	.phase-body h2 {
		font-size: 16px;
	}

	.phase-body h3 {
		font-size: 14px;
	}

	.phase-body ul {
		margin: 12px 0;
		padding-left: 20px;
	}

	.phase-body li {
		margin-bottom: 4px;
	}

	.phase-body code {
		background-color: #f5f5f5;
		padding: 2px 4px;
		border-radius: 3px;
		font-family: 'Courier New', monospace;
		font-size: 0.9em;
	}

	.phase-body strong {
		font-weight: 600;
		color: #333;
	}

	.phase-body em {
		font-style: italic;
		color: #555;
	}

	.phase-dependencies {
		background: #f5f5f5;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		padding: 12px;
		margin-bottom: 16px;
		font-size: 13px;
	}

	.phase-inputs, .phase-outputs {
		margin-bottom: 8px;
	}

	.phase-inputs:last-child, .phase-outputs:last-child {
		margin-bottom: 0;
	}

	.phase-inputs strong, .phase-outputs strong {
		color: #333;
	}

	.phase-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: #666;
	}

	.phase-status-badge {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 10px;
		font-weight: bold;
		text-transform: uppercase;
	}

	.status-draft {
		background: #f5f5f5;
		color: #666;
	}

	.status-approved {
		background: #e3f2fd;
		color: #1976d2;
	}

	.status-active {
		background: #fff3e0;
		color: #f57c00;
	}

	.status-completed {
		background: #e8f5e8;
		color: #388e3c;
	}

	.status-blocked {
		background: #ffebee;
		color: #d32f2f;
	}

	.phase-created {
		font-style: italic;
	}

	.empty-phases {
		text-align: center;
		padding: 40px 20px;
		color: #666;
	}

	.empty-phases p {
		margin: 0;
		font-size: 14px;
	}

	.empty-state {
		text-align: center;
		color: #6b7280;
		padding: 60px 20px;
	}

	.empty-state h4 {
		margin: 0 0 8px 0;
		color: #374151;
		font-weight: 600;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	/* Dialog Styles */
	.dialog-overlay {
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

	.dialog {
		background: white;
		border-radius: 8px;
		padding: 24px;
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.dialog h3 {
		margin: 0 0 20px 0;
		font-size: 18px;
		font-weight: 600;
		color: #111827;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-weight: 500;
		color: #374151;
		font-size: 14px;
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 14px;
		background: white;
		color: #111827;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
	}

	.form-help {
		display: block;
		margin-top: 4px;
		font-size: 12px;
		color: #6b7280;
		line-height: 1.4;
	}

	.dialog-buttons {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid #e5e7eb;
	}

	.cancel-btn,
	.create-btn {
		padding: 8px 16px;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.cancel-btn {
		background: #f9fafb;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.cancel-btn:hover {
		background: #f3f4f6;
	}

	.create-btn {
		background: #2563eb;
		color: white;
	}

	.create-btn:hover {
		background: #1d4ed8;
	}

	.create-btn:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}
</style>