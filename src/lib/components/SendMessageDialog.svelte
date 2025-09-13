<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let showSendMessageDialog: boolean = false;
	export let channels: any[] = [];
	export let agents: any[] = [];
	export let roleTypes: any[] = [];
	export let squads: any[] = [];

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Dialog state (colocated from main component)
	let newMessage = {
		type: 'message',
		title: '',
		body: '',
		channelId: null as number | null
	};

	let messageReadingAssignments: Array<{
		assignedToType: 'role' | 'agent' | 'squad';
		assignedTo: string;
	}> = [];

	// Dialog management functions (colocated from main component)
	function addReadingAssignment() {
		messageReadingAssignments = [...messageReadingAssignments, {
			assignedToType: 'role',
			assignedTo: ''
		}];
	}

	function removeReadingAssignment(index: number) {
		messageReadingAssignments = messageReadingAssignments.filter((_, i) => i !== index);
	}

	function resetSendMessageDialog() {
		showSendMessageDialog = false;
		newMessage = {
			type: 'message',
			title: '',
			body: '',
			channelId: null
		};
		messageReadingAssignments = [];
		dispatch('close');
	}

	function handleSendMessage() {
		const assignTo = messageReadingAssignments
			.filter(assignment => assignment.assignedTo.trim())
			.map(assignment => ({
				type: assignment.assignedToType,
				target: assignment.assignedTo
			}));

		dispatch('sendMessage', {
			newMessage,
			assignTo
		});
	}
</script>

{#if showSendMessageDialog}
	<div class="dialog-overlay" on:click={resetSendMessageDialog}>
		<div class="dialog" on:click|stopPropagation>
			<div class="dialog-header">
				<h3>📨 Send Message</h3>
				<button class="close-btn" on:click={resetSendMessageDialog}>×</button>
			</div>
			
			<div class="dialog-body">
				<div class="form-group">
					<label for="message-type">Type:</label>
					<select id="message-type" bind:value={newMessage.type}>
						<option value="message">Message</option>
						<option value="document">Document</option>
					</select>
				</div>

				<div class="form-group">
					<label for="message-title">Title (optional):</label>
					<input 
						id="message-title"
						type="text" 
						bind:value={newMessage.title} 
						placeholder="Message title"
					/>
				</div>
				
				<div class="form-group">
					<label for="message-body">Message:</label>
					<textarea 
						id="message-body"
						bind:value={newMessage.body} 
						placeholder="Type your message here..."
						rows="6"
					></textarea>
				</div>
				
				<div class="form-group">
					<label for="message-channel">Channel (optional):</label>
					<select 
						id="message-channel"
						bind:value={newMessage.channelId}
					>
						<option value={null}>Direct Message</option>
						{#each channels as channel}
							<option value={channel.id}>{channel.name}</option>
						{/each}
					</select>
				</div>

				<div class="reading-assignments-section">
					<div class="assignments-header">
						<h4>📋 Reading Assignments</h4>
						<button type="button" class="add-assignment-btn" on:click={addReadingAssignment}>
							+ Add Assignment
						</button>
					</div>

					{#each messageReadingAssignments as assignment, index}
						<div class="assignment-row">
							<select bind:value={assignment.assignedToType}>
								<option value="role">Role</option>
								<option value="agent">Agent</option>
								<option value="squad">Squad</option>
							</select>
							
							{#if assignment.assignedToType === 'role'}
								<select bind:value={assignment.assignedTo}>
									<option value="">Select a role type...</option>
									{#each roleTypes as roleType}
										<option value={roleType.roleType}>{roleType.roleType} ({roleType.count} agents)</option>
									{/each}
								</select>
							{:else if assignment.assignedToType === 'agent'}
								<select bind:value={assignment.assignedTo}>
									<option value="">Select an agent...</option>
									{#each agents as agent}
										<option value={agent.id}>{agent.id} ({agent.roleType})</option>
									{/each}
								</select>
							{:else if assignment.assignedToType === 'squad'}
								<select bind:value={assignment.assignedTo}>
									<option value="">Select a squad...</option>
									{#each squads as squad}
										<option value={squad.id}>{squad.name}</option>
									{/each}
								</select>
							{/if}
							
							<button type="button" class="remove-btn" on:click={() => removeReadingAssignment(index)}>
								Remove
							</button>
						</div>
					{/each}
				</div>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={resetSendMessageDialog}>Cancel</button>
				<button class="send-btn" on:click={handleSendMessage} disabled={!newMessage.body.trim()}>
					Send Message
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Dialog overlay and base styles */
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
		max-width: 600px;
		width: 90%;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.dialog-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		color: #6b7280;
		padding: 0;
		width: 32px;
		height: 32px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		background: #f3f4f6;
		color: #374151;
	}

	/* Dialog body */
	.dialog-body {
		padding: 20px;
	}

	/* Form styles */
	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		margin-bottom: 8px;
		font-weight: 500;
		color: #374151;
		font-size: 14px;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 12px;
		font-size: 14px;
		font-family: inherit;
		transition: border-color 0.2s ease;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		line-height: 1.5;
		min-height: 120px;
	}

	.form-group input::placeholder,
	.form-group textarea::placeholder {
		color: #9ca3af;
	}

	/* Reading assignments section */
	.reading-assignments-section {
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid #f3f4f6;
	}

	.assignments-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.assignments-header h4 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #374151;
	}

	.add-assignment-btn {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 8px 12px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.add-assignment-btn:hover {
		background: #2563eb;
	}

	.assignment-row {
		display: flex;
		gap: 12px;
		align-items: center;
		margin-bottom: 12px;
		padding: 12px;
		background: #f9fafb;
		border-radius: 6px;
		border: 1px solid #e5e7eb;
	}

	.assignment-row select {
		flex: 1;
		margin: 0;
	}

	.remove-btn {
		background: #ef4444;
		color: white;
		border: none;
		padding: 8px 12px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: background-color 0.2s ease;
		flex-shrink: 0;
	}

	.remove-btn:hover {
		background: #dc2626;
	}

	/* Dialog buttons */
	.dialog-buttons {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		padding: 20px;
		border-top: 1px solid #f3f4f6;
		background: #f9fafb;
	}

	.cancel-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 12px 20px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.cancel-btn:hover {
		background: #e5e7eb;
		border-color: #9ca3af;
	}

	.send-btn {
		background: #2563eb;
		color: white;
		border: none;
		padding: 12px 20px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.send-btn:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.send-btn:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}
</style>