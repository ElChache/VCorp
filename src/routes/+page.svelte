<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OverviewSection from '$lib/components/OverviewSection.svelte';
	import RolesSection from '$lib/components/RolesSection.svelte';
	import PromptsSection from '$lib/components/PromptsSection.svelte';
	import AgentsSection from '$lib/components/AgentsSection.svelte';
	import ChannelsSection from '$lib/components/ChannelsSection.svelte';
	import SquadsSection from '$lib/components/SquadsSection.svelte';
	import PhasesSection from '$lib/components/PhasesSection.svelte';
	import ScheduledRemindersSection from '$lib/components/ScheduledRemindersSection.svelte';
	import TicketsSection from '$lib/components/TicketsSection.svelte';
	import DocumentsSection from '$lib/components/DocumentsSection.svelte';
	import CommunicationsSection from '$lib/components/CommunicationsSection.svelte';
	import { contentPollingStore } from '$lib/services/ContentPollingService';
	
	let projects: any[] = [];
	let selectedProject: any = null;
	let showCreateDialog = false;
	let showDeleteDialog = false;
	let showEditDialog = false;
	let newProject = { name: '', description: '', path: '' };
	let editProject = { name: '', description: '', path: '' };
	let deleteProjectName = '';
	let currentSection = 'overview'; // 'overview', 'roles', 'prompts', 'documents', 'scheduled-reminders'
	let channels: any[] = [];
	let selectedChannel: any = null;
	let prompts: any[] = [];
	let promptsByType: Record<string, any[]> = {};
	
	// Scheduled Reminders variables
	let scheduledReminders: any[] = [];
	let showCreateReminderDialog = false;
	let showEditReminderDialog = false;
	
	
	

	// Phases variables
	let phases: any[] = [];
	let phasesByRole: Record<string, any[]> = {};
	let showCreatePhaseDialog = false;


	// Squad data (needed for document assignments and other integrations)
	let squads: any[] = [];

	// Monitoring variables
	let monitoringStatus: any = { isRunning: false, stats: null };

	// Communications Center unread count
	$: pollingState = $contentPollingStore;
	$: totalUnreadCount = calculateTotalUnreadCount(pollingState.updates);
	$: documentsUnreadCount = calculateDocumentsUnreadCount(pollingState.updates);

	function calculateTotalUnreadCount(updates: any): number {
		if (!updates) return 0;

		// Helper function to check if a message is unread by human director
		function isUnreadByHumanDirector(message: any): boolean {
			if (!message.readingAssignments) return false;
			
			return message.readingAssignments.some((assignment: any) => {
				// Check if this assignment is for human-director
				const isForHumanDirector = (assignment.assignedToType === 'agent' && assignment.assignedTo === 'human-director') ||
				                          (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director');
				
				if (!isForHumanDirector) return false;
				
				// Check if human-director has read this assignment
				const hasRead = assignment.readBy.some((read: any) => read.agentId === 'human-director');
				return !hasRead;
			});
		}

		// Count unread channel messages + unread direct messages (type "message" or "reply")
		const channelUnread = updates.channelMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isUnreadByHumanDirector(msg)
		).length || 0;

		const dmUnread = updates.directMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isUnreadByHumanDirector(msg)
		).length || 0;

		// Count unread documents
		const documentsUnread = updates.documents?.filter((doc: any) => 
			isUnreadByHumanDirector(doc)
		).length || 0;

		return channelUnread + dmUnread + documentsUnread;
	}

	function calculateDocumentsUnreadCount(updates: any): number {
		if (!updates) return 0;

		// Helper function to check if a document is unread by human director
		function isUnreadByHumanDirector(document: any): boolean {
			if (!document.readingAssignments) return false;
			
			return document.readingAssignments.some((assignment: any) => {
				// Check if this assignment is for human-director
				const isForHumanDirector = (assignment.assignedToType === 'agent' && assignment.assignedTo === 'human-director') ||
				                          (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director');
				
				if (!isForHumanDirector) return false;
				
				// Check if human-director has read this assignment
				const hasRead = assignment.readBy.some((read: any) => read.agentId === 'human-director');
				return !hasRead;
			});
		}

		// Count only unread documents
		return updates.documents?.filter((doc: any) => isUnreadByHumanDirector(doc)).length || 0;
	}

	onMount(async () => {
		await loadProjects();
		await loadPhases();
		
		// Add global debug functions for testing
		(window as any).debugChannels = () => {
			console.log('Current channels:', channels);
			console.log('Selected channel:', selectedChannel);
		};
	});

	onDestroy(() => {
		// Cleanup handled by individual components
	});

	async function loadProjects() {
		try {
			const response = await fetch('/api/projects');
			if (response.ok) {
				projects = await response.json();
				if (projects.length > 0 && !selectedProject) {
					selectedProject = projects[0];
				}
			}
		} catch (error) {
			console.error('Failed to load projects:', error);
		}
	}












	async function onProjectChange() {
		await loadPhases();
		currentSection = 'overview';
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
				
				// Group phases by role
				phasesByRole = {};
				for (const phase of phases) {
					if (!phasesByRole[phase.assignedToRoleType]) {
						phasesByRole[phase.assignedToRoleType] = [];
					}
					phasesByRole[phase.assignedToRoleType].push(phase);
				}
			}
		} catch (error) {
			console.error('Failed to load phases:', error);
			phases = [];
			phasesByRole = {};
		}
	}



	async function createProject() {
		if (!newProject.name.trim()) return;
		
		try {
			const response = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newProject)
			});
			
			if (response.ok) {
				const project = await response.json();
				projects = [...projects, project];
				selectedProject = project;
				showCreateDialog = false;
				newProject = { name: '', description: '', path: '' };
			}
		} catch (error) {
			console.error('Failed to create project:', error);
		}
	}

	function openCreateDialog() {
		showCreateDialog = true;
	}

	function closeCreateDialog() {
		showCreateDialog = false;
		newProject = { name: '', description: '' };
	}

	function openDeleteDialog() {
		if (!selectedProject) return;
		showDeleteDialog = true;
		deleteProjectName = '';
	}

	function closeDeleteDialog() {
		showDeleteDialog = false;
		deleteProjectName = '';
	}

	function openEditDialog() {
		if (selectedProject) {
			editProject = { 
				name: selectedProject.name, 
				description: selectedProject.description || '', 
				path: selectedProject.path || '' 
			};
			showEditDialog = true;
		}
	}

	function closeEditDialog() {
		showEditDialog = false;
		editProject = { name: '', description: '', path: '' };
	}

	async function updateProject() {
		if (!editProject.name.trim() || !selectedProject) return;
		
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editProject)
			});
			
			if (response.ok) {
				const updatedProject = await response.json();
				// Update the project in the local list
				const index = projects.findIndex(p => p.id === selectedProject.id);
				if (index !== -1) {
					projects[index] = updatedProject;
					selectedProject = updatedProject;
				}
				showEditDialog = false;
				editProject = { name: '', description: '', path: '' };
			}
		} catch (error) {
			console.error('Failed to update project:', error);
		}
	}

	async function deleteProject() {
		if (!selectedProject || deleteProjectName !== selectedProject.name) {
			return; // Name doesn't match, do nothing
		}

		try {
			const response = await fetch(`/api/projects/${selectedProject.id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				projects = projects.filter(p => p.id !== selectedProject.id);
				selectedProject = projects.length > 0 ? projects[0] : null;
				closeDeleteDialog();
				// Refresh data for the newly selected project
				if (selectedProject) {
					// Data refreshed by individual components
					}
			} else {
				const errorData = await response.json();
				console.error('Failed to delete project:', errorData);
				alert(`Failed to delete project: ${errorData.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Failed to delete project:', error);
			alert(`Failed to delete project: ${error.message}`);
		}
	}









	// Prompt management functions



	
	
















</script>

<div class="app">
	<div class="top-bar">
		<div class="project-controls">
			<select bind:value={selectedProject} on:change={onProjectChange} class="project-selector">
				{#if projects.length === 0}
					<option value={null}>No projects</option>
				{:else}
					{#each projects as project}
						<option value={project}>{project.name}</option>
					{/each}
				{/if}
			</select>
			
			<button class="create-btn" on:click={openCreateDialog}>
				+ Create Project
			</button>
			
			{#if selectedProject}
				<button class="edit-btn" on:click={openEditDialog}>
					✏️ Edit Project
				</button>
				<button class="delete-btn" on:click={openDeleteDialog}>
					🗑️ Delete Project
				</button>
			{/if}
		</div>

		{#if selectedProject}
			<div class="section-nav">
				<button 
					class="nav-btn" 
					class:active={currentSection === 'overview'}
					on:click={() => currentSection = 'overview'}
				>
					Overview
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'roles'}
					on:click={() => currentSection = 'roles'}
				>
					Roles
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'prompts'}
					on:click={() => currentSection = 'prompts'}
				>
					Prompts
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'agents'}
					on:click={() => { currentSection = 'agents'; }}
				>
					Agents
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'channels'}
					on:click={() => { currentSection = 'channels'; }}
				>
					Channels
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'squads'}
					on:click={() => currentSection = 'squads'}
				>
					Squads
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'phases'}
					on:click={() => { currentSection = 'phases'; loadPhases(); }}
				>
					Phases
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'scheduled-reminders'}
					on:click={() => { currentSection = 'scheduled-reminders'; }}
				>
					⏰ Scheduled Reminders
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'tickets'}
					on:click={() => currentSection = 'tickets'}
				>
					🎫 Tickets
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'documents'}
					on:click={() => { currentSection = 'documents'; }}
				>
					📄 Documents
					{#if documentsUnreadCount > 0}
						<span class="unread-badge">{documentsUnreadCount}</span>
					{/if}
				</button>
				<button 
					class="nav-btn director-btn nav-btn-with-badge" 
					class:active={currentSection === 'communications'}
					on:click={() => { currentSection = 'communications'; }}
				>
					<span class="btn-content">
						📬 Communications Center
						{#if totalUnreadCount > 0}
							<span class="unread-badge">{totalUnreadCount}</span>
						{/if}
					</span>
				</button>
			</div>
		{/if}
	</div>

	<div class="main-content">
		{#if selectedProject}
			{#if currentSection === 'overview'}
				<OverviewSection {selectedProject} bind:monitoringStatus />
			{:else if currentSection === 'roles'}
				<RolesSection {selectedProject} />
			{:else if currentSection === 'prompts'}
				<PromptsSection {selectedProject} bind:prompts bind:promptsByType />
			{:else if currentSection === 'agents'}
				<AgentsSection {selectedProject} />
			{:else if currentSection === 'channels'}
				<ChannelsSection
					{selectedProject}
					bind:channels
					bind:selectedChannel
				/>
			{:else if currentSection === 'squads'}
				<SquadsSection
					{selectedProject}
					bind:squads
				/>
			{:else if currentSection === 'scheduled-reminders'}
				<ScheduledRemindersSection {selectedProject} bind:scheduledReminders bind:showCreateReminderDialog bind:showEditReminderDialog />

			{:else if currentSection === 'tickets'}
				<TicketsSection {selectedProject} />

		{:else if currentSection === 'documents'}
			<DocumentsSection {selectedProject} />

		{:else if currentSection === 'communications'}
			<CommunicationsSection {selectedProject} />
			{:else if currentSection === 'phases'}
				<PhasesSection {selectedProject} bind:phases bind:phasesByRole bind:showCreatePhaseDialog />
			{/if}
		{:else}
			<p>Select or create a project to get started</p>
		{/if}
	</div>
</div>

{#if showCreateDialog}
	<div class="dialog-overlay" on:click={closeCreateDialog}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Create New Project</h3>
			
			<div class="form-group">
				<label for="name">Name:</label>
				<input 
					id="name"
					type="text" 
					bind:value={newProject.name} 
					placeholder="Enter project name"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="description">Description:</label>
				<textarea 
					id="description"
					bind:value={newProject.description} 
					placeholder="Project description or prompt"
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="path">Project Path:</label>
				<input 
					id="path"
					type="text" 
					bind:value={newProject.path} 
					placeholder="Enter project path (e.g., /Users/username/Projects/myproject)"
				/>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeCreateDialog}>Cancel</button>
				<button class="create-btn" on:click={createProject} disabled={!newProject.name.trim() || !newProject.path.trim()}>
					Create
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteDialog}
	<div class="dialog-overlay" on:click={closeDeleteDialog}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Delete Project</h3>
			<p>This action cannot be undone. To confirm, type the project name: <strong>{selectedProject?.name}</strong></p>
			
			<div class="form-group">
				<label for="delete-name">Project name:</label>
				<input 
					id="delete-name"
					type="text" 
					bind:value={deleteProjectName} 
					placeholder="Type project name to confirm"
					autofocus
				/>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeDeleteDialog}>Cancel</button>
				<button 
					class="delete-confirm-btn" 
					on:click={deleteProject} 
					disabled={deleteProjectName !== selectedProject?.name}
				>
					Delete Project
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showEditDialog}
	<div class="dialog-overlay" on:click={closeEditDialog}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Edit Project</h3>
			
			<div class="form-group">
				<label for="edit-name">Name:</label>
				<input 
					id="edit-name"
					type="text" 
					bind:value={editProject.name} 
					placeholder="Enter project name"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="edit-description">Description:</label>
				<textarea 
					id="edit-description"
					bind:value={editProject.description} 
					placeholder="Project description or prompt"
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="edit-path">Project Path:</label>
				<input 
					id="edit-path"
					type="text" 
					bind:value={editProject.path} 
					placeholder="Enter project path (e.g., /Users/username/Projects/myproject)"
				/>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeEditDialog}>Cancel</button>
				<button class="create-btn" on:click={updateProject} disabled={!editProject.name.trim() || !editProject.path.trim()}>
					Update
				</button>
			</div>
		</div>
	</div>
{/if}













