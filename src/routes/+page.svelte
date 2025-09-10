<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	
	let projects: any[] = [];
	let selectedProject: any = null;
	let showCreateDialog = false;
	let showDeleteDialog = false;
	let showEditDialog = false;
	let newProject = { name: '', description: '', path: '' };
	let editProject = { name: '', description: '', path: '' };
	let deleteProjectName = '';
	let currentSection = 'overview'; // 'overview', 'roles', 'prompts', 'documents', 'scheduled-reminders'
	let roles: any[] = [];
	let selectedRole: any = null;
	let rolePrompts: any[] = [];
	let roleChannels: any = null;
	let roleFinalPrompt: string = '';
	let draggedIndex: number | null = null;
	let agents: any[] = [];
	let selectedAgent: any = null;
	let agentOutput: string = '';
	let agentRefreshInterval: NodeJS.Timeout | null = null;
	let selectedRoleType: string = '';
	let selectedModel: string = 'sonnet';
	let showStartupPromptEditor = false;
	let startupPrompt: string = '';
	let channels: any[] = [];
	let selectedChannel: any = null;
	let showCreateChannelDialog = false;
	let showEditChannelDialog = false;
	let newChannel = { name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	let editChannel = { id: '', name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	let channelRoles: any = null;
	let channelViewMode: 'messages' | 'settings' = 'messages'; // Default to messages view
	let channelMessages: any[] = [];
	let prompts: any[] = [];
	let promptsByType: Record<string, any[]> = {};
	
	// Scheduled Reminders variables
	let scheduledReminders: any[] = [];
	let showCreateReminderDialog = false;
	let showEditReminderDialog = false;
	let newReminder = { name: '', targetRoleType: '', message: '', frequencyMinutes: 15, isActive: true };
	let editReminder = { id: 0, name: '', targetRoleType: '', message: '', frequencyMinutes: 15, isActive: true };
	let showCreatePromptDialog = false;
	let showEditPromptDialog = false;
	let showAddPromptToRoleDialog = false;
	let availablePromptsForRole: any[] = [];
	let showUpdateTemplateDialog = false;
	let selectedPromptForTemplate: any = null;
	let newPrompt = { name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };
	let editPrompt = { id: 0, name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };
	
	// Communications Center variables
	let directorInbox: any = { messages: [], categorized: { urgent: [], regular: [], read: [] }, stats: {}, summary: {} };
	let directorActivity: any = { recentActivity: [], agentStats: [], channelStats: [], summary: {} };
	let commsViewMode: 'urgent' | 'dashboard' | 'messages' | 'documents' | 'assistant' = 'urgent';
	let selectedMessage: any = null;
	let showReplyDialog = false;
	let replyContent = '';
	let replyToMessageId: number | null = null;
	
	// Documents section variables
	let documents: any[] = [];
	let selectedDocument: any = null;
	let documentReplies: any[] = [];
	let showCreateDocumentDialog = false;
	let showReplyToDocumentDialog = false;
	let newDocument = { 
		title: '', 
		body: '', 
		type: 'document', 
		documentSlug: '', 
		authorAgentId: '', 
		squadId: '',
		readingAssignments: [] 
	};
	let documentReplyContent = '';
	let replyToContentId: number | null = null;
	let documentReadingAssignments: Array<{
		assignedToType: 'role' | 'agent' | 'squad';
		assignedTo: string;
	}> = [];
	
	// Send Message variables
	let showSendMessageDialog = false;
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
	
	// All Messages variables
	let allMessages: any[] = [];
	let allMessagesSummary: any = {};
	
	// Assistant variables
	let assistantMessages: any[] = [];
	let assistantMessageContent = '';
	let assistantForwardingEnabled = false;

	// Phases variables
	let phases: any[] = [];
	let phasesByRole: Record<string, any[]> = {};
	let showCreatePhaseDialog = false;
	let newPhase = { 
		roleType: 'backend_developer', 
		title: '', 
		body: '', 
		requiredInputs: '', 
		expectedOutputs: '' 
	};

	// Squads variables
	let squads: any[] = [];
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

	// Monitoring variables
	let monitoringStatus: any = { isRunning: false, stats: null };

	onMount(async () => {
		await loadProjects();
		await loadPhases();
		await refreshMonitoringStatus();
		
		// Add global debug functions for testing
		(window as any).debugChannels = () => {
			console.log('Current channels:', channels);
			console.log('Selected channel:', selectedChannel);
			console.log('Channel roles:', channelRoles);
		};
		(window as any).testChannelSelect = (channelIndex: number) => {
			if (channels[channelIndex]) {
				console.log('Testing channel selection for index:', channelIndex);
				onChannelSelect(channels[channelIndex]);
			} else {
				console.log('No channel at index:', channelIndex);
			}
		};
	});

	onDestroy(() => {
		if (agentRefreshInterval) {
			clearInterval(agentRefreshInterval);
		}
	});

	async function loadProjects() {
		try {
			const response = await fetch('/api/projects');
			if (response.ok) {
				projects = await response.json();
				if (projects.length > 0 && !selectedProject) {
					selectedProject = projects[0];
					await loadRoles();
				}
			}
		} catch (error) {
			console.error('Failed to load projects:', error);
		}
	}

	async function loadRoles() {
		if (!selectedProject) {
			roles = [];
			return;
		}
		
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/roles`);
			if (response.ok) {
				roles = await response.json();
				selectedRole = roles.length > 0 ? roles[0] : null;
				// Set default selectedRoleType for agents section if not already set
				if (roles.length > 0 && !selectedRoleType) {
					selectedRoleType = roles[0].name;
				}
				if (selectedRole) {
					await loadRolePrompts();
				}
			}
		} catch (error) {
			console.error('Failed to load roles:', error);
			roles = [];
		}
	}

	async function loadRolePrompts() {
		if (!selectedRole) {
			rolePrompts = [];
			roleChannels = null;
			roleFinalPrompt = '';
			return;
		}
		
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/prompts`);
			if (response.ok) {
				rolePrompts = await response.json();
			}
		} catch (error) {
			console.error('Failed to load role prompts:', error);
			rolePrompts = [];
		}
		
		// Load the final combined prompt
		await loadRoleFinalPrompt();
		
		// Also load role channels
		await loadRoleChannels();
	}

	async function loadRoleFinalPrompt() {
		if (!selectedRole) {
			roleFinalPrompt = '';
			return;
		}
		
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/final-prompt`);
			if (response.ok) {
				const data = await response.json();
				roleFinalPrompt = data.finalPrompt;
			}
		} catch (error) {
			console.error('Failed to load final prompt:', error);
			roleFinalPrompt = 'Error loading final prompt';
		}
	}

	async function loadRoleChannels() {
		if (!selectedRole) {
			roleChannels = null;
			return;
		}
		
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/channels`);
			if (response.ok) {
				roleChannels = await response.json();
			}
		} catch (error) {
			console.error('Failed to load role channels:', error);
			roleChannels = null;
		}
	}

	async function addChannelToRole(channelId: number) {
		if (!selectedRole) return;
		
		try {
			const response = await fetch(`/api/channels/${channelId}/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roleId: selectedRole.id.toString() })
			});
			if (response.ok) {
				await loadRoleChannels(); // Refresh the channel assignments
			}
		} catch (error) {
			console.error('Failed to add channel to role:', error);
		}
	}

	async function removeChannelFromRole(assignmentId: number) {
		if (!selectedRole) return;
		
		try {
			// We need to find the channel ID from the assignment
			const assignedChannel = roleChannels?.assignedChannels?.find(c => c.assignmentId === assignmentId);
			if (!assignedChannel) return;
			
			const response = await fetch(`/api/channels/${assignedChannel.channelId}/roles/${assignmentId}`, {
				method: 'DELETE'
			});
			if (response.ok) {
				await loadRoleChannels(); // Refresh the channel assignments
			}
		} catch (error) {
			console.error('Failed to remove channel from role:', error);
		}
	}

	async function refreshSelectedRoleContent() {
		if (!selectedRole) return;
		
		const currentRoleId = selectedRole.id;
		
		try {
			// Reload all roles to get updated content
			const response = await fetch(`/api/projects/${selectedProject.id}/roles`);
			if (response.ok) {
				roles = await response.json();
				// Find and restore the previously selected role
				selectedRole = roles.find(role => role.id === currentRoleId) || null;
			}
		} catch (error) {
			console.error('Failed to refresh role content:', error);
		}
	}

	// Prompt assignment functions
	async function openAddPromptToRoleDialog() {
		if (!selectedProject) return;
		
		try {
			// Load all available custom prompts that are not already assigned to this role
			const response = await fetch(`/api/prompts?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				
				// Filter out prompts that are already assigned to this role
				const currentPromptIds = rolePrompts.filter(p => p.source === 'role').map(p => p.id);
				availablePromptsForRole = data.prompts.filter(prompt => !currentPromptIds.includes(prompt.id));
				
				showAddPromptToRoleDialog = true;
			}
		} catch (error) {
			console.error('Failed to load available prompts:', error);
		}
	}

	async function assignPromptToRole(promptId: number) {
		if (!selectedRole || !promptId) return;
		
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/prompts/assign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ promptId })
			});
			
			if (response.ok) {
				await loadRolePrompts();
				await loadRoleFinalPrompt();
				showAddPromptToRoleDialog = false;
			} else {
				const error = await response.json();
				console.error('Failed to assign prompt to role:', error.error);
			}
		} catch (error) {
			console.error('Failed to assign prompt to role:', error);
		}
	}

	async function removePromptFromRole(promptId: number) {
		if (!selectedRole || !promptId) return;
		
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/prompts/unassign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ promptId })
			});
			
			if (response.ok) {
				await loadRolePrompts();
				await loadRoleFinalPrompt();
			} else {
				const error = await response.json();
				console.error('Failed to remove prompt from role:', error.error);
			}
		} catch (error) {
			console.error('Failed to remove prompt from role:', error);
		}
	}

	async function onRoleSelect(role: any) {
		selectedRole = role;
		await loadRolePrompts();
	}

	async function onProjectChange() {
		await loadRoles();
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
			} else {
				alert('Failed to delete reminder');
			}
		} catch (error) {
			console.error('Failed to delete reminder:', error);
			alert('Failed to delete reminder');
		}
	}

	async function createReminder() {
		if (!newReminder.name.trim() || !newReminder.targetRoleType || !newReminder.message.trim() || !selectedProject) return;
		
		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/scheduled-reminders`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(newReminder)
			});
			
			if (response.ok) {
				showCreateReminderDialog = false;
				newReminder = { name: '', targetRoleType: '', message: '', frequencyMinutes: 15, isActive: true };
				await loadScheduledReminders();
			} else {
				alert('Failed to create reminder');
			}
		} catch (error) {
			console.error('Failed to create reminder:', error);
			alert('Failed to create reminder');
		}
	}

	async function updateReminder() {
		if (!editReminder.name.trim() || !editReminder.targetRoleType || !editReminder.message.trim()) return;
		
		try {
			const response = await fetch(`/api/scheduled-reminders/${editReminder.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
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
			} else {
				alert('Failed to update reminder');
			}
		} catch (error) {
			console.error('Failed to update reminder:', error);
			alert('Failed to update reminder');
		}
	}

	async function createPhase() {
		if (!newPhase.title.trim() || !selectedProject) return;
		
		try {
			// Generate document slug from title and role
			const slugBase = `${newPhase.roleType}-${newPhase.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
			
			const phaseData = {
				projectId: selectedProject.id,
				type: 'phase',
				title: newPhase.title,
				body: newPhase.body,
				documentSlug: slugBase,
				assignedToRoleType: newPhase.roleType,
				phaseStatus: 'draft',
				requiredInputs: newPhase.requiredInputs ? JSON.stringify(newPhase.requiredInputs.split(',').map(slug => slug.trim()).filter(slug => slug.length > 0)) : null,
				expectedOutputs: newPhase.expectedOutputs ? JSON.stringify(newPhase.expectedOutputs.split(',').map(slug => slug.trim()).filter(slug => slug.length > 0)) : null
			};

			const response = await fetch(`/api/projects/${selectedProject.id}/content`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(phaseData)
			});
			
			if (response.ok) {
				const phase = await response.json();
				phases = [...phases, phase];
				
				// Update phasesByRole
				if (!phasesByRole[phase.assignedToRoleType]) {
					phasesByRole[phase.assignedToRoleType] = [];
				}
				phasesByRole[phase.assignedToRoleType].push(phase);
				
				showCreatePhaseDialog = false;
				newPhase = { 
					roleType: 'backend_developer', 
					title: '', 
					body: '', 
					requiredInputs: '', 
					expectedOutputs: '' 
				};
			}
		} catch (error) {
			console.error('Failed to create phase:', error);
		}
	}

	async function updatePhaseStatus(phase: any, newStatus: string) {
		try {
			const response = await fetch(`/api/phases/${phase.id}/status`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					newStatus: newStatus
				})
			});
			
			if (response.ok) {
				const result = await response.json();
				console.log('Phase status updated:', result.message);
				
				// Reload phases to get updated data and trigger auto-progression
				await loadPhases();
				
				// Trigger auto-progression logic
				await checkPhaseProgression();
			} else {
				const error = await response.json();
				console.error('Failed to update phase status:', error.error);
			}
		} catch (error) {
			console.error('Failed to update phase status:', error);
		}
	}

	async function checkPhaseProgression() {
		// Auto-progression logic: when a phase becomes completed, 
		// check if there are any draft phases for the same role that can become active
		try {
			const response = await fetch(`/api/phases/auto-progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId: selectedProject.id })
			});
			
			if (response.ok) {
				// Reload phases to see the changes
				await loadPhases();
			}
		} catch (error) {
			console.error('Failed to check phase progression:', error);
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
					await loadRoles();
					await loadChannels();
					await loadSquads();
					await loadPrompts();
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

	// Drag and drop functions
	function handleDragStart(event: DragEvent, index: number) {
		draggedIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(event: DragEvent, targetIndex: number) {
		event.preventDefault();
		
		if (draggedIndex === null || draggedIndex === targetIndex) {
			draggedIndex = null;
			return;
		}

		// Reorder the prompts array
		const reorderedPrompts = [...rolePrompts];
		const [draggedItem] = reorderedPrompts.splice(draggedIndex, 1);
		reorderedPrompts.splice(targetIndex, 0, draggedItem);

		// Update orderIndex for each prompt
		reorderedPrompts.forEach((prompt, index) => {
			prompt.orderIndex = index;
		});

		rolePrompts = reorderedPrompts;
		draggedIndex = null;

		// Save the new order to the server
		savePromptOrder();
	}

	async function savePromptOrder() {
		if (!selectedRole) return;

		try {
			const response = await fetch(`/api/roles/${selectedRole.id}/prompts`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompts: rolePrompts })
			});

			if (response.ok) {
				// Reload just the prompts for the current role (preserves selectedRole)
				await loadRolePrompts();
				// Also refresh the role content to show updated combined prompts
				await refreshSelectedRoleContent();
			}
		} catch (error) {
			console.error('Failed to save prompt order:', error);
		}
	}

	// Agent management functions
	async function loadAgents() {
		if (!selectedProject) {
			agents = [];
			return;
		}

		try {
			const response = await fetch(`/api/agents?projectId=${selectedProject.id}`);
			if (response.ok) {
				agents = await response.json();
				selectedAgent = agents.length > 0 ? agents[0] : null;
			}
		} catch (error) {
			console.error('Failed to load agents:', error);
			agents = [];
		}

		startAgentRefresh();
	}


	async function loadAgentOutput() {
		if (!selectedAgent) {
			agentOutput = '';
			return;
		}

		try {
			const response = await fetch(`/api/agents/${selectedAgent.id}/console`);
			if (response.ok) {
				const data = await response.json();
				agentOutput = data.output || 'Console not available';
			}
		} catch (error) {
			console.error('Failed to load agent console:', error);
			agentOutput = 'Failed to load console output';
		}
	}

	async function killAgent() {
		if (!selectedAgent) return;
		
		try {
			const response = await fetch(`/api/agents/${selectedAgent.id}/kill`, {
				method: 'POST'
			});
			
			if (response.ok) {
				// Refresh the agents list
				await loadAgents();
				// Clear selection since agent is killed
				selectedAgent = null;
				agentOutput = '';
			}
		} catch (error) {
			console.error('Failed to kill agent:', error);
		}
	}

	async function launchAgent() {
		if (!selectedProject) return;

		try {
			const response = await fetch('/api/agents/launch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					roleType: selectedRoleType,
					model: selectedModel,
					projectId: selectedProject.id
				})
			});

			if (response.ok) {
				// Wait a moment for agent to potentially register
				setTimeout(async () => {
					await loadAgents();
				}, 2000);
			}
		} catch (error) {
			console.error('Failed to launch agent:', error);
		}
	}

	async function loadStartupPrompt() {
		try {
			const response = await fetch('/api/agents/launch');
			if (response.ok) {
				const data = await response.json();
				startupPrompt = data.startupPrompt;
			}
		} catch (error) {
			console.error('Failed to load startup prompt:', error);
		}
	}

	async function saveStartupPrompt() {
		try {
			const response = await fetch('/api/agents/launch', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ startupPrompt })
			});

			if (response.ok) {
				showStartupPromptEditor = false;
			}
		} catch (error) {
			console.error('Failed to save startup prompt:', error);
		}
	}


	function startAgentRefresh() {
		if (agentRefreshInterval) {
			clearInterval(agentRefreshInterval);
		}

		agentRefreshInterval = setInterval(async () => {
			if (currentSection === 'agents' && selectedProject) {
				await loadAgents();
				if (selectedAgent) {
					await loadAgentOutput();
				}
			}
		}, 5000); // Refresh every 5 seconds
	}

	function onAgentSelect(agent: any) {
		selectedAgent = agent;
		loadAgentOutput();
	}

	// Channel management functions
	async function loadChannels() {
		if (!selectedProject) {
			channels = [];
			return;
		}

		try {
			const response = await fetch(`/api/channels?projectId=${selectedProject.id}`);
			if (response.ok) {
				channels = await response.json();
				selectedChannel = channels.length > 0 ? channels[0] : null;
			}
		} catch (error) {
			console.error('Failed to load channels:', error);
			channels = [];
		}
	}


	function openCreateChannelDialog() {
		newChannel = { name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
		showCreateChannelDialog = true;
	}

	function closeCreateChannelDialog() {
		showCreateChannelDialog = false;
		newChannel = { name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	}

	async function createChannel() {
		if (!newChannel.name.trim() || !selectedProject) return;
		
		try {
			const response = await fetch('/api/channels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...newChannel,
					projectId: selectedProject.id
				})
			});
			
			if (response.ok) {
				const channel = await response.json();
				channels = [...channels, channel];
				selectedChannel = channel;
				closeCreateChannelDialog();
			}
		} catch (error) {
			console.error('Failed to create channel:', error);
		}
	}

	function openEditChannelDialog() {
		if (selectedChannel) {
			editChannel = {
				id: selectedChannel.id,
				name: selectedChannel.name,
				description: selectedChannel.description || '',
				promptForAgents: selectedChannel.promptForAgents || '',
				isMainChannel: selectedChannel.isMainChannel || false,
				isForHumanDirector: selectedChannel.isForHumanDirector || false
			};
			showEditChannelDialog = true;
		}
	}

	function closeEditChannelDialog() {
		showEditChannelDialog = false;
		editChannel = { id: '', name: '', description: '', promptForAgents: '', isMainChannel: false, isForHumanDirector: false };
	}

	async function updateChannel() {
		if (!editChannel.name.trim() || !editChannel.id.trim() || !selectedChannel) return;
		
		try {
			const response = await fetch(`/api/channels/${selectedChannel.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editChannel)
			});
			
			if (response.ok) {
				const updatedChannel = await response.json();
				const index = channels.findIndex(c => c.id === selectedChannel.id);
				if (index !== -1) {
					channels[index] = updatedChannel;
					selectedChannel = updatedChannel;
				}
				closeEditChannelDialog();
			}
		} catch (error) {
			console.error('Failed to update channel:', error);
		}
	}

	async function deleteChannel() {
		if (!selectedChannel) return;
		
		if (confirm(`Are you sure you want to delete channel "${selectedChannel.name}"?`)) {
			try {
				const response = await fetch(`/api/channels/${selectedChannel.id}`, {
					method: 'DELETE'
				});
				
				if (response.ok) {
					channels = channels.filter(c => c.id !== selectedChannel.id);
					selectedChannel = channels.length > 0 ? channels[0] : null;
				}
			} catch (error) {
				console.error('Failed to delete channel:', error);
			}
		}
	}

	// Channel role management functions
	async function loadChannelRoles() {
		if (!selectedChannel) {
			console.log('No selected channel, clearing roles');
			channelRoles = null;
			return;
		}

		console.log('Loading roles for channel:', selectedChannel.id);
		try {
			const url = `/api/channels/${selectedChannel.id}/roles`;
			console.log('Fetching URL:', url);
			const response = await fetch(url);
			console.log('Response status:', response.status);
			console.log('Response ok:', response.ok);
			
			if (response.ok) {
				const data = await response.json();
				console.log('Raw API response:', data);
				channelRoles = data;
				console.log('Channel roles assigned to state:', channelRoles);
			} else {
				const errorText = await response.text();
				console.error('Failed to load channel roles - response not ok:', response.status, errorText);
				channelRoles = null;
			}
		} catch (error) {
			console.error('Failed to load channel roles:', error);
			channelRoles = null;
		}
	}

	function onChannelSelect(channel: any) {
		console.log('=== CHANNEL SELECTION DEBUG ===');
		console.log('Channel selected:', channel);
		console.log('Previous selectedChannel:', selectedChannel);
		selectedChannel = channel;
		channelViewMode = 'messages'; // Reset to messages view when selecting a new channel
		console.log('New selectedChannel:', selectedChannel);
		console.log('About to call loadChannelRoles...');
		loadChannelRoles();
		loadChannelMessages();
		console.log('=== END CHANNEL SELECTION DEBUG ===');
	}

	async function loadChannelMessages() {
		if (!selectedChannel) {
			channelMessages = [];
			return;
		}

		try {
			const response = await fetch(`/api/channels/${selectedChannel.id}/messages`);
			if (response.ok) {
				channelMessages = await response.json();
			} else {
				console.error('Failed to load channel messages:', response.status);
				channelMessages = [];
			}
		} catch (error) {
			console.error('Failed to load channel messages:', error);
			channelMessages = [];
		}
	}

	function formatMessageTime(timestamp: string) {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
		
		return date.toLocaleDateString();
	}
	
	function switchToMessagesView() {
		channelViewMode = 'messages';
	}
	
	function switchToSettingsView() {
		channelViewMode = 'settings';
	}

	async function assignRoleToChannel(roleId: number) {
		if (!selectedChannel) return;

		try {
			const response = await fetch(`/api/channels/${selectedChannel.id}/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ roleId: roleId.toString() })
			});

			if (response.ok) {
				await loadChannelRoles(); // Refresh the role assignments
			}
		} catch (error) {
			console.error('Failed to assign role to channel:', error);
		}
	}

	async function removeRoleFromChannel(assignmentId: number) {
		if (!selectedChannel) return;

		try {
			const response = await fetch(`/api/channels/${selectedChannel.id}/roles/${assignmentId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadChannelRoles(); // Refresh the role assignments
			}
		} catch (error) {
			console.error('Failed to remove role from channel:', error);
		}
	}

	// Squad management functions
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

	// Prompt management functions
	async function loadPrompts() {
		if (!selectedProject) {
			prompts = [];
			promptsByType = {};
			return;
		}

		try {
			const response = await fetch(`/api/prompts?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				prompts = data.prompts || [];
				promptsByType = data.promptsByType || {};
			}
		} catch (error) {
			console.error('Failed to load prompts:', error);
			prompts = [];
			promptsByType = {};
		}
	}

	// Communications Center functions
	async function loadDirectorMessages() {
		if (!selectedProject) {
			directorInbox = { messages: [], categorized: { urgent: [], regular: [], read: [] }, stats: {}, summary: {} };
			return;
		}

		try {
			const response = await fetch('/api/director/inbox');
			if (response.ok) {
				directorInbox = await response.json();
			} else {
				console.error('Failed to load director inbox:', response.status);
			}
		} catch (error) {
			console.error('Failed to load director inbox:', error);
		}

		// Also load activity data
		await loadDirectorActivity();
	}

	async function loadDirectorActivity() {
		if (!selectedProject) {
			directorActivity = { recentActivity: [], agentStats: [], channelStats: [], summary: {} };
			return;
		}

		try {
			const response = await fetch(`/api/director/activity?projectId=${selectedProject.id}`);
			if (response.ok) {
				directorActivity = await response.json();
			} else {
				console.error('Failed to load director activity:', response.status);
			}
		} catch (error) {
			console.error('Failed to load director activity:', error);
		}
	}

	async function loadAllMessages() {
		if (!selectedProject) {
			allMessages = [];
			allMessagesSummary = {};
			return;
		}

		try {
			const response = await fetch(`/api/messages/all?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				allMessages = data.messages;
				allMessagesSummary = data.summary;
				console.log(`📬 Loaded ${allMessages.length} messages for All Messages view`);
			} else {
				console.error('Failed to load all messages:', response.status);
			}
		} catch (error) {
			console.error('Failed to load all messages:', error);
		}
	}
	
	async function loadAssistantMessages() {
		if (!selectedProject) {
			assistantMessages = [];
			return;
		}
		
		try {
			const response = await fetch(`/api/messages/assistant?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				assistantMessages = data.messages;
				console.log(`🤖 Loaded ${assistantMessages.length} assistant messages`);
			} else {
				console.error('Failed to load assistant messages:', response.status);
			}
		} catch (error) {
			console.error('Failed to load assistant messages:', error);
		}
	}
	
	async function sendAssistantMessage() {
		if (!assistantMessageContent.trim() || !selectedProject) return;
		
		try {
			// Create the message
			const response = await fetch(`/api/channels/0/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'message',
					title: null,
					body: assistantMessageContent,
					authorAgentId: null, // Human director
					projectId: selectedProject.id
				})
			});
			
			if (response.ok) {
				const newMessage = await response.json();
				
				// Create reading assignment for Director Assistant role
				await fetch(`/api/reading-assignments`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contentId: newMessage.id,
						assignedToType: 'role',
						assignedTo: 'Director Assistant'
					})
				});
				
				// Reset form and reload messages
				assistantMessageContent = '';
				await loadAssistantMessages();
				console.log('✅ Message sent to Director Assistant');
			} else {
				console.error('Failed to send assistant message:', response.status);
			}
		} catch (error) {
			console.error('Failed to send assistant message:', error);
		}
	}

	async function toggleAssistantForwarding() {
		try {
			const response = await fetch('/api/assistant/forwarding', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					enabled: assistantForwardingEnabled,
					projectId: selectedProject?.id
				})
			});

			if (response.ok) {
				console.log(`✅ Assistant forwarding ${assistantForwardingEnabled ? 'enabled' : 'disabled'}`);
				
				// Send notification to assistant about forwarding status
				if (assistantForwardingEnabled) {
					await notifyAssistantAboutForwarding();
				}
			} else {
				console.error('Failed to toggle assistant forwarding:', response.status);
				// Revert the toggle on failure
				assistantForwardingEnabled = !assistantForwardingEnabled;
			}
		} catch (error) {
			console.error('Failed to toggle assistant forwarding:', error);
			// Revert the toggle on failure
			assistantForwardingEnabled = !assistantForwardingEnabled;
		}
	}

	async function notifyAssistantAboutForwarding() {
		if (!selectedProject) return;

		try {
			const response = await fetch(`/api/channels/0/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'message',
					title: 'Assistant Forwarding Activated',
					body: `🤖 ASSISTANT FORWARDING ENABLED

The Human Director has enabled message forwarding to you. You are now authorized to:

• Receive copies of all messages directed to 'human-director'
• Respond on behalf of the Human Director when appropriate
• Make decisions within your defined authority scope
• Escalate only when necessary per your role guidelines

You should now actively monitor for incoming messages and respond promptly to keep projects moving forward during unsupervised periods.

Status: ACTIVE - Ready to assist with full authority`,
					authorAgentId: null,
					projectId: selectedProject.id
				})
			});

			if (response.ok) {
				// Create reading assignment for Director Assistant
				await fetch('/api/reading-assignments', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contentId: (await response.json()).id,
						assignedToType: 'role',
						assignedTo: 'Director Assistant'
					})
				});
			}
		} catch (error) {
			console.error('Failed to notify assistant about forwarding:', error);
		}
	}


	function openReplyDialog(message: any) {
		selectedMessage = message;
		replyToMessageId = message.messageId;
		replyContent = '';
		showReplyDialog = true;
	}

	function closeReplyDialog() {
		showReplyDialog = false;
		selectedMessage = null;
		replyToMessageId = null;
		replyContent = '';
	}

	async function sendReply() {
		if (!replyContent.trim() || !replyToMessageId || !selectedProject) return;

		try {
			const response = await fetch('/api/send-message', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject.id,
					authorAgentId: null, // Human director
					title: null,
					body: replyContent,
					channelId: selectedMessage?.channelId || null,
					parentContentId: replyToMessageId,
					type: 'reply',
					assignTo: [
						{
							type: 'agent',
							target: selectedMessage?.authorAgentId || 'unknown'
						}
					]
				})
			});

			if (response.ok) {
				closeReplyDialog();
				await loadDirectorMessages(); // Refresh inbox
			} else {
				console.error('Failed to send reply:', response.status);
			}
		} catch (error) {
			console.error('Failed to send reply:', error);
		}
	}

	// Send Message Functions
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
	}

	async function sendMessage() {
		if (!newMessage.body.trim() || !selectedProject) return;

		try {
			// Create the message
			const response = await fetch(`/api/channels/${newMessage.channelId || 0}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: newMessage.type,
					title: newMessage.title || null,
					body: newMessage.body,
					authorAgentId: null, // Human director
					projectId: selectedProject.id
				})
			});

			if (!response.ok) {
				console.error('Failed to create message:', response.status);
				return;
			}

			const createdMessage = await response.json();

			// Create reading assignments if any
			if (messageReadingAssignments.length > 0) {
				for (const assignment of messageReadingAssignments) {
					if (assignment.assignedTo.trim()) {
						try {
							await fetch('/api/reading-assignments', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									contentId: createdMessage.id,
									assignedToType: assignment.assignedToType,
									assignedTo: assignment.assignedTo
								})
							});
						} catch (error) {
							console.error('Failed to create reading assignment:', error);
						}
					}
				}
			}

			resetSendMessageDialog();
			await loadDirectorMessages(); // Refresh inbox
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	}

	async function markAsRead(messageId: number, assignmentId: number) {
		try {
			const response = await fetch('/api/reading-assignments/mark-read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					assignmentId,
					agentId: 'director'
				})
			});

			if (response.ok) {
				await loadDirectorMessages(); // Refresh inbox
			}
		} catch (error) {
			console.error('Failed to mark as read:', error);
		}
	}

	function formatTimeAgo(timestamp: string): string {
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

	function getMessageIcon(message: any): string {
		if (message.isDM) return '💬';
		if (message.isDirectorChannel) return '📢';
		if (message.isReply) return '↩️';
		if (message.type === 'announcement') return '📣';
		if (message.type === 'report') return '📊';
		if (message.type === 'document') return '📄';
		return '💭';
	}

	function openCreatePromptDialog() {
		newPrompt = { name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };
		showCreatePromptDialog = true;
	}

	function closeCreatePromptDialog() {
		showCreatePromptDialog = false;
		newPrompt = { name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };
	}

	async function createPrompt() {
		if (!newPrompt.name.trim() || !newPrompt.content.trim() || !selectedProject) return;
		
		try {
			const response = await fetch('/api/prompts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...newPrompt,
					projectId: selectedProject.id
				})
			});
			
			if (response.ok) {
				const prompt = await response.json();
				prompts = [...prompts, prompt];
				await loadPrompts(); // Refresh to get updated grouping
				closeCreatePromptDialog();
			}
		} catch (error) {
			console.error('Failed to create prompt:', error);
		}
	}

	function openEditPromptDialog(prompt: any) {
		editPrompt = {
			id: prompt.id,
			name: prompt.name,
			type: prompt.type,
			content: prompt.content,
			premade: prompt.premade,
			orderIndex: prompt.orderIndex
		};
		showEditPromptDialog = true;
	}

	function closeEditPromptDialog() {
		showEditPromptDialog = false;
		editPrompt = { id: 0, name: '', type: 'custom', content: '', premade: null, orderIndex: 0 };
	}

	async function updatePrompt() {
		if (!editPrompt.name.trim() || !editPrompt.content.trim() || !editPrompt.id) return;
		
		try {
			const response = await fetch(`/api/prompts/${editPrompt.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editPrompt)
			});
			
			if (response.ok) {
				await loadPrompts(); // Refresh the prompts
				closeEditPromptDialog();
			}
		} catch (error) {
			console.error('Failed to update prompt:', error);
		}
	}

	async function deletePrompt(promptId: number) {
		if (!confirm('Are you sure you want to delete this prompt?')) return;
		
		try {
			const response = await fetch(`/api/prompts/${promptId}`, {
				method: 'DELETE'
			});
			
			if (response.ok) {
				await loadPrompts(); // Refresh the prompts
			}
		} catch (error) {
			console.error('Failed to delete prompt:', error);
		}
	}

	// Template Update Functions
	function openUpdateTemplateDialog(prompt: any) {
		selectedPromptForTemplate = prompt;
		showUpdateTemplateDialog = true;
	}

	async function updateTemplate() {
		if (!selectedPromptForTemplate) return;
		
		try {
			const response = await fetch(`/api/templates/${selectedPromptForTemplate.templateId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: selectedPromptForTemplate.content,
					name: selectedPromptForTemplate.name,
					type: selectedPromptForTemplate.type
				})
			});
			
			if (response.ok) {
				const result = await response.json();
				showUpdateTemplateDialog = false;
				selectedPromptForTemplate = null;
				
				// Show success message
				alert(`Template updated successfully! ${result.affectedCount || 0} prompts across projects will use the new template content.`);
				
				// Refresh prompts to show any changes
				await loadPrompts();
			} else {
				const error = await response.json();
				console.error('Failed to update template:', error.error);
				alert('Failed to update template: ' + error.error);
			}
		} catch (error) {
			console.error('Failed to update template:', error);
			alert('Failed to update template. Please try again.');
		}
	}

	// Monitoring Service Functions
	async function refreshMonitoringStatus() {
		try {
			const response = await fetch('/api/monitoring/status');
			if (response.ok) {
				monitoringStatus = await response.json();
			} else {
				console.error('Failed to fetch monitoring status');
			}
		} catch (error) {
			console.error('Error fetching monitoring status:', error);
		}
	}

	async function startMonitoring() {
		try {
			const response = await fetch('/api/monitoring/start', { method: 'POST' });
			if (response.ok) {
				await refreshMonitoringStatus();
				console.log('Monitoring service started successfully');
			} else {
				const error = await response.json();
				console.error('Failed to start monitoring:', error.error);
				alert(`Failed to start monitoring: ${error.error}`);
			}
		} catch (error) {
			console.error('Error starting monitoring:', error);
			alert('Failed to start monitoring service');
		}
	}

	async function stopMonitoring() {
		try {
			const response = await fetch('/api/monitoring/stop', { method: 'POST' });
			if (response.ok) {
				const result = await response.json();
				await refreshMonitoringStatus();
				console.log('Monitoring service stopped:', result.finalStats);
			} else {
				const error = await response.json();
				console.error('Failed to stop monitoring:', error.error);
				alert(`Failed to stop monitoring: ${error.error}`);
			}
		} catch (error) {
			console.error('Error stopping monitoring:', error);
			alert('Failed to stop monitoring service');
		}
	}

	// Documents management functions
	async function loadDocuments() {
		if (!selectedProject) {
			documents = [];
			return;
		}

		try {
			const response = await fetch(`/api/documents?projectId=${selectedProject.id}`);
			if (response.ok) {
				documents = await response.json();
				selectedDocument = documents.length > 0 ? documents[0] : null;
				if (selectedDocument) {
					await loadDocumentReplies();
				}
			}
		} catch (error) {
			console.error('Failed to load documents:', error);
			documents = [];
		}
	}

	async function loadDocumentReplies() {
		if (!selectedDocument) {
			documentReplies = [];
			return;
		}

		try {
			const response = await fetch(`/api/documents/${selectedDocument.id}/replies`);
			if (response.ok) {
				documentReplies = await response.json();
			}
		} catch (error) {
			console.error('Failed to load document replies:', error);
			documentReplies = [];
		}
	}

	function openCreateDocumentDialog() {
		newDocument = { 
			title: '', 
			body: '', 
			type: 'document', 
			documentSlug: '', 
			authorAgentId: 'human-director', // Default to human director
			squadId: '',
			readingAssignments: [] 
		};
		documentReadingAssignments = [];
		showCreateDocumentDialog = true;
	}

	// Document Reading Assignment Functions
	function addDocumentReadingAssignment() {
		documentReadingAssignments = [...documentReadingAssignments, {
			assignedToType: 'role',
			assignedTo: ''
		}];
	}

	function removeDocumentReadingAssignment(index: number) {
		documentReadingAssignments = documentReadingAssignments.filter((_, i) => i !== index);
	}

	async function createDocument() {
		if (!newDocument.title.trim() || !newDocument.body.trim() || !selectedProject) return;

		try {
			const response = await fetch('/api/documents', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...newDocument,
					projectId: selectedProject.id
				})
			});

			if (!response.ok) {
				console.error('Failed to create document:', response.status);
				return;
			}

			const createdDocument = await response.json();

			// Create reading assignments if any
			if (documentReadingAssignments.length > 0) {
				for (const assignment of documentReadingAssignments) {
					if (assignment.assignedTo.trim()) {
						try {
							await fetch('/api/reading-assignments', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									contentId: createdDocument.id,
									assignedToType: assignment.assignedToType,
									assignedTo: assignment.assignedTo
								})
							});
						} catch (error) {
							console.error('Failed to create reading assignment:', error);
						}
					}
				}
			}

			documents = [...documents, createdDocument];
			selectedDocument = createdDocument;
			await loadDocumentReplies();

			showCreateDocumentDialog = false;
			newDocument = { 
				title: '', 
				body: '', 
				type: 'document', 
				documentSlug: '', 
				authorAgentId: 'human-director',
				squadId: '',
				readingAssignments: [] 
			};
		} catch (error) {
			console.error('Failed to create document:', error);
		}
	}

	function openReplyToDocumentDialog(parentId: number | null = null) {
		documentReplyContent = '';
		replyToContentId = parentId;
		showReplyToDocumentDialog = true;
	}

	async function replyToDocument() {
		if (!documentReplyContent.trim() || !selectedDocument) return;

		try {
			const response = await fetch(`/api/documents/${selectedDocument.id}/replies`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					body: documentReplyContent,
					authorAgentId: 'human-director', // Default to human director
					parentContentId: replyToContentId || selectedDocument.id
				})
			});

			if (response.ok) {
				await loadDocumentReplies();
				showReplyToDocumentDialog = false;
				documentReplyContent = '';
				replyToContentId = null;
			}
		} catch (error) {
			console.error('Failed to reply to document:', error);
		}
	}

	async function markDocumentAsRead() {
		if (!selectedDocument) return;

		try {
			const response = await fetch(`/api/documents/${selectedDocument.id}/mark-read`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					agentId: 'human-director'
				})
			});

			if (response.ok) {
				await loadDocuments(); // Reload to update read status
			}
		} catch (error) {
			console.error('Failed to mark document as read:', error);
		}
	}

	function onDocumentSelect(document: any) {
		selectedDocument = document;
		loadDocumentReplies();
	}


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
					on:click={() => { currentSection = 'prompts'; loadPrompts(); }}
				>
					Prompts
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'agents'}
					on:click={() => { currentSection = 'agents'; loadRoles(); loadAgents(); }}
				>
					Agents
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'channels'}
					on:click={() => { currentSection = 'channels'; loadChannels(); }}
				>
					Channels
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'squads'}
					on:click={() => { currentSection = 'squads'; loadSquads(); }}
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
					on:click={() => { currentSection = 'scheduled-reminders'; loadScheduledReminders(); }}
				>
					⏰ Scheduled Reminders
				</button>
				<button 
					class="nav-btn" 
					on:click={() => window.open('/tickets', '_blank')}
				>
					🎫 Tickets
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'documents'}
					on:click={() => { currentSection = 'documents'; loadDocuments(); }}
				>
					📄 Documents
				</button>
				<button 
					class="nav-btn director-btn" 
					class:active={currentSection === 'communications'}
					on:click={() => { currentSection = 'communications'; loadDirectorMessages(); }}
				>
					📬 Communications Center
				</button>
			</div>
		{/if}
	</div>

	<div class="main-content">
		{#if selectedProject}
			{#if currentSection === 'overview'}
				<h2>{selectedProject.name}</h2>
				<p>{selectedProject.description || 'No description provided'}</p>
				
				<!-- Monitoring Service Controls -->
				<div class="monitoring-section">
					<h3>🔍 Monitoring Service</h3>
					<div class="monitoring-controls">
						<div class="monitoring-status">
							<span class="status-indicator" class:active={monitoringStatus?.isRunning}></span>
							<span>{monitoringStatus?.isRunning ? 'Active' : 'Stopped'}</span>
						</div>
						
						<div class="monitoring-actions">
							{#if monitoringStatus?.isRunning}
								<button class="btn-stop" on:click={stopMonitoring}>Stop Monitoring</button>
							{:else}
								<button class="btn-start" on:click={startMonitoring}>Start Monitoring</button>
							{/if}
							<button class="btn-refresh" on:click={refreshMonitoringStatus}>Refresh</button>
						</div>
					</div>
					
					{#if monitoringStatus?.stats}
						<div class="monitoring-stats">
							<div class="stat-item">
								<span class="stat-label">Total Checks:</span>
								<span class="stat-value">{monitoringStatus.stats.totalChecks}</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Status Updates:</span>
								<span class="stat-value">{monitoringStatus.stats.statusUpdates}</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Notifications Sent:</span>
								<span class="stat-value">{monitoringStatus.stats.notificationsSent}</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Gentle Pokes:</span>
								<span class="stat-value">{monitoringStatus.stats.gentlePokes || 0}</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Errors:</span>
								<span class="stat-value">{monitoringStatus.stats.errors}</span>
							</div>
							{#if monitoringStatus.stats.lastCheck}
								<div class="stat-item">
									<span class="stat-label">Last Check:</span>
									<span class="stat-value">{new Date(monitoringStatus.stats.lastCheck).toLocaleTimeString()}</span>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{:else if currentSection === 'roles'}
				<div class="roles-section">
					<div class="section-header">
						<div class="role-controls">
							<select bind:value={selectedRole} on:change={() => loadRolePrompts()} class="role-selector">
								{#if roles.length === 0}
									<option value={null}>No roles</option>
								{:else}
									{#each roles as role}
										<option value={role}>{role.name}</option>
									{/each}
								{/if}
							</select>
							
						</div>
					</div>
					
					{#if selectedRole}
						<div class="role-content">
							<h4>Final Role Prompt (All Components)</h4>
							<textarea 
								bind:value={roleFinalPrompt}
								class="role-textarea"
								readonly
								rows="20"
							></textarea>
							
							<div class="section-header-with-action">
								<h4>Prompt Composition</h4>
								{#if selectedRole}
									<button class="btn-secondary" on:click={openAddPromptToRoleDialog}>
										➕ Add Prompt
									</button>
								{/if}
							</div>
							<div class="prompt-composition">
								{#if rolePrompts.length > 0}
									{#each rolePrompts as prompt, index}
										<div 
											class="prompt-item"
											class:dragging={draggedIndex === index}
											draggable="true"
											on:dragstart={(e) => handleDragStart(e, index)}
											on:dragover={handleDragOver}
											on:drop={(e) => handleDrop(e, index)}
										>
											<div class="prompt-header">
												<span class="prompt-order">#{index + 1}</span>
												<span class="prompt-name">{prompt.name}</span>
												{#if prompt.isPremade || prompt.premade}
													<span class="prompt-badge premade">Premade</span>
												{:else}
													<span class="prompt-badge custom">Role Description</span>
												{/if}
												{#if prompt.source === 'role'}
													<span class="prompt-badge source-role">Role: {selectedRole?.name || 'Unknown'}</span>
												{:else if prompt.source === 'squad'}
													<span class="prompt-badge source-squad">Squad: {prompt.squadName || 'Unknown'}</span>
												{:else if prompt.source === 'global'}
													<span class="prompt-badge source-global">Global</span>
												{/if}
												<span class="prompt-type">{prompt.type}</span>
												<div class="prompt-actions">
													{#if prompt.source === 'role'}
														<button 
															class="btn-danger-small" 
															on:click={() => removePromptFromRole(prompt.id)}
															title="Remove this prompt from role"
														>×</button>
													{/if}
													<span class="drag-handle">⋮⋮</span>
												</div>
											</div>
											<div class="prompt-preview">
												{prompt.content.substring(0, 100)}...
											</div>
										</div>
									{/each}
								{:else}
									<p class="empty-state">No prompts assigned to this role</p>
								{/if}
							</div>
							
							<h4>Channel Access</h4>
							<div class="role-channels">
								{#if roleChannels}
									<div class="channel-assignments">
										<div class="assigned-channels">
											<h5>Accessible Channels ({roleChannels.assignedChannels?.length || 0})</h5>
											{#if roleChannels.assignedChannels && roleChannels.assignedChannels.length > 0}
												<div class="channel-list">
													{#each roleChannels.assignedChannels as assignedChannel}
														<div class="channel-item assigned">
															<div class="channel-info">
																<span class="channel-name">#{assignedChannel.channelName}</span>
																{#if assignedChannel.isMainChannel}
																	<span class="channel-status public">Public</span>
																{/if}
															</div>
															{#if !assignedChannel.isMainChannel}
																<button 
																	class="btn-remove"
																	on:click={() => removeChannelFromRole(assignedChannel.assignmentId)}
																	title="Remove channel access"
																>×</button>
															{/if}
														</div>
													{/each}
												</div>
											{:else}
												<p class="no-channels">No channels accessible to this role</p>
											{/if}
										</div>
										
										<div class="available-channels">
											<h5>Available Channels</h5>
											{#if roleChannels.allChannels}
												{@const unassignedChannels = roleChannels.allChannels.filter(channel => !channel.isAssigned && !channel.isMainChannel)}
												{#if unassignedChannels.length > 0}
													<div class="channel-list">
														{#each unassignedChannels as channel}
															<div class="channel-item available">
																<div class="channel-info">
																	<span class="channel-name">#{channel.name}</span>
																	<span class="channel-desc">{channel.description}</span>
																</div>
																<button 
																	class="btn-add"
																	on:click={() => addChannelToRole(channel.id)}
																	title="Grant channel access"
																>+</button>
															</div>
														{/each}
													</div>
												{:else}
													<p class="no-channels">All channels are accessible or public</p>
												{/if}
											{/if}
										</div>
									</div>
								{:else}
									<p>Loading channel access...</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="empty-selection">
							<p>Select a role to view details</p>
						</div>
					{/if}
				</div>
			{:else if currentSection === 'prompts'}
				<div class="prompts-section">
					<div class="section-header">
						<h2>Custom Prompt Management</h2>
						<p class="section-description">Manage custom prompts and role descriptions. Premade prompts (channel instructions, ticketing system) are managed in the Roles section.</p>
						<button class="btn-primary" on:click={openCreatePromptDialog}>
							➕ Create Custom Prompt
						</button>
					</div>

					{#if Object.keys(promptsByType).length > 0}
						{#each Object.entries(promptsByType) as [type, typePrompts]}
							<div class="prompt-type-section">
								<div class="prompt-type-header">
									<h3>{type.replace(/_/g, ' ').toUpperCase()}</h3>
									<span class="prompt-count">({typePrompts.length})</span>
								</div>
								
								<div class="prompt-list">
									{#each typePrompts as prompt}
										<div class="prompt-card">
											<div class="prompt-card-header">
												<div class="prompt-info">
													<h4 class="prompt-name">{prompt.name}</h4>
													{#if prompt.premade}
														<span class="prompt-badge premade">Premade</span>
													{:else if prompt.templateId}
														<span class="prompt-badge template">Template</span>
													{:else}
														<span class="prompt-badge custom">Custom</span>
													{/if}
												</div>
												<div class="prompt-actions">
													{#if prompt.templateId}
														<button 
															class="btn-template" 
															on:click={() => openUpdateTemplateDialog(prompt)}
															title="Update the original template with this content"
														>📝 Update Template</button>
													{/if}
													<button 
														class="btn-secondary" 
														on:click={() => openEditPromptDialog(prompt)}
														title="Edit prompt"
													>✏️</button>
													<button 
														class="btn-danger" 
														on:click={() => deletePrompt(prompt.id)}
														title="Delete prompt"
													>🗑️</button>
												</div>
											</div>
											<div class="prompt-preview">
												{prompt.content.substring(0, 200)}{#if prompt.content.length > 200}...{/if}
											</div>
											<div class="prompt-metadata">
												<span class="prompt-order">Order: #{prompt.orderIndex}</span>
												<span class="prompt-created">
													Created: {new Date(prompt.createdAt).toLocaleDateString()}
												</span>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					{:else}
						<div class="empty-state">
							<h3>No prompts found</h3>
							<p>Create your first prompt to get started with project customization.</p>
							<button class="btn-primary" on:click={openCreatePromptDialog}>
								Create First Prompt
							</button>
						</div>
					{/if}
				</div>
			{:else if currentSection === 'agents'}
				<div class="agents-section">
					<div class="section-header">
						<h2>Agent Management</h2>
						<div class="agent-controls">
							<select bind:value={selectedRoleType} class="role-selector">
								{#if roles.length === 0}
									<option value="">No roles available</option>
								{:else}
									{#each roles as role}
										<option value={role.name}>{role.name}</option>
									{/each}
								{/if}
							</select>
							
							<select bind:value={selectedModel} class="model-selector">
								<option value="sonnet">Sonnet</option>
								<option value="opus">Opus</option>
								<option value="haiku">Haiku</option>
							</select>
							
							<button class="btn-primary" on:click={launchAgent}>
								🚀 Launch Agent
							</button>
						</div>
					</div>

					<div class="agents-content">
						<div class="agents-left">
							<div class="agents-panel">
								<div class="agents-header">
									<h3>All Agents ({agents.length})</h3>
									<button class="btn-secondary" on:click={() => { loadStartupPrompt(); showStartupPromptEditor = true; }}>
										⚙️ Startup Prompt
									</button>
								</div>
								
								<!-- Agent List -->
								<div class="agent-list">
									{#each agents as agent}
										<div 
											class="agent-item"
											class:active={selectedAgent?.id === agent.id}
											on:click={() => onAgentSelect(agent)}
										>
											<div class="agent-header">
												<div class="agent-id-section">
													<span class="agent-status-indicator status-{agent.status}"></span>
													<span class="agent-id">{agent.id}</span>
												</div>
												<span class="agent-status status-{agent.status}">{agent.status}</span>
											</div>
											<div class="agent-details">
												<span class="agent-role">{agent.roleType}</span>
												<span class="agent-model">{agent.model}</span>
												<span class="agent-heartbeat">
													Last seen: {new Date(agent.lastHeartbeat).toLocaleTimeString()}
												</span>
											</div>
										</div>
									{/each}
								</div>

								{#if agents.length === 0}
									<p class="empty-state">No agents launched yet</p>
								{/if}
							</div>
						</div>

						<div class="agents-right">
							{#if selectedAgent}
								<div class="agent-details-panel">
									<div class="agent-details-header">
										<h3>{selectedAgent.id}</h3>
										<div class="agent-actions">
											<button class="btn-secondary">Send Command</button>
											<button class="btn-danger" on:click={killAgent}>🗲 Kill Agent</button>
										</div>
									</div>

									<div class="agent-console">
										<div class="console-header">
											<h4>Live Console</h4>
											<button class="btn-secondary" on:click={loadAgentOutput}>🔄 Refresh</button>
										</div>
										<textarea 
											bind:value={agentOutput}
											class="console-output"
											readonly
											rows="25"
											placeholder="Console output will appear here..."
										></textarea>
									</div>
								</div>
							{:else}
								<div class="empty-selection">
									<p>Select an agent to view details</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else if currentSection === 'channels'}
				<div class="channels-section">
					<div class="section-header">
						<h2>Channel Management</h2>
						<button class="btn-primary" on:click={openCreateChannelDialog}>
							➕ Create Channel
						</button>
					</div>

					<div class="channels-content">
						<div class="channels-left">
							<div class="channels-panel">
								<div class="channels-header">
									<h3>Channels ({channels.length})</h3>
								</div>
								
								<div class="channel-list">
									{#each channels.sort((a, b) => (b.isForHumanDirector ? 1 : 0) - (a.isForHumanDirector ? 1 : 0)) as channel}
										<div 
											class="channel-item"
											class:active={selectedChannel?.id === channel.id}
											on:click={() => onChannelSelect(channel)}
										>
											<div class="channel-header">
												<span class="channel-id">#{channel.id}</span>
												{#if channel.isForHumanDirector}
													<span class="channel-badge human-director">👤 Human</span>
												{/if}
												{#if channel.isMainChannel}
													<span class="channel-badge">Main</span>
												{/if}
											</div>
											<div class="channel-details">
												<span class="channel-name">{channel.name}</span>
											</div>
										</div>
									{/each}
								</div>

								{#if channels.length === 0}
									<p class="empty-state">No channels created yet</p>
								{/if}
							</div>
						</div>

						<div class="channels-right">
							{#if selectedChannel}
								<div class="channel-details-panel">
									<div class="channel-details-header">
										<h3>#{selectedChannel.name}</h3>
										<div class="channel-view-toggle">
											<button 
												class="view-toggle-btn" 
												class:active={channelViewMode === 'messages'}
												on:click={switchToMessagesView}
											>💬 Messages</button>
											<button 
												class="view-toggle-btn settings-btn" 
												class:active={channelViewMode === 'settings'}
												on:click={switchToSettingsView}
												title="Channel Settings"
											>⚙️</button>
										</div>
									</div>

									<div class="channel-info">
										{#if channelViewMode === 'messages'}
											<div class="messages-view">
												<!-- Messages view placeholder for now -->
												<div class="messages-container">
													<div class="messages-list">
														{#if channelMessages.length > 0}
															{#each channelMessages as message}
																<div class="message" class:ticket={message.type === 'ticket'}>
																	<div class="message-header">
																		<span class="message-author">{message.authorAgentId || 'System'}</span>
																		{#if message.type === 'ticket'}
																			<span class="message-type ticket-badge">🎫 TICKET</span>
																		{/if}
																		<span class="message-time">{formatMessageTime(message.createdAt)}</span>
																	</div>
																	
																	{#if message.type === 'ticket'}
																		<div class="ticket-info">
																			<div class="ticket-header">
																				<h4 class="ticket-title">{message.title}</h4>
																				<div class="ticket-badges">
																					{#if message.priority}
																						<span class="priority-badge priority-{message.priority}">{message.priority.toUpperCase()}</span>
																					{/if}
																					{#if message.status}
																						<span class="status-badge status-{message.status.replace('_', '-')}">{message.status.replace('_', ' ').toUpperCase()}</span>
																					{/if}
																				</div>
																			</div>
																			
																			<div class="ticket-assignment">
																				{#if message.assignedToRoleType}
																					<span class="assigned-role">👥 {message.assignedToRoleType}</span>
																				{/if}
																				{#if message.claimedByAgent}
																					<span class="claimed-agent">👤 {message.claimedByAgent}</span>
																				{/if}
																			</div>
																			
																			<div class="ticket-body">
																				{message.body}
																			</div>
																			
																			{#if message.updatedAt && message.updatedAt !== message.createdAt}
																				<div class="ticket-updated">
																					Last updated: {formatMessageTime(message.updatedAt)}
																				</div>
																			{/if}
																		</div>
																	{:else}
																		<div class="message-content">
																			{#if message.title && message.title !== message.body}
																				<strong>{message.title}</strong><br>
																			{/if}
																			{message.body}
																		</div>
																	{/if}
																	{#if message.readingAssignments && message.readingAssignments.length > 0}
																		<div class="message-assignments">
																			{#each message.readingAssignments as assignment}
																				<div class="assignment">
																					<div class="assignment-header">
																						<span class="assignment-target">📋 {assignment.assignedTo}</span>
																						<span class="read-status" class:fully-read={assignment.isFullyRead} class:partially-read={assignment.readCount > 0 && !assignment.isFullyRead} class:unread={assignment.readCount === 0}>
																							{assignment.readCount}/{assignment.totalTargets} read
																						</span>
																					</div>
																					{#if assignment.targetAgents.length > 0}
																						<div class="agents-status">
																							{#each assignment.targetAgents as agentId}
																								{@const readInfo = assignment.readBy.find(r => r.agentId === agentId)}
																								<span class="agent-status" class:read={readInfo} class:acknowledged={readInfo?.acknowledged}>
																									{agentId}
																								</span>
																							{/each}
																						</div>
																					{/if}
																				</div>
																			{/each}
																		</div>
																	{/if}
																</div>
															{/each}
														{:else}
															<div class="no-messages">
																<p>No messages in this channel yet.</p>
																<p>Start the conversation!</p>
															</div>
														{/if}
													</div>
												</div>
												<div class="message-input-container">
													<div class="message-input-wrapper">
														<input 
															type="text" 
															class="message-input" 
															placeholder="Type a message..." 
															disabled
														/>
														<button class="send-btn" disabled>Send</button>
													</div>
													<p class="input-note">Real-time messaging coming soon...</p>
												</div>
											</div>
										{:else if channelViewMode === 'settings'}
											<div class="settings-view">
												<div class="channel-actions-section">
													<div class="settings-actions">
														<button class="btn-secondary" on:click={openEditChannelDialog}>✏️ Edit Channel</button>
														<button class="btn-danger" on:click={deleteChannel}>🗑️ Delete Channel</button>
													</div>
												</div>
												<div class="info-section">
											<h4>Name</h4>
											<p>{selectedChannel.name}</p>
										</div>

										{#if selectedChannel.description}
											<div class="info-section">
												<h4>Description</h4>
												<p>{selectedChannel.description}</p>
											</div>
										{/if}

										{#if selectedChannel.promptForAgents}
											<div class="info-section">
												<h4>Agent Prompt</h4>
												<div class="prompt-preview">
													{selectedChannel.promptForAgents}
												</div>
											</div>
										{/if}

										<div class="info-section">
											<h4>Settings</h4>
											<p>
												{#if selectedChannel.isMainChannel}
													<span class="status-badge default">Main Channel</span>
												{:else}
													<span class="status-badge">Regular Channel</span>
												{/if}
											</p>
										</div>

										<div class="info-section">
											<h4>Role Assignments</h4>
											{#if selectedChannel.isMainChannel}
												<div class="public-channel-message">
													<p><strong>This is a public channel</strong> - accessible to all roles in the project.</p>
													<p>No role assignments needed as all team members can access this channel.</p>
												</div>
											{:else if channelRoles}
												<div class="role-assignments">
													<div class="assigned-roles">
														<h5>Assigned Roles ({channelRoles.assignedRoles?.length || 0})</h5>
														{#if channelRoles.assignedRoles && channelRoles.assignedRoles.length > 0}
															<div class="role-list">
																{#each channelRoles.assignedRoles as assignedRole}
																	<div class="role-item assigned">
																		<div class="role-info">
																			<span class="role-name">{assignedRole.roleName}</span>
																			{#if !assignedRole.isActive}
																				<span class="role-status inactive">Inactive</span>
																			{/if}
																		</div>
																		<button 
																			class="btn-remove"
																			on:click={() => removeRoleFromChannel(assignedRole.assignmentId)}
																			title="Remove role from channel"
																		>×</button>
																	</div>
																{/each}
															</div>
														{:else}
															<p class="no-roles">No roles assigned to this channel</p>
														{/if}
													</div>

													<div class="available-roles">
														<h5>Available Roles</h5>
														{#if channelRoles.allRoles}
															{@const unassignedRoles = channelRoles.allRoles.filter(role => !role.isAssigned)}
															{console.log('=== ROLE AVAILABILITY DEBUG ===', {
																allRoles: channelRoles.allRoles,
																unassignedRoles: unassignedRoles,
																assignedRoles: channelRoles.assignedRoles
															})}
															{#if unassignedRoles.length > 0}
																<div class="role-list">
																	{#each unassignedRoles as role}
																		<div class="role-item available">
																			<div class="role-info">
																				<span class="role-name">{role.name}</span>
																				{#if !role.isActive}
																					<span class="role-status inactive">Inactive</span>
																				{/if}
																			</div>
																			<button 
																				class="btn-add"
																				on:click={() => assignRoleToChannel(role.id)}
																				title="Assign role to channel"
																			>+</button>
																		</div>
																	{/each}
																</div>
															{:else}
																<p class="no-roles">All roles are assigned</p>
															{/if}
														{/if}
													</div>
												</div>
											{:else}
												<p class="loading">Loading role assignments...</p>
											{/if}
										</div>
											</div>
										{/if}
									</div>
								</div>
							{:else}
								<div class="empty-selection">
									<p>Select a channel to view details</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else if currentSection === 'squads'}
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
			{:else if currentSection === 'scheduled-reminders'}
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

			{:else if currentSection === 'documents'}
				<div class="documents-section">
					<div class="section-header">
						<h2>📄 Documents</h2>
						<button 
							class="btn-primary"
							on:click={openCreateDocumentDialog}
						>
							📝 Create Document
						</button>
					</div>
					
					<div class="documents-layout">
						<div class="documents-sidebar">
							<div class="documents-list">
								{#if documents.length > 0}
									{#each documents as document}
										<div 
											class="document-item"
											class:selected={selectedDocument?.id === document.id}
											on:click={() => onDocumentSelect(document)}
										>
											<div class="document-header">
												<h4>{document.title}</h4>
												<span class="document-type">{document.type}</span>
											</div>
											<div class="document-meta">
												<span class="author">{document.authorAgentId || 'Unknown'}</span>
												<span class="date">{new Date(document.createdAt).toLocaleDateString()}</span>
											</div>
											{#if document.readingAssignments?.length > 0}
												{@const assignmentsByType = document.readingAssignments.reduce((groups, assignment) => {
													const key = assignment.assignedToType;
													if (!groups[key]) groups[key] = [];
													groups[key].push(assignment);
													return groups;
												}, {})}
												<div class="reading-status-section document-assignments">
													<h5>📋 Reading Assignments ({document.readingAssignments.length})</h5>
													<div class="assignments-grouped">
														{#each Object.entries(assignmentsByType) as [type, assignments]}
															<div class="assignment-group">
																<div class="group-header">
																	<span class="group-type-icon">
																		{#if type === 'role'}👥{:else if type === 'agent'}🤖{:else if type === 'squad'}👨‍👩‍👧‍👦{/if}
																	</span>
																	<strong>{type.charAt(0).toUpperCase() + type.slice(1)}s</strong>
																	<span class="group-count">({assignments.length})</span>
																</div>
																<div class="assignment-items">
																	{#each assignments as assignment}
																		<div class="assignment-item" class:fully-read={assignment.isFullyRead}>
																			<div class="assignment-info">
																				<span class="assignment-name">{assignment.assignedTo}</span>
																				<div class="read-indicators">
																					<span class="read-count" class:all-read={assignment.isFullyRead}>
																						{assignment.readCount}/{assignment.totalTargets}
																					</span>
																					<div class="read-status-indicator" class:read={assignment.isFullyRead}>
																						{assignment.isFullyRead ? '✅' : '⏳'}
																					</div>
																				</div>
																			</div>
																		</div>
																	{/each}
																</div>
															</div>
														{/each}
													</div>
												</div>
											{/if}
										</div>
									{/each}
								{:else}
									<div class="empty-state">
										<h3>No Documents Yet</h3>
										<p>Create your first document to get started.</p>
									</div>
								{/if}
							</div>
						</div>
						
						<div class="document-viewer">
							{#if selectedDocument}
								<div class="document-content">
									<div class="document-header-full">
										<h1>{selectedDocument.title}</h1>
										<div class="document-meta-full">
											<span class="document-type-badge">{selectedDocument.type}</span>
											<span class="author">by {selectedDocument.authorAgentId || 'Unknown'}</span>
											<span class="date">{new Date(selectedDocument.createdAt).toLocaleDateString()}</span>
											{#if selectedDocument.readingAssignments?.some(assignment => assignment.assignedTo === 'human-director' && assignment.reads?.length === 0)}
												<button 
													class="btn-secondary btn-sm"
													on:click={markDocumentAsRead}
												>
													Mark as Read
												</button>
											{/if}
										</div>
									</div>
									
									<div class="document-body">
										<div class="document-text">
											{@html selectedDocument.body.replace(/\n/g, '<br>')}
										</div>
									</div>
									
									{#if selectedDocument.readingAssignments?.length > 0}
										<div class="read-assignments">
											<h3>Read Assignments</h3>
											{#each selectedDocument.readingAssignments as assignment}
												<div class="assignment-detail">
													<div class="assignment-info">
														<span class="assignee">{assignment.assignedTo}</span>
														<span class="assignment-type">({assignment.assignedToType})</span>
													</div>
													<div class="read-status-detail">
														{#if assignment.reads?.length > 0}
															{#each assignment.reads as read}
																<div class="read-record">
																	<span class="agent">{read.agentId}</span>
																	<span class="read-time">{new Date(read.readAt).toLocaleString()}</span>
																	{#if read.acknowledged}
																		<span class="ack">✅ Acknowledged</span>
																	{/if}
																</div>
															{/each}
														{:else}
															<span class="unread">⏳ Not read yet</span>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									{/if}
									
									<div class="document-replies">
										<div class="replies-header">
											<h3>Comments & Replies</h3>
											<button 
												class="btn-primary btn-sm"
												on:click={() => openReplyToDocumentDialog()}
											>
												💬 Add Comment
											</button>
										</div>
										
										{#if documentReplies.length > 0}
											{#each documentReplies as reply}
												<div class="reply-item">
													<div class="reply-header">
														<span class="reply-author">{reply.authorAgentId || 'Anonymous'}</span>
														<span class="reply-date">{new Date(reply.createdAt).toLocaleString()}</span>
														<button 
															class="reply-btn"
															on:click={() => openReplyToDocumentDialog(reply.id)}
														>
															↩️ Reply
														</button>
													</div>
													<div class="reply-body">
														{@html reply.body.replace(/\n/g, '<br>')}
													</div>
													
													{#if reply.replies?.length > 0}
														<div class="nested-replies">
															<!-- Render nested replies recursively -->
															{#each reply.replies as nestedReply}
																<div class="nested-reply">
																	<div class="reply-header">
																		<span class="reply-author">{nestedReply.authorAgentId || 'Anonymous'}</span>
																		<span class="reply-date">{new Date(nestedReply.createdAt).toLocaleString()}</span>
																		<button 
																			class="reply-btn"
																			on:click={() => openReplyToDocumentDialog(nestedReply.id)}
																		>
																			↩️ Reply
																		</button>
																	</div>
																	<div class="reply-body">
																		{@html nestedReply.body.replace(/\n/g, '<br>')}
																	</div>
																</div>
															{/each}
														</div>
													{/if}
												</div>
											{/each}
										{:else}
											<div class="empty-replies">
												<p>No comments yet. Be the first to comment!</p>
											</div>
										{/if}
									</div>
								</div>
							{:else}
								<div class="empty-document-viewer">
									<h3>Select a Document</h3>
									<p>Choose a document from the list to view its content and comments.</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else if currentSection === 'communications'}
				<div class="communications-section">
					<div class="section-header">
						<h2>📬 Communications Center</h2>
						<button 
							class="btn-primary"
							on:click={() => showSendMessageDialog = true}
						>
							✉️ Send Message
						</button>
					</div>

					<div class="comms-nav">
						<button 
							class="comms-nav-btn" 
							class:active={commsViewMode === 'urgent'}
							on:click={() => commsViewMode = 'urgent'}
						>
							🚨 Urgent ({directorInbox.categorized?.urgent?.length || 0})
						</button>
						<button 
							class="comms-nav-btn" 
							class:active={commsViewMode === 'dashboard'}
							on:click={() => commsViewMode = 'dashboard'}
						>
							📊 Dashboard
						</button>
						<button 
							class="comms-nav-btn" 
							class:active={commsViewMode === 'messages'}
							on:click={() => { commsViewMode = 'messages'; loadAllMessages(); }}
						>
							💬 All Messages ({allMessagesSummary.total || 0})
						</button>
						<button 
							class="comms-nav-btn" 
							class:active={commsViewMode === 'assistant'}
							on:click={() => { commsViewMode = 'assistant'; loadAssistantMessages(); }}
						>
							🤖 Assistant ({assistantMessages.length || 0})
						</button>
					</div>

					<div class="comms-content">
						{#if commsViewMode === 'urgent'}
							<div class="urgent-view">
								<h3>🚨 Urgent Messages</h3>
								{#if directorInbox.categorized?.urgent?.length > 0}
									<div class="message-list">
										{#each directorInbox.categorized.urgent as message}
											<div class="message-card urgent" class:unread={!message.isRead}>
												<div class="message-header">
													<div class="message-meta">
														<span class="message-icon">{getMessageIcon(message)}</span>
														<span class="message-source">
															{#if message.isDM}
																DM from {message.authorAgentId}
															{:else if message.isDirectorChannel}
																#{message.channelName} (Director Channel)
															{:else}
																#{message.channelName}
															{/if}
														</span>
														<span class="message-time">{formatTimeAgo(message.createdAt)}</span>
													</div>
													<div class="message-actions">
														{#if !message.isRead}
															<button class="btn-small" on:click={() => markAsRead(message.messageId, message.assignmentId)}>
																Mark Read
															</button>
														{/if}
														<button class="btn-small btn-primary" on:click={() => openReplyDialog(message)}>
															Reply
														</button>
													</div>
												</div>
												<div class="message-content">
													<div class="message-body">{message.body}</div>
													{#if message.parentMessage}
														<div class="parent-context">
															<small>↩️ Replying to: "{message.parentMessage.body.substring(0, 50)}..."</small>
														</div>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<div class="empty-state">
										<h4>✅ No urgent messages!</h4>
										<p>All caught up on priority communications.</p>
									</div>
								{/if}
							</div>

						{:else if commsViewMode === 'assistant'}
							<div class="assistant-view">
								<div class="assistant-header">
									<div class="assistant-title-row">
										<div>
											<h3>🤖 Director Assistant</h3>
											<p class="assistant-description">Direct communication with your assistant</p>
										</div>
										<div class="assistant-controls">
											<label class="toggle-container">
												<span class="toggle-label">Forward messages to assistant</span>
												<input 
													type="checkbox" 
													bind:checked={assistantForwardingEnabled}
													on:change={toggleAssistantForwarding}
												/>
												<span class="toggle-slider"></span>
											</label>
										</div>
									</div>
									{#if assistantForwardingEnabled}
										<div class="forwarding-notice">
											<span class="notice-icon">📬</span>
											<span>Assistant will receive copies of all messages directed to you and can respond on your behalf</span>
										</div>
									{/if}
								</div>
								
								<div class="assistant-chat">
									{#if assistantMessages.length > 0}
										<div class="message-list">
											{#each assistantMessages as message}
												<div class="assistant-message" class:from-assistant={message.isFromAssistant} class:from-director={message.isFromDirector}>
													<div class="message-header">
														<span class="message-author">
															{#if message.isFromAssistant}
																🤖 Assistant ({message.authorAgentId})
															{:else}
																👤 You
															{/if}
														</span>
														<span class="message-time">{formatTimeAgo(message.createdAt)}</span>
													</div>
													<div class="message-body">{message.body}</div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-chat">
											<div class="empty-icon">💬</div>
											<h4>No messages yet</h4>
											<p>Start a conversation with your Director Assistant</p>
										</div>
									{/if}
								</div>
								
								<div class="assistant-input">
									<div class="input-container">
										<textarea
											bind:value={assistantMessageContent}
											placeholder="Type your message to the assistant..."
											rows="3"
											on:keydown={(e) => {
												if (e.key === 'Enter' && !e.shiftKey) {
													e.preventDefault();
													sendAssistantMessage();
												}
											}}
										></textarea>
										<button 
											class="send-btn" 
											on:click={sendAssistantMessage}
											disabled={!assistantMessageContent.trim()}
										>
											Send
										</button>
									</div>
									<div class="input-hint">
										<span>📝 Press Enter to send, Shift+Enter for new line</span>
									</div>
								</div>
							</div>

						{:else if commsViewMode === 'dashboard'}
							<div class="dashboard-view">
								<div class="dashboard-grid">
									<div class="dashboard-card">
										<h3>📊 Activity Overview</h3>
										{#if directorActivity.summary}
											<div class="activity-stats">
												<div class="stat-item">
													<span class="stat-number">{directorActivity.summary.totalMessages}</span>
													<span class="stat-label">Total Messages</span>
												</div>
												<div class="stat-item">
													<span class="stat-number">{directorActivity.summary.activeAgents}</span>
													<span class="stat-label">Active Agents</span>
												</div>
												<div class="stat-item">
													<span class="stat-number">{directorActivity.summary.activeChannels}</span>
													<span class="stat-label">Active Channels</span>
												</div>
											</div>
										{/if}
									</div>

									<div class="dashboard-card">
										<h3>🤖 Agent Activity</h3>
										{#if directorActivity.agentStats?.length > 0}
											<div class="agent-activity-list">
												{#each directorActivity.agentStats.slice(0, 5) as agentStat}
													<div class="activity-item">
														<span class="agent-name">{agentStat.agentId}</span>
														<span class="activity-count">{agentStat.messageCount} messages</span>
														<span class="activity-time">{formatTimeAgo(agentStat.lastActivity)}</span>
													</div>
												{/each}
											</div>
										{:else}
											<p class="empty-note">No agent activity yet</p>
										{/if}
									</div>

									<div class="dashboard-card">
										<h3>📢 Channel Activity</h3>
										{#if directorActivity.channelStats?.length > 0}
											<div class="channel-activity-list">
												{#each directorActivity.channelStats.slice(0, 5) as channelStat}
													<div class="activity-item">
														<span class="channel-name">
															#{channelStat.channelName}
														</span>
														<span class="activity-count">{channelStat.messageCount} messages</span>
														<span class="activity-time">{formatTimeAgo(channelStat.lastActivity)}</span>
													</div>
												{/each}
											</div>
										{:else}
											<p class="empty-note">No channel activity yet</p>
										{/if}
									</div>

									<div class="dashboard-card">
										<h3>📈 Recent Activity</h3>
										{#if directorActivity.recentActivity?.length > 0}
											<div class="recent-activity-list">
												{#each directorActivity.recentActivity.slice(0, 5) as activity}
													<div class="activity-item recent">
														<span class="activity-icon">{getMessageIcon(activity)}</span>
														<div class="activity-details">
															<span class="activity-summary">
																{activity.authorAgentId || 'System'} 
																{#if activity.channelName}in #{activity.channelName}{/if}
															</span>
															<span class="activity-preview">{activity.body.substring(0, 40)}...</span>
														</div>
														<span class="activity-time">{formatTimeAgo(activity.createdAt)}</span>
													</div>
												{/each}
											</div>
										{:else}
											<p class="empty-note">No recent activity</p>
										{/if}
									</div>
								</div>
							</div>

						{:else if commsViewMode === 'messages'}
							<div class="all-messages-view">
								<div class="messages-header">
									<h3>💬 All Messages</h3>
									{#if allMessagesSummary.total}
										<div class="messages-stats">
											<span class="stat">Total: {allMessagesSummary.total}</span>
											<span class="stat">With Assignments: {allMessagesSummary.withAssignments}</span>
											<span class="stat">Direct: {allMessagesSummary.withoutAssignments}</span>
										</div>
									{/if}
								</div>
								
								{#if allMessages.length > 0}
									<div class="message-list">
										{#each allMessages as message}
											<div class="message-card enhanced">
												<div class="message-header">
													<div class="message-meta">
														<span class="message-icon">{getMessageIcon(message)}</span>
														<div class="message-info">
															<div class="message-title-line">
																{#if message.title}
																	<strong>{message.title}</strong>
																{:else}
																	<span class="message-type">{message.type}</span>
																{/if}
																{#if message.isReply}
																	<span class="reply-badge">Reply</span>
																{/if}
															</div>
															<div class="message-source-line">
																<span class="message-source">
																	{#if message.authorAgentId}
																		{message.authorAgentId}
																	{:else}
																		Director
																	{/if}
																</span>
																{#if message.channelName}
																	<span class="channel-name">#{message.channelName}</span>
																{:else if message.isDM}
																	<span class="dm-badge">DM</span>
																{/if}
																<span class="message-time">{formatTimeAgo(message.createdAt)}</span>
															</div>
														</div>
													</div>
													<div class="message-actions">
														<button 
															class="btn-small btn-primary" 
															on:click={() => { selectedMessage = message; replyToMessageId = message.id; showReplyDialog = true; }}
														>
															Reply
														</button>
													</div>
												</div>
												
												<div class="message-content">
													<div class="message-body">{message.body}</div>
												</div>

												<!-- Reading Assignments Status -->
												{#if message.readingAssignments && message.readingAssignments.length > 0}
													{@const assignmentsByType = message.readingAssignments.reduce((groups, assignment) => {
														const key = assignment.assignedToType;
														if (!groups[key]) groups[key] = [];
														groups[key].push(assignment);
														return groups;
													}, {})}
													<div class="reading-status-section">
														<h5>📋 Reading Assignments ({message.readingAssignments.length})</h5>
														<div class="assignments-grouped">
															
															{#each Object.entries(assignmentsByType) as [type, assignments]}
																<div class="assignment-group">
																	<div class="group-header">
																		<span class="group-type-icon">
																			{#if type === 'role'}👥{:else if type === 'agent'}🤖{:else if type === 'squad'}👨‍👩‍👧‍👦{/if}
																		</span>
																		<strong>{type.charAt(0).toUpperCase() + type.slice(1)}s</strong>
																		<span class="group-count">({assignments.length})</span>
																	</div>
																	<div class="assignment-items">
																		{#each assignments as assignment}
																			<div class="assignment-item" class:fully-read={assignment.isFullyRead}>
																				<div class="assignment-info">
																					<span class="assignment-name">{assignment.assignedTo}</span>
																					<div class="read-indicators">
																						<span class="read-count" class:all-read={assignment.isFullyRead}>
																							{assignment.readCount}/{assignment.totalTargets}
																						</span>
																						{#if assignment.isFullyRead}
																							<span class="status-indicator read">✓</span>
																						{:else if assignment.readCount > 0}
																							<span class="status-indicator partial">◐</span>
																						{:else}
																							<span class="status-indicator unread">○</span>
																						{/if}
																					</div>
																				</div>
																				
																				{#if assignment.readBy && assignment.readBy.length > 0}
																					<div class="read-by-list">
																						<span class="read-by-label">Read:</span>
																						{#each assignment.readBy as read}
																							<span class="read-by-agent">
																								{read.agentId}
																								<small>({formatTimeAgo(read.readAt)})</small>
																							</span>
																						{/each}
																					</div>
																				{/if}
																				
																				{#if assignment.unreadAgents && assignment.unreadAgents.length > 0}
																					<div class="unread-agents-list">
																						<span class="unread-label">Unread:</span>
																						{#each assignment.unreadAgents as agentId}
																							<span class="unread-agent">{agentId}</span>
																						{/each}
																					</div>
																				{/if}
																			</div>
																		{/each}
																	</div>
																</div>
															{/each}
														</div>
													</div>
												{:else}
													<div class="no-assignments">
														<small>📝 No reading assignments</small>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<div class="empty-state">
										<h4>📭 No messages yet</h4>
										<p>All project messages will appear here with reading assignment status.</p>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{:else if currentSection === 'phases'}
				<div class="phases-section">
					<div class="section-header">
						<h2>Phase Management</h2>
						<button class="btn-primary" on:click={() => showCreatePhaseDialog = true}>
							+ Create Phase
						</button>
					</div>

					<div class="phases-by-role">
						{#each Object.entries(phasesByRole) as [roleType, rolePhases]}
							<div class="role-section">
								<h3>{roleType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
								
								<div class="phase-list">
									{#each rolePhases as phase}
										<div class="phase-card" class:draft={phase.phaseStatus === 'draft'} class:approved={phase.phaseStatus === 'approved'} class:active={phase.phaseStatus === 'active'} class:completed={phase.phaseStatus === 'completed'} class:blocked={phase.phaseStatus === 'blocked'}>
											<div class="phase-header">
												<h4>{phase.title}</h4>
												<div class="phase-controls">
													<select 
														class="phase-status-select" 
														value={phase.phaseStatus} 
														on:change={(e) => updatePhaseStatus(phase, e.target.value)}
													>
														<option value="draft">Draft</option>
														<option value="approved">Approved</option>
														<option value="active">Active</option>
														<option value="completed">Completed</option>
														<option value="blocked">Blocked</option>
													</select>
												</div>
											</div>
											
											<div class="phase-body">
												<p>{phase.body}</p>
											</div>
											
											{#if phase.requiredInputs || phase.expectedOutputs}
												<div class="phase-dependencies">
													{#if phase.requiredInputs}
														<div class="phase-inputs">
															<strong>Required Inputs:</strong> {JSON.parse(phase.requiredInputs).join(', ')}
														</div>
													{/if}
													{#if phase.expectedOutputs}
														<div class="phase-outputs">
															<strong>Expected Outputs:</strong> {JSON.parse(phase.expectedOutputs).join(', ')}
														</div>
													{/if}
												</div>
											{/if}
											
											<div class="phase-meta">
												<span class="phase-status-badge status-{phase.phaseStatus}">
													{phase.phaseStatus}
												</span>
												<span class="phase-created">
													Created: {new Date(phase.createdAt).toLocaleDateString()}
												</span>
											</div>
										</div>
									{/each}
								</div>
								
								{#if rolePhases.length === 0}
									<div class="empty-phases">
										<p>No phases defined for this role yet.</p>
									</div>
								{/if}
							</div>
						{/each}
						
						{#if Object.keys(phasesByRole).length === 0}
							<div class="empty-state">
								<h4>No phases created yet</h4>
								<p>Create your first phase to start organizing work by roles.</p>
							</div>
						{/if}
					</div>
				</div>
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

{#if showStartupPromptEditor}
	<div class="dialog-overlay" on:click={() => showStartupPromptEditor = false}>
		<div class="dialog large-dialog" on:click|stopPropagation>
			<h3>Agent Startup Prompt</h3>
			
			<div class="form-group">
				<label for="startup-prompt">This prompt is sent to each agent when they launch:</label>
				<textarea 
					id="startup-prompt"
					bind:value={startupPrompt}
					placeholder="Enter the startup prompt for new agents..."
					rows="15"
				></textarea>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showStartupPromptEditor = false}>Cancel</button>
				<button class="create-btn" on:click={saveStartupPrompt}>
					Save Prompt
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showCreateChannelDialog}
	<div class="dialog-overlay" on:click={closeCreateChannelDialog}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Create New Channel</h3>
			
			<div class="form-group">
				<label for="channel-name">Name:</label>
				<input 
					id="channel-name"
					type="text" 
					bind:value={newChannel.name} 
					placeholder="Enter channel name"
				/>
			</div>
			
			<div class="form-group">
				<label for="channel-description">Description:</label>
				<textarea 
					id="channel-description"
					bind:value={newChannel.description} 
					placeholder="Channel description (optional)"
					rows="3"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="channel-prompt">Agent Prompt:</label>
				<textarea 
					id="channel-prompt"
					bind:value={newChannel.promptForAgents} 
					placeholder="When should agents use this channel? (optional)"
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={newChannel.isMainChannel}
					/>
					Set as main channel
				</label>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={newChannel.isForHumanDirector}
					/>
					👤 For Human Director communication
				</label>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeCreateChannelDialog}>Cancel</button>
				<button class="create-btn" on:click={createChannel} disabled={!newChannel.name.trim()}>
					Create Channel
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showEditChannelDialog}
	<div class="dialog-overlay" on:click={closeEditChannelDialog}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Edit Channel</h3>
			
			<div class="form-group">
				<label for="edit-channel-id">Channel ID:</label>
				<input 
					id="edit-channel-id"
					type="text" 
					bind:value={editChannel.id} 
					placeholder="Enter channel ID"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="edit-channel-name">Name:</label>
				<input 
					id="edit-channel-name"
					type="text" 
					bind:value={editChannel.name} 
					placeholder="Enter channel name"
				/>
			</div>
			
			<div class="form-group">
				<label for="edit-channel-description">Description:</label>
				<textarea 
					id="edit-channel-description"
					bind:value={editChannel.description} 
					placeholder="Channel description (optional)"
					rows="3"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="edit-channel-prompt">Agent Prompt:</label>
				<textarea 
					id="edit-channel-prompt"
					bind:value={editChannel.promptForAgents} 
					placeholder="When should agents use this channel? (optional)"
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={editChannel.isMainChannel}
					/>
					Set as main channel
				</label>
			</div>
			
			<div class="form-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={editChannel.isForHumanDirector}
					/>
					👤 For Human Director communication
				</label>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeEditChannelDialog}>Cancel</button>
				<button class="create-btn" on:click={updateChannel} disabled={!editChannel.name.trim() || !editChannel.id.trim()}>
					Update Channel
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showCreatePromptDialog}
	<div class="dialog-overlay" on:click={closeCreatePromptDialog}>
		<div class="dialog large-dialog" on:click|stopPropagation>
			<h3>Create New Prompt</h3>
			
			<div class="form-group">
				<label for="prompt-name">Name:</label>
				<input 
					id="prompt-name"
					type="text" 
					bind:value={newPrompt.name} 
					placeholder="Enter prompt name"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="prompt-type">Type:</label>
				<select 
					id="prompt-type"
					bind:value={newPrompt.type}
				>
					<option value="system_intro">System Introduction - Agent startup and identity</option>
					<option value="role_description">Role Description - Detailed role responsibilities and scope</option>
					<option value="communication">Communication - Team interaction and messaging protocols</option>
					<option value="channel_instructions">Channel Instructions - When to use specific channels</option>
					<option value="worktree_workflow">Worktree Workflow - Code management and Git workflows</option>
					<option value="company_workflow">Company Workflow - Business processes and standards</option>
					<option value="custom">Custom - General purpose prompts</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="prompt-content">Content:</label>
				<textarea 
					id="prompt-content"
					bind:value={newPrompt.content} 
					placeholder="Enter prompt content..."
					rows="12"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="prompt-order">Order Index:</label>
				<input 
					id="prompt-order"
					type="number" 
					bind:value={newPrompt.orderIndex} 
					placeholder="0"
					min="0"
				/>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeCreatePromptDialog}>Cancel</button>
				<button class="create-btn" on:click={createPrompt} disabled={!newPrompt.name.trim() || !newPrompt.content.trim()}>
					Create Prompt
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showAddPromptToRoleDialog}
	<div class="dialog-overlay" on:click={() => showAddPromptToRoleDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Add Prompt to Role: {selectedRole?.name}</h3>
			
			{#if availablePromptsForRole.length > 0}
				<div class="form-group">
					<label>Select a prompt to assign to this role:</label>
					<div class="prompt-selection-list">
						{#each availablePromptsForRole as prompt}
							<div class="prompt-selection-item">
								<div class="prompt-info">
									<h4>{prompt.name}</h4>
									<span class="prompt-type-badge">{prompt.type.replace(/_/g, ' ')}</span>
									<p class="prompt-preview">{prompt.content.substring(0, 150)}...</p>
								</div>
								<button 
									class="btn-primary" 
									on:click={() => assignPromptToRole(prompt.id)}
								>
									Assign
								</button>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="empty-state">
					<p>No available prompts to assign. All custom prompts are either already assigned to this role or no custom prompts exist.</p>
					<p>Create new prompts in the Prompts section to assign them to roles.</p>
				</div>
			{/if}
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showAddPromptToRoleDialog = false}>Cancel</button>
			</div>
		</div>
	</div>
{/if}

{#if showEditPromptDialog}
	<div class="dialog-overlay" on:click={closeEditPromptDialog}>
		<div class="dialog large-dialog" on:click|stopPropagation>
			<h3>Edit Prompt</h3>
			
			<div class="form-group">
				<label for="edit-prompt-name">Name:</label>
				<input 
					id="edit-prompt-name"
					type="text" 
					bind:value={editPrompt.name} 
					placeholder="Enter prompt name"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="edit-prompt-type">Type:</label>
				<select 
					id="edit-prompt-type"
					bind:value={editPrompt.type}
				>
					<option value="system_intro">System Introduction - Agent startup and identity</option>
					<option value="role_description">Role Description - Detailed role responsibilities and scope</option>
					<option value="communication">Communication - Team interaction and messaging protocols</option>
					<option value="channel_instructions">Channel Instructions - When to use specific channels</option>
					<option value="worktree_workflow">Worktree Workflow - Code management and Git workflows</option>
					<option value="company_workflow">Company Workflow - Business processes and standards</option>
					<option value="custom">Custom - General purpose prompts</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="edit-prompt-content">Content:</label>
				<textarea 
					id="edit-prompt-content"
					bind:value={editPrompt.content} 
					placeholder="Enter prompt content..."
					rows="12"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="edit-prompt-order">Order Index:</label>
				<input 
					id="edit-prompt-order"
					type="number" 
					bind:value={editPrompt.orderIndex} 
					placeholder="0"
					min="0"
				/>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeEditPromptDialog}>Cancel</button>
				<button class="create-btn" on:click={updatePrompt} disabled={!editPrompt.name.trim() || !editPrompt.content.trim()}>
					Update Prompt
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showUpdateTemplateDialog}
	<div class="dialog-overlay" on:click={() => showUpdateTemplateDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>⚠️ Update Template</h3>
			
			{#if selectedPromptForTemplate}
				<div class="warning-section">
					<div class="warning-box">
						<p><strong>Are you sure you want to update the template?</strong></p>
						<p>This will update the original template with the current content of this prompt.</p>
						<p><strong>Template:</strong> {selectedPromptForTemplate.name}</p>
						<p><strong>Type:</strong> {selectedPromptForTemplate.type}</p>
					</div>
					
					<div class="template-impact">
						<h4>⚠️ Impact:</h4>
						<ul>
							<li>All existing prompts created from this template will <strong>NOT</strong> be automatically updated</li>
							<li>Only new prompts created from this template will use the updated content</li>
							<li>This action cannot be easily undone</li>
						</ul>
					</div>

					<div class="content-preview">
						<h4>New Template Content:</h4>
						<div class="preview-box">
							{selectedPromptForTemplate.content.substring(0, 300)}{#if selectedPromptForTemplate.content.length > 300}...{/if}
						</div>
					</div>
				</div>
			{/if}
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showUpdateTemplateDialog = false}>Cancel</button>
				<button class="btn-warning" on:click={updateTemplate}>
					Yes, Update Template
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showReplyDialog}
	<div class="dialog-overlay" on:click={closeReplyDialog}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Reply to Message</h3>
			
			{#if selectedMessage}
				<div class="reply-context">
					<div class="original-message">
						<div class="original-header">
							<span class="message-icon">{getMessageIcon(selectedMessage)}</span>
							<span class="message-source">
								{#if selectedMessage.isDM}
									DM from {selectedMessage.authorAgentId}
								{:else}
									#{selectedMessage.channelName}
								{/if}
							</span>
							<span class="message-time">{formatTimeAgo(selectedMessage.createdAt)}</span>
						</div>
						<div class="original-content">
							<p>{selectedMessage.body}</p>
						</div>
					</div>
				</div>
			{/if}
			
			<div class="form-group">
				<label for="reply-content">Your Reply:</label>
				<textarea 
					id="reply-content"
					bind:value={replyContent} 
					placeholder="Type your reply..."
					rows="6"
					autofocus
				></textarea>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeReplyDialog}>Cancel</button>
				<button class="create-btn" on:click={sendReply} disabled={!replyContent.trim()}>
					Send Reply
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showSendMessageDialog}
	<div class="dialog-overlay" on:click={() => showSendMessageDialog = false}>
		<div class="dialog dialog-large" on:click|stopPropagation>
			<h3>✉️ Send New Message</h3>
			
			<div class="form-group">
				<label for="message-type">Message Type:</label>
				<select id="message-type" bind:value={newMessage.type}>
					<option value="message">Message</option>
					<option value="announcement">Announcement</option>
					<option value="document">Document</option>
				</select>
			</div>

			<div class="form-group">
				<label for="message-channel">Channel (Optional):</label>
				<select id="message-channel" bind:value={newMessage.channelId}>
					<option value={null}>No Channel (Direct Assignment)</option>
					{#each channels as channel}
						<option value={channel.id}>#{channel.name}</option>
					{/each}
				</select>
			</div>

			<div class="form-group">
				<label for="message-title">Title:</label>
				<input 
					id="message-title"
					type="text" 
					bind:value={newMessage.title}
					placeholder="Message title..."
				/>
			</div>
			
			<div class="form-group">
				<label for="message-body">Message Content:</label>
				<textarea 
					id="message-body"
					bind:value={newMessage.body} 
					placeholder="Type your message..."
					rows="8"
					autofocus
				></textarea>
			</div>

			<div class="form-group">
				<label>Reading Assignments:</label>
				<div class="reading-assignments-section">
					{#each messageReadingAssignments as assignment, index}
						<div class="assignment-item">
							<select bind:value={assignment.assignedToType} on:change={() => assignment.assignedTo = ''}>
								<option value="role">Role</option>
								<option value="agent">Agent</option>
								<option value="squad">Squad</option>
							</select>
							
							{#if assignment.assignedToType === 'role'}
								<select bind:value={assignment.assignedTo}>
									<option value="">Select Role...</option>
									{#each roles as role}
										<option value={role.name}>{role.name}</option>
									{/each}
								</select>
							{:else if assignment.assignedToType === 'agent'}
								<select bind:value={assignment.assignedTo}>
									<option value="">Select Agent...</option>
									{#each agents as agent}
										<option value={agent.id}>{agent.id} ({agent.roleType})</option>
									{/each}
								</select>
							{:else if assignment.assignedToType === 'squad'}
								<select bind:value={assignment.assignedTo}>
									<option value="">Select Squad...</option>
									{#each squads as squad}
										<option value={squad.id}>{squad.name}</option>
									{/each}
								</select>
							{/if}
							
							<button 
								class="btn-remove"
								on:click={() => removeReadingAssignment(index)}
							>×</button>
						</div>
					{/each}
					
					<button 
						class="btn-secondary btn-sm"
						on:click={addReadingAssignment}
					>+ Add Assignment</button>
				</div>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showSendMessageDialog = false}>Cancel</button>
				<button 
					class="create-btn" 
					on:click={sendMessage} 
					disabled={!newMessage.body.trim()}
				>
					Send Message
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showCreatePhaseDialog}
	<div class="dialog-overlay" on:click={() => showCreatePhaseDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Create New Phase</h3>
			
			<div class="form-group">
				<label for="phase-role">Role Type:</label>
				<select 
					id="phase-role"
					bind:value={newPhase.roleType}
				>
					<option value="backend_developer">Backend Developer</option>
					<option value="frontend_developer">Frontend Developer</option>
					<option value="product_manager">Product Manager</option>
					<option value="architect">Architect</option>
					<option value="lead_developer">Lead Developer</option>
					<option value="ai_developer">AI Developer</option>
				</select>
			</div>
			
			<div class="form-group">
				<label for="phase-title">Title:</label>
				<input 
					id="phase-title"
					type="text" 
					bind:value={newPhase.title} 
					placeholder="Enter phase title"
					autofocus
				/>
			</div>
			
			<div class="form-group">
				<label for="phase-body">Description:</label>
				<textarea 
					id="phase-body"
					bind:value={newPhase.body} 
					placeholder="Describe what this phase involves..."
					rows="4"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="phase-inputs">Required Inputs (Document Slugs):</label>
				<input 
					id="phase-inputs"
					type="text" 
					bind:value={newPhase.requiredInputs} 
					placeholder="pm-spec-document, design-wireframes (comma-separated slugs)"
				/>
				<small class="form-help">Optional: Document slugs that must be completed before this phase can start</small>
			</div>
			
			<div class="form-group">
				<label for="phase-outputs">Expected Outputs (Document Slugs):</label>
				<input 
					id="phase-outputs"
					type="text" 
					bind:value={newPhase.expectedOutputs} 
					placeholder="api-documentation, database-schema (comma-separated slugs)"
				/>
				<small class="form-help">Optional: Document slugs that this phase will produce</small>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showCreatePhaseDialog = false}>Cancel</button>
				<button class="create-btn" on:click={createPhase} disabled={!newPhase.title.trim()}>
					Create Phase
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Squad Management Modals -->
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

<!-- Documents Modals -->
{#if showCreateDocumentDialog}
	<div class="dialog-overlay" on:click={() => showCreateDocumentDialog = false}>
		<div class="dialog large" on:click|stopPropagation>
			<h3>Create New Document</h3>
			
			<div class="form-group">
				<label for="document-title">Title:</label>
				<input 
					id="document-title"
					type="text" 
					bind:value={newDocument.title} 
					placeholder="Document title"
				/>
			</div>
			
			<div class="form-group">
				<label for="document-slug">Document Slug (optional):</label>
				<input 
					id="document-slug"
					type="text" 
					bind:value={newDocument.documentSlug} 
					placeholder="document-slug"
				/>
				<small class="form-help">Unique identifier for this document</small>
			</div>
			
			<div class="form-group">
				<label for="document-body">Content:</label>
				<textarea 
					id="document-body"
					bind:value={newDocument.body} 
					placeholder="Document content..."
					rows="10"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="document-squad">Squad (optional):</label>
				<select 
					id="document-squad"
					bind:value={newDocument.squadId}
				>
					<option value="">None</option>
					{#each squads as squad}
						<option value={squad.id}>{squad.name}</option>
					{/each}
				</select>
			</div>

			<!-- Reading Assignments Section -->
			<div class="form-group">
				<label>Reading Assignments:</label>
				<div class="reading-assignments-section">
					{#each documentReadingAssignments as assignment, index}
						<div class="assignment-item">
							<select bind:value={assignment.assignedToType} on:change={() => assignment.assignedTo = ''}>
								<option value="role">Role</option>
								<option value="agent">Agent</option>
								<option value="squad">Squad</option>
							</select>
							
							{#if assignment.assignedToType === 'role'}
								<select bind:value={assignment.assignedTo}>
									<option value="">Select Role...</option>
									{#each roles as role}
										<option value={role.name}>{role.name}</option>
									{/each}
								</select>
							{:else if assignment.assignedToType === 'agent'}
								<select bind:value={assignment.assignedTo}>
									<option value="">Select Agent...</option>
									{#each agents as agent}
										<option value={agent.name}>{agent.name}</option>
									{/each}
								</select>
							{:else if assignment.assignedToType === 'squad'}
								<select bind:value={assignment.assignedTo}>
									<option value="">Select Squad...</option>
									{#each squads as squad}
										<option value={squad.name}>{squad.name}</option>
									{/each}
								</select>
							{/if}
							
							<button class="remove-btn" on:click={() => removeDocumentReadingAssignment(index)}>×</button>
						</div>
					{/each}
					
					<button class="add-assignment-btn" on:click={addDocumentReadingAssignment}>
						+ Add Reading Assignment
					</button>
				</div>
				<small class="form-help">Assign specific agents, roles, or squads to read this document</small>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showCreateDocumentDialog = false}>Cancel</button>
				<button class="create-btn" on:click={createDocument} disabled={!newDocument.title.trim() || !newDocument.body.trim()}>
					Create Document
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showReplyToDocumentDialog}
	<div class="dialog-overlay" on:click={() => showReplyToDocumentDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>{replyToContentId ? 'Reply to Comment' : 'Add Comment'}</h3>
			
			<div class="form-group">
				<label for="reply-content">Comment:</label>
				<textarea 
					id="reply-content"
					bind:value={documentReplyContent} 
					placeholder="Write your comment..."
					rows="4"
				></textarea>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showReplyToDocumentDialog = false}>Cancel</button>
				<button class="create-btn" on:click={replyToDocument} disabled={!documentReplyContent.trim()}>
					Post Comment
				</button>
			</div>
		</div>
	</div>
{/if}

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

	.roles-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.section-header {
		border-bottom: 1px solid #e5e5e5;
		padding-bottom: 16px;
	}

	.role-controls {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.role-selector {
		padding: 6px 12px;
		border: 1px solid #ccc;
		border-radius: 4px;
		min-width: 200px;
	}

	.empty-state {
		color: #666;
		font-style: italic;
		margin: 20px 0;
	}


	.role-actions {
		display: flex;
		gap: 8px;
	}

	.btn-primary, .btn-secondary {
		padding: 6px 12px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.btn-primary {
		background: #007acc;
		color: white;
	}

	.btn-primary:hover {
		background: #005a9e;
	}

	.btn-secondary {
		background: #f5f5f5;
		border: 1px solid #ccc;
	}

	.btn-secondary:hover {
		background: #e5e5e5;
	}

	.role-content h4 {
		margin: 20px 0 8px 0;
		color: #333;
	}

	.role-textarea {
		width: 100%;
		padding: 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: monospace;
		font-size: 14px;
		resize: vertical;
	}

	.prompt-composition {
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
		background: #fafafa;
	}

	.prompt-item {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		margin-bottom: 8px;
		padding: 12px;
		cursor: move;
		transition: all 0.2s ease;
		user-select: none;
	}

	.prompt-item:hover {
		border-color: #007acc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.prompt-item.dragging {
		opacity: 0.5;
		transform: rotate(2deg);
	}

	.prompt-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		font-weight: 500;
	}

	.prompt-order {
		background: #007acc;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 12px;
		min-width: 24px;
		text-align: center;
	}

	.prompt-name {
		flex: 1;
		color: #333;
	}

	.prompt-type {
		background: #f0f0f0;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 12px;
		color: #666;
	}

	.drag-handle {
		color: #999;
		font-size: 18px;
		cursor: grab;
	}

	.drag-handle:active {
		cursor: grabbing;
	}

	.prompt-preview {
		color: #666;
		font-size: 13px;
		line-height: 1.4;
		font-family: monospace;
		background: #f9f9f9;
		padding: 8px;
		border-radius: 3px;
		border-left: 3px solid #007acc;
	}

	.empty-selection {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: #666;
		font-style: italic;
	}

	/* Agents Section Styles */
	.agents-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
		height: calc(100vh - 140px);
	}

	.agent-controls {
		display: flex;
		gap: 8px;
	}

	.agents-content {
		display: flex;
		gap: 20px;
		flex: 1;
		overflow: hidden;
	}

	.agents-left {
		width: 400px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-y: auto;
	}

	.agents-right {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.agents-panel {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 16px;
	}

	.agents-panel h3 {
		margin: 0 0 12px 0;
		color: #333;
	}

	.agents-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.agents-header h3 {
		margin: 0;
	}

	.agent-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.agent-item {
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: all 0.2s ease;
		cursor: pointer !important;
		user-select: none;
	}





	.agent-item:hover {
		border-color: #007acc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.agent-item.active {
		border-color: #007acc;
		background: #f0f8ff;
	}

	.agent-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.agent-id {
		font-weight: 500;
		color: #333;
	}

	.agent-model {
		font-size: 12px;
		background: #e7f3ff;
		color: #0066cc;
		padding: 2px 6px;
		border-radius: 10px;
	}


	.agent-details {
		display: flex;
		gap: 8px;
		font-size: 12px;
		color: #666;
	}

	.agent-uptime {
		font-family: monospace;
	}

	.agent-status {
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
	}

	.status-active {
		background: #e8f5e8;
		color: #2d7d2d;
	}

	.status-idle {
		background: #fff3cd;
		color: #856404;
	}

	.status-offline {
		background: #f8d7da;
		color: #721c24;
	}

	.agent-id-section {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.agent-status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
		animation: pulse 2s infinite;
	}

	.agent-status-indicator.status-active {
		background: #28a745;
		animation: pulse-active 1.5s infinite;
	}

	.agent-status-indicator.status-idle {
		background: #ffc107;
		animation: pulse-idle 2s infinite;
	}

	.agent-status-indicator.status-offline {
		background: #dc3545;
		animation: none;
	}

	.agent-heartbeat {
		font-size: 10px;
		color: #666;
		font-style: italic;
	}

	@keyframes pulse-active {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	@keyframes pulse-idle {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.btn-launch {
		background: #28a745;
		color: white;
		border: none;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}

	.btn-launch:hover {
		background: #218838;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
		border: none;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}

	.btn-danger:hover {
		background: #c82333;
	}

	.agent-details-panel {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.agent-details-header {
		padding: 16px;
		border-bottom: 1px solid #e5e5e5;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.agent-details-header h3 {
		margin: 0;
		font-family: monospace;
	}

	.agent-console {
		flex: 1;
		padding: 16px;
		display: flex;
		flex-direction: column;
	}

	.agent-console h4 {
		margin: 0 0 8px 0;
		color: #333;
	}

	.console-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.console-output {
		flex: 1;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 12px;
		background: #1a1a1a;
		color: #00ff00;
		border: none;
		padding: 12px;
		border-radius: 4px;
		resize: none;
		white-space: pre-wrap;
		height: 500px;
	}

	.console-output:focus {
		outline: none;
	}

	.role-selector, .model-selector {
		padding: 6px 12px;
		border: 1px solid #ccc;
		border-radius: 4px;
		min-width: 120px;
	}

	.large-dialog {
		width: 600px;
		max-width: 90vw;
	}

	.section-subtitle {
		margin: 16px 0 8px 0;
		color: #666;
		font-size: 14px;
		font-weight: 500;
	}

	.agent-item.launching {
		background: #fff8dc;
		border-color: #ffc107;
		cursor: pointer !important;
	}

	.agent-priority {
		background: #007acc;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 500;
		min-width: 20px;
		text-align: center;
		margin-right: 8px;
	}

	.status-launching {
		background: #fff3cd;
		color: #856404;
	}

	.agent-role {
		font-size: 12px;
		color: #666;
	}

	/* Channels Section Styles */
	.channels-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
		height: calc(100vh - 140px);
	}

	.channels-content {
		display: flex;
		gap: 20px;
		flex: 1;
		overflow: hidden;
	}

	.channels-left {
		width: 400px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-y: auto;
	}

	.channels-right {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.channels-panel {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 16px;
	}

	.channels-panel h3 {
		margin: 0 0 12px 0;
		color: #333;
	}

	.channels-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.channels-header h3 {
		margin: 0;
	}

	.channel-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.channel-item {
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: all 0.2s ease;
		cursor: pointer;
		user-select: none;
	}

	.channel-item:hover {
		border-color: #007acc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.channel-item.active {
		border-color: #007acc;
		background: #f0f8ff;
	}

	.channel-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.channel-id {
		font-family: monospace;
		font-weight: 500;
		color: #333;
		background: #f0f0f0;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.channel-badge {
		background: #28a745;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 500;
	}

	.channel-details {
		display: flex;
		gap: 8px;
		font-size: 12px;
		color: #666;
	}

	.channel-name {
		font-weight: 500;
		color: #333;
	}

	.channel-details-panel {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.channel-details-header {
		padding: 16px;
		border-bottom: 1px solid #e5e5e5;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.channel-details-header h3 {
		margin: 0;
		font-family: monospace;
	}

	.channel-actions {
		display: flex;
		gap: 8px;
	}
	
	/* Channel view toggle styles */
	.channel-view-toggle {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	
	.view-toggle-btn {
		padding: 6px 12px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		color: #666;
		transition: all 0.2s;
	}
	
	.view-toggle-btn:hover {
		background: #f5f5f5;
		border-color: #ccc;
	}
	
	.view-toggle-btn.active {
		background: #007acc;
		border-color: #007acc;
		color: white;
	}
	
	.view-toggle-btn.settings-btn {
		padding: 6px 8px;
		min-width: 32px;
		text-align: center;
	}

	.channel-info {
		flex: 1;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		overflow-y: auto;
		min-height: 0;
	}

	.info-section h4 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 14px;
		font-weight: 600;
	}

	.info-section p {
		margin: 0;
		color: #666;
		line-height: 1.4;
	}

	.prompt-preview {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		padding: 12px;
		font-family: monospace;
		font-size: 13px;
		color: #666;
		white-space: pre-wrap;
		border-left: 3px solid #007acc;
	}

	.status-badge {
		background: #e7f3ff;
		color: #0066cc;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 500;
	}

	.status-badge.default {
		background: #e8f5e8;
		color: #2d7d2d;
	}

	/* Role Assignment Styles */
	.public-channel-message {
		padding: 16px;
		background: #e8f5e8;
		border: 1px solid #4caf50;
		border-radius: 6px;
		color: #2e7d32;
	}

	.public-channel-message p {
		margin: 0 0 8px 0;
	}

	.public-channel-message p:last-child {
		margin-bottom: 0;
	}

	.role-assignments {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.assigned-roles, .available-roles {
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 12px;
		background: #fafafa;
	}

	.assigned-roles h5, .available-roles h5 {
		margin: 0 0 12px 0;
		font-size: 13px;
		font-weight: 600;
		color: #333;
	}

	.role-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.role-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		border-radius: 4px;
		background: white;
		border: 1px solid #e5e5e5;
	}

	.role-item.assigned {
		border-color: #4caf50;
		background: #f8fff8;
	}

	.role-item.available {
		border-color: #ddd;
		background: white;
	}

	.role-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.role-name {
		font-size: 13px;
		font-weight: 500;
		color: #333;
	}

	.role-status {
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 3px;
		background: #ffa726;
		color: white;
	}

	.role-status.inactive {
		background: #ff7043;
	}

	.btn-remove, .btn-add {
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 14px;
		font-weight: bold;
	}

	.btn-remove {
		background: #f44336;
		color: white;
	}

	.btn-remove:hover {
		background: #d32f2f;
	}

	.btn-add {
		background: #4caf50;
		color: white;
	}

	.btn-add:hover {
		background: #388e3c;
	}

	.no-roles {
		font-size: 13px;
		color: #999;
		font-style: italic;
		margin: 0;
	}

	.loading {
		font-size: 13px;
		color: #666;
		font-style: italic;
		margin: 0;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
		cursor: pointer;
	}

	.checkbox-label input[type="checkbox"] {
		margin: 0;
		width: auto;
	}
	
	/* Messages view styles */
	.messages-view {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	
	.messages-container {
		flex: 1;
		overflow-y: auto;
		margin-bottom: 16px;
	}
	
	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 8px 0;
	}
	
	.message {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 12px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}
	
	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
		font-size: 12px;
	}
	
	.message-author {
		font-weight: 600;
		color: #007acc;
	}
	
	.message-time {
		color: #999;
	}
	
	.message-content {
		font-size: 14px;
		line-height: 1.4;
		color: #333;
	}

	/* Ticket-specific styles */
	.message.ticket {
		border-left: 4px solid #ff9800;
		background: #fefaf6;
	}

	.ticket-badge {
		background: #ff9800;
		color: white;
		font-size: 10px;
		font-weight: bold;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.ticket-info {
		margin-top: 8px;
	}

	.ticket-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.ticket-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
		flex: 1;
	}

	.ticket-badges {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
		margin-left: 12px;
	}

	.priority-badge, .status-badge {
		font-size: 10px;
		font-weight: bold;
		padding: 3px 8px;
		border-radius: 12px;
		text-transform: uppercase;
	}

	.priority-badge.priority-critical {
		background: #f44336;
		color: white;
	}

	.priority-badge.priority-high {
		background: #ff9800;
		color: white;
	}

	.priority-badge.priority-medium {
		background: #2196f3;
		color: white;
	}

	.priority-badge.priority-low {
		background: #4caf50;
		color: white;
	}

	.status-badge.status-open {
		background: #e3f2fd;
		color: #1976d2;
	}

	.status-badge.status-in-progress {
		background: #fff3e0;
		color: #f57c00;
	}

	.status-badge.status-blocked {
		background: #ffebee;
		color: #d32f2f;
	}

	.status-badge.status-ready-for-review {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.status-badge.status-reviewing {
		background: #fce4ec;
		color: #c2185b;
	}

	.status-badge.status-review-passed {
		background: #e8f5e8;
		color: #388e3c;
	}

	.status-badge.status-needs-attention {
		background: #fff8e1;
		color: #f57c00;
	}

	.status-badge.status-resolved {
		background: #e8f5e8;
		color: #388e3c;
	}

	.status-badge.status-closed {
		background: #f5f5f5;
		color: #757575;
	}

	.ticket-assignment {
		display: flex;
		gap: 12px;
		margin-bottom: 12px;
		font-size: 12px;
	}

	.assigned-role, .claimed-agent {
		background: #f5f5f5;
		padding: 4px 8px;
		border-radius: 4px;
		color: #666;
		font-weight: 500;
	}

	.claimed-agent {
		background: #e3f2fd;
		color: #1976d2;
	}

	.ticket-body {
		font-size: 14px;
		line-height: 1.4;
		color: #333;
		margin-bottom: 8px;
	}

	.ticket-updated {
		font-size: 11px;
		color: #999;
		font-style: italic;
	}
	
	.message-assignments {
		margin-top: 8px;
		padding: 8px;
		background: #f0f8ff;
		border-left: 3px solid #007acc;
		border-radius: 0 4px 4px 0;
		font-size: 11px;
		color: #666;
	}
	
	.assignment {
		margin-bottom: 8px;
	}
	
	.assignment:last-child {
		margin-bottom: 0;
	}
	
	.assignment-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}
	
	.assignment-target {
		font-weight: 600;
		color: #333;
	}
	
	.read-status {
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 10px;
		font-weight: 500;
	}
	
	.read-status.fully-read {
		background: #d4edda;
		color: #155724;
	}
	
	.read-status.partially-read {
		background: #fff3cd;
		color: #856404;
	}
	
	.read-status.unread {
		background: #f8d7da;
		color: #721c24;
		font-weight: 600;
	}
	
	.agents-status {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	
	.agent-status {
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 8px;
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		font-weight: 500;
	}
	
	.agent-status.read {
		background: #cce5ff;
		border-color: #b3d4fc;
		color: #004085;
	}
	
	.agent-status.acknowledged {
		background: #d1e7dd;
		border-color: #badbcc;
		color: #0f5132;
	}
	
	.no-messages {
		text-align: center;
		padding: 40px 20px;
		color: #999;
	}
	
	.no-messages p {
		margin: 8px 0;
	}
	
	.message-input-container {
		border-top: 1px solid #e5e5e5;
		padding-top: 16px;
	}
	
	.message-input-wrapper {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}
	
	.message-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		background: #f9f9f9;
	}
	
	.message-input:disabled {
		background: #f5f5f5;
		color: #999;
	}
	
	.send-btn {
		padding: 8px 16px;
		background: #007acc;
		color: white;
		border: none;
		border-radius: 4px;
		font-weight: 500;
		cursor: pointer;
	}
	
	.send-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}
	
	.input-note {
		font-size: 12px;
		color: #999;
		font-style: italic;
		margin: 0;
		text-align: center;
	}
	
	/* Settings view styles */
	.settings-view {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	
	.channel-actions-section {
		border-bottom: 1px solid #e5e5e5;
		padding-bottom: 16px;
		margin-bottom: 4px;
	}
	
	.settings-actions {
		display: flex;
		gap: 8px;
	}
	
	/* Prompts Section Styles */
	.prompts-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	
	.prompt-type-section {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 16px;
	}
	
	.prompt-type-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
		padding-bottom: 8px;
		border-bottom: 1px solid #e5e5e5;
	}
	
	.prompt-type-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}
	
	.prompt-count {
		background: #007acc;
		color: white;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 500;
	}
	
	.prompt-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	
	.prompt-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 16px;
		transition: all 0.2s ease;
	}
	
	.prompt-card:hover {
		border-color: #007acc;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
	
	.prompt-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}
	
	.prompt-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	
	.prompt-name {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}
	
	.prompt-badge {
		font-size: 11px;
		padding: 3px 8px;
		border-radius: 12px;
		font-weight: 500;
	}
	
	.prompt-badge.premade {
		background: #e8f5e8;
		color: #2d7d2d;
		border: 1px solid #4caf50;
	}
	
	.prompt-badge.custom {
		background: #e7f3ff;
		color: #0066cc;
		border: 1px solid #007acc;
	}

	.prompt-badge.template {
		background: #fff3e0;
		color: #e65100;
		border: 1px solid #ff9800;
	}
	
	.prompt-badge.source-role {
		background: #fff3e0;
		color: #e65100;
		border: 1px solid #ff9800;
	}
	
	.prompt-badge.source-squad {
		background: #f3e5f5;
		color: #7b1fa2;
		border: 1px solid #9c27b0;
	}
	
	.prompt-badge.source-global {
		background: #e8f5e8;
		color: #2e7d32;
		border: 1px solid #4caf50;
	}
	
	.prompt-actions {
		display: flex;
		gap: 4px;
	}
	
	.prompt-actions button {
		padding: 4px 8px;
		font-size: 12px;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}
	
	.prompt-preview {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		padding: 12px;
		font-family: monospace;
		font-size: 13px;
		color: #666;
		line-height: 1.4;
		border-left: 3px solid #007acc;
		margin-bottom: 12px;
		white-space: pre-wrap;
	}
	
	.prompt-metadata {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: #999;
	}
	
	.prompt-order {
		font-weight: 500;
	}
	
	.prompt-created {
		font-style: italic;
	}

	/* Prompt Assignment Styles */
	.section-header-with-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.section-header-with-action h4 {
		margin: 0;
	}

	.prompt-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.btn-danger-small {
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		padding: 4px 8px;
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-danger-small:hover {
		background: #c82333;
	}

	.prompt-selection-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: 400px;
		overflow-y: auto;
	}

	.prompt-selection-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		background: #f9f9f9;
	}

	.prompt-selection-item .prompt-info {
		flex: 1;
	}

	.prompt-selection-item h4 {
		margin: 0 0 4px 0;
		font-size: 14px;
		color: #333;
	}

	.prompt-type-badge {
		background: #e7f3ff;
		color: #0066cc;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 11px;
		margin-bottom: 8px;
		display: inline-block;
	}

	.prompt-selection-item .prompt-preview {
		font-size: 12px;
		color: #666;
		margin: 4px 0 0 0;
		line-height: 1.4;
	}

	/* Template Update Styles */
	.btn-template {
		background: #ff9800;
		color: white;
		border: none;
		border-radius: 4px;
		padding: 6px 12px;
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.2s;
		margin-right: 8px;
	}

	.btn-template:hover {
		background: #f57c00;
	}

	.btn-warning {
		background: #ff9800;
		color: white;
		border: none;
		border-radius: 4px;
		padding: 8px 16px;
		font-size: 14px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-warning:hover {
		background: #f57c00;
	}

	.warning-section {
		margin-bottom: 20px;
	}

	.warning-box {
		background: #fff3e0;
		border: 1px solid #ff9800;
		border-radius: 4px;
		padding: 12px;
		margin-bottom: 16px;
	}

	.warning-box p {
		margin: 4px 0;
	}

	.template-impact {
		background: #ffebee;
		border: 1px solid #e57373;
		border-radius: 4px;
		padding: 12px;
		margin-bottom: 16px;
	}

	.template-impact h4 {
		margin: 0 0 8px 0;
		color: #c62828;
	}

	.template-impact ul {
		margin: 0;
		padding-left: 20px;
	}

	.template-impact li {
		margin: 4px 0;
		color: #666;
	}

	.content-preview {
		margin-bottom: 16px;
	}

	.content-preview h4 {
		margin: 0 0 8px 0;
		color: #333;
	}

	.preview-box {
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
		font-family: monospace;
		font-size: 12px;
		color: #666;
		white-space: pre-wrap;
		max-height: 200px;
		overflow-y: auto;
	}
	
	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: #666;
	}
	
	.empty-state h3 {
		margin: 0 0 12px 0;
		color: #333;
	}
	
	.empty-state p {
		margin: 0 0 20px 0;
		font-size: 14px;
	}

	/* Communications Center Styles */
	.communications-section {
		padding: 20px;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.comms-stats {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.stat {
		padding: 6px 12px;
		background: #f0f0f0;
		border-radius: 16px;
		font-size: 12px;
		font-weight: 500;
		color: #666;
	}

	.stat.urgent {
		background: #ffebee;
		color: #c62828;
	}

	.stat.urgent.has-urgent {
		background: #f44336;
		color: white;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0% { opacity: 1; }
		50% { opacity: 0.7; }
		100% { opacity: 1; }
	}

	.comms-nav {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
		padding: 4px;
		background: #f5f5f5;
		border-radius: 8px;
	}

	.comms-nav-btn {
		padding: 10px 16px;
		border: none;
		background: transparent;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		color: #666;
		transition: all 0.2s ease;
	}

	.comms-nav-btn:hover {
		background: #e0e0e0;
		color: #333;
	}

	.comms-nav-btn.active {
		background: #2196f3;
		color: white;
		box-shadow: 0 2px 4px rgba(33, 150, 243, 0.3);
	}

	.comms-content {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.message-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.message-card {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 16px;
		transition: all 0.2s ease;
	}

	.message-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		border-color: #ddd;
	}

	.message-card.urgent {
		border-left: 4px solid #f44336;
		background: #fefefe;
	}

	.message-card.unread {
		border-left: 4px solid #2196f3;
		background: #f8fafe;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.message-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
	}

	.message-icon {
		font-size: 16px;
	}

	.message-source {
		font-weight: 500;
		color: #333;
		font-size: 14px;
	}

	.message-time {
		color: #888;
		font-size: 12px;
	}

	.unread-badge {
		background: #ff5722;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 10px;
		font-weight: bold;
	}

	.director-badge {
		background: #9c27b0;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 10px;
		font-weight: bold;
		margin-left: 4px;
	}

	.message-actions {
		display: flex;
		gap: 8px;
	}

	.btn-small {
		padding: 4px 8px;
		font-size: 12px;
		border: 1px solid #ddd;
		background: white;
		color: #666;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-small:hover {
		background: #f5f5f5;
		border-color: #bbb;
	}

	.btn-small.btn-primary {
		background: #2196f3;
		color: white;
		border-color: #2196f3;
	}

	.btn-small.btn-primary:hover {
		background: #1976d2;
		border-color: #1976d2;
	}

	.message-content {
		line-height: 1.5;
	}

	.message-title {
		margin: 0 0 8px 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.message-body {
		color: #444;
		white-space: pre-wrap;
		margin-bottom: 8px;
	}

	.parent-context {
		padding: 8px 12px;
		background: #f5f5f5;
		border-radius: 4px;
		border-left: 3px solid #ddd;
		color: #666;
		font-size: 12px;
		margin-top: 8px;
	}

	/* Dashboard Styles */
	.dashboard-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 20px;
	}

	.dashboard-card {
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.dashboard-card h3 {
		margin: 0 0 16px 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.activity-stats {
		display: flex;
		gap: 16px;
	}

	.stat-item {
		text-align: center;
		flex: 1;
	}

	.stat-number {
		display: block;
		font-size: 24px;
		font-weight: bold;
		color: #2196f3;
		margin-bottom: 4px;
	}

	.stat-label {
		font-size: 12px;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.agent-activity-list,
	.channel-activity-list,
	.recent-activity-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.activity-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: #f9f9f9;
		border-radius: 4px;
		font-size: 13px;
	}

	.activity-item.recent {
		align-items: flex-start;
		padding: 12px;
	}

	.agent-name,
	.channel-name {
		font-weight: 500;
		color: #333;
	}

	.activity-count {
		color: #666;
		font-size: 12px;
	}

	.activity-time {
		color: #888;
		font-size: 11px;
	}

	.activity-details {
		flex: 1;
		margin: 0 12px;
	}

	.activity-summary {
		display: block;
		font-weight: 500;
		color: #333;
		margin-bottom: 2px;
	}

	.activity-preview {
		display: block;
		color: #666;
		font-size: 12px;
	}

	.empty-note {
		color: #888;
		font-style: italic;
		text-align: center;
		padding: 20px;
		margin: 0;
	}

	/* Assistant View Styles */
	.assistant-view {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.assistant-header {
		margin-bottom: 20px;
		padding-bottom: 16px;
		border-bottom: 1px solid #e5e5e5;
	}

	.assistant-header h3 {
		margin: 0 0 8px 0;
		color: #333;
	}

	.assistant-description {
		margin: 0;
		color: #666;
		font-size: 14px;
	}
	.assistant-title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 20px;
	}
	.assistant-controls {
		display: flex;
		align-items: center;
	}
	.toggle-container {
		display: flex;
		align-items: center;
		gap: 12px;
		cursor: pointer;
		user-select: none;
	}
	.toggle-label {
		font-size: 14px;
		color: #333;
		font-weight: 500;
	}
	.toggle-container input[type="checkbox"] {
		display: none;
	}
	.toggle-slider {
		position: relative;
		width: 44px;
		height: 24px;
		background: #ccc;
		border-radius: 12px;
		transition: background 0.3s ease;
	}
	.toggle-slider::before {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		background: white;
		border-radius: 50%;
		transition: transform 0.3s ease;
		box-shadow: 0 2px 4px rgba(0,0,0,0.2);
	}
	.toggle-container input:checked + .toggle-slider {
		background: #4CAF50;
	}
	.toggle-container input:checked + .toggle-slider::before {
		transform: translateX(20px);
	}
	.forwarding-notice {
		margin-top: 12px;
		padding: 8px 12px;
		background: #e8f5e8;
		border: 1px solid #c3e6c3;
		border-radius: 6px;
		font-size: 13px;
		color: #2d5a2d;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.notice-icon {
		font-size: 16px;
	}

	.assistant-chat {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		margin-bottom: 20px;
	}

	.assistant-message {
		margin-bottom: 8px;
		padding: 8px 12px;
		border-radius: 4px;
		width: 100%;
		border: 1px solid #e0e0e0;
	}

	.assistant-message.from-director {
		background: #f0f8ff;
		border-color: #2196f3;
	}

	.assistant-message.from-assistant {
		background: #f9f9f9;
		border-color: #ccc;
	}

	.assistant-message .message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
		font-size: 11px;
		color: #666;
		font-weight: 500;
	}

	.assistant-message.from-director .message-header {
		color: #0066cc;
	}

	.assistant-message .message-body {
		white-space: pre-wrap;
		line-height: 1.3;
		font-size: 14px;
		color: #333;
	}

	.empty-chat {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color: #666;
		text-align: center;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-chat h4 {
		margin: 0 0 8px 0;
		font-size: 18px;
	}

	.empty-chat p {
		margin: 0;
		font-size: 14px;
	}

	.assistant-input {
		border-top: 1px solid #e5e5e5;
		padding-top: 16px;
	}

	.input-container {
		display: flex;
		gap: 12px;
		align-items: flex-end;
	}

	.input-container textarea {
		flex: 1;
		padding: 12px;
		border: 1px solid #ddd;
		border-radius: 6px;
		resize: vertical;
		min-height: 60px;
		font-family: inherit;
		font-size: 14px;
	}

	.input-container textarea:focus {
		outline: none;
		border-color: #2196f3;
		box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
	}

	.send-btn {
		padding: 12px 24px;
		background: #2196f3;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.send-btn:hover:not(:disabled) {
		background: #1976d2;
	}

	.send-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.input-hint {
		margin-top: 8px;
		font-size: 12px;
		color: #666;
		text-align: center;
	}

	/* Reply Dialog Styles */
	.reply-context {
		margin-bottom: 20px;
		padding: 16px;
		background: #f8f9fa;
		border-radius: 6px;
		border: 1px solid #e9ecef;
	}

	.original-message {
		background: white;
		border-radius: 4px;
		padding: 12px;
	}

	.original-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		font-size: 12px;
		color: #666;
	}

	.original-content h4 {
		margin: 0 0 6px 0;
		font-size: 14px;
		color: #333;
	}

	.original-content p {
		margin: 0;
		color: #444;
		font-size: 13px;
		line-height: 1.4;
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

	/* Phase Management Styles */
	.phases-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
		height: 100%;
		padding: 20px;
	}

	.phases-by-role {
		display: flex;
		flex-direction: column;
		gap: 24px;
		overflow-y: auto;
	}

	.role-section {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 20px;
	}

	.role-section h3 {
		margin: 0 0 16px 0;
		font-size: 18px;
		font-weight: 600;
		color: #333;
		border-bottom: 2px solid #007acc;
		padding-bottom: 8px;
	}

	.phase-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.phase-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 16px;
		transition: all 0.2s ease;
		border-left: 4px solid #e5e5e5;
	}

	.phase-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		border-color: #ddd;
	}

	.phase-card.draft {
		border-left-color: #999;
		background: #fafafa;
	}

	.phase-card.approved {
		border-left-color: #2196f3;
		background: #f8fafe;
	}

	.phase-card.active {
		border-left-color: #ff9800;
		background: #fffbf0;
		box-shadow: 0 2px 8px rgba(255, 152, 0, 0.2);
	}

	.phase-card.completed {
		border-left-color: #4caf50;
		background: #f8fff8;
	}

	.phase-card.blocked {
		border-left-color: #f44336;
		background: #fffafa;
	}

	.phase-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.phase-header h4 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
		flex: 1;
		margin-right: 12px;
	}

	.phase-controls {
		flex-shrink: 0;
	}

	.phase-status-select {
		padding: 6px 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		background: white;
		color: #333;
		cursor: pointer;
	}

	.phase-body {
		margin-bottom: 16px;
		color: #444;
		line-height: 1.5;
	}

	.phase-body p {
		margin: 0;
	}

	.phase-dependencies {
		background: #f5f5f5;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		padding: 12px;
		margin-bottom: 16px;
		font-size: 13px;
	}

	.phase-inputs, .phase-outputs {
		margin-bottom: 8px;
	}

	.phase-inputs:last-child, .phase-outputs:last-child {
		margin-bottom: 0;
	}

	.phase-inputs strong, .phase-outputs strong {
		color: #333;
	}

	.phase-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: #666;
	}

	.phase-status-badge {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 10px;
		font-weight: bold;
		text-transform: uppercase;
	}

	.status-draft {
		background: #f5f5f5;
		color: #666;
	}

	.status-approved {
		background: #e3f2fd;
		color: #1976d2;
	}

	.status-active {
		background: #fff3e0;
		color: #f57c00;
	}

	.status-completed {
		background: #e8f5e8;
		color: #388e3c;
	}

	.status-blocked {
		background: #ffebee;
		color: #d32f2f;
	}

	.phase-created {
		font-style: italic;
	}

	.empty-phases {
		text-align: center;
		padding: 40px 20px;
		color: #666;
	}

	.empty-phases p {
		margin: 0;
		font-style: italic;
	}

	.form-help {
		display: block;
		font-size: 11px;
		color: #666;
		margin-top: 4px;
		font-style: italic;
	}

	/* Squad Management Styles */
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

	.squad-overview,
	.squad-roles {
		flex: 1;
		padding: 20px;
		overflow: auto;
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
		align-items: center;
		padding: 12px 16px;
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.role-item:hover {
		border-color: #007bff;
		box-shadow: 0 2px 4px rgba(0,0,0,0.08);
	}

	.role-info h5 {
		margin: 0 0 4px 0;
		font-size: 16px;
		font-weight: 600;
		color: #333;
	}

	.role-content {
		margin: 0;
		font-size: 13px;
		color: #666;
		line-height: 1.4;
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
		padding: 12px 16px;
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		width: 100%;
	}

	.role-option:hover {
		border-color: #007bff;
		background: #f8f9ff;
	}

	.role-name {
		font-weight: 600;
		font-size: 14px;
		color: #333;
		margin-bottom: 4px;
	}

	.role-preview {
		font-size: 12px;
		color: #666;
		line-height: 1.3;
	}

	/* Monitoring Service Styles */
	.monitoring-section {
		margin: 24px 0;
		padding: 20px;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		background: #f9f9ff;
	}

	.monitoring-section h3 {
		margin: 0 0 16px 0;
		color: #333;
	}

	.monitoring-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.monitoring-status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
	}

	.status-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #dc3545;
		transition: background 0.3s ease;
	}

	.status-indicator.active {
		background: #28a745;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.monitoring-actions {
		display: flex;
		gap: 8px;
	}

	.btn-start {
		padding: 6px 12px;
		background: #28a745;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn-start:hover {
		background: #218838;
	}

	.btn-stop {
		padding: 6px 12px;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn-stop:hover {
		background: #c82333;
	}

	.btn-refresh {
		padding: 6px 12px;
		background: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn-refresh:hover {
		background: #545b62;
	}

	.monitoring-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		padding: 16px;
		background: white;
		border-radius: 6px;
		border: 1px solid #e0e0e0;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.stat-label {
		font-size: 12px;
		color: #666;
		font-weight: 500;
	}

	.stat-value {
		font-size: 16px;
		font-weight: bold;
		color: #333;
	}

	/* Send Message Dialog Styles */
	.dialog-large {
		max-width: 600px;
		max-height: 80vh;
		overflow-y: auto;
	}

	.reading-assignments-section {
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 12px;
		background: #f9f9f9;
	}

	.assignment-item {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-bottom: 8px;
		padding: 8px;
		background: white;
		border-radius: 4px;
		border: 1px solid #e5e5e5;
	}

	.assignment-item select {
		flex: 1;
		padding: 4px 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
	}

	.btn-remove {
		width: 24px;
		height: 24px;
		border: none;
		background: #dc3545;
		color: white;
		border-radius: 50%;
		cursor: pointer;
		font-size: 14px;
		font-weight: bold;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-remove:hover {
		background: #c82333;
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

	.btn-sm {
		font-size: 12px;
		padding: 4px 8px;
	}

	/* Documents Section Styles */
	.documents-section {
		padding: 20px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.documents-layout {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 20px;
		height: 100%;
		flex: 1;
		min-height: 0;
	}

	.documents-sidebar {
		border-right: 1px solid #ddd;
		padding-right: 20px;
		overflow-y: auto;
	}

	.documents-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.document-item {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 12px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.document-item:hover {
		border-color: #007bff;
		box-shadow: 0 2px 4px rgba(0,123,255,0.1);
	}

	.document-item.selected {
		border-color: #007bff;
		background-color: #f8f9ff;
		box-shadow: 0 2px 8px rgba(0,123,255,0.15);
	}

	.document-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 8px;
	}

	.document-header h4 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #333;
		flex: 1;
	}

	.document-type {
		background: #e9ecef;
		color: #495057;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		margin-left: 8px;
	}

	.document-meta {
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: #666;
		margin-bottom: 8px;
	}

	.read-status {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.assignment {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
	}

	.assignee {
		font-weight: 500;
	}

	.status.read {
		color: #28a745;
	}

	.document-viewer {
		overflow-y: auto;
		padding: 0 20px;
	}

	.document-content {
		max-width: none;
	}

	.document-header-full {
		border-bottom: 1px solid #e0e0e0;
		padding-bottom: 16px;
		margin-bottom: 20px;
	}

	.document-header-full h1 {
		margin: 0 0 8px 0;
		font-size: 24px;
		color: #333;
	}

	.document-meta-full {
		display: flex;
		align-items: center;
		gap: 16px;
		font-size: 14px;
		color: #666;
	}

	.document-type-badge {
		background: #007bff;
		color: white;
		padding: 4px 12px;
		border-radius: 16px;
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
	}

	.document-body {
		margin-bottom: 32px;
	}

	.document-text {
		font-size: 15px;
		line-height: 1.6;
		color: #333;
	}

	.read-assignments {
		margin-bottom: 32px;
		padding: 20px;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.read-assignments h3 {
		margin: 0 0 16px 0;
		font-size: 16px;
		color: #333;
	}

	.assignment-detail {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px solid #e9ecef;
	}

	.assignment-detail:last-child {
		border-bottom: none;
	}

	.assignment-info {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.assignment-type {
		color: #666;
		font-size: 12px;
	}

	.read-status-detail {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: right;
	}

	.read-record {
		display: flex;
		gap: 8px;
		font-size: 12px;
		align-items: center;
	}

	.ack {
		color: #28a745;
		font-weight: 500;
	}

	.unread {
		color: #dc3545;
		font-weight: 500;
	}

	.document-replies {
		margin-top: 32px;
		padding-top: 20px;
		border-top: 1px solid #e0e0e0;
	}

	.replies-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.replies-header h3 {
		margin: 0;
		font-size: 18px;
		color: #333;
	}

	.reply-item {
		border: 1px solid #e9ecef;
		border-radius: 8px;
		padding: 16px;
		margin-bottom: 16px;
	}

	.reply-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		padding-bottom: 8px;
		border-bottom: 1px solid #f1f3f4;
	}

	.reply-author {
		font-weight: 600;
		color: #333;
	}

	.reply-date {
		color: #666;
		font-size: 12px;
	}

	.reply-btn {
		background: none;
		border: none;
		color: #007bff;
		cursor: pointer;
		font-size: 12px;
		padding: 4px 8px;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.reply-btn:hover {
		background-color: #f8f9ff;
	}

	.reply-body {
		font-size: 14px;
		line-height: 1.5;
		color: #555;
	}

	.nested-replies {
		margin-top: 12px;
		margin-left: 20px;
		border-left: 2px solid #e9ecef;
		padding-left: 16px;
	}

	.nested-reply {
		border: 1px solid #f1f3f4;
		border-radius: 6px;
		padding: 12px;
		margin-bottom: 8px;
		background: #fafbfc;
	}

	.empty-replies {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.empty-document-viewer {
		text-align: center;
		padding: 60px 20px;
		color: #666;
	}

	.empty-document-viewer h3 {
		margin: 0 0 12px 0;
		color: #333;
	}

	.dialog.large {
		max-width: 800px;
		width: 90vw;
	}

	.dialog.large textarea {
		min-height: 200px;
	}

	/* Reading Assignments - Grouped Display */
	.reading-status-section {
		margin-top: 12px;
		border-top: 1px solid #e5e5e5;
		padding-top: 12px;
	}

	.assignments-grouped {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.assignment-group {
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		background: #fafafa;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: #f0f0f0;
		border-bottom: 1px solid #e0e0e0;
		border-radius: 6px 6px 0 0;
		font-size: 14px;
	}

	.group-type-icon {
		font-size: 16px;
	}

	.group-count {
		color: #666;
		font-weight: normal;
	}

	.assignment-items {
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.assignment-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 12px;
		background: white;
		border: 1px solid #e5e5e5;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.assignment-item.fully-read {
		background: #f0f8f0;
		border-color: #c8e6c8;
	}

	.assignment-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.assignment-name {
		font-weight: 500;
		color: #333;
	}

	.read-indicators {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.read-count {
		font-size: 12px;
		color: #666;
		font-weight: 500;
	}

	.read-count.all-read {
		color: #28a745;
	}

	/* Document assignments - more compact styling */
	.document-assignments {
		margin-top: 8px;
		border-top: 1px solid #e5e5e5;
		padding-top: 8px;
	}

	.document-assignments h5 {
		font-size: 12px;
		margin-bottom: 6px;
		color: #666;
	}

	.document-assignments .assignments-grouped {
		gap: 6px;
	}

	.document-assignments .assignment-group {
		border: 1px solid #e8e8e8;
	}

	.document-assignments .group-header {
		padding: 4px 8px;
		font-size: 12px;
		background: #f8f8f8;
	}

	.document-assignments .assignment-items {
		padding: 4px;
		gap: 4px;
	}

	.document-assignments .assignment-item {
		padding: 4px 8px;
		border-radius: 4px;
	}

	.status-indicator {
		font-size: 14px;
		font-weight: bold;
	}

	.status-indicator.read {
		color: #28a745;
	}

	.status-indicator.partial {
		color: #ffc107;
	}

	.status-indicator.unread {
		color: #dc3545;
	}

	.read-by-list, .unread-agents-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		padding-left: 8px;
		font-size: 12px;
	}

	.read-by-label, .unread-label {
		font-weight: 500;
		color: #666;
	}

	.read-by-agent {
		background: #e8f5e8;
		color: #2e7d32;
		padding: 2px 6px;
		border-radius: 12px;
		font-size: 11px;
	}

	.unread-agent {
		background: #ffebee;
		color: #c62828;
		padding: 2px 6px;
		border-radius: 12px;
		font-size: 11px;
	}

	.no-assignments {
		text-align: center;
		color: #666;
		font-style: italic;
		padding: 12px;
	}

	/* Scheduled Reminders Styles */
	.scheduled-reminders-section {
		padding: 20px;
		max-width: 1000px;
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
		background: #007bff;
		color: white;
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
</style>
