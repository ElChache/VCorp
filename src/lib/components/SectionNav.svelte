<script>
	export let selectedProject = null;
	export let currentSection = 'overview';
	export let loadRoles = () => {};
	export let loadAgents = () => {};
	export let loadChannels = () => {};
	export let loadSquads = () => {};
	export let loadScheduledReminders = () => {};
	export let loadPhases = () => {};

	function handleSectionChange(section) {
		currentSection = section;
		
		// Load data based on section
		switch(section) {
			case 'roles':
			case 'agents':
				loadRoles();
				if (section === 'agents') loadAgents();
				break;
			case 'channels':
				loadChannels();
				break;
			case 'squads':
				loadSquads();
				break;
			case 'scheduled-reminders':
				loadScheduledReminders();
				break;
			case 'phases':
				loadPhases();
				break;
		}
	}
</script>

{#if selectedProject}
	<div class="section-nav">
		<button 
			class="nav-btn" 
			class:active={currentSection === 'overview'}
			on:click={() => handleSectionChange('overview')}
		>
			Overview
		</button>
		<button 
			class="nav-btn" 
			class:active={currentSection === 'roles'}
			on:click={() => handleSectionChange('roles')}
		>
			Roles
		</button>
		<button 
			class="nav-btn" 
			class:active={currentSection === 'prompts'}
			on:click={() => handleSectionChange('prompts')}
		>
			Prompts
		</button>
		<button 
			class="nav-btn" 
			class:active={currentSection === 'agents'}
			on:click={() => handleSectionChange('agents')}
		>
			Agents
		</button>
		<button 
			class="nav-btn" 
			class:active={currentSection === 'channels'}
			on:click={() => handleSectionChange('channels')}
		>
			Channels
		</button>
		<button 
			class="nav-btn" 
			class:active={currentSection === 'squads'}
			on:click={() => handleSectionChange('squads')}
		>
			Squads
		</button>
		<button 
			class="nav-btn" 
			class:active={currentSection === 'scheduled-reminders'}
			on:click={() => handleSectionChange('scheduled-reminders')}
		>
			⏰ Scheduled Reminders
		</button>
		<button 
			class="nav-btn" 
			class:active={currentSection === 'documents'}
			on:click={() => handleSectionChange('documents')}
		>
			📄 Documents
		</button>
		<button 
			class="nav-btn" 
			class:active={currentSection === 'communications'}
			on:click={() => handleSectionChange('communications')}
		>
			💬 Communications
		</button>
		<button 
			class="nav-btn" 
			class:active={currentSection === 'phases'}
			on:click={() => handleSectionChange('phases')}
		>
			Phases
		</button>
	</div>
{/if}

<style>
	.section-nav {
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
		padding: 0 20px;
		display: flex;
		gap: 0;
		overflow-x: auto;
	}

	.nav-btn {
		background: none;
		border: none;
		padding: 12px 16px;
		cursor: pointer;
		color: #64748b;
		font-weight: 500;
		border-bottom: 2px solid transparent;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.nav-btn:hover {
		color: #475569;
		background: #f1f5f9;
	}

	.nav-btn.active {
		color: #3b82f6;
		border-bottom-color: #3b82f6;
		background: white;
	}
</style>