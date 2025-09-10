<script>
	export let selectedProject = null;
	export let scheduledReminders = [];
	export let showCreateReminderDialog = false;
	export let showEditReminderDialog = false;

	let newReminder = { name: '', targetRoleType: '', message: '', frequencyMinutes: 15, isActive: true };
	let editReminder = { id: 0, name: '', targetRoleType: '', message: '', frequencyMinutes: 15, isActive: true };

	async function loadScheduledReminders() {
		if (!selectedProject) {
			scheduledReminders = [];
			return;
		}
		
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/scheduled-reminders`);
			if (response.ok) {
				scheduledReminders = await response.json();
			}
		} catch (error) {
			console.error('Failed to load scheduled reminders:', error);
			scheduledReminders = [];
		}
	}

	function openEditReminderDialog(reminder) {
		editReminder = {
			id: reminder.id,
			name: reminder.name,
			targetRoleType: reminder.targetRoleType,
			message: reminder.message,
			frequencyMinutes: reminder.frequencyMinutes,
			isActive: reminder.isActive
		};
		showEditReminderDialog = true;
	}

	async function deleteReminder(reminderId) {
		if (!confirm('Are you sure you want to delete this scheduled reminder?')) return;
		
		try {
			const response = await fetch(`/api/scheduled-reminders/${reminderId}`, {
				method: 'DELETE'
			});
			if (response.ok) {
				await loadScheduledReminders();
			}
		} catch (error) {
			console.error('Failed to delete reminder:', error);
		}
	}

	async function createReminder() {
		if (!newReminder.name.trim() || !newReminder.targetRoleType || !newReminder.message.trim() || !selectedProject) return;
		
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/scheduled-reminders`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newReminder)
			});
			
			if (response.ok) {
				showCreateReminderDialog = false;
				newReminder = { name: '', targetRoleType: '', message: '', frequencyMinutes: 15, isActive: true };
				await loadScheduledReminders();
			}
		} catch (error) {
			console.error('Failed to create reminder:', error);
		}
	}

	async function updateReminder() {
		if (!editReminder.name.trim() || !editReminder.targetRoleType || !editReminder.message.trim()) return;
		
		try {
			const response = await fetch(`/api/scheduled-reminders/${editReminder.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: editReminder.name,
					targetRoleType: editReminder.targetRoleType,
					message: editReminder.message,
					frequencyMinutes: editReminder.frequencyMinutes,
					isActive: editReminder.isActive
				})
			});
			
			if (response.ok) {
				showEditReminderDialog = false;
				await loadScheduledReminders();
			}
		} catch (error) {
			console.error('Failed to update reminder:', error);
		}
	}

	// Load reminders when component mounts or project changes
	$: if (selectedProject) {
		loadScheduledReminders();
	}
</script>

<div class="scheduled-reminders-section">
	<div class="section-header">
		<h2>⏰ Scheduled Reminders</h2>
		<button class="btn-primary" on:click={() => showCreateReminderDialog = true}>
			+ Create Reminder
		</button>
	</div>
	
	{#if scheduledReminders.length === 0}
		<div class="empty-state">
			<p>No scheduled reminders yet. Create one to automatically send periodic messages to agents.</p>
		</div>
	{:else}
		<div class="reminders-list">
			{#each scheduledReminders as reminder}
				<div class="reminder-card" class:inactive={!reminder.isActive}>
					<div class="reminder-header">
						<div class="reminder-info">
							<h3>{reminder.name}</h3>
							<div class="reminder-meta">
								<span class="role-badge">{reminder.targetRoleType}</span>
								<span class="frequency">Every {reminder.frequencyMinutes} minutes</span>
								<span class="status" class:active={reminder.isActive} class:inactive={!reminder.isActive}>
									{reminder.isActive ? '✅ Active' : '⏸️ Paused'}
								</span>
							</div>
						</div>
						<div class="reminder-actions">
							<button class="edit-btn" on:click={() => openEditReminderDialog(reminder)}>
								Edit
							</button>
							<button class="delete-btn" on:click={() => deleteReminder(reminder.id)}>
								Delete
							</button>
						</div>
					</div>
					<div class="reminder-message">
						<strong>Message:</strong> {reminder.message}
					</div>
					{#if reminder.lastSentAt}
						<div class="last-sent">
							<small>Last sent: {new Date(reminder.lastSentAt).toLocaleString()}</small>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create Scheduled Reminder Dialog -->
{#if showCreateReminderDialog}
	<div class="dialog-overlay" on:click={() => showCreateReminderDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Create Scheduled Reminder</h3>
			
			<div class="form-group">
				<label for="reminder-name">Name:</label>
				<input 
					id="reminder-name"
					type="text" 
					bind:value={newReminder.name} 
					placeholder="Enter reminder name"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="reminder-role">Target Role:</label>
				<select id="reminder-role" bind:value={newReminder.targetRoleType}>
					<option value="">Select a role</option>
					<option value="Backend Developer">Backend Developer</option>
					<option value="Frontend Developer">Frontend Developer</option>
					<option value="AI Developer">AI Developer</option>
					<option value="UX Expert">UX Expert</option>
					<option value="Graphic Designer">Graphic Designer</option>
					<option value="Technical QA">Technical QA</option>
					<option value="Product Manager">Product Manager</option>
					<option value="Lead Developer">Lead Developer</option>
					<option value="System Architect">System Architect</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="reminder-frequency">Frequency (minutes):</label>
				<select id="reminder-frequency" bind:value={newReminder.frequencyMinutes}>
					<option value={5}>Every 5 minutes</option>
					<option value={15}>Every 15 minutes</option>
					<option value={30}>Every 30 minutes</option>
					<option value={60}>Every hour</option>
					<option value={120}>Every 2 hours</option>
					<option value={240}>Every 4 hours</option>
					<option value={480}>Every 8 hours</option>
					<option value={1440}>Every day</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="reminder-message">Message:</label>
				<textarea 
					id="reminder-message"
					bind:value={newReminder.message} 
					placeholder="Enter the reminder message to send to the role"
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={newReminder.isActive}
					/>
					Active (start sending immediately)
				</label>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showCreateReminderDialog = false}>Cancel</button>
				<button class="create-btn" on:click={createReminder} disabled={!newReminder.name.trim() || !newReminder.targetRoleType || !newReminder.message.trim()}>
					Create Reminder
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Scheduled Reminder Dialog -->
{#if showEditReminderDialog}
	<div class="dialog-overlay" on:click={() => showEditReminderDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Edit Scheduled Reminder</h3>
			
			<div class="form-group">
				<label for="edit-reminder-name">Name:</label>
				<input 
					id="edit-reminder-name"
					type="text" 
					bind:value={editReminder.name} 
					placeholder="Enter reminder name"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="edit-reminder-role">Target Role:</label>
				<select id="edit-reminder-role" bind:value={editReminder.targetRoleType}>
					<option value="">Select a role</option>
					<option value="Backend Developer">Backend Developer</option>
					<option value="Frontend Developer">Frontend Developer</option>
					<option value="AI Developer">AI Developer</option>
					<option value="UX Expert">UX Expert</option>
					<option value="Graphic Designer">Graphic Designer</option>
					<option value="Technical QA">Technical QA</option>
					<option value="Product Manager">Product Manager</option>
					<option value="Lead Developer">Lead Developer</option>
					<option value="System Architect">System Architect</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="edit-reminder-frequency">Frequency (minutes):</label>
				<select id="edit-reminder-frequency" bind:value={editReminder.frequencyMinutes}>
					<option value={5}>Every 5 minutes</option>
					<option value={15}>Every 15 minutes</option>
					<option value={30}>Every 30 minutes</option>
					<option value={60}>Every hour</option>
					<option value={120}>Every 2 hours</option>
					<option value={240}>Every 4 hours</option>
					<option value={480}>Every 8 hours</option>
					<option value={1440}>Every day</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="edit-reminder-message">Message:</label>
				<textarea 
					id="edit-reminder-message"
					bind:value={editReminder.message} 
					placeholder="Enter the reminder message to send to the role"
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={editReminder.isActive}
					/>
					Active (start sending immediately)
				</label>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showEditReminderDialog = false}>Cancel</button>
				<button class="create-btn" on:click={updateReminder} disabled={!editReminder.name.trim() || !editReminder.targetRoleType || !editReminder.message.trim()}>
					Update Reminder
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Scheduled Reminders Styles */
	.scheduled-reminders-section {
		padding: 20px;
		max-width: 1000px;
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

	.empty-state {
		text-align: center;
		color: #6b7280;
		padding: 60px 20px;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	.reminders-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.reminder-card {
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 16px;
		background: white;
		transition: box-shadow 0.2s;
	}

	.reminder-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.reminder-card.inactive {
		opacity: 0.7;
		background: #f8f8f8;
		border-color: #d0d0d0;
	}

	.reminder-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.reminder-info h3 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 18px;
	}

	.reminder-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	.role-badge {
		background: #e3f2fd;
		color: #1976d2;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.frequency {
		background: #f0f0f0;
		color: #666;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
	}

	.status {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.status.active {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.status.inactive {
		background: #fff3e0;
		color: #f57c00;
	}

	.reminder-actions {
		display: flex;
		gap: 8px;
	}

	.reminder-actions button {
		padding: 6px 12px;
		border-radius: 4px;
		border: 1px solid #ccc;
		background: white;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s;
	}

	.edit-btn:hover {
		background: #007bff;
		color: white;
		border-color: #007bff;
	}

	.delete-btn:hover {
		background: #dc3545;
		color: white;
		border-color: #dc3545;
	}

	.reminder-message {
		margin-bottom: 8px;
		padding: 12px;
		background: #f8f9fa;
		border-radius: 4px;
		border-left: 3px solid #007bff;
	}

	.reminder-message strong {
		color: #333;
		margin-right: 8px;
	}

	.last-sent {
		color: #666;
		font-size: 12px;
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

	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: 8px;
		font-size: 14px;
	}

	.checkbox-label input[type="checkbox"] {
		width: auto !important;
		margin: 0;
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