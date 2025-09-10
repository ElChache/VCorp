<script>
	import CommunicationsSection from './CommunicationsSection.svelte';
	import PhasesSection from './PhasesSection.svelte';
	import RolesSection from './RolesSection.svelte';
	import AgentsSection from './AgentsSection.svelte';
	import ChannelsSection from './ChannelsSection.svelte';

	// All the props this component needs
	export let selectedProject = null;
	export let currentSection = 'overview';
	export let monitoringStatus = {};
	export let roles = [];
	export let agents = [];
	export let channels = [];
	export let squads = [];
	export let scheduledReminders = [];
	export let phasesByRole = {};
	export let commsViewMode = 'dashboard';
	export let allMessages = [];
	export let directorActivity = {};
	export let selectedMessage = null;
	export let showReplyDialog = false;
	export let replyToMessageId = null;
	export let showCreatePhaseDialog = false;
	export let formatTimeAgo;
	export let getMessageIcon;

	// Roles section props
	export let selectedRole = null;
	export let rolePrompts = [];
	export let roleFinalPrompt = '';
	export let loadRolePrompts = () => {};
	export let openAddPromptToRoleDialog = () => {};
	export let handleDragStart = () => {};
	export let handleDragOver = () => {};
	export let handleDrop = () => {};
	export let removePromptFromRole = () => {};
	export let draggedIndex = null;

	// Agents section props
	export let selectedAgent = null;
	export let selectedRoleType = '';
	export let selectedModel = 'sonnet';
	export let launchAgent = () => {};
	export let killAgent = () => {};
	export let onAgentSelect = () => {};
	export let showStartupPromptEditor = false;
	export let loadStartupPrompt = () => {};
</script>

<div class="main-content">
	{#if selectedProject}
		{#if currentSection === 'overview'}
			<div class="overview-section">
				<h2>Project Overview: {selectedProject.name}</h2>
				<div class="overview-grid">
					<div class="overview-card">
						<h3>📊 Project Stats</h3>
						<p><strong>Roles:</strong> {roles.length}</p>
						<p><strong>Agents:</strong> {agents.length}</p>
						<p><strong>Channels:</strong> {channels.length}</p>
					</div>
					<div class="overview-card">
						<h3>🏃‍♂️ System Status</h3>
						{#if monitoringStatus.isRunning}
							<p class="status-running">✅ Monitoring Active</p>
						{:else}
							<p class="status-stopped">⏹️ Monitoring Stopped</p>
						{/if}
					</div>
				</div>
			</div>

		{:else if currentSection === 'roles'}
			<RolesSection 
				{roles}
				bind:selectedRole
				{rolePrompts}
				{roleFinalPrompt}
				{loadRolePrompts}
				{openAddPromptToRoleDialog}
				{handleDragStart}
				{handleDragOver}
				{handleDrop}
				{removePromptFromRole}
				{draggedIndex}
			/>

		{:else if currentSection === 'prompts'}
			<div class="section-placeholder">
				<h2>🎯 Prompts Management</h2>
				<p>Prompts management component can be created when needed</p>
			</div>

		{:else if currentSection === 'agents'}
			<AgentsSection 
				{roles}
				{agents}
				bind:selectedAgent
				bind:selectedRoleType
				bind:selectedModel
				{selectedProject}
				{launchAgent}
				{killAgent}
				{onAgentSelect}
				{showStartupPromptEditor}
				{loadStartupPrompt}
			/>

		{:else if currentSection === 'channels'}
			<ChannelsSection 
				{channels}
				{selectedProject}
			/>

		{:else if currentSection === 'squads'}
			<div class="section-placeholder">
				<h2>Squads Management</h2>
				<p>Squads section would go here - can be componentized later</p>
				<p>Found {squads.length} squads</p>
			</div>

		{:else if currentSection === 'scheduled-reminders'}
			<div class="section-placeholder">
				<h2>Scheduled Reminders</h2>
				<p>Scheduled reminders section would go here - can be componentized later</p>
				<p>Found {scheduledReminders.length} reminders</p>
			</div>

		{:else if currentSection === 'documents'}
			<div class="section-placeholder">
				<h2>Documents</h2>
				<p>Documents section would go here - can be componentized later</p>
			</div>

		{:else if currentSection === 'communications'}
			<CommunicationsSection 
				{selectedProject}
				bind:commsViewMode
				{channels}
				{allMessages}
				{directorActivity}
				bind:selectedMessage 
				bind:showReplyDialog 
				bind:replyToMessageId 
				{formatTimeAgo}
				{getMessageIcon}
			/>

		{:else if currentSection === 'phases'}
			<PhasesSection 
				{phasesByRole}
				bind:showCreatePhaseDialog
				{formatTimeAgo}
			/>
		{/if}
	{:else}
		<div class="no-project">
			<h2>Welcome to VCorp</h2>
			<p>Select a project to get started, or create a new one.</p>
		</div>
	{/if}
</div>

<style>
	.main-content {
		flex: 1;
		overflow-y: auto;
		background: white;
	}

	.overview-section {
		padding: 20px;
	}

	.overview-section h2 {
		margin: 0 0 24px 0;
		color: #111827;
		font-size: 24px;
		font-weight: 700;
	}

	.overview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 20px;
	}

	.overview-card {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 20px;
	}

	.overview-card h3 {
		margin: 0 0 16px 0;
		color: #374151;
		font-size: 18px;
		font-weight: 600;
	}

	.overview-card p {
		margin: 8px 0;
		color: #6b7280;
	}

	.status-running {
		color: #059669 !important;
		font-weight: 500;
	}

	.status-stopped {
		color: #dc2626 !important;
		font-weight: 500;
	}

	.section-placeholder {
		padding: 40px;
		text-align: center;
		color: #6b7280;
	}

	.section-placeholder h2 {
		margin: 0 0 16px 0;
		color: #374151;
		font-size: 24px;
		font-weight: 600;
	}

	.section-placeholder p {
		margin: 8px 0;
		font-size: 16px;
	}

	.no-project {
		padding: 80px 40px;
		text-align: center;
		color: #6b7280;
	}

	.no-project h2 {
		margin: 0 0 16px 0;
		color: #374151;
		font-size: 32px;
		font-weight: 700;
	}

	.no-project p {
		font-size: 18px;
		margin: 0;
	}
</style>