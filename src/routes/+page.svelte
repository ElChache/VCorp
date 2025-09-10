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
	let agents: any[] = [];
	let selectedAgent: any = null;
	let selectedRoleType: string = '';
	let selectedModel: string = 'sonnet';
	let showStartupPromptEditor = false;
	let startupPrompt: string = '';
	let channels: any[] = [];
	let selectedChannel: any = null;
	let prompts: any[] = [];
	let promptsByType: Record<string, any[]> = {};
	
	// Scheduled Reminders variables
	let scheduledReminders: any[] = [];
	let showCreateReminderDialog = false;
	let showEditReminderDialog = false;
	
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


	// Squad data (needed for document assignments and other integrations)
	let squads: any[] = [];

	// Monitoring variables
	let monitoringStatus: any = { isRunning: false, stats: null };

	onMount(async () => {
		await loadProjects();
		await loadPhases();
		
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


	// Agent management functions (moved to AgentsSection component)
	async function launchAgent() {
		if (!selectedProject) {
			console.error('No project selected');
			return;
		}

		if (!selectedRoleType) {
			alert('Please select a role first');
			return;
		}

		try {
			const response = await fetch('/api/agents/launch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject.id,
					roleType: selectedRoleType,
					model: selectedModel
				})
			});

			if (response.ok) {
				console.log('Agent launched successfully');
				// Wait a moment for agent to potentially register, then reload
				setTimeout(async () => {
					await loadAgentsData();
				}, 2000);
			} else {
				const error = await response.json();
				console.error('Failed to launch agent:', error.error);
				alert(`Failed to launch agent: ${error.error}`);
			}
		} catch (error) {
			console.error('Error launching agent:', error);
			alert('Failed to launch agent');
		}
	}

	async function killAgent() {
		if (!selectedAgent) {
			console.error('No agent selected');
			return;
		}
		
		try {
			const response = await fetch(`/api/agents/${selectedAgent.id}/kill`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ projectId: selectedProject.id })
			});
			
			if (response.ok) {
				console.log('Agent killed successfully');
				selectedAgent = null;
				await loadAgentsData();
			} else {
				const error = await response.json();
				console.error('Failed to kill agent:', error.error);
				alert(`Failed to kill agent: ${error.error}`);
			}
		} catch (error) {
			console.error('Error killing agent:', error);
			alert('Failed to kill agent');
		}
	}

	async function loadAgentsData() {
		if (!selectedProject) {
			agents = [];
			return;
		}

		try {
			const response = await fetch(`/api/agents?projectId=${selectedProject.id}`);
			if (response.ok) {
				agents = await response.json();
				// Update selectedAgent if it no longer exists
				if (selectedAgent && !agents.find(a => a.id === selectedAgent.id)) {
					selectedAgent = null;
				}
			} else {
				console.error('Failed to load agents');
				agents = [];
			}
		} catch (error) {
			console.error('Error loading agents:', error);
			agents = [];
		}
	}

	async function loadRoles() {
		if (!selectedProject) {
			roles = [];
			return;
		}

		try {
			const response = await fetch(`/api/roles?projectId=${selectedProject.id}`);
			if (response.ok) {
				roles = await response.json();
			} else {
				console.error('Failed to load roles');
				roles = [];
			}
		} catch (error) {
			console.error('Error loading roles:', error);
			roles = [];
		}
	}

	function onAgentSelect(agent: any) {
		selectedAgent = agent;
	}

	function loadStartupPrompt() {
		// This function loads startup prompt for the dialog in main file
		console.log('Load startup prompt function called');
	}

	async function saveStartupPrompt() {
		try {
			const response = await fetch('/api/agents/startup-prompt', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ startupPrompt })
			});

			if (response.ok) {
				showStartupPromptEditor = false;
				console.log('Startup prompt saved successfully');
			} else {
				console.error('Failed to save startup prompt');
			}
		} catch (error) {
			console.error('Failed to save startup prompt:', error);
		}
	}







	// Prompt management functions

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
					on:click={() => currentSection = 'prompts'}
				>
					Prompts
				</button>
				<button 
					class="nav-btn" 
					class:active={currentSection === 'agents'}
					on:click={() => { currentSection = 'agents'; loadRoles(); loadAgentsData(); }}
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
					on:click={() => { currentSection = 'scheduled-reminders'; loadScheduledReminders(); }}
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
				<OverviewSection {selectedProject} bind:monitoringStatus />
			{:else if currentSection === 'roles'}
				<RolesSection {selectedProject} bind:roles bind:selectedRole />
			{:else if currentSection === 'prompts'}
				<PromptsSection {selectedProject} bind:prompts bind:promptsByType />
			{:else if currentSection === 'agents'}
				<AgentsSection 
					{selectedProject} 
					{roles}
					bind:agents
					bind:selectedAgent
					bind:selectedRoleType
					bind:selectedModel
					{launchAgent}
					{killAgent}
					{onAgentSelect}
					bind:showStartupPromptEditor
					{loadStartupPrompt}
				/>
			{:else if currentSection === 'channels'}
				<ChannelsSection
					bind:selectedProject
					bind:channels
					bind:selectedChannel
					{roles}
				/>
			{:else if currentSection === 'squads'}
				<SquadsSection
					bind:selectedProject
					{roles}
					bind:squads
				/>
			{:else if currentSection === 'scheduled-reminders'}
				<ScheduledRemindersSection bind:selectedProject bind:scheduledReminders bind:showCreateReminderDialog bind:showEditReminderDialog />

			{:else if currentSection === 'tickets'}
				<TicketsSection bind:selectedProject />

		{:else if currentSection === 'documents'}
			<DocumentsSection bind:selectedProject />

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
				<PhasesSection bind:selectedProject bind:phases bind:phasesByRole bind:showCreatePhaseDialog />
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


	.section-header {
		border-bottom: 1px solid #e5e5e5;
		padding-bottom: 16px;
	}



	.empty-state {
		color: #666;
		font-style: italic;
		margin: 20px 0;
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











	.empty-selection {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: #666;
		font-style: italic;
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

	.form-help {
		display: block;
		font-size: 11px;
		color: #666;
		margin-top: 4px;
		font-style: italic;
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

</style>