<style>
	.app {
		height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.top-bar {
		padding: 12px 16px;
		border-bottom: 1px solid #e5e5e5;
		background: #f9f9f9;
	}

	.project-controls {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.project-selector {
		padding: 6px 12px;
		border: 1px solid #ccc;
		border-radius: 4px;
		min-width: 180px;
	}

	.create-btn {
		padding: 6px 12px;
		background: #007acc;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.create-btn:hover {
		background: #005a9e;
	}

	.create-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.main-content {
		flex: 1;
		padding: 24px;
	}

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
		width: 400px;
		max-width: 90vw;
	}

	.dialog h3 {
		margin: 0 0 16px 0;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 4px;
		font-weight: 500;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 14px;
	}

	.dialog-buttons {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 20px;
	}

	.cancel-btn {
		padding: 8px 16px;
		background: #f5f5f5;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
	}

	.cancel-btn:hover {
		background: #e5e5e5;
	}

	.edit-btn {
		padding: 6px 12px;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	.edit-btn:hover {
		background: #0056b3;
	}

	.delete-btn {
		padding: 6px 12px;
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	.delete-btn:hover {
		background: #f1aeb5;
		border-color: #e99ca2;
	}

	.delete-confirm-btn {
		padding: 8px 16px;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.delete-confirm-btn:hover:not(:disabled) {
		background: #c82333;
	}

	.delete-confirm-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.section-nav {
		display: flex;
		gap: 4px;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid #e5e5e5;
	}

	.nav-btn {
		padding: 8px 16px;
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.nav-btn:hover {
		background: #e5e5e5;
	}

	.nav-btn.active {
		background: #007acc;
		color: white;
		border-color: #007acc;
	}

	.nav-btn-with-badge {
		position: relative;
	}

	.btn-content {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.unread-badge {
		background: #ef4444;
		color: white;
		border-radius: 10px;
		padding: 2px 6px;
		font-size: 11px;
		font-weight: 700;
		min-width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: pulse-badge 2s infinite;
	}

	@keyframes pulse-badge {
		0% { transform: scale(1); }
		50% { transform: scale(1.1); }
		100% { transform: scale(1); }
	}





































	
	
	
	
	
	
	
	
	
	
	
	
	
	

	
	
	
	
	
	
	
	
	








	

	/* Director Button Styling */
	.director-btn {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		font-weight: 600;
	}

	.director-btn:hover {
		background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
	}

	.director-btn.active {
		background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}






















</style>
