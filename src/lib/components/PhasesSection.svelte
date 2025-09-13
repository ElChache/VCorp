<script lang="ts">
	import { onMount } from 'svelte';
	import { phases, agents, roleTypes, isLoading, error, contentActions } from '$lib/stores/contentStore';

	export let selectedProject: any;

	// Reactive data from content store
	$: storePhases = $phases;
	$: storeRoleTypes = $roleTypes;
	$: storeIsLoading = $isLoading;
	$: storeError = $error;
	
	// Local component state
	let selectedRole: any = null;
	let selectedPhase: any = null;
	
	// Reactive filtering
	$: filteredPhases = selectedRole && storePhases ? 
		storePhases.filter(phase => phase.assignedToRoleType === selectedRole.roleType) : 
		storePhases;

	// Load content when project changes
	$: if (selectedProject) {
		contentActions.loadContent(selectedProject.id);
	}

	// Phase status color mapping
	function getStatusBadgeClass(status: string) {
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
	function getStatusText(status: string) {
		switch(status) {
			case 'draft': return 'Draft';
			case 'approved': return 'Approved';
			case 'active': return 'In Progress';
			case 'completed': return 'Done';
			case 'blocked': return 'Blocked';
			default: return 'Unknown';
		}
	}

	function onRoleSelect(role: any) {
		selectedRole = role;
		selectedPhase = null; // Clear phase selection when switching roles
	}

	function onPhaseSelect(phase: any) {
		selectedPhase = phase;
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}
</script>

<div class="phases-section">
	<div class="section-header">
		<h2>📋 Development Phases</h2>
	</div>

	{#if storeError}
		<div class="error-banner">
			{storeError}
		</div>
	{/if}

	<div class="phases-layout">
		<!-- Column 1: Role Types -->
		<div class="roles-sidebar">
			<div class="roles-list">
				{#if storeIsLoading}
					<div class="loading">Loading roles...</div>
				{:else if storeRoleTypes.length > 0}
					{#each storeRoleTypes as role}
						<div 
							class="role-item"
							class:selected={selectedRole?.roleType === role.roleType}
							on:click={() => onRoleSelect(role)}
						>
							<div class="role-header">
								<h4>{role.roleType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
								<span class="agent-count">{role.count} agents</span>
							</div>
						</div>
					{/each}
				{:else}
					<div class="empty-state">
						<h3>No Roles</h3>
						<p>No role types available.</p>
					</div>
				{/if}
			</div>
		</div>
		
		<!-- Column 2: Phases List -->
		<div class="phases-column">
			{#if selectedRole}
				<div class="column-header">
					<h3>Phases for {selectedRole.roleType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
				</div>
				<div class="phases-list">
					{#if storeIsLoading}
						<div class="loading">Loading phases...</div>
					{:else if filteredPhases.length > 0}
						{#each filteredPhases as phase}
							<div 
								class="phase-item"
								class:selected={selectedPhase?.id === phase.id}
								on:click={() => onPhaseSelect(phase)}
							>
								<div class="phase-header">
									<h4>{phase.title}</h4>
									<span class="phase-status-badge {getStatusBadgeClass(phase.phaseStatus)}">
										{getStatusText(phase.phaseStatus)}
									</span>
								</div>
								<div class="phase-meta">
									<span class="phase-created">Created: {formatDate(phase.createdAt)}</span>
								</div>
							</div>
						{/each}
					{:else}
						<div class="no-phases">
							<p>No phases assigned to this role.</p>
						</div>
					{/if}
				</div>
			{:else}
				<div class="no-role-selected">
					<h3>Select a role to view phases</h3>
					<p>Choose a role from the sidebar to see its assigned development phases.</p>
				</div>
			{/if}
		</div>

		<!-- Column 3: Phase Details -->
		<div class="phase-details-column">
			{#if selectedPhase}
				<div class="phase-details">
					<div class="phase-header-full">
						<h1>{selectedPhase.title}</h1>
						<div class="phase-meta-full">
							<span class="phase-status-badge-large {getStatusBadgeClass(selectedPhase.phaseStatus)}">
								{getStatusText(selectedPhase.phaseStatus)}
							</span>
							<span class="phase-role">Assigned to: {selectedPhase.assignedToRoleType?.replace(/-/g, ' ')}</span>
							<span class="date">Created: {formatDate(selectedPhase.createdAt)}</span>
							{#if selectedPhase.updatedAt !== selectedPhase.createdAt}
								<span class="date">Updated: {formatDate(selectedPhase.updatedAt)}</span>
							{/if}
						</div>
					</div>
					
					{#if selectedPhase.body}
						<div class="phase-body">
							{selectedPhase.body}
						</div>
					{/if}
				</div>
			{:else}
				<div class="no-phase-selected">
					<h3>Select a phase to view details</h3>
					<p>Choose a phase from the middle column to view its details and description.</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.phases-section {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.phases-layout {
		display: grid;
		grid-template-columns: 250px 1fr 350px;
		gap: 20px;
		height: 100%;
		flex: 1;
		min-height: 0;
	}

	.roles-sidebar {
		border-right: 1px solid #ddd;
		padding: 1rem;
		overflow-y: auto;
	}

	.roles-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.role-item {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 12px;
		cursor: pointer;
		transition: all 0.2s;
		background: white;
	}

	.role-item:hover {
		border-color: #007bff;
		box-shadow: 0 2px 4px rgba(0,123,255,0.1);
	}

	.role-item.selected {
		border-color: #007bff;
		background-color: #f8f9ff;
		box-shadow: 0 2px 8px rgba(0,123,255,0.15);
	}

	.role-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.role-header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #333;
	}

	.agent-count {
		background: #e9ecef;
		color: #495057;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 0.7rem;
		font-weight: 500;
	}

	.phases-column {
		padding: 1rem;
		overflow-y: auto;
		border-right: 1px solid #ddd;
	}

	.column-header {
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.column-header h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #374151;
	}

	.phases-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.phase-item {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 12px;
		cursor: pointer;
		transition: all 0.2s;
		background: white;
	}

	.phase-item:hover {
		border-color: #007bff;
		box-shadow: 0 2px 4px rgba(0,123,255,0.1);
	}

	.phase-item.selected {
		border-color: #007bff;
		background-color: #f8f9ff;
		box-shadow: 0 2px 8px rgba(0,123,255,0.15);
	}

	.phase-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 8px;
		gap: 8px;
	}

	.phase-header h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #333;
		flex: 1;
	}

	.phase-status-badge {
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		white-space: nowrap;
	}

	.phase-meta {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.phase-details-column {
		padding: 1rem;
		overflow-y: auto;
	}

	.phase-header-full {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.phase-header-full h1 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
	}

	.phase-meta-full {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.phase-status-badge-large {
		padding: 6px 12px;
		border-radius: 16px;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		align-self: flex-start;
	}

	.phase-role {
		font-size: 0.9rem;
		color: #6b7280;
		text-transform: capitalize;
	}

	.phase-body {
		font-size: 1rem;
		line-height: 1.6;
		color: #374151;
		white-space: pre-wrap;
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

	.empty-state, .no-role-selected, .no-phase-selected {
		text-align: center;
		padding: 2rem 1rem;
		color: #6b7280;
	}

	.empty-state h3, .no-role-selected h3, .no-phase-selected h3 {
		margin: 0 0 0.5rem 0;
		color: #374151;
	}

	.no-phases {
		text-align: center;
		padding: 1rem;
		color: #6b7280;
		font-style: italic;
	}

	.loading {
		text-align: center;
		padding: 2rem;
		color: #6b7280;
	}

	.error-banner {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #dc2626;
		padding: 1rem;
		margin: 1rem;
		border-radius: 6px;
	}

	.date {
		font-size: 0.85rem;
		color: #9ca3af;
	}
</style>