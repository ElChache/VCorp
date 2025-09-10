<script lang="ts">
	// Props for integration with main page
	export let selectedProject: any;
	export let roles: any[] = [];
	export let squads: any[] = [];
	let selectedSquad: any = null;
	let showCreateSquadDialog = false;
	let showEditSquadDialog = false;
	let showDeleteSquadDialog = false;
	let newSquad = { name: '', squadId: '' };
	let editSquad = { id: '', name: '' };
	let deleteSquadName = '';
	let squadRoles: any[] = [];
	let availableRolesForSquad: any[] = [];
	let showAssignRoleDialog = false;
	let squadViewMode: 'overview' | 'roles' = 'overview';

	// Squad management functions (extracted from main file)
	async function loadSquads() {
		if (!selectedProject) {
			squads = [];
			return;
		}

		try {
			const response = await fetch(`/api/squads?projectId=${selectedProject.id}`);
			if (response.ok) {
				squads = await response.json();
			}
		} catch (error) {
			console.error('Failed to load squads:', error);
			squads = [];
		}
	}

	async function onSquadSelect(squad: any) {
		selectedSquad = squad;
		squadViewMode = 'overview';
		await loadSquadRoles();
	}

	async function loadSquadRoles() {
		if (!selectedSquad) {
			squadRoles = [];
			return;
		}

		try {
			const response = await fetch(`/api/squads/${selectedSquad.id}/roles`);
			if (response.ok) {
				squadRoles = await response.json();
			}
		} catch (error) {
			console.error('Failed to load squad roles:', error);
			squadRoles = [];
		}
	}

	async function loadAvailableRoles() {
		if (!selectedProject) {
			availableRolesForSquad = [];
			return;
		}

		try {
			const response = await fetch(`/api/roles?projectId=${selectedProject.id}`);
			if (response.ok) {
				const allRoles = await response.json();
				// Filter out roles that are already assigned to this squad
				const assignedRoleIds = squadRoles.map(sr => sr.roleId);
				availableRolesForSquad = allRoles.filter((role: any) => !assignedRoleIds.includes(role.id));
			}
		} catch (error) {
			console.error('Failed to load available roles:', error);
			availableRolesForSquad = [];
		}
	}

	async function createSquad() {
		if (!newSquad.name.trim() || !newSquad.squadId.trim() || !selectedProject) return;

		try {
			const response = await fetch('/api/squads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject.id,
					squadId: newSquad.squadId.trim(),
					name: newSquad.name.trim()
				})
			});

			if (response.ok) {
				await loadSquads();
				showCreateSquadDialog = false;
				newSquad = { name: '', squadId: '' };
			} else {
				const error = await response.json();
				console.error('Failed to create squad:', error.error);
			}
		} catch (error) {
			console.error('Failed to create squad:', error);
		}
	}

	async function updateSquad() {
		if (!editSquad.name.trim() || !editSquad.id) return;

		try {
			const response = await fetch('/api/squads', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					squadId: editSquad.id,
					name: editSquad.name.trim()
				})
			});

			if (response.ok) {
				await loadSquads();
				// Update selectedSquad if it was the one being edited
				if (selectedSquad?.id === editSquad.id) {
					selectedSquad = { ...selectedSquad, name: editSquad.name.trim() };
				}
				showEditSquadDialog = false;
				editSquad = { id: '', name: '' };
			} else {
				const error = await response.json();
				console.error('Failed to update squad:', error.error);
			}
		} catch (error) {
			console.error('Failed to update squad:', error);
		}
	}

	async function deleteSquad() {
		if (!selectedSquad) return;

		try {
			const response = await fetch('/api/squads', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ squadId: selectedSquad.id })
			});

			if (response.ok) {
				await loadSquads();
				selectedSquad = null;
				squadRoles = [];
				showDeleteSquadDialog = false;
				deleteSquadName = '';
			} else {
				const error = await response.json();
				console.error('Failed to delete squad:', error.error);
			}
		} catch (error) {
			console.error('Failed to delete squad:', error);
		}
	}

	async function assignRoleToSquad(roleId: number) {
		if (!selectedSquad) return;

		try {
			const response = await fetch(`/api/squads/${selectedSquad.id}/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roleId })
			});

			if (response.ok) {
				await loadSquadRoles();
				showAssignRoleDialog = false;
			} else {
				const error = await response.json();
				console.error('Failed to assign role to squad:', error.error);
			}
		} catch (error) {
			console.error('Failed to assign role to squad:', error);
		}
	}

	async function removeRoleFromSquad(roleId: number) {
		if (!selectedSquad) return;

		try {
			const response = await fetch(`/api/squads/${selectedSquad.id}/roles`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roleId })
			});

			if (response.ok) {
				await loadSquadRoles();
			} else {
				const error = await response.json();
				console.error('Failed to remove role from squad:', error.error);
			}
		} catch (error) {
			console.error('Failed to remove role from squad:', error);
		}
	}

	// Load squads when selectedProject changes
	$: if (selectedProject) {
		loadSquads();
	}
</script>

<!-- Squad Management Section HTML (extracted from main file lines 1546-1667) -->
<div class="squads-section">
	<div class="section-header">
		<h2>Squad Management</h2>
		<button class="btn-primary" on:click={() => showCreateSquadDialog = true}>
			+ Create Squad
		</button>
	</div>

	<div class="squads-content">
		{#if squads.length === 0}
			<div class="empty-state">
				<p>No squads created yet. Create your first squad to organize roles into teams.</p>
			</div>
		{:else}
			<div class="squads-layout">
				<div class="squads-list">
					<h3>Squads ({squads.length})</h3>
					{#each squads as squad}
						<div 
							class="squad-item" 
							class:selected={selectedSquad?.id === squad.id}
							on:click={() => onSquadSelect(squad)}
						>
							<div class="squad-info">
								<h4>{squad.name}</h4>
								<p class="squad-id">ID: {squad.id}</p>
							</div>
							<div class="squad-actions">
								<button 
									class="btn-secondary btn-sm"
									on:click|stopPropagation={() => { editSquad = { id: squad.id, name: squad.name }; showEditSquadDialog = true; }}
								>
									Edit
								</button>
								<button 
									class="btn-danger btn-sm"
									on:click|stopPropagation={() => { deleteSquadName = squad.name; showDeleteSquadDialog = true; }}
								>
									Delete
								</button>
							</div>
						</div>
					{/each}
				</div>

				{#if selectedSquad}
					<div class="squad-details">
						<div class="squad-header">
							<h3>{selectedSquad.name}</h3>
							<div class="squad-nav">
								<button 
									class="nav-btn" 
									class:active={squadViewMode === 'overview'}
									on:click={() => squadViewMode = 'overview'}
								>
									Overview
								</button>
								<button 
									class="nav-btn" 
									class:active={squadViewMode === 'roles'}
									on:click={() => { squadViewMode = 'roles'; loadSquadRoles(); }}
								>
									Roles ({squadRoles.length})
								</button>
							</div>
						</div>

						{#if squadViewMode === 'overview'}
							<div class="squad-overview">
								<div class="info-card">
									<h4>Squad Information</h4>
									<p><strong>Name:</strong> {selectedSquad.name}</p>
									<p><strong>ID:</strong> {selectedSquad.id}</p>
									<p><strong>Created:</strong> {new Date(selectedSquad.createdAt).toLocaleDateString()}</p>
								</div>
								<div class="info-card">
									<h4>Quick Stats</h4>
									<p><strong>Assigned Roles:</strong> {squadRoles.length}</p>
								</div>
							</div>
						{:else if squadViewMode === 'roles'}
							<div class="squad-roles">
								<div class="roles-header">
									<h4>Assigned Roles</h4>
									<button 
										class="btn-primary btn-sm"
										on:click={() => { loadAvailableRoles(); showAssignRoleDialog = true; }}
									>
										+ Assign Role
									</button>
								</div>
								{#if squadRoles.length === 0}
									<div class="empty-state">
										<p>No roles assigned to this squad yet.</p>
									</div>
								{:else}
									<div class="roles-list">
										{#each squadRoles as squadRole}
											<div class="role-item">
												<div class="role-info">
													<h5>{squadRole.roleName}</h5>
													<p class="role-content">{squadRole.roleContent?.substring(0, 100)}...</p>
												</div>
												<button 
													class="btn-danger btn-sm"
													on:click={() => removeRoleFromSquad(squadRole.roleId)}
												>
													Remove
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Squad Management Modals (extracted from main file lines 2801-2912) -->
{#if showCreateSquadDialog}
	<div class="dialog-overlay" on:click={() => showCreateSquadDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Create New Squad</h3>
			
			<div class="form-group">
				<label for="squad-id">Squad ID:</label>
				<input 
					id="squad-id"
					type="text" 
					bind:value={newSquad.squadId} 
					placeholder="e.g., leadership, core-team, frontend-team"
					autofocus
				/>
				<small class="form-help">Unique identifier for the squad (lowercase, use hyphens)</small>
			</div>
			
			<div class="form-group">
				<label for="squad-name">Squad Name:</label>
				<input 
					id="squad-name"
					type="text" 
					bind:value={newSquad.name} 
					placeholder="e.g., Leadership Team, Core Development Team"
				/>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showCreateSquadDialog = false}>Cancel</button>
				<button class="create-btn" on:click={createSquad} disabled={!newSquad.name.trim() || !newSquad.squadId.trim()}>
					Create Squad
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showEditSquadDialog}
	<div class="dialog-overlay" on:click={() => showEditSquadDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Edit Squad</h3>
			
			<div class="form-group">
				<label for="edit-squad-name">Squad Name:</label>
				<input 
					id="edit-squad-name"
					type="text" 
					bind:value={editSquad.name} 
					placeholder="Squad name"
					autofocus
				/>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showEditSquadDialog = false}>Cancel</button>
				<button class="create-btn" on:click={updateSquad} disabled={!editSquad.name.trim()}>
					Update Squad
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteSquadDialog}
	<div class="dialog-overlay" on:click={() => showDeleteSquadDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Delete Squad</h3>
			<p>Are you sure you want to delete the squad "{deleteSquadName}"?</p>
			<p><strong>Warning:</strong> This will also remove all role assignments from this squad.</p>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showDeleteSquadDialog = false}>Cancel</button>
				<button class="delete-btn" on:click={deleteSquad}>
					Delete Squad
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showAssignRoleDialog}
	<div class="dialog-overlay" on:click={() => showAssignRoleDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Assign Role to Squad</h3>
			
			{#if availableRolesForSquad.length === 0}
				<p>No available roles to assign. All roles are already assigned to this squad.</p>
				<div class="dialog-buttons">
					<button class="cancel-btn" on:click={() => showAssignRoleDialog = false}>Close</button>
				</div>
			{:else}
				<div class="form-group">
					<label>Select a role to assign:</label>
					<div class="role-options">
						{#each availableRolesForSquad as role}
							<button 
								class="role-option"
								on:click={() => assignRoleToSquad(role.id)}
							>
								<div class="role-name">{role.name}</div>
								<div class="role-preview">{role.content?.substring(0, 100)}...</div>
							</button>
						{/each}
					</div>
				</div>
				<div class="dialog-buttons">
					<button class="cancel-btn" on:click={() => showAssignRoleDialog = false}>Cancel</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Squad Management Styles (extracted from main file lines 4799-4951) */
	.squads-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.squads-content {
		flex: 1;
		overflow: auto;
		padding: 16px;
	}

	.squads-layout {
		display: flex;
		gap: 24px;
		height: 100%;
	}

	.squads-list {
		flex: 1;
		min-width: 300px;
	}

	.squads-list h3 {
		margin: 0 0 16px 0;
		color: #333;
		font-size: 18px;
		font-weight: 600;
	}

	.squad-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		margin-bottom: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		background: white;
	}

	.squad-item:hover {
		border-color: #007bff;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.squad-item.selected {
		border-color: #007bff;
		background: #f8f9ff;
		box-shadow: 0 2px 8px rgba(0,123,255,0.15);
	}

	.squad-info h4 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.squad-id {
		margin: 4px 0 0 0;
		font-size: 12px;
		color: #666;
		font-family: 'Monaco', 'Menlo', monospace;
	}

	.squad-actions {
		display: flex;
		gap: 8px;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.squad-item:hover .squad-actions {
		opacity: 1;
	}

	.squad-details {
		flex: 2;
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
	}

	.squad-header {
		padding: 16px 20px;
		border-bottom: 1px solid #e5e5e5;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #f8f9fa;
		border-radius: 8px 8px 0 0;
	}

	.squad-header h3 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		color: #333;
	}

	.squad-nav {
		display: flex;
		gap: 8px;
	}

	.squad-nav .nav-btn {
		padding: 6px 12px;
		font-size: 14px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.squad-nav .nav-btn:hover {
		background: #f0f0f0;
	}

	.squad-nav .nav-btn.active {
		background: #007bff;
		color: white;
		border-color: #007bff;
	}

	.squad-overview {
		padding: 20px;
	}

	.info-card {
		background: #f8f9fa;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 16px;
		margin-bottom: 16px;
	}

	.info-card h4 {
		margin: 0 0 12px 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.info-card p {
		margin: 8px 0;
		font-size: 14px;
		color: #555;
	}

	.squad-roles {
		padding: 20px;
	}

	.roles-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.roles-header h4 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #333;
	}

	.roles-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.role-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 16px;
		background: #f8f9fa;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
	}

	.role-info h5 {
		margin: 0 0 8px 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.role-content {
		margin: 0;
		font-size: 14px;
		color: #666;
		line-height: 1.4;
	}

	.empty-state {
		text-align: center;
		padding: 40px 20px;
		color: #666;
		font-style: italic;
	}

	/* Common button styles that may be needed */
	.btn-primary {
		background: #007bff;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
	}

	.btn-primary:hover {
		background: #0056b3;
	}

	.btn-secondary {
		background: #6c757d;
		color: white;
		border: none;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn-secondary:hover {
		background: #545b62;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
		border: none;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn-danger:hover {
		background: #c82333;
	}

	.btn-sm {
		font-size: 12px;
		padding: 4px 8px;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid #e5e5e5;
		background: #f8f9fa;
	}

	.section-header h2 {
		margin: 0;
		font-size: 24px;
		font-weight: 600;
		color: #333;
	}

	/* Dialog styles */
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
		padding: 24px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.dialog h3 {
		margin: 0 0 20px 0;
		font-size: 20px;
		font-weight: 600;
		color: #333;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-weight: 500;
		color: #333;
	}

	.form-group input {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.form-group input:focus {
		outline: none;
		border-color: #007bff;
		box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
	}

	.form-help {
		display: block;
		margin-top: 4px;
		font-size: 12px;
		color: #666;
	}

	.dialog-buttons {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 24px;
	}

	.cancel-btn {
		background: #6c757d;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.cancel-btn:hover {
		background: #545b62;
	}

	.create-btn {
		background: #28a745;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.create-btn:hover {
		background: #218838;
	}

	.create-btn:disabled {
		background: #6c757d;
		cursor: not-allowed;
	}

	.delete-btn {
		background: #dc3545;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.delete-btn:hover {
		background: #c82333;
	}

	.role-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 300px;
		overflow-y: auto;
	}

	.role-option {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 12px;
		background: #f8f9fa;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		transition: all 0.2s ease;
	}

	.role-option:hover {
		background: #e9ecef;
		border-color: #007bff;
	}

	.role-name {
		font-weight: 600;
		color: #333;
		margin-bottom: 4px;
	}

	.role-preview {
		font-size: 12px;
		color: #666;
		line-height: 1.3;
	}
</style>