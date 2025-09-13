<script lang="ts">
	import { onMount } from 'svelte';
	import { tickets, agents, roleTypes, isLoading, error, contentActions } from '$lib/stores/contentStore';
	import TicketComments from './TicketComments.svelte';

	export let selectedProject: any;

	// Reactive data from content store
	$: storeTickets = $tickets;
	$: storeRoleTypes = $roleTypes;
	$: storeIsLoading = $isLoading;
	$: storeError = $error;
	
	// Local component state
	let selectedRole: any = null;
	
	// Comments panel state (following same pattern as ThreadView)
	let selectedTicket: any = null;
	let isCommentsColumnOpen: boolean = false;
	let replyContent: string = '';
	let ticketCommentsRef: any;
	
	// Reactive filtering
	$: filteredTickets = selectedRole && storeTickets ? 
		storeTickets.filter(ticket => ticket.assignedToRoleType === selectedRole.name) : 
		storeTickets;
	let showCreateDialog = false;
	let newTicket = {
		title: '',
		body: '',
		assignedToRoleType: '',
		priority: 'medium',
		status: 'open'
	};

	const priorityColors = {
		low: 'bg-gray-100 text-gray-800',
		medium: 'bg-blue-100 text-blue-800',
		high: 'bg-yellow-100 text-yellow-800',
		critical: 'bg-red-100 text-red-800'
	};

	const statusColors = {
		open: 'bg-green-100 text-green-800',
		in_progress: 'bg-blue-100 text-blue-800',
		blocked: 'bg-red-100 text-red-800',
		ready_for_review: 'bg-purple-100 text-purple-800',
		reviewing: 'bg-orange-100 text-orange-800',
		review_passed: 'bg-emerald-100 text-emerald-800',
		needs_attention: 'bg-yellow-100 text-yellow-800',
		resolved: 'bg-gray-100 text-gray-800',
		closed: 'bg-gray-200 text-gray-600'
	};

	const statusOptions = [
		'open', 'in_progress', 'blocked', 'ready_for_review', 
		'reviewing', 'review_passed', 'needs_attention', 'resolved', 'closed'
	];
	
	const priorityOptions = ['low', 'medium', 'high', 'critical'];

	// Load content when project changes
	$: if (selectedProject) {
		contentActions.loadContent(selectedProject.id);
	}

	// Data is now managed by the centralized content store
	
	// Auto-select first role when roles are loaded
	$: if (storeRoleTypes.length > 0 && !selectedRole) {
		selectedRole = storeRoleTypes[0];
	}

	function selectRole(role) {
		selectedRole = role;
	}

	function getRoleTicketCount(role) {
		return storeTickets.filter(ticket => ticket.assignedToRoleType === role.name).length;
	}

	async function createTicket() {
		if (!newTicket.title || !newTicket.body || !newTicket.assignedToRoleType) {
			// TODO: Add local validation feedback
			return;
		}

		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/content`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					...newTicket,
					type: 'ticket'
				})
			});

			if (response.ok) {
				const createdTicket = await response.json();
				showCreateDialog = false;
				// ContentPollingService will automatically pick up the new ticket
				newTicket = {
					title: '',
					body: '',
					assignedToRoleType: '',
					priority: 'medium',
					status: 'open'
				};
			} else {
				const errorData = await response.json();
				console.error('Failed to create ticket:', errorData.error);
			}
		} catch (err) {
			console.error('Failed to create ticket:', err.message);
		}
	}

	async function updateTicketStatus(ticket, newStatus) {
		try {
			const response = await fetch(`/api/content/${ticket.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					...ticket,
					status: newStatus,
					updatedAt: new Date().toISOString()
				})
			});

			if (response.ok) {
				const updatedTicket = await response.json();
				// ContentPollingService will automatically pick up the updated ticket
			}
		} catch (err) {
			console.error('Failed to update ticket status:', err);
		}
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString();
	}

	function openCreateDialog() {
		newTicket.assignedToRoleType = selectedRole?.name || '';
		showCreateDialog = true;
		// Content store manages error state
	}

	// Ticket comments handling functions (following same pattern as thread handling)
	function onTicketSelect(ticket: any) {
		selectedTicket = ticket;
		isCommentsColumnOpen = true;
	}

	function closeCommentsColumn() {
		isCommentsColumnOpen = false;
		selectedTicket = null;
	}

	async function sendComment() {
		if (!replyContent.trim() || !selectedTicket?.id || !selectedProject) return;

		try {
			const response = await fetch('/api/send-message', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					projectId: selectedProject.id,
					parentContentId: selectedTicket.id,
					type: 'message',
					title: `Comment on: ${selectedTicket.title}`,
					body: replyContent,
					authorAgentId: 'human-director'
				})
			});

			if (response.ok) {
				replyContent = '';
				// ContentPollingService will automatically pick up the new comment
			} else {
				const errorData = await response.json();
				console.error('Failed to send comment:', errorData.error);
			}
		} catch (err) {
			console.error('Failed to send comment:', err.message);
		}
	}

	function formatMessageTime(timestamp: string): string {
		const now = new Date();
		const messageTime = new Date(timestamp);
		const diffMs = now.getTime() - messageTime.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		
		return messageTime.toLocaleDateString();
	}
