<script>
	import { phases } from '$lib/stores/contentStore';
	
	export let selectedProject;
	
	// Reactive data from content store
	$: storePhases = $phases;
	
	// Group phases by assigned role
	$: phasesByRole = storePhases.reduce((acc, phase) => {
		const roleType = phase.assignedToRoleType || 'unassigned';
		if (!acc[roleType]) acc[roleType] = [];
		acc[roleType].push(phase);
		return acc;
	}, {});
	
	// Phase status color mapping
	function getStatusBadgeClass(status) {
		switch(status) {
			case 'draft': return 'status-draft';
			case 'approved': return 'status-approved'; 
			case 'active': return 'status-active';
			case 'completed': return 'status-completed';
			case 'blocked': return 'status-blocked';
			default: return 'status-unknown';
		}
	}
	
	// Phase status display text
	function getStatusText(status) {
		switch(status) {
			case 'draft': return 'Draft';
			case 'approved': return 'Approved';
			case 'active': return 'In Progress';
			case 'completed': return 'Done';
			case 'blocked': return 'Blocked';
			default: return 'Unknown';
		}
	}
</script>

<div class="phases-display">
	<div class="phases-header">
		<h3>📋 Development Phases</h3>
	</div>
	
	{#if Object.keys(phasesByRole).length === 0}
		<div class="empty-state">
			<p>No phases available for this project.</p>
		</div>
	{:else}
		<div class="phases-content">
			{#each Object.entries(phasesByRole) as [roleType, rolePhases]}
				<div class="role-section">
					<h4 class="role-title">{roleType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
					<div class="phases-list">
						{#each rolePhases as phase}
							<div class="phase-item">
								<div class="phase-header">
									<h5 class="phase-title">{phase.title}</h5>
									<span class="phase-status-badge {getStatusBadgeClass(phase.phaseStatus)}">
										{getStatusText(phase.phaseStatus)}
									</span>
								</div>
								{#if phase.body}
									<div class="phase-description">
										{@html phase.body}
									</div>
								{/if}
								<div class="phase-meta">
									<span class="phase-created">Created: {new Date(phase.createdAt).toLocaleDateString()}</span>
									{#if phase.updatedAt !== phase.createdAt}
										<span class="phase-updated">Updated: {new Date(phase.updatedAt).toLocaleDateString()}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.phases-display {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	
	.phases-header {
		padding: 16px;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
	}
	
	.phases-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}
	
	.empty-state {
		padding: 40px;
		text-align: center;
		color: #6b7280;
	}
	
	.phases-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}
	
	.role-section {
		margin-bottom: 24px;
	}
	
	.role-title {
		margin: 0 0 12px 0;
		font-size: 16px;
		font-weight: 600;
		color: #374151;
		padding-bottom: 8px;
		border-bottom: 1px solid #e5e7eb;
	}
	
	.phases-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	
	.phase-item {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 16px;
		transition: border-color 0.2s ease;
	}
	
	.phase-item:hover {
		border-color: #d1d5db;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}
	
	.phase-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	
	.phase-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #111827;
	}
	
	.phase-status-badge {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	
	/* Status badge colors */
	.status-draft {
		background: #f3f4f6;
		color: #6b7280;
	}
	
	.status-approved {
		background: #ddd6fe;
		color: #7c3aed;
	}
	
	.status-active {
		background: #dbeafe;
		color: #2563eb;
	}
	
	.status-completed {
		background: #dcfce7;
		color: #16a34a;
	}
	
	.status-blocked {
		background: #fee2e2;
		color: #dc2626;
	}
	
	.status-unknown {
		background: #f9fafb;
		color: #6b7280;
	}
	
	.phase-description {
		margin: 8px 0;
		color: #6b7280;
		font-size: 13px;
		line-height: 1.5;
	}
	
	.phase-meta {
		display: flex;
		gap: 16px;
		font-size: 11px;
		color: #9ca3af;
		margin-top: 8px;
	}
</style>