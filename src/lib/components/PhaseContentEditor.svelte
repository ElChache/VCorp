<script lang="ts">
	import PhaseDocumentManager from './PhaseDocumentManager.svelte';
	
	export let selectedPhase: any;
	export let selectedProject: any;

	let isEditingPhase = false;
	let editedPhaseBody = '';
	let isSavingPhase = false;
	
	// Document management state
	let requiredInputs: string[] = [];
	let expectedOutputs: string[] = [];
	
	// Reminder functionality
	let isSendingReminder = false;

	// Reset editing state when phase changes
	$: if (selectedPhase) {
		isEditingPhase = false;
		editedPhaseBody = selectedPhase?.body || '';
		
		// Parse document arrays
		try {
			requiredInputs = selectedPhase?.requiredInputs ? JSON.parse(selectedPhase.requiredInputs) : [];
		} catch {
			requiredInputs = [];
		}
		
		try {
			expectedOutputs = selectedPhase?.expectedOutputs ? JSON.parse(selectedPhase.expectedOutputs) : [];
		} catch {
			expectedOutputs = [];
		}
	}

	function startEditingPhase() {
		isEditingPhase = true;
		editedPhaseBody = selectedPhase?.body || '';
	}

	function cancelEditingPhase() {
		isEditingPhase = false;
		editedPhaseBody = selectedPhase?.body || '';
		
		// Reset document arrays
		try {
			requiredInputs = selectedPhase?.requiredInputs ? JSON.parse(selectedPhase.requiredInputs) : [];
		} catch {
			requiredInputs = [];
		}
		
		try {
			expectedOutputs = selectedPhase?.expectedOutputs ? JSON.parse(selectedPhase.expectedOutputs) : [];
		} catch {
			expectedOutputs = [];
		}
	}

	async function savePhaseContent() {
		if (!selectedPhase || isSavingPhase) return;

		// Check if anything has changed
		const currentRequiredInputs = selectedPhase?.requiredInputs ? JSON.parse(selectedPhase.requiredInputs) : [];
		const currentExpectedOutputs = selectedPhase?.expectedOutputs ? JSON.parse(selectedPhase.expectedOutputs) : [];
		
		const bodyChanged = editedPhaseBody !== selectedPhase.body;
		const inputsChanged = JSON.stringify(requiredInputs.sort()) !== JSON.stringify(currentRequiredInputs.sort());
		const outputsChanged = JSON.stringify(expectedOutputs.sort()) !== JSON.stringify(currentExpectedOutputs.sort());

		if (!bodyChanged && !inputsChanged && !outputsChanged) {
			isEditingPhase = false;
			return;
		}

		isSavingPhase = true;

		try {
			const updateData: any = {};
			
			if (bodyChanged) updateData.body = editedPhaseBody;
			if (inputsChanged) updateData.requiredInputs = JSON.stringify(requiredInputs);
			if (outputsChanged) updateData.expectedOutputs = JSON.stringify(expectedOutputs);

			const response = await fetch(`/api/phases?id=${selectedPhase.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				alert(`Failed to update phase: ${errorData.error || `HTTP ${response.status}`}`);
				return;
			}

			const updatedPhase = await response.json();
			
			// Update the local phase data by dispatching an event
			selectedPhase = { ...selectedPhase, ...updatedPhase };
			
			// ContentPollingService will automatically pick up the updated phase
			isEditingPhase = false;
			
		} catch (error) {
			console.error('Failed to save phase content:', error);
			alert(`Error saving phase: ${error.message}`);
		} finally {
			isSavingPhase = false;
		}
	}

	// Document management handlers
	function updateRequiredInputs(newInputs: string[]) {
		requiredInputs = newInputs;
	}

	function updateExpectedOutputs(newOutputs: string[]) {
		expectedOutputs = newOutputs;
	}

	// Send reminder to phase assignee
	async function sendDocumentReminder() {
		if (!selectedPhase || !selectedProject || isSendingReminder) return;
		
		// Check if phase has expected outputs to remind about
		if (!expectedOutputs || expectedOutputs.length === 0) {
			alert('This phase has no expected output documents to remind about.');
			return;
		}

		isSendingReminder = true;

		try {
			// Create the message content
			const documentList = expectedOutputs
				.map(slug => `• ${slug}: /docs/${slug}.md`)
				.join('\n');

			const messageBody = `Human director is asking you to please produce the documents of your active phase:

${documentList}

Phase: "${selectedPhase.title}"

Thank you for your attention to this matter.`;

			// Send the message via the messages API
			const response = await fetch('/api/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					projectId: selectedProject.id,
					authorAgentId: 'human-director',
					title: `Document Reminder: ${selectedPhase.title}`,
					body: messageBody,
					channelId: null, // null for DM
					assignTo: [
						{
							type: 'role',
							target: selectedPhase.assignedToRoleType
						}
					]
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				alert(`Failed to send reminder: ${errorData.error || `HTTP ${response.status}`}`);
				return;
			}

			// Success feedback
			alert(`Reminder sent successfully to ${selectedPhase.assignedToRoleType} role!`);

		} catch (error) {
			console.error('Failed to send reminder:', error);
			alert(`Error sending reminder: ${error.message}`);
		} finally {
			isSendingReminder = false;
		}
	}
</script>

{#if selectedPhase?.body || isEditingPhase}
	<div class="phase-content-section">
		<div class="phase-content-header">
			<h3>Phase Description</h3>
			{#if !isEditingPhase}
				<button class="edit-phase-btn" on:click={startEditingPhase} title="Edit phase content">
					✏️ Edit
				</button>
			{/if}
		</div>
		
		{#if isEditingPhase}
			<div class="phase-editor">
				<textarea 
					bind:value={editedPhaseBody}
					class="phase-body-editor"
					placeholder="Enter phase description..."
					rows="10"
				></textarea>
				<div class="editor-buttons">
					<button 
						class="save-btn" 
						on:click={savePhaseContent}
						disabled={isSavingPhase}
					>
						{isSavingPhase ? 'Saving...' : 'Save Changes'}
					</button>
					<button 
						class="cancel-btn" 
						on:click={cancelEditingPhase}
						disabled={isSavingPhase}
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<div class="phase-body">
				{selectedPhase.body || 'No description provided.'}
			</div>
		{/if}
	</div>
{/if}

<!-- Document Reminder Button - Show when not editing and has expected outputs -->
{#if !isEditingPhase && expectedOutputs.length > 0 && selectedPhase?.assignedToRoleType}
	<div class="reminder-section">
		<button 
			class="reminder-btn" 
			on:click={sendDocumentReminder}
			disabled={isSendingReminder}
			title="Send gentle reminder to {selectedPhase.assignedToRoleType} to produce expected documents"
		>
			{#if isSendingReminder}
				Sending...
			{:else}
				📝 Send Document Reminder
			{/if}
		</button>
	</div>
{/if}

<!-- Document Management Section - Only show in edit mode -->
{#if isEditingPhase}
	<PhaseDocumentManager 
		bind:documentSlugs={requiredInputs}
		label="Required Input Documents"
		{selectedProject}
		onUpdate={updateRequiredInputs}
	/>
	
	<PhaseDocumentManager 
		bind:documentSlugs={expectedOutputs}
		label="Expected Output Documents"
		{selectedProject}
		onUpdate={updateExpectedOutputs}
	/>
{/if}

<style>
	.phase-content-section {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.phase-content-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.phase-content-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.edit-phase-btn {
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 6px 12px;
		cursor: pointer;
		font-size: 0.875rem;
		color: #374151;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.edit-phase-btn:hover {
		background: #e5e7eb;
		border-color: #9ca3af;
	}

	.phase-editor {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.phase-body-editor {
		width: 100%;
		min-height: 200px;
		padding: 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-family: inherit;
		font-size: 1rem;
		line-height: 1.6;
		resize: vertical;
		transition: border-color 0.2s ease;
	}

	.phase-body-editor:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.editor-buttons {
		display: flex;
		gap: 8px;
		justify-content: flex-start;
	}

	.save-btn {
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 6px;
		padding: 8px 16px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.save-btn:hover:not(:disabled) {
		background: #2563eb;
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.cancel-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 8px 16px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.cancel-btn:hover:not(:disabled) {
		background: #e5e7eb;
		border-color: #9ca3af;
	}

	.cancel-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.phase-body {
		font-size: 1rem;
		line-height: 1.6;
		color: #374151;
		white-space: pre-wrap;
	}

	/* Reminder button styles */
	.reminder-section {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.reminder-btn {
		background: #f59e0b;
		color: white;
		border: none;
		border-radius: 6px;
		padding: 10px 16px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 6px;
		box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
	}

	.reminder-btn:hover:not(:disabled) {
		background: #d97706;
		box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3);
		transform: translateY(-1px);
	}

	.reminder-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
		box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
	}

</style>