</script>

<div class="tickets-section">
	<div class="section-header">
		<h2>🎫 Tickets</h2>
		<div class="section-actions">
			<button class="btn btn-primary" on:click={openCreateDialog}>
				+ Create Ticket
			</button>
		</div>
	</div>

	{#if storeError}
		<div class="error-banner">
			{storeError}
		</div>
	{/if}

	<div class="tickets-container">
		<!-- Left Sidebar - Roles -->
		<div class="roles-sidebar">
			<h3>Roles</h3>
			<div class="roles-list">
				{#each storeRoleTypes as role}
					<button 
						class="role-item {selectedRole?.id === role.id ? 'selected' : ''}"
						on:click={() => selectRole(role)}
					>
						<div class="role-name">{role.name}</div>
						<div class="ticket-count">{getRoleTicketCount(role)}</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Right Content - Tickets for Selected Role -->
		<div class="tickets-content">
			{#if selectedRole}
				<div class="tickets-header">
					<h3>Tickets for {selectedRole.name}</h3>
					<div class="tickets-count">{filteredTickets.length} tickets</div>
				</div>

				{#if storeIsLoading}
					<div class="loading">Loading tickets...</div>
				{:else if filteredTickets.length === 0}
					<div class="empty-state">
						<p>No tickets assigned to {selectedRole.name}</p>
						<button class="btn btn-secondary" on:click={openCreateDialog}>
							Create First Ticket
						</button>
					</div>
				{:else}
					<div class="tickets-list">
						{#each filteredTickets as ticket}
							<div class="ticket-card" on:click={() => onTicketSelect(ticket)}>
								<div class="ticket-header">
									<div class="ticket-title">{ticket.title}</div>
									<div class="ticket-badges">
										<span class="badge priority-badge {priorityColors[ticket.priority]}">
											{ticket.priority}
										</span>
										<select 
											class="status-select {statusColors[ticket.status]}"
											value={ticket.status}
											on:change={(e) => updateTicketStatus(ticket, e.target.value)}
										>
											{#each statusOptions as status}
												<option value={status}>{status.replace('_', ' ')}</option>
											{/each}
										</select>
									</div>
								</div>
								
								<div class="ticket-body">
									{ticket.body}
								</div>

								<div class="ticket-meta">
									<div class="ticket-info">
										{#if ticket.claimedByAgent}
											<span class="claimed-by">Claimed by: {ticket.claimedByAgent}</span>
										{:else}
											<span class="unclaimed">Unclaimed</span>
										{/if}
									</div>
									<div class="ticket-dates">
										Created: {formatDate(ticket.createdAt)}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="no-role-selected">
					<p>Select a role from the sidebar to view tickets</p>
				</div>
			{/if}
		</div>

		<!-- Ticket Comments Panel -->
		<TicketComments 
			bind:this={ticketCommentsRef}
			{selectedProject}
			{selectedTicket}
			{isCommentsColumnOpen}
			bind:replyContent
			{formatMessageTime}
			on:close={closeCommentsColumn}
			on:sendComment={sendComment}
		/>
	</div>
</div>

<!-- Create Ticket Dialog -->
{#if showCreateDialog}
	<div class="modal-overlay" on:click={() => showCreateDialog = false}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Create New Ticket</h3>
				<button class="modal-close" on:click={() => showCreateDialog = false}>×</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="ticket-title">Title *</label>
					<input 
						type="text" 
						id="ticket-title"
						bind:value={newTicket.title} 
						placeholder="Enter ticket title"
						autofocus
					/>
				</div>

				<div class="form-group">
					<label for="ticket-role">Assigned To *</label>
					<select id="ticket-role" bind:value={newTicket.assignedToRoleType}>
						<option value="">Select a role</option>
						{#each storeRoleTypes as role}
							<option value={role.name}>{role.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="ticket-priority">Priority</label>
					<select id="ticket-priority" bind:value={newTicket.priority}>
						{#each priorityOptions as priority}
							<option value={priority}>{priority}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="ticket-status">Status</label>
					<select id="ticket-status" bind:value={newTicket.status}>
						{#each statusOptions as status}
							<option value={status}>{status.replace('_', ' ')}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="ticket-body">Description *</label>
					<textarea 
						id="ticket-body"
						bind:value={newTicket.body} 
						placeholder="Enter ticket description"
						rows="4"
					></textarea>
				</div>
			</div>

			<div class="modal-actions">
				<button class="btn btn-secondary" on:click={() => showCreateDialog = false}>
					Cancel
				</button>
				<button class="btn btn-primary" on:click={createTicket}>
					Create Ticket
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.tickets-section {
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

	.section-actions {
		display: flex;
		gap: 0.5rem;
	}

	.tickets-container {
		flex: 1;
		display: flex;
		min-height: 0;
		position: relative;
	}

	.roles-sidebar {
		width: 280px;
		border-right: 1px solid #e5e7eb;
		padding: 1rem;
		overflow-y: auto;
	}

	.roles-sidebar h3 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #374151;
	}

	.roles-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.role-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		background: white;
		cursor: pointer;
		text-align: left;
		transition: all 0.2s;
	}

	.role-item:hover {
		border-color: #3b82f6;
		background: #f8fafc;
	}

	.role-item.selected {
		border-color: #3b82f6;
		background: #eff6ff;
		color: #3b82f6;
	}

	.role-name {
		font-weight: 500;
	}

	.ticket-count {
		background: #e5e7eb;
		color: #6b7280;
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		min-width: 20px;
		text-align: center;
	}

	.role-item.selected .ticket-count {
		background: #3b82f6;
		color: white;
	}

	.tickets-content {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
	}

	.tickets-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.tickets-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.tickets-count {
		color: #6b7280;
		font-size: 0.875rem;
	}

	.empty-state, .no-role-selected {
		text-align: center;
		padding: 3rem 1rem;
		color: #6b7280;
	}

	.tickets-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.ticket-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 1rem;
		transition: border-color 0.2s;
		cursor: pointer;
	}

	.ticket-card:hover {
		border-color: #d1d5db;
	}

	.ticket-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.ticket-title {
		font-weight: 600;
		font-size: 1.1rem;
		margin-right: 1rem;
	}

	.ticket-badges {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.badge {
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.status-select {
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		border: 1px solid transparent;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: capitalize;
		background: inherit;
		cursor: pointer;
	}

	.status-select:focus {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}

	.ticket-body {
		margin-bottom: 1rem;
		line-height: 1.5;
		color: #374151;
	}

	.ticket-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.claimed-by {
		color: #059669;
		font-weight: 500;
	}

	.unclaimed {
		color: #dc2626;
		font-weight: 500;
	}

	.error-banner {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #dc2626;
		padding: 1rem;
		margin: 1rem;
		border-radius: 6px;
	}

	.loading {
		text-align: center;
		padding: 2rem;
		color: #6b7280;
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
		max-width: 500px;
		max-height: 90vh;
		overflow-y: auto;
		margin: 1rem;
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
		margin-bottom: 0.25rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.form-group input:focus,
	.form-group select:focus,
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

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid transparent;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover {
		background: #2563eb;
	}

	.btn-secondary {
		background: white;
		color: #374151;
		border-color: #d1d5db;
	}

	.btn-secondary:hover {
		background: #f9fafb;
	}
</style>