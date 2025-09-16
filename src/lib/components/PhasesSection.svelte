<script lang="ts">
	import { onMount } from 'svelte';
	import { phases, documents, agents, roleTypes, isLoading, error, contentActions } from '$lib/stores/contentStore';

	export let selectedProject: any;

	// Reactive data from content store
	$: storePhases = $phases;
	$: storeRoleTypes = $roleTypes;
	$: storeIsLoading = $isLoading;
	$: storeError = $error;
	
	// Compute role types with active/blocked counts from central store phases data
	$: roleTypesWithCounts = storeRoleTypes.map(role => {
		// Filter phases from central store for this role
		const rolePhasesData = storePhases.filter(phase => phase.assignedToRoleType === role.name);
		const activeCount = rolePhasesData.filter(phase => phase.phaseStatus === 'active').length;
		const blockedCount = rolePhasesData.filter(phase => phase.phaseStatus === 'blocked').length;
		const draftCount = rolePhasesData.filter(phase => phase.phaseStatus === 'draft').length;
		const completedCount = rolePhasesData.filter(phase => phase.phaseStatus === 'completed').length;
		const approvedCount = rolePhasesData.filter(phase => phase.phaseStatus === 'approved').length;
		
		// Priority order: blocked, draft, active, completed, approved
		let priority = 5; // default (no phases)
		if (blockedCount > 0) priority = 1;
		else if (draftCount > 0) priority = 2;
		else if (activeCount > 0) priority = 3;
		else if (completedCount > 0) priority = 4;
		else if (approvedCount > 0) priority = 5;
		
		return {
			...role,
			activeCount,
			blockedCount,
			draftCount,
			completedCount,
			approvedCount,
			priority
		};
	}).sort((a, b) => a.priority - b.priority);
	
	// Local component state
	let selectedRole: any = null;
	let selectedPhase: any = null;
	let showStatusMenu: any = null; // Track which phase has open status menu
	let existingDocuments: string[] = []; // Track which document slugs exist
	
	// Reactive filtering
	$: filteredPhases = selectedRole && storePhases ? 
		storePhases.filter(phase => phase.assignedToRoleType === selectedRole.name) : 
		storePhases;

	// Load content when project changes
	$: if (selectedProject) {
		contentActions.loadContent(selectedProject.id);
	}

	// Load existing documents from content store
	$: if ($documents) {
		existingDocuments = $documents
			.filter(doc => doc.documentSlug)
			.map(doc => doc.documentSlug);
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

	// Parse document lists and check if they exist
	function parseDocumentList(documentListJson: string | null): string[] {
		if (!documentListJson) return [];
		try {
			return JSON.parse(documentListJson);
		} catch {
			return [];
		}
	}

	function documentExists(documentSlug: string): boolean {
		return existingDocuments.includes(documentSlug);
	}

	// Available phase statuses
	const allStatuses = ['draft', 'approved', 'active', 'completed', 'blocked'];

	// Get available statuses (excluding current status)
	function getAvailableStatuses(currentStatus: string) {
		return allStatuses.filter(status => status !== currentStatus);
	}

	// Toggle status menu
	function toggleStatusMenu(phase: any, event: Event) {
		event.stopPropagation(); // Prevent phase selection
		showStatusMenu = showStatusMenu === phase.id ? null : phase.id;
	}

	// Change phase status
	async function changePhaseStatus(phaseId: number, newStatus: string) {
		try {
			const response = await fetch(`/api/phases/${phaseId}/status`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					phaseStatus: newStatus,
					projectId: selectedProject.id
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				
				if (response.status === 400 && errorData.missingDocuments) {
					// Specific error for missing documents
					alert(`Cannot change status to "${getStatusText(newStatus)}": Required documents are missing.\n\nMissing documents: ${errorData.missingDocuments.join(', ')}\n\n${errorData.details || ''}`);
				} else {
					// Generic error
					alert(`Failed to update phase status: ${errorData.error || `HTTP ${response.status}`}`);
				}
				
				showStatusMenu = null; // Close menu
				return;
			}

			showStatusMenu = null; // Close menu
			// ContentPollingService will automatically pick up the updated phase
		} catch (error) {
			console.error('Failed to update phase status:', error);
			alert(`Error updating phase status: ${error.message}`);
			showStatusMenu = null; // Close menu
		}
	}

	// Close status menu when clicking outside
	function handleGlobalClick() {
		showStatusMenu = null;
	}
</script>

<div class="phases-section" on:click={handleGlobalClick}>
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
				{:else if roleTypesWithCounts.length > 0}
					{#each roleTypesWithCounts as role}
						<div 
							class="role-item"
							class:selected={selectedRole?.name === role.name}
							class:no-phases={role.count == 0}
							class:has-active={role.activeCount > 0}
							class:has-blocked={role.blockedCount > 0}
							on:click={() => role.count > 0 ? onRoleSelect(role) : null}
						>
							<div class="role-header">
								<h4>{role.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
								<div class="phase-counts">
									<span class="phase-count">{role.count} phase{role.count !== 1 ? 's' : ''}</span>
									{#if role.activeCount > 0}
										<span class="active-indicator">{role.activeCount} active</span>
									{/if}
									{#if role.blockedCount > 0}
										<span class="blocked-indicator">{role.blockedCount} blocked</span>
									{/if}
								</div>
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
					<h3>Phases for {selectedRole.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
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
									<div class="phase-status-area">
										<span class="phase-status-badge {getStatusBadgeClass(phase.phaseStatus)}">
											{getStatusText(phase.phaseStatus)}
										</span>
										<div class="status-menu-container">
											<button 
												class="change-status-btn"
												title="Change status to..."
												on:click={(e) => toggleStatusMenu(phase, e)}
											>
												⚙️
											</button>
											{#if showStatusMenu === phase.id}
												<div class="status-menu">
													{#each getAvailableStatuses(phase.phaseStatus) as status}
														<button
															class="status-option {getStatusBadgeClass(status)}"
															on:click={() => changePhaseStatus(phase.id, status)}
														>
															{getStatusText(status)}
														</button>
													{/each}
												</div>
											{/if}
										</div>
									</div>
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
		<div class="phase-details-column" class:open={selectedPhase}>
			{#if selectedPhase}
				<div class="phase-details">
					<button class="close-details-btn" on:click={() => selectedPhase = null}>✕</button>
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

					<!-- Required Input Documents -->
					{#if parseDocumentList(selectedPhase.requiredInputs).length > 0}
						<div class="document-section">
							<h3>Required Input Documents</h3>
							<div class="document-list">
								{#each parseDocumentList(selectedPhase.requiredInputs) as docSlug}
									<div class="document-item {documentExists(docSlug) ? 'exists' : 'missing'}">
										<span class="document-status">{documentExists(docSlug) ? '✓' : '✗'}</span>
										<span class="document-name">{docSlug}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Expected Output Documents -->
					{#if parseDocumentList(selectedPhase.expectedOutputs).length > 0}
						<div class="document-section">
							<h3>Expected Output Documents</h3>
							<div class="document-list">
								{#each parseDocumentList(selectedPhase.expectedOutputs) as docSlug}
									<div class="document-item {documentExists(docSlug) ? 'exists' : 'missing'}">
										<span class="document-status">{documentExists(docSlug) ? '✓' : '✗'}</span>
										<span class="document-name">{docSlug}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
					
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
		grid-template-columns: 300px 1fr;
		gap: 20px;
		height: 100%;
		flex: 1;
		min-height: 0;
		position: relative;
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
	.role-item.no-phases {
		opacity: 0.5;
		cursor: not-allowed;
		background-color: #f8f9fa;
		color: #6c757d;
	}
	.role-item.no-phases:hover {
		border-color: #e0e0e0;
		box-shadow: none;
	}
	.role-item.has-active {
		border-left: 4px solid #2563eb;
		background-color: #dbeafe;
	}
	.role-item.has-blocked {
		border-left: 4px solid #dc2626;
		background-color: #fee2e2;
	}
	.role-item.has-blocked.has-active {
		border-left: 4px solid #7c3aed;
		background-color: #ddd6fe;
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

	.phase-counts {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
	}
	.phase-count {
		background: #e9ecef;
		color: #495057;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 0.7rem;
		font-weight: 500;
	}
	.active-indicator {
		background: #dbeafe;
		color: #2563eb;
		padding: 1px 4px;
		border-radius: 8px;
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		border: 1px solid #93c5fd;
	}
	.blocked-indicator {
		background: #fee2e2;
		color: #dc2626;
		padding: 1px 4px;
		border-radius: 8px;
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		border: 1px solid #fca5a5;
	}

	.phases-column {
		padding: 1rem;
		overflow-y: auto;
		position: relative;
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

	.phase-status-area {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-menu-container {
		position: relative;
	}

	.change-status-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		font-size: 0.8rem;
		opacity: 0.7;
		transition: all 0.2s ease;
	}

	.change-status-btn:hover {
		opacity: 1;
		background: rgba(0, 0, 0, 0.1);
	}

	.status-menu {
		position: absolute;
		top: 100%;
		right: 0;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		min-width: 120px;
		padding: 4px 0;
	}

	.status-option {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 8px 12px;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		transition: background-color 0.2s ease;
	}

	.status-option:hover {
		background: rgba(0, 0, 0, 0.05);
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
		position: absolute;
		top: 0;
		right: 0;
		width: 750px;
		height: 100%;
		background: white;
		border-left: 1px solid #ddd;
		padding: 1rem;
		overflow-y: auto;
		transform: translateX(100%);
		transition: transform 0.3s ease;
		z-index: 10;
	}

	.phase-details-column.open {
		transform: translateX(0);
	}

	.close-details-btn {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #6b7280;
		padding: 4px;
		border-radius: 4px;
		transition: all 0.2s ease;
		z-index: 20;
	}

	.close-details-btn:hover {
		background: #f3f4f6;
		color: #374151;
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

	.document-section {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.document-section h3 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.document-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.document-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.document-item.exists {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		color: #166534;
	}

	.document-item.missing {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #dc2626;
	}

	.document-status {
		font-weight: bold;
		font-size: 1rem;
	}

	.document-name {
		font-family: 'Courier New', monospace;
		font-size: 0.8rem;
	}
</style>