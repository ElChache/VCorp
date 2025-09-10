<script>
	export let phasesByRole = {};
	export let showCreatePhaseDialog = false;
	export let formatTimeAgo;

	function createPhase() {
		showCreatePhaseDialog = true;
	}
</script>

<div class="phases-section">
	<div class="section-header">
		<h2>Phase Management</h2>
		<button class="btn-primary" on:click={createPhase}>
			+ Create Phase
		</button>
	</div>

	<div class="phases-by-role">
		{#each Object.entries(phasesByRole) as [roleType, rolePhases]}
			<div class="role-section">
				<h3>{roleType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
				
				<div class="phase-list">
					{#each rolePhases as phase}
						<div class="phase-card" class:draft={phase.phaseStatus === 'draft'} class:approved={phase.phaseStatus === 'approved'} class:active={phase.phaseStatus === 'active'} class:completed={phase.phaseStatus === 'completed'} class:blocked={phase.phaseStatus === 'blocked'}>
							<div class="phase-header">
								<h4>{phase.phaseName}</h4>
								<span class="phase-status status-{phase.phaseStatus}">{phase.phaseStatus}</span>
							</div>
							
							{#if phase.description}
								<p class="phase-description">{phase.description}</p>
							{/if}
							
							<div class="phase-meta">
								<span class="phase-order">Order: {phase.phaseOrder}</span>
								{#if phase.createdAt}
									<span class="phase-date">{formatTimeAgo(phase.createdAt)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	{#if Object.keys(phasesByRole).length === 0}
		<div class="empty-state">
			<h4>📋 No phases yet</h4>
			<p>Create phases to organize your project workflow</p>
		</div>
	{/if}
</div>

<style>
	.phases-section {
		padding: 20px;
		height: 100%;
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
		gap: 32px;
	}

	.role-section h3 {
		margin: 0 0 16px 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
		text-transform: capitalize;
	}

	.phase-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 16px;
	}

	.phase-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 16px;
		transition: all 0.2s ease;
	}

	.phase-card:hover {
		border-color: #d1d5db;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	.phase-card.draft {
		border-left: 4px solid #6b7280;
	}

	.phase-card.approved {
		border-left: 4px solid #2563eb;
	}

	.phase-card.active {
		border-left: 4px solid #059669;
		background: #f0fdf4;
	}

	.phase-card.completed {
		border-left: 4px solid #16a34a;
		opacity: 0.8;
	}

	.phase-card.blocked {
		border-left: 4px solid #dc2626;
		background: #fef2f2;
	}

	.phase-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 8px;
	}

	.phase-header h4 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #111827;
		flex: 1;
		margin-right: 12px;
	}

	.phase-status {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-draft {
		background: #f3f4f6;
		color: #6b7280;
	}

	.status-approved {
		background: #dbeafe;
		color: #2563eb;
	}

	.status-active {
		background: #dcfce7;
		color: #059669;
	}

	.status-completed {
		background: #d1fae5;
		color: #16a34a;
	}

	.status-blocked {
		background: #fee2e2;
		color: #dc2626;
	}

	.phase-description {
		margin: 0 0 12px 0;
		color: #6b7280;
		font-size: 14px;
		line-height: 1.5;
	}

	.phase-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: #9ca3af;
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
</style>