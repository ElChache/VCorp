<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { marked } from 'marked';
	import { contentPollingService, contentPollingStore } from '$lib/services/ContentPollingService';

	// Props
	export let selectedProject: any = null;

	// Communications Center variables
	let commsViewMode: 'communications' | 'direct-messages' = 'communications';
	let selectedMessage: any = null;
	let showReplyDialog = false;
	let replyContent = '';
	let replyToMessageId: number | null = null;

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

	// Communications variables
	let selectedChannel: any = null;
	let channelMessages: any[] = [];
	let newMessageContent = '';
	let replyingToMessage: any = null;
	
	// Thread variables for 3-column layout
	let selectedThreadMessage: any = null;
	let threadReplies: any[] = [];
	let isThreadsColumnOpen: boolean = false;
	let showAssignmentDialog = false;
	let messageAssignments: Array<{
		assignedToType: 'role' | 'agent' | 'squad';
		assignedTo: string;
	}> = [];

	// Direct Messages variables
	let dmAgents: any[] = [];
	let selectedDMAgent: any = null;
	let dmMessages: any[] = [];
	let newDMContent = '';

	// Channels for dropdown
	let channels: any[] = [];
	
	// Data for dropdowns
	let agents: any[] = [];
	let roleTypes: any[] = [];
	let squads: any[] = [];

	// Event dispatcher for parent communication
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	// Real-time updates
	let contentUpdatesListener: any = null;
	$: pollingState = $contentPollingStore;

	// Unread message counts for badges
	let totalUnreadCount = 0;
	let channelUnreadCount = 0;
	let dmUnreadCount = 0;

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

	// Helper function to check if a message is fully read by all assigned agents
	function isMessageFullyRead(message: any): boolean {
		if (!message.readingAssignments) return false;
		// Only consider assignments that have actual target agents
		const assignmentsWithTargets = message.readingAssignments.filter((assignment: any) => assignment.totalTargets > 0);
		if (assignmentsWithTargets.length === 0) return false;
		return assignmentsWithTargets.every((assignment: any) => assignment.isFullyRead);
	}

	// Helper function to check if a message is partially read
	function isMessagePartiallyRead(message: any): boolean {
		if (!message.readingAssignments) return false;
		// Only consider assignments that have actual target agents
		const assignmentsWithTargets = message.readingAssignments.filter((assignment: any) => assignment.totalTargets > 0);
		return assignmentsWithTargets.some((assignment: any) => assignment.readCount > 0 && !assignment.isFullyRead);
	}

	// Tooltip variables
	let tooltip = null;
	let tooltipTimeout = null;

	// Global click handler to dismiss tooltip when clicking elsewhere
	function handleGlobalClick(event: MouseEvent) {
		if (tooltip && !tooltip.contains(event.target as Node)) {
			// Clicked outside tooltip, hide it
			document.body.removeChild(tooltip);
			tooltip = null;
			document.removeEventListener('click', handleGlobalClick);
		}
	}

	// Toggle tooltip with agent read status
	function toggleReadStatusTooltip(event: MouseEvent, message: any) {
		// If tooltip is already open, close it
		if (tooltip) {
			document.body.removeChild(tooltip);
			tooltip = null;
			document.removeEventListener('click', handleGlobalClick);
			return;
		}

		// Create tooltip content
		const tooltipContent = createTooltipContent(message);
		
		// Create new tooltip
		tooltip = document.createElement('div');
		tooltip.className = 'read-status-tooltip';
		tooltip.innerHTML = tooltipContent;
		
		document.body.appendChild(tooltip);
		
		// Position tooltip
		const rect = (event.target as HTMLElement).getBoundingClientRect();
		tooltip.style.position = 'fixed';
		tooltip.style.left = `${rect.left + rect.width + 4}px`;
		tooltip.style.top = `${rect.top - tooltip.offsetHeight / 2 + rect.height / 2}px`;
		tooltip.style.zIndex = '1000';
		tooltip.style.pointerEvents = 'auto';
		
		// Ensure tooltip doesn't go off-screen
		const tooltipRect = tooltip.getBoundingClientRect();
		if (tooltipRect.right > window.innerWidth) {
			tooltip.style.left = `${rect.left - tooltip.offsetWidth - 4}px`;
		}
		if (tooltipRect.top < 0) {
			tooltip.style.top = '8px';
		}
		
		// Add global click handler to dismiss when clicking elsewhere
		setTimeout(() => {
			document.addEventListener('click', handleGlobalClick);
		}, 0);
	}

	// Create tooltip content showing agent read status
	function createTooltipContent(message: any): string {
		if (!message.readingAssignments) return '';
		
		let content = '<div class="tooltip-header">Read Status</div>';
		
		// Group all agents from all assignments
		const allAgents = new Map();
		
		message.readingAssignments.forEach((assignment: any) => {
			if (assignment.targetAgents && assignment.readBy) {
				assignment.targetAgents.forEach((agentId: string) => {
					const readInfo = assignment.readBy.find((read: any) => read.agentId === agentId);
					allAgents.set(agentId, {
						hasRead: !!readInfo,
						readAt: readInfo?.readAt,
						acknowledged: readInfo?.acknowledged
					});
				});
			}
		});
		
		// Convert to sorted array
		const agentEntries = Array.from(allAgents.entries()).sort(([a], [b]) => a.localeCompare(b));
		
		content += '<div class="agents-list">';
		agentEntries.forEach(([agentId, status]) => {
			const icon = status.hasRead ? '✅' : '⏳';
			const className = status.hasRead ? 'agent-read' : 'agent-unread';
			const readTime = status.hasRead && status.readAt ? ` (${new Date(status.readAt).toLocaleString()})` : '';
			content += `<div class="agent-status ${className}">
				<span class="agent-icon">${icon}</span>
				<span class="agent-name">${agentId}</span>
				<span class="read-time">${readTime}</span>
			</div>`;
		});
		content += '</div>';
		
		return content;
	}

	// Fetch current unread counts from the server
	async function loadUnreadCounts() {
		if (!selectedProject) return;

		try {
			const response = await fetch(`/api/content/updates?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				calculateUnreadCountsFromData(data.updates);
			}
		} catch (error) {
			console.error('Failed to load unread counts:', error);
		}
	}

	// Calculate unread counts from content data
	function calculateUnreadCountsFromData(updates: any) {
		if (!updates) return;
		
		// Count unread channel messages (type "message" or "reply")
		channelUnreadCount = updates.channelMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isUnreadByHumanDirector(msg)
		).length || 0;

		// Count unread direct messages (type "message" or "reply")
		const unreadDMs = updates.directMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isUnreadByHumanDirector(msg)
		) || [];
		dmUnreadCount = unreadDMs.length;
		
		// Debug logging
		console.log(`📊 DM Count Debug - Found ${updates.directMessages?.length || 0} total DMs, ${unreadDMs.length} unread:`, 
			unreadDMs.map(dm => `ID:${dm.id} from:${dm.authorAgentId} type:${dm.type}`)
		);

		// Count unread documents  
		const unreadDocs = updates.documents?.filter((doc: any) => 
			isUnreadByHumanDirector(doc)
		) || [];
		const documentsUnreadCount = unreadDocs.length;
		
		// Total unread count (matching main page calculation)
		totalUnreadCount = channelUnreadCount + dmUnreadCount + documentsUnreadCount;
		
		console.log(`📊 Total Unread Debug - Channels: ${channelUnreadCount}, DMs: ${dmUnreadCount}, Docs: ${documentsUnreadCount}, Total: ${totalUnreadCount}`);
	}

	// Update counts when new updates arrive
	function updateUnreadCountsFromNewData(updates: any) {
		if (!updates) return;

		// Add new unread messages to existing counts
		const newChannelUnread = updates.channelMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isUnreadByHumanDirector(msg)
		).length || 0;

		const newDmUnread = updates.directMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isUnreadByHumanDirector(msg)
		).length || 0;

		if (newChannelUnread > 0 || newDmUnread > 0) {
			channelUnreadCount += newChannelUnread;
			dmUnreadCount += newDmUnread;
			totalUnreadCount = channelUnreadCount + dmUnreadCount;
			
			console.log(`📊 New unread messages - Channels: +${newChannelUnread}, DMs: +${newDmUnread}, Total: ${totalUnreadCount}`);
		}
	}

	// Handle real-time content updates
	function handleContentUpdates(event: CustomEvent) {
		const { updates } = event.detail;
		
		console.log('📬 Processing real-time content updates:', updates);

		// Update unread counts with new messages
		updateUnreadCountsFromNewData(updates);

		// Update channel messages if we have a selected channel
		if (selectedChannel && updates.channelMessages?.length > 0) {
			const relevantMessages = updates.channelMessages.filter(
				(msg: any) => msg.channelId === selectedChannel.id
			);
			
			if (relevantMessages.length > 0) {
				console.log(`🔄 Adding ${relevantMessages.length} new messages to channel ${selectedChannel.name}`);
				// Add new messages to existing messages, avoiding duplicates
				const existingIds = new Set(channelMessages.map(m => m.id));
				const newMessages = relevantMessages.filter(msg => !existingIds.has(msg.id));
				
				if (newMessages.length > 0) {
					channelMessages = [...channelMessages, ...newMessages].sort(
						(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);
				}
			}
		}

		// Update direct messages if we have a selected DM agent
		if (selectedDMAgent && updates.directMessages?.length > 0) {
			const relevantDMs = updates.directMessages.filter(
				(msg: any) => 
					msg.authorAgentId === selectedDMAgent.id || 
					(msg.readingAssignments?.some((assignment: any) => 
						assignment.assignedToType === 'agent' && assignment.assignedTo === selectedDMAgent.id
					))
			);
			
			if (relevantDMs.length > 0) {
				console.log(`🔄 Adding ${relevantDMs.length} new DMs with ${selectedDMAgent.id}`);
				// Add new DMs to existing messages, avoiding duplicates
				const existingIds = new Set(dmMessages.map(m => m.id));
				const newDMs = relevantDMs.filter(msg => !existingIds.has(msg.id));
				
				if (newDMs.length > 0) {
					dmMessages = [...dmMessages, ...newDMs].sort(
						(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);
				}
			}
		}

		// Update channel list with new unread counts
		if (updates.channelMessages?.length > 0) {
			loadChannels(); // Refresh channel list to update unread counts
		}

		// Update DM agent list with new message indicators
		if (updates.directMessages?.length > 0) {
			loadDMAgents(); // Refresh DM agents list
		}
	}

	// Start polling when project changes
	function startPolling() {
		if (selectedProject && selectedProject.id) {
			console.log(`🚀 Starting real-time polling for project ${selectedProject.id}`);
			contentPollingService.startPolling(selectedProject.id);
		}
	}

	// Stop polling
	function stopPolling() {
		console.log('⏹️ Stopping real-time polling');
		contentPollingService.stopPolling();
	}

	// Functions for loading channel messages
	async function loadChannelMessages(channel) {
		if (!channel) {
			channelMessages = [];
			return;
		}

		try {
			console.log(`Loading messages for channel: ${channel.name} (ID: ${channel.id})`);
			const response = await fetch(`/api/channels/${channel.id}/messages`);
			if (response.ok) {
				channelMessages = await response.json();
				console.log(`✅ Loaded ${channelMessages.length} messages for channel ${channel.name}`);
			} else {
				console.error('Failed to load channel messages:', response.status);
				channelMessages = [];
			}
		} catch (error) {
			console.error('Error loading channel messages:', error);
			channelMessages = [];
		}
	}

	function onChannelSelect(channel) {
		selectedChannel = channel;
		loadChannelMessages(channel);
	}

	// Helper functions for messages
	function formatMessageTime(timestamp) {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
		
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
		
		return date.toLocaleDateString();
	}

	function hasUnreadAssignmentForHumanDirector(message) {
		if (!message.readingAssignments) return false;
		
		return message.readingAssignments.some(assignment => {
			// Check if this assignment is for human-director
			const isForHumanDirector = (assignment.assignedToType === 'agent' && assignment.assignedTo === 'human-director') ||
			                          (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director');
			
			if (!isForHumanDirector) return false;
			
			// Check if human-director has read this assignment
			const hasRead = assignment.readBy.some(read => read.agentId === 'human-director');
			return !hasRead;
		});
	}

	function startReply(message) {
		replyingToMessage = message;
		replyContent = '';
	}

	function cancelReply() {
		replyingToMessage = null;
		replyContent = '';
	}

	async function markMessageAsRead(message) {
		if (!message.readingAssignments) return;
		
		try {
			// Find the assignment(s) for human-director
			const humanDirectorAssignments = message.readingAssignments.filter(assignment => {
				return (assignment.assignedToType === 'agent' && assignment.assignedTo === 'human-director') ||
				       (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director');
			});
			
			// Mark each assignment as read
			let markedAsRead = false;
			for (const assignment of humanDirectorAssignments) {
				// Check if already read to avoid duplicate marking
				const hasRead = assignment.readBy.some(read => read.agentId === 'human-director');
				if (!hasRead) {
					await fetch('/api/reading-assignments/mark-read', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							assignmentId: assignment.id,
							agentId: 'human-director'
						})
					});
					markedAsRead = true;
				}
			}
			
			// Update unread counts if we marked something as read
			if (markedAsRead && (message.type === 'message' || message.type === 'reply')) {
				if (message.channelId) {
					channelUnreadCount = Math.max(0, channelUnreadCount - 1);
				} else {
					dmUnreadCount = Math.max(0, dmUnreadCount - 1);
				}
				totalUnreadCount = channelUnreadCount + dmUnreadCount;
				console.log(`📖 Marked message as read. Updated counts - Total: ${totalUnreadCount}, Channels: ${channelUnreadCount}, DMs: ${dmUnreadCount}`);
			}
			
			// Refresh the channel messages and channel list
			if (selectedChannel) {
				await loadChannelMessages(selectedChannel);
				await loadChannels();
			}
		} catch (error) {
			console.error('Failed to mark message as read:', error);
		}
	}





	async function loadChannels() {
		if (!selectedProject) {
			channels = [];
			return;
		}

		try {
			const response = await fetch(`/api/channels?projectId=${selectedProject.id}`);
			if (response.ok) {
				const channelsData = await response.json();
				
				// Load message counts for each channel
				const channelsWithCounts = await Promise.all(
					channelsData.map(async (channel) => {
						try {
							const msgResponse = await fetch(`/api/channels/${channel.id}/messages?projectId=${selectedProject.id}`);
							if (msgResponse.ok) {
								const messages = await msgResponse.json();
								
								// Calculate unread messages for human-director
								let unreadCount = 0;
								messages.forEach(message => {
									if (message.readingAssignments) {
										message.readingAssignments.forEach(assignment => {
											// Check if this assignment is for human-director and unread
											if ((assignment.assignedToType === 'agent' && assignment.assignedTo === 'human-director') ||
											    (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director')) {
												// Check if human-director has read this assignment
												const hasRead = assignment.readBy.some(read => read.agentId === 'human-director');
												if (!hasRead) {
													unreadCount++;
												}
											}
										});
									}
								});
								
								return {
									...channel,
									messageCount: messages.length,
									unreadCount: unreadCount
								};
							}
						} catch (error) {
							console.error(`Failed to load messages for channel ${channel.id}:`, error);
						}
						return {
							...channel,
							messageCount: 0,
							unreadCount: 0
						};
					})
				);
				
				channels = channelsWithCounts;
			} else {
				console.error('Failed to load channels:', response.status);
			}
		} catch (error) {
			console.error('Failed to load channels:', error);
		}
	}

	async function loadAgents() {
		if (!selectedProject) {
			agents = [];
			return;
		}

		try {
			const response = await fetch(`/api/agents?projectId=${selectedProject.id}`);
			if (response.ok) {
				agents = await response.json();
			} else {
				console.error('Failed to load agents:', response.status);
			}
		} catch (error) {
			console.error('Failed to load agents:', error);
		}
	}

	async function loadRoleTypes() {
		if (!selectedProject) {
			roleTypes = [];
			return;
		}

		try {
			const response = await fetch(`/api/projects/${selectedProject.id}/role-types`);
			if (response.ok) {
				roleTypes = await response.json();
			} else {
				console.error('Failed to load role types:', response.status);
			}
		} catch (error) {
			console.error('Failed to load role types:', error);
		}
	}

	async function loadSquads() {
		if (!selectedProject) {
			squads = [];
			return;
		}

		try {
			const response = await fetch(`/api/squads?projectId=${selectedProject.id}`);
			if (response.ok) {
				squads = await response.json();
			} else {
				console.error('Failed to load squads:', response.status);
			}
		} catch (error) {
			console.error('Failed to load squads:', error);
		}
	}

	async function loadDMAgents() {
		if (!selectedProject) {
			dmAgents = [];
			return;
		}

		try {
			// Use the polling data to get direct messages (much more reliable)
			const response = await fetch(`/api/content/updates?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				const directMessages = data.updates.directMessages || [];
				
				// Get unique agents from DMs (either as author or recipient to human-director)
				const agentIds = new Set();
				directMessages.forEach(dm => {
					// Add the author if it's not human-director
					if (dm.authorAgentId && dm.authorAgentId !== 'human-director') {
						agentIds.add(dm.authorAgentId);
					}
					// Add agents who have reading assignments from human-director messages
					if (dm.authorAgentId === 'human-director' && dm.readingAssignments) {
						dm.readingAssignments.forEach(assignment => {
							if (assignment.assignedToType === 'agent' && 
							    assignment.assignedTo !== 'human-director') {
								agentIds.add(assignment.assignedTo);
							}
						});
					}
				});

				// Create agent objects for the UI
				dmAgents = Array.from(agentIds).map(agentId => {
					// Find the most recent message with this agent
					const recentMessage = directMessages
						.filter(dm => 
							dm.authorAgentId === agentId || 
							(dm.authorAgentId === 'human-director' && 
							 dm.readingAssignments?.some(a => a.assignedToType === 'agent' && a.assignedTo === agentId))
						)
						.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

					// Count unread messages from this agent to human-director (using same logic as badge)
					const unreadCount = directMessages.filter(dm => 
						dm.authorAgentId === agentId && 
						(dm.type === 'message' || dm.type === 'reply') &&
						isUnreadByHumanDirector(dm)
					).length;

					// Get display name for the agent
					let roleType = 'Unknown';
					if (agentId === 'pm_001') roleType = 'Product Manager';
					else if (agentId.startsWith('be_')) roleType = 'Backend Developer';
					else if (agentId.startsWith('fe_')) roleType = 'Frontend Developer';
					else if (agentId.startsWith('ai_')) roleType = 'AI Developer';
					else if (agentId.startsWith('ux_')) roleType = 'UX Expert';
					else if (agentId.startsWith('design_')) roleType = 'Graphic Designer';
					else if (agentId.startsWith('qa_')) roleType = 'Technical QA';
					else if (agentId.startsWith('sa_')) roleType = 'System Architect';

					return {
						id: agentId,
						roleType: roleType,
						status: 'online',
						lastMessageAt: recentMessage?.createdAt || null,
						unreadCount: unreadCount
					};
				});
				
				// Sort by most recent message date (desc)
				dmAgents.sort((a, b) => {
					if (!a.lastMessageAt && !b.lastMessageAt) return 0;
					if (!a.lastMessageAt) return 1;
					if (!b.lastMessageAt) return -1;
					return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
				});

				console.log(`📱 DM Agents Debug:`, {
					totalDMs: directMessages.length,
					agentIds: Array.from(agentIds),
					loadedAgents: dmAgents.length,
					agentDetails: dmAgents.map(a => `${a.id} (unread: ${a.unreadCount}, last: ${a.lastMessageAt})`)
				});
			} else {
				console.error('Failed to load DM content:', response.status);
			}
		} catch (error) {
			console.error('Failed to load DM agents:', error);
		}
	}

	async function loadDMMessages(agentId) {
		if (!selectedProject || !agentId) {
			dmMessages = [];
			return;
		}

		try {
			const response = await fetch(`/api/messages/conversation?projectId=${selectedProject.id}&agent1=human-director&agent2=${agentId}`);
			if (response.ok) {
				dmMessages = await response.json();
				console.log(`📬 Loaded ${dmMessages.length} DM messages with ${agentId}`);
			} else {
				console.error('Failed to load DM messages:', response.status);
				dmMessages = [];
			}
		} catch (error) {
			console.error('Error loading DM messages:', error);
			dmMessages = [];
		}
	}

	function onDMAgentSelect(agent) {
		selectedDMAgent = agent;
		loadDMMessages(agent.id);
	}

	async function sendDMMessage() {
		if (!newDMContent.trim() || !selectedDMAgent || !selectedProject) return;

		try {
			const response = await fetch('/api/send-message', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject.id,
					authorAgentId: 'human-director',
					body: newDMContent,
					channelId: null, // This makes it a DM
					type: 'message',
					assignTo: [
						{
							type: 'agent',
							target: selectedDMAgent.id
						}
					]
				})
			});

			if (response.ok) {
				newDMContent = '';
				await loadDMMessages(selectedDMAgent.id);
				await loadDMAgents(); // Refresh agent list to update timestamps
			} else {
				console.error('Failed to send DM:', response.status);
			}
		} catch (error) {
			console.error('Failed to send DM:', error);
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
		// Support thread replies (selectedThreadMessage) and legacy replies 
		const messageId = selectedThreadMessage?.id || replyToMessageId || replyingToMessage?.id;
		const message = selectedThreadMessage || selectedMessage || replyingToMessage;
		
		if (!replyContent.trim() || !messageId || !selectedProject) return;

		try {
			const response = await fetch('/api/send-message', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject.id,
					authorAgentId: 'human-director', // Human director
					title: null,
					body: replyContent,
					channelId: message?.channelId || selectedChannel?.id || null,
					parentContentId: messageId,
					type: 'reply',
					assignTo: [
						{
							type: 'agent',
							target: message?.authorAgentId || 'unknown'
						}
					]
				})
			});

			if (response.ok) {
				// Handle thread reply
				if (selectedThreadMessage) {
					replyContent = '';
					await loadThreadReplies(selectedThreadMessage); // Refresh thread replies
				}
				// Handle dialog reply
				else if (replyToMessageId) {
					closeReplyDialog();
				} 
				// Handle inline reply
				else if (replyingToMessage) {
					cancelReply(); // Clear inline reply state
					if (selectedChannel) {
						await loadChannelMessages(selectedChannel); // Refresh channel messages
					}
				}
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
		// Handle both channel messaging (newMessageContent) and dialog messaging (newMessage.body)
		const messageBody = newMessageContent || newMessage.body;
		const channelId = selectedChannel?.id || newMessage.channelId;
		
		if (!messageBody.trim() || !selectedProject) return;

		try {
			// Create the message
			const response = await fetch(`/api/channels/${channelId || 0}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: newMessage.type || 'message',
					title: newMessage.title || null,
					body: messageBody,
					authorAgentId: 'human-director', // Human director
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

			// Clear the appropriate input field
			if (newMessageContent) {
				// Channel messaging - clear the channel input and reload channel messages
				newMessageContent = '';
				if (selectedChannel) {
					await loadChannelMessages(selectedChannel);
				}
			} else {
				// Dialog messaging - reset dialog
				resetSendMessageDialog();
			}
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	}

	// Thread handling functions for 3-column layout
	function onMessageSelect(message: any) {
		selectedThreadMessage = message;
		isThreadsColumnOpen = true;
		loadThreadReplies(message);
	}

	function closeThreadsColumn() {
		isThreadsColumnOpen = false;
		selectedThreadMessage = null;
		threadReplies = [];
	}

	async function loadThreadReplies(message: any) {
		if (!message?.id) {
			threadReplies = [];
			return;
		}

		try {
			// Use content updates API to get replies with full reading assignment data
			const response = await fetch(`/api/content/updates?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				// Filter replies for this specific message
				threadReplies = data.updates.replies?.filter((reply: any) => 
					reply.parentContentId === message.id
				) || [];
			}
		} catch (err) {
			console.error('Failed to load thread replies:', err);
			threadReplies = [];
		}
	}

	// Build flat comment list sorted by timestamp - all replies are to the selected message
	function buildThreadTree(replies: any[]) {
		return replies
			.map((reply: any) => ({ ...reply, children: [] }))
			.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	}

	$: threadTree = buildThreadTree(threadReplies);

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
		if (message.isReply) return '↩️';
		if (message.isDM) return '💬';
		if (message.isDirectorChannel) return '📢';
		if (message.type === 'document') return '📄';
		return '💭';
	}

	// Load data when project changes
	$: if (selectedProject) {
		loadChannels();
		loadAgents();
		loadRoleTypes();
		loadSquads();
		loadDMAgents();
		loadUnreadCounts(); // Load initial unread counts
		startPolling(); // Start real-time polling for the new project
	}

	// Lifecycle management
	onMount(() => {
		// Set up event listener for content updates
		contentUpdatesListener = (event: CustomEvent) => handleContentUpdates(event);
		window.addEventListener('contentUpdates', contentUpdatesListener);
		
		// Start polling if we already have a selected project
		if (selectedProject) {
			startPolling();
		}
	});

	onDestroy(() => {
		// Clean up event listener
		if (contentUpdatesListener) {
			window.removeEventListener('contentUpdates', contentUpdatesListener);
		}
		
		// Stop polling
		stopPolling();
	});
</script>

<div class="communications-section">
	<!-- Removed section header to save space -->

	<div class="comms-nav">
		<button 
			class="comms-nav-btn" 
			class:active={commsViewMode === 'communications'}
			on:click={() => commsViewMode = 'communications'}
		>
			<span class="nav-btn-content">
				📺 Channels
				{#if channelUnreadCount > 0}
					<span class="unread-badge nav-badge">{channelUnreadCount}</span>
				{/if}
			</span>
		</button>
		<button 
			class="comms-nav-btn" 
			class:active={commsViewMode === 'direct-messages'}
			on:click={() => commsViewMode = 'direct-messages'}
		>
			<span class="nav-btn-content">
				📩 Direct Messages
				{#if dmUnreadCount > 0}
					<span class="unread-badge nav-badge">{dmUnreadCount}</span>
				{/if}
			</span>
		</button>
	</div>

	<div class="comms-content">
		{#if commsViewMode === 'communications'}
			<!-- Flexible Layout with Sliding Threads Column -->
			<div class="communications-layout">
				<!-- Column 1: Channels List (Fixed width) -->
				<div class="channels-sidebar">
					<div class="channels-header">
						<h3>Channels ({channels.length})</h3>
					</div>
					
					<div class="channel-list">
						{#each channels.sort((a, b) => (b.isForHumanDirector ? 1 : 0) - (a.isForHumanDirector ? 1 : 0)) as channel}
							<div 
								class="channel-item"
								class:selected={selectedChannel?.id === channel.id}
								on:click={() => onChannelSelect(channel)}
							>
								<div class="channel-header">
									<span class="channel-name">#{channel.name}</span>
									{#if channel.isForHumanDirector}
										<span class="channel-badge human-director">👤</span>
									{/if}
								</div>
								<div class="channel-meta">
									<span class="message-count">{channel.messageCount || 0} messages</span>
									{#if channel.unreadCount > 0}
										<span class="unread-count">{channel.unreadCount} unread</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
				
				<!-- Column 2: Messages View -->
				<div class="messages-viewer">
					{#if selectedChannel}
						<div class="messages-view">
							<div class="messages-container">
								<div class="messages-list">
									{#if channelMessages.length > 0}
										{#each channelMessages.filter(msg => !msg.parentContentId) as message}
											<div class="message" 
												class:ticket={message.type === 'ticket'} 
												class:selected={selectedThreadMessage?.id === message.id}
												on:click={() => onMessageSelect(message)}>
												<div class="message-indicator">
													{#if message.replies && message.replies.length > 0}
														<span class="replies-count">{message.replies.length}</span>
													{/if}
												</div>
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
														
														<div class="ticket-body markdown-content">
															{@html marked((message.body || '').replace(/\\n/g, '\n'))}
														</div>
														
														{#if message.updatedAt && message.updatedAt !== message.createdAt}
															<div class="ticket-updated">
																Last updated: {formatMessageTime(message.updatedAt)}
															</div>
														{/if}
													</div>
												{:else}
													<div class="message-content markdown-content">
														{#if message.title && message.title !== message.body}
															<strong>{message.title}</strong><br>
														{/if}
														{@html marked((message.body || '').replace(/\\n/g, '\n'))}
													</div>
													<div class="message-actions">
														{#if message.readingAssignments && message.readingAssignments.length > 0}
															<div class="read-status-icon-container" 
																 on:click={(e) => toggleReadStatusTooltip(e, message)}>
																<span class="read-status-icon" class:fully-read={isMessageFullyRead(message)} class:partially-read={isMessagePartiallyRead(message)}>
																	{#if isMessageFullyRead(message)}
																		✅
																	{:else if isMessagePartiallyRead(message)}
																		👀
																	{:else}
																		📩
																	{/if}
																</span>
															</div>
														{/if}
														{#if hasUnreadAssignmentForHumanDirector(message)}
															<button 
																class="reply-btn mark-read-btn" 
																on:click={() => markMessageAsRead(message)}
															>
																Mark Read
															</button>
														{/if}
														<button 
															class="reply-btn" 
															on:click={() => startReply(message)}
														>
															Reply
														</button>
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
										bind:value={newMessageContent}
										on:keydown={(e) => {
											if (e.key === 'Enter' && !e.shiftKey) {
												e.preventDefault();
												sendMessage();
											}
										}}
									/>
									<button 
										class="send-btn" 
										on:click={sendMessage}
										disabled={!newMessageContent.trim()}
									>
										Send
									</button>
								</div>
								<p class="input-note">Press Enter to send message</p>
							</div>
						</div>
					{:else}
						<div class="communications-placeholder">
							<h3>💬 Communications</h3>
							<p>Select a channel from the left to start chatting.</p>
						</div>
					{/if}
				</div>
				
				<!-- Column 3: Sliding Threads/Replies -->
				<div class="threads-column" class:open={isThreadsColumnOpen}>
					{#if selectedThreadMessage}
						<div class="threads-header">
							<h3>💬 Thread ({threadReplies.length})</h3>
							<button class="close-threads-btn" on:click={closeThreadsColumn} title="Close thread">
								×
							</button>
						</div>
						
						<div class="threads-container">
							<div class="original-message">
								<div class="message-header">
									<span class="message-author">
										{selectedThreadMessage.authorAgentId || 'System'}
									</span>
									<span class="message-time">{formatTimeAgo(selectedThreadMessage.createdAt)}</span>
									{#if selectedThreadMessage.readingAssignments && selectedThreadMessage.readingAssignments.length > 0}
										<div class="read-status-icon-container" 
											 on:click={(e) => toggleReadStatusTooltip(e, selectedThreadMessage)}>
											<span class="read-status-icon" class:fully-read={isMessageFullyRead(selectedThreadMessage)} class:partially-read={isMessagePartiallyRead(selectedThreadMessage)}>
												{#if isMessageFullyRead(selectedThreadMessage)}
													✅
												{:else if isMessagePartiallyRead(selectedThreadMessage)}
													👀
												{:else}
													📩
												{/if}
											</span>
										</div>
									{/if}
								</div>
								<div class="message-content markdown-content">
									{#if selectedThreadMessage.title && selectedThreadMessage.title !== selectedThreadMessage.body}
										<strong>{selectedThreadMessage.title}</strong><br>
									{/if}
									{@html marked((selectedThreadMessage.body || '').replace(/\\n/g, '\n'))}
								</div>
							</div>
							
							{#if threadTree.length > 0}
								{#each threadTree as reply}
									<div class="thread-reply">
										<div class="message-header">
											<span class="message-author">
												{reply.authorAgentId === 'human-director' ? 'Human Director' : reply.authorAgentId || 'System'}
											</span>
											<span class="message-time">{formatTimeAgo(reply.createdAt)}</span>
											{#if reply.readingAssignments && reply.readingAssignments.length > 0}
												<div class="read-status-icon-container" 
													 on:click={(e) => toggleReadStatusTooltip(e, reply)}>
													<span class="read-status-icon" class:fully-read={isMessageFullyRead(reply)} class:partially-read={isMessagePartiallyRead(reply)}>
														{#if isMessageFullyRead(reply)}
															✅
														{:else if isMessagePartiallyRead(reply)}
															👀
														{:else}
															📩
														{/if}
													</span>
												</div>
											{/if}
										</div>
										<div class="message-content markdown-content">
											{@html marked((reply.body || '').replace(/\\n/g, '\n'))}
										</div>
									</div>
								{/each}
							{:else}
								<div class="no-replies">
									<p>No replies yet. Start the discussion!</p>
								</div>
							{/if}
						</div>

						<!-- Add Reply Form -->
						<div class="add-reply-form">
							<textarea 
								bind:value={replyContent} 
								placeholder="Add a reply..."
								rows="3"
								class="reply-input"
								on:keydown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										if (replyContent.trim()) {
											sendReply();
										}
									}
								}}
							></textarea>
							<button 
								class="btn-primary btn-sm" 
								on:click={sendReply}
								disabled={!replyContent.trim()}
							>
								💬 Reply
							</button>
						</div>
					{:else}
						<div class="no-thread-selected">
							<p>Select a message to view thread</p>
						</div>
					{/if}
				</div>
			</div>
		{:else if commsViewMode === 'direct-messages'}
			<div class="direct-messages-view">
				<div class="dm-left">
					<div class="dm-agents-panel">
						<div class="dm-agents-header">
							<h3>Agents ({dmAgents.length})</h3>
							<button 
								class="btn-primary btn-sm"
								on:click={() => showSendMessageDialog = true}
								title="Send Message"
							>
								✉️ Send Message
							</button>
						</div>
						
						<div class="dm-agent-list">
							{#each dmAgents as agent}
								<div 
									class="dm-agent-item"
									class:active={selectedDMAgent?.id === agent.id}
									on:click={() => onDMAgentSelect(agent)}
								>
									<div class="dm-agent-header">
										<span class="dm-agent-name">{agent.id}</span>
										<span class="dm-agent-role">{agent.roleType}</span>
									</div>
									{#if agent.lastMessageAt}
										<div class="dm-agent-details">
											<span class="dm-last-message">{formatMessageTime(agent.lastMessageAt)}</span>
										</div>
									{/if}
								</div>
							{/each}
							{#if dmAgents.length === 0}
								<div class="no-dm-agents">
									<p>No direct message conversations yet.</p>
									<p>Send a message to an agent to start!</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
				
				<div class="dm-right">
					{#if selectedDMAgent}
						<div class="dm-messages-view">
							<div class="dm-messages-container">
								<div class="dm-messages-list">
									{#if dmMessages.length > 0}
										{#each dmMessages as message}
											<div class="message" class:reply={message.parentContentId}>
												<div class="message-header">
													<span class="message-author">{message.authorAgentId || 'System'}</span>
													<span class="message-time">{formatMessageTime(message.createdAt)}</span>
												</div>
												
												<div class="message-content markdown-content">
													{#if message.title && message.title !== message.body}
														<strong>{message.title}</strong><br>
													{/if}
													{@html marked((message.body || '').replace(/\\n/g, '\n'))}
												</div>
												<div class="message-actions">
													{#if message.readingAssignments && message.readingAssignments.length > 0}
														<div class="read-status-icon-container" 
															 on:click={(e) => toggleReadStatusTooltip(e, message)}>
															<span class="read-status-icon" class:fully-read={isMessageFullyRead(message)} class:partially-read={isMessagePartiallyRead(message)}>
																{#if isMessageFullyRead(message)}
																	✅
																{:else if isMessagePartiallyRead(message)}
																	👀
																{:else}
																	📩
																{/if}
															</span>
														</div>
													{/if}
													{#if hasUnreadAssignmentForHumanDirector(message)}
														<button 
															class="reply-btn mark-read-btn" 
															on:click={() => markMessageAsRead(message)}
														>
															Mark Read
														</button>
													{/if}
													<button 
														class="reply-btn" 
														on:click={() => startReply(message)}
													>
														Reply
													</button>
												</div>
												
												<!-- Reply input interface -->
												{#if replyingToMessage && replyingToMessage.id === message.id}
													<div class="reply-input-container">
														<div class="reply-input-wrapper">
															<input 
																type="text" 
																class="reply-input" 
																placeholder="Type your reply..." 
																bind:value={replyContent}
																on:keydown={(e) => {
																	if (e.key === 'Enter' && !e.shiftKey) {
																		e.preventDefault();
																		sendReply();
																	} else if (e.key === 'Escape') {
																		cancelReply();
																	}
																}}
																autofocus
															/>
															<button 
																class="send-btn" 
																on:click={sendReply}
																disabled={!replyContent.trim()}
															>
																Reply
															</button>
															<button class="cancel-reply-btn" on:click={cancelReply}>×</button>
														</div>
													</div>
												{/if}
											</div>
										{/each}
									{:else}
										<div class="no-messages">
											<p>No messages with {selectedDMAgent.id} yet.</p>
											<p>Start the conversation!</p>
										</div>
									{/if}
								</div>
							</div>
							<div class="dm-input-container">
								<div class="dm-input-wrapper">
									<input 
										type="text" 
										class="message-input" 
										placeholder="Type a direct message..." 
										bind:value={newDMContent}
										on:keydown={(e) => {
											if (e.key === 'Enter' && !e.shiftKey) {
												e.preventDefault();
												sendDMMessage();
											}
										}}
									/>
									<button 
										class="send-btn" 
										on:click={sendDMMessage}
										disabled={!newDMContent.trim()}
									>
										Send
									</button>
								</div>
								<p class="input-note">Press Enter to send DM to {selectedDMAgent.id}</p>
							</div>
						</div>
					{:else}
						<div class="dm-placeholder">
							<h3>📩 Direct Messages</h3>
							<p>Select an agent from the left to view your conversation.</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if showReplyDialog}
	<div class="dialog-overlay" on:click={closeReplyDialog}>
		<div class="dialog" on:click|stopPropagation>
			<div class="dialog-header">
				<h3>💬 Reply to Message</h3>
				<button class="close-btn" on:click={closeReplyDialog}>×</button>
			</div>
			
			{#if selectedMessage}
				<div class="reply-context">
					<div class="original-message">
						<div class="message-meta">
							<span class="message-icon">{getMessageIcon(selectedMessage)}</span>
							<span class="message-author">
								{selectedMessage.authorAgentId || 'System'}
							</span>
							<span class="message-time">{formatTimeAgo(selectedMessage.createdAt)}</span>
						</div>
						<div class="message-preview">
							{selectedMessage.body.substring(0, 100)}...
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
					rows="4"
				></textarea>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeReplyDialog}>Cancel</button>
				<button class="send-btn" on:click={sendReply} disabled={!replyContent.trim()}>
					Send Reply
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showSendMessageDialog}
	<div class="dialog-overlay" on:click={() => showSendMessageDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Send Message</h3>
			
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
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showSendMessageDialog = false}>Cancel</button>
				<button class="send-btn" on:click={sendMessage} disabled={!newMessage.body.trim()}>
					Send Message
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Assignment Dialog for Channel Messaging -->
{#if showAssignmentDialog}
	<div class="dialog-overlay" on:click={closeAssignmentDialog}>
		<div class="dialog" on:click|stopPropagation>
			<div class="dialog-header">
				<h3>Add Assignment</h3>
				<button class="close-btn" on:click={closeAssignmentDialog}>×</button>
			</div>
			
			<div class="assignment-options">
				<div class="assignment-section">
					<h4>👥 Roles</h4>
					<div class="option-grid">
						{#each roleTypes as roleType}
							<button 
								class="option-btn"
								on:click={() => addMessageAssignment('role', roleType.roleType)}
							>
								{roleType.roleType} ({roleType.count})
							</button>
						{/each}
					</div>
				</div>
				
				<div class="assignment-section">
					<h4>🤖 Agents</h4>
					<div class="option-grid">
						{#each agents as agent}
							<button 
								class="option-btn"
								on:click={() => addMessageAssignment('agent', agent.id)}
							>
								{agent.id} ({agent.roleType})
							</button>
						{/each}
					</div>
				</div>
				
				<div class="assignment-section">
					<h4>👥 Squads</h4>
					<div class="option-grid">
						{#each squads as squad}
							<button 
								class="option-btn"
								on:click={() => addMessageAssignment('squad', squad.id)}
							>
								{squad.name}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.communications-section {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 170px); /* Increased to fully eliminate scroll */
		background: white;
		border-radius: 8px;
		overflow: hidden;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.section-header h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		color: #374151;
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


	.nav-badge {
		margin-left: 6px;
	}

	@keyframes pulse-badge {
		0% { transform: scale(1); }
		50% { transform: scale(1.1); }
		100% { transform: scale(1); }
	}

	.polling-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: #dcfce7;
		border: 1px solid #bbf7d0;
		border-radius: 12px;
		font-size: 12px;
	}

	.polling-dot {
		width: 8px;
		height: 8px;
		background: #22c55e;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	.polling-text {
		color: #15803d;
		font-weight: 500;
	}

	.polling-error {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 12px;
		font-size: 12px;
	}

	.error-dot {
		width: 8px;
		height: 8px;
		background: #ef4444;
		border-radius: 50%;
	}

	.error-text {
		color: #dc2626;
		font-weight: 500;
	}

	@keyframes pulse {
		0% { opacity: 1; }
		50% { opacity: 0.5; }
		100% { opacity: 1; }
	}

	.btn-primary {
		background: #2563eb;
		color: white;
		border: none;
		padding: 10px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.btn-primary:hover {
		background: #1d4ed8;
	}

	.btn-primary:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	/* Assignment Dialog Styles */
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
		max-width: 500px;
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

	.assignment-options {
		padding: 20px;
	}

	.assignment-section {
		margin-bottom: 24px;
	}

	.assignment-section:last-child {
		margin-bottom: 0;
	}

	.assignment-section h4 {
		margin: 0 0 12px 0;
		font-size: 14px;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.option-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 8px;
	}

	.option-btn {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		padding: 8px 12px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
		color: #374151;
		transition: all 0.2s ease;
		text-align: center;
	}

	.option-btn:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
	}

	.option-btn:active {
		background: #e5e7eb;
		transform: translateY(1px);
	}

	/* Reply Input Interface Styles */
	.reply-input-container {
		margin-top: 8px;
		padding: 12px;
		background: #f9fafb;
		border-radius: 6px;
		border: 1px solid #e5e7eb;
	}

	.reply-input-wrapper {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.reply-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 14px;
		background: white;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.reply-input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);
	}

	.cancel-reply-btn {
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		color: #6b7280;
		padding: 6px 10px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s ease;
		min-width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cancel-reply-btn:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.comms-nav {
		display: flex;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
		padding: 0;
	}

	.comms-nav-btn {
		background: none;
		border: none;
		padding: 12px 20px;
		cursor: pointer;
		font-weight: 500;
		color: #6b7280;
		border-bottom: 2px solid transparent;
		transition: all 0.2s ease;
	}

	.nav-btn-content {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.comms-nav-btn:hover {
		color: #374151;
		background: #f3f4f6;
	}

	.comms-nav-btn.active {
		color: #2563eb;
		border-bottom-color: #2563eb;
		background: white;
	}

	.comms-content {
		flex: 1;
		overflow: hidden;
		padding: 0; /* Remove padding to give full space to columns */
		height: 100%; /* Ensure it takes full available height */
	}

	/* Flexible Layout with Sliding Threads Column */
	.communications-layout {
		display: flex;
		height: 100%;
		flex: 1;
		min-height: 0;
		position: relative;
		overflow: hidden;
	}

	/* Subtle backdrop when threads are open - only over messages area */
	.messages-viewer::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0);
		pointer-events: none;
		transition: background 0.3s ease;
		z-index: 1;
		opacity: 0;
	}

	.communications-layout:has(.threads-column.open) .messages-viewer::before {
		background: rgba(0, 0, 0, 0.05);
		opacity: 1;
	}

	/* Column 1: Channels Sidebar (Fixed width) */
	.channels-sidebar {
		width: 300px;
		flex-shrink: 0;
		border-right: 1px solid #ddd;
		padding: 1rem;
		overflow-y: auto;
		background: white;
		height: 100%; /* Full height of layout */
	}

	.channels-header {
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e7eb;
		margin-bottom: 1rem;
	}

	.channels-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.channel-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.channel-item {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 12px;
		cursor: pointer;
		transition: all 0.2s;
		background: white;
	}

	.channel-item:hover {
		border-color: #007bff;
		box-shadow: 0 2px 4px rgba(0,123,255,0.1);
	}

	.channel-item.selected {
		border-color: #007bff;
		background-color: #f8f9ff;
		box-shadow: 0 2px 8px rgba(0,123,255,0.15);
	}

	.channel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.channel-name {
		font-weight: 600;
		color: #333;
		font-size: 0.9rem;
	}

	.channel-badge {
		font-size: 0.7rem;
		padding: 2px 6px;
		border-radius: 8px;
		background: #e9ecef;
		color: #495057;
	}

	.channel-badge.human-director {
		background: #fee2e2;
		color: #dc2626;
	}

	.channel-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.75rem;
		color: #6b7280;
	}

	.message-count {
		font-weight: 500;
	}

	.unread-count {
		color: #ef4444;
		font-weight: 600;
	}

	/* Column 2: Messages Viewer (Flexible) */
	.messages-viewer {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: white;
		min-width: 0;
		position: relative;
		height: 100%; /* Full height of layout */
		overflow: hidden;
	}

	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		min-height: 0; /* Allow shrinking for scroll */
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Messages in column 2 - flat style like documents */
	.message {
		padding: 0.5rem 0;
		border-bottom: 2px solid #d1d5db;
		margin-bottom: 0.25rem;
		cursor: pointer;
		transition: background-color 0.2s;
		position: relative;
	}

	.message:hover {
		background-color: rgba(59, 130, 246, 0.05);
	}

	.message.selected {
		background-color: rgba(59, 130, 246, 0.1);
		border-left: 4px solid #3b82f6;
		padding-left: calc(0.5rem - 4px);
	}

	.message:last-child {
		border-bottom: 2px solid #d1d5db;
	}

	.message-indicator {
		position: absolute;
		top: 8px;
		right: 8px;
		font-size: 0.75rem;
		color: #6b7280;
	}

	.replies-count {
		background: #e5e7eb;
		padding: 2px 6px;
		border-radius: 12px;
		font-weight: 500;
	}

	/* Column 3: Sliding Threads Column */
	.threads-column {
		position: absolute;
		top: 0;
		right: 0;
		width: 600px; /* Wider for better content viewing */
		height: 100%; /* Full height of parent layout */
		background: #f9fafb;
		border-left: 1px solid #e5e7eb;
		box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		transform: translateX(100%);
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 10;
		overflow: hidden; /* Prevent content overflow */
	}

	.threads-column.open {
		transform: translateX(0); /* Slides out completely to right edge, overlapping messages */
	}

	.threads-header {
		padding: 1rem 0.5rem 1rem 1rem; /* Less padding on right to move X closer to edge */
		border-bottom: 1px solid #e5e7eb;
		background: white;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.threads-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.close-threads-btn {
		background: none;
		border: none;
		font-size: 24px;
		color: #6b7280;
		cursor: pointer;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: all 0.2s;
		line-height: 1;
	}

	.close-threads-btn:hover {
		background-color: #f3f4f6;
		color: #374151;
	}

	.threads-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0; /* Force flex item to respect container height and enable scrolling */
	}

	.no-thread-selected, .no-replies {
		text-align: center;
		padding: 2rem 1rem;
		color: #6b7280;
		font-style: italic;
	}

	.original-message {
		background: white;
		border: 2px solid #3b82f6;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.thread-reply {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 1rem;
		margin-left: 1rem;
	}

	/* Message components */
	.message-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.125rem;
	}

	.message-author {
		font-weight: 700;
		color: #1f2937;
		font-size: 0.8rem;
	}

	.message-time {
		font-size: 0.7rem;
		color: #6b7280;
	}

	.message-content {
		font-size: 0.85rem;
		line-height: 1.4;
		color: #374151;
		margin: 0;
	}

	.message-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	/* Add Reply Form */
	.add-reply-form {
		padding: 1rem;
		border-top: 1px solid #e5e7eb;
		background: white;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.reply-input {
		resize: vertical;
		min-height: 60px;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		font-family: inherit;
	}

	.reply-input:focus {
		outline: 2px solid #3b82f6;
		outline-offset: -1px;
		border-color: #3b82f6;
	}

	.reply-input::placeholder {
		color: #9ca3af;
	}

	.communications-placeholder {
		padding: 40px;
		text-align: center;
		color: #6b7280;
		background: #f9fafb;
		border: 2px dashed #d1d5db;
		border-radius: 8px;
		margin: 20px;
	}

	.communications-placeholder h3 {
		margin: 0 0 16px 0;
		font-size: 20px;
		font-weight: 600;
		color: #374151;
	}

	.communications-placeholder p {
		margin: 8px 0;
		font-size: 14px;
		line-height: 1.5;
	}

	/* Channel list styles - copied from ChannelsSection */
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

	.channel-name {
		font-weight: 500;
		color: #333;
	}

	.channel-badge {
		background: #28a745;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 500;
	}

	.channel-badge.human-director {
		background: #f59e0b;
		color: white;
	}

	.channel-badge.unread-badge {
		background: #ef4444;
		color: white;
		font-weight: 700;
		min-width: 20px;
		text-align: center;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0% { transform: scale(1); }
		50% { transform: scale(1.05); }
		100% { transform: scale(1); }
	}

	.channel-details {
		display: flex;
		gap: 8px;
		font-size: 12px;
		color: #666;
	}

	.channel-stats {
		font-size: 12px;
		color: #666;
	}

	.unread-count {
		color: #ef4444;
		font-weight: 600;
	}

	/* Messages view styles - copied from ChannelsSection */
	.messages-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0;
		margin: 0;
	}
	
	.messages-container {
		flex: 1;
		overflow-y: auto;
		margin-bottom: 16px;
		padding: 0;
	}
	
	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0;
	}
	
	.message {
		background: transparent;
		border: none;
		border-radius: 0;
		padding: 6px 16px;
		box-shadow: none;
		transition: background-color 0.1s ease;
		margin-bottom: 4px;
		border-bottom: 1px solid #f3f4f6;
	}

	.message:last-child {
		border-bottom: none;
	}
	
	.message:hover {
		background: #f8f9fa;
	}

	.message.reply {
		margin-left: 24px;
		border-left: 2px solid #e5e7eb;
		padding-left: 12px;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 1px;
		font-size: 12px;
		gap: 8px;
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
		line-height: 1.3;
		color: #333;
		margin-bottom: 1px;
	}

	.message-actions {
		margin-top: 1px;
		display: flex;
		gap: 4px;
		align-items: center;
	}

	.reply-btn {
		background: transparent;
		border: none;
		color: #64748b;
		padding: 2px 4px;
		border-radius: 3px;
		font-size: 11px;
		cursor: pointer;
		transition: all 0.1s ease;
		text-decoration: none;
		opacity: 0.7;
	}

	.reply-btn:hover {
		background: #e2e8f0;
		color: #334155;
		opacity: 1;
	}

	.mark-read-btn {
		color: #059669 !important;
		opacity: 0.8;
	}

	.mark-read-btn:hover {
		background: #dcfce7 !important;
		color: #047857 !important;
		opacity: 1;
	}

	.no-messages {
		text-align: center;
		padding: 40px;
		color: #6b7280;
	}

	.no-messages p {
		margin: 8px 0;
		font-size: 14px;
	}

	/* Message input styles */
	.message-input-container {
		border-top: 1px solid #e5e5e5;
		padding: 16px 1rem 1rem 1rem;
		background: white;
		flex-shrink: 0; /* Don't shrink when messages grow */
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
		outline: none;
	}

	.message-input:disabled {
		background: #f5f5f5;
		color: #999;
	}
	
	.send-btn {
		background: #007acc;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.send-btn:hover {
		background: #0056a3;
	}

	.send-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.input-note {
		font-size: 12px;
		color: #666;
		margin: 0;
	}

	.btn-icon {
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 14px;
		color: #666;
		transition: all 0.2s ease;
	}

	.btn-icon:hover {
		background: #e5e5e5;
		color: #333;
	}

	/* Inline assignment badges */
	.inline-assignments {
		display: flex;
		gap: 4px;
		margin-top: 4px;
		flex-wrap: wrap;
	}

	.assignment-badge {
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 10px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.assignment-badge.fully-read {
		background: #dcfce7;
		color: #166534;
		border: 1px solid #bbf7d0;
	}

	.assignment-badge.unread {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}

	.assignment-badge:not(.fully-read):not(.unread) {
		background: #fef3c7;
		color: #d97706;
		border: 1px solid #fed7aa;
	}

	.urgent-view {
		height: 100%;
		overflow-y: auto;
	}

	.urgent-view h3 {
		margin: 0 0 16px 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}

	.message-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.message-card {
		background: #fafbfc;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 16px;
		transition: all 0.2s ease;
	}

	.message-card.urgent {
		border-left: 4px solid #ef4444;
	}

	.message-card.unread {
		background: #fef7ff;
		border-color: #d8b4fe;
	}

	.message-card.enhanced {
		border-left: 4px solid #2563eb;
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

	.message-info {
		flex: 1;
		min-width: 0;
	}

	.message-title-line {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.message-source-line {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: #6b7280;
	}

	.message-icon {
		font-size: 18px;
		min-width: 24px;
	}

	.message-source,
	.channel-name {
		font-weight: 500;
		color: #374151;
	}

	.message-time {
		font-size: 12px;
		color: #9ca3af;
	}

	.message-actions {
		display: flex;
		gap: 8px;
	}

	.btn-small {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.btn-small:hover {
		background: #e5e7eb;
	}

	.btn-small.btn-primary {
		background: #2563eb;
		color: white;
		border-color: #2563eb;
	}

	.btn-small.btn-primary:hover {
		background: #1d4ed8;
	}

	.message-content {
		margin-top: 8px;
	}

	.message-body {
		color: #374151;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.parent-context {
		margin-top: 8px;
		color: #6b7280;
		font-style: italic;
	}

	.empty-state {
		text-align: center;
		padding: 40px 20px;
		color: #6b7280;
	}

	.empty-state h4 {
		margin: 0 0 8px 0;
		color: #374151;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	.assistant-view {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.assistant-header {
		margin-bottom: 20px;
	}

	.assistant-header h3 {
		margin: 0 0 8px 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}

	.assistant-description {
		margin: 0 0 16px 0;
		color: #6b7280;
		font-size: 14px;
	}

	.assistant-title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.assistant-controls {
		display: flex;
		align-items: center;
	}

	.toggle-container {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		user-select: none;
	}

	.toggle-label {
		font-size: 14px;
		color: #374151;
		font-weight: 500;
	}

	.toggle-container input[type="checkbox"] {
		display: none;
	}

	.toggle-slider {
		position: relative;
		width: 44px;
		height: 24px;
		background: #d1d5db;
		border-radius: 12px;
		transition: background-color 0.2s ease;
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
		transition: transform 0.2s ease;
	}

	.toggle-container input:checked + .toggle-slider {
		background: #2563eb;
	}

	.toggle-container input:checked + .toggle-slider::before {
		transform: translateX(20px);
	}

	.forwarding-notice {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 6px;
		padding: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: #1e40af;
	}

	.notice-icon {
		font-size: 16px;
		min-width: 20px;
	}

	.assistant-chat {
		flex: 1;
		overflow-y: auto;
		margin-bottom: 16px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		background: #fafbfc;
	}

	.assistant-message {
		padding: 12px 16px;
		border-bottom: 1px solid #f3f4f6;
	}

	.assistant-message:last-child {
		border-bottom: none;
	}

	.assistant-message.from-director {
		background: #eff6ff;
	}

	.assistant-message.from-assistant {
		background: #f0fdf4;
	}

	.assistant-message .message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
		font-size: 14px;
		font-weight: 500;
	}

	.assistant-message.from-director .message-header {
		color: #1e40af;
	}

	.assistant-message.from-assistant .message-header {
		color: #15803d;
	}

	.assistant-message .message-body {
		color: #374151;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.empty-chat {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: #6b7280;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.empty-chat h4 {
		margin: 0 0 8px 0;
		color: #374151;
	}

	.empty-chat p {
		margin: 0;
		font-size: 14px;
	}

	.assistant-input {
		margin-top: auto;
	}

	.input-container {
		display: flex;
		gap: 12px;
		align-items: flex-end;
	}

	.input-container textarea {
		flex: 1;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 10px 12px;
		resize: none;
		font-family: inherit;
		font-size: 14px;
		line-height: 1.4;
	}

	.input-container textarea:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.send-btn {
		background: #2563eb;
		color: white;
		border: none;
		padding: 10px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s ease;
		white-space: nowrap;
	}

	.send-btn:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.send-btn:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.input-hint {
		margin-top: 6px;
		font-size: 12px;
		color: #6b7280;
	}

	.dashboard-view {
		height: 100%;
		overflow-y: auto;
	}

	.dashboard-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		height: 100%;
	}

	.dashboard-card {
		background: #fafbfc;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 16px;
		overflow-y: auto;
	}

	.dashboard-card h3 {
		margin: 0 0 16px 0;
		font-size: 16px;
		font-weight: 600;
		color: #374151;
	}

	.activity-stats {
		display: flex;
		gap: 16px;
		margin-bottom: 16px;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px;
		background: white;
		border-radius: 6px;
		border: 1px solid #f3f4f6;
		flex: 1;
	}

	.stat-number {
		font-size: 24px;
		font-weight: 700;
		color: #2563eb;
		margin-bottom: 4px;
	}

	.stat-label {
		font-size: 12px;
		color: #6b7280;
		text-align: center;
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
		align-items: center;
		gap: 12px;
		padding: 8px;
		background: white;
		border-radius: 6px;
		border: 1px solid #f3f4f6;
	}

	.activity-item.recent {
		padding: 12px;
	}

	.agent-name,
	.channel-name {
		font-weight: 500;
		color: #374151;
		min-width: 100px;
	}

	.activity-count {
		font-size: 14px;
		color: #6b7280;
		flex: 1;
	}

	.activity-time {
		font-size: 12px;
		color: #9ca3af;
		min-width: 80px;
		text-align: right;
	}

	.activity-icon {
		font-size: 18px;
		min-width: 24px;
	}

	.activity-details {
		flex: 1;
		min-width: 0;
	}

	.activity-summary {
		display: block;
		font-weight: 500;
		color: #374151;
		font-size: 14px;
	}

	.activity-preview {
		display: block;
		font-size: 13px;
		color: #6b7280;
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-note {
		color: #6b7280;
		font-style: italic;
		margin: 0;
	}

	.direct-messages-view {
		height: 100%;
		display: flex;
		gap: 20px;
		overflow: hidden;
	}

	.dm-left {
		width: 400px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-y: auto;
	}

	.dm-right {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	/* DM Agent List Styles */
	.dm-agents-panel {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 16px;
	}

	.dm-agents-panel h3 {
		margin: 0 0 12px 0;
		color: #333;
	}

	.dm-agents-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.dm-agents-header h3 {
		margin: 0;
	}

	.dm-agent-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.dm-agent-item {
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px;
		transition: all 0.2s ease;
		cursor: pointer;
		user-select: none;
	}

	.dm-agent-item:hover {
		border-color: #007acc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.dm-agent-item.active {
		border-color: #007acc;
		background: #f0f8ff;
	}

	.dm-agent-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.dm-agent-name {
		font-weight: 500;
		color: #333;
	}

	.dm-agent-role {
		font-size: 12px;
		color: #666;
		background: #f3f4f6;
		padding: 2px 6px;
		border-radius: 10px;
	}

	.dm-agent-details {
		display: flex;
		gap: 8px;
		font-size: 12px;
		color: #666;
	}

	.dm-last-message {
		font-size: 12px;
		color: #666;
	}

	.no-dm-agents {
		text-align: center;
		padding: 20px;
		color: #6b7280;
	}

	.no-dm-agents p {
		margin: 4px 0;
		font-size: 14px;
	}

	/* DM Messages View Styles */
	.dm-messages-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0;
		margin: 0;
	}
	
	.dm-messages-container {
		flex: 1;
		overflow-y: auto;
		margin-bottom: 16px;
		padding: 0;
	}
	
	.dm-messages-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0;
	}

	.dm-input-container {
		border-top: 1px solid #e5e5e5;
		padding-top: 16px;
	}
	
	.dm-input-wrapper {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}

	.dm-placeholder {
		padding: 40px;
		text-align: center;
		color: #6b7280;
		background: #f9fafb;
		border: 2px dashed #d1d5db;
		border-radius: 8px;
		margin: 20px;
	}

	.dm-placeholder h3 {
		margin: 0 0 16px 0;
		font-size: 20px;
		font-weight: 600;
		color: #374151;
	}

	.dm-placeholder p {
		margin: 8px 0;
		font-size: 14px;
		line-height: 1.5;
	}

	.all-messages-view {
		height: 100%;
		overflow-y: auto;
	}

	.messages-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.messages-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}

	.messages-stats {
		display: flex;
		gap: 16px;
		font-size: 14px;
		color: #6b7280;
	}

	.stat {
		padding: 4px 8px;
		background: #f3f4f6;
		border-radius: 4px;
	}

	.reply-badge,
	.dm-badge {
		background: #dbeafe;
		color: #1e40af;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.reading-status-section {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid #f3f4f6;
	}

	.reading-status-section h5 {
		margin: 0 0 12px 0;
		font-size: 14px;
		font-weight: 600;
		color: #374151;
	}

	.assignments-grouped {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.assignment-group {
		background: #f9fafb;
		border-radius: 6px;
		padding: 12px;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
		font-size: 14px;
		color: #374151;
	}

	.group-type-icon {
		font-size: 16px;
	}

	.group-count {
		color: #6b7280;
		font-weight: normal;
	}

	.assignment-items {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.assignment-item {
		background: white;
		border-radius: 4px;
		padding: 8px;
		border: 1px solid #e5e7eb;
	}

	.assignment-item.fully-read {
		background: #f0fdf4;
		border-color: #bbf7d0;
	}

	.assignment-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.assignment-name {
		font-weight: 500;
		color: #374151;
	}

	.read-indicators {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.read-count {
		font-size: 12px;
		color: #6b7280;
	}

	.read-count.all-read {
		color: #059669;
		font-weight: 600;
	}

	.status-indicator {
		font-size: 14px;
	}

	.status-indicator.read {
		color: #059669;
	}

	.status-indicator.partial {
		color: #f59e0b;
	}

	.status-indicator.unread {
		color: #9ca3af;
	}

	.read-by-list,
	.unread-agents-list {
		font-size: 12px;
		margin-top: 4px;
	}

	.read-by-label,
	.unread-label {
		color: #6b7280;
		margin-right: 6px;
	}

	.read-by-agent,
	.unread-agent {
		display: inline-block;
		margin-right: 8px;
		color: #374151;
	}

	.no-assignments {
		margin-top: 8px;
		color: #6b7280;
		font-style: italic;
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
		border-radius: 8px;
		padding: 24px;
		max-width: 500px;
		width: 90%;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
	}

	.dialog-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.dialog h3 {
		margin: 0 0 20px 0;
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
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		color: #374151;
	}

	.form-group {
		margin-bottom: 16px;
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
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 14px;
		font-family: inherit;
		transition: border-color 0.2s ease;
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

	.reply-context {
		margin-bottom: 16px;
		padding: 12px;
		background: #f9fafb;
		border-radius: 6px;
		border: 1px solid #e5e7eb;
	}

	.original-message .message-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		font-size: 14px;
		color: #6b7280;
	}

	.message-preview {
		color: #374151;
		font-style: italic;
	}

	.reading-assignments-section {
		margin-bottom: 16px;
	}

	.assignments-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.assignments-header h4 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #374151;
	}

	.add-assignment-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.add-assignment-btn:hover {
		background: #e5e7eb;
	}

	.assignment-row {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-bottom: 8px;
	}

	.assignment-row select {
		width: 120px;
	}

	.assignment-row input {
		flex: 1;
	}

	.remove-btn {
		background: #fecaca;
		color: #dc2626;
		border: 1px solid #fca5a5;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.remove-btn:hover {
		background: #fca5a5;
	}

	.dialog-buttons {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 20px;
	}

	.cancel-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 10px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.cancel-btn:hover {
		background: #e5e7eb;
	}

	/* Simple Reading Assignments */
	.reading-assignments-simple {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 4px;
		font-size: 12px;
	}

	.assignment-tag {
		font-weight: 500;
	}

	.assignment-tag.read {
		color: #22c55e;
	}

	.assignment-tag.partial {
		color: #f59e0b;
	}

	.assignment-tag.unread {
		color: #ef4444;
	}

	/* FROM/TO styling */
	.message-from, .message-to {
		font-size: 12px;
		margin-right: 12px;
	}

	.message-from strong, .message-to strong {
		color: #6b7280;
		font-weight: 600;
		margin-right: 4px;
	}

	.assignment-name.read {
		color: #22c55e;
		font-weight: 500;
	}

	.assignment-name.partial {
		color: #f59e0b;
		font-weight: 500;
	}

	.assignment-name.unread {
		color: #ef4444;
		font-weight: 500;
	}

	/* Markdown Content Styling */
	.markdown-content {
		line-height: 1.6;
	}

	.markdown-content h1,
	.markdown-content h2,
	.markdown-content h3,
	.markdown-content h4,
	.markdown-content h5,
	.markdown-content h6 {
		margin: 1.5em 0 0.5em 0;
		font-weight: 600;
		color: #111827;
	}

	.markdown-content h1 {
		font-size: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 0.5rem;
	}

	.markdown-content h2 {
		font-size: 1.25rem;
	}

	.markdown-content h3 {
		font-size: 1.125rem;
	}

	.markdown-content h4 {
		font-size: 1rem;
	}

	.markdown-content p {
		margin: 1em 0;
	}

	.markdown-content ul,
	.markdown-content ol {
		margin: 1em 0;
		padding-left: 2em;
	}

	.markdown-content li {
		margin: 0.25em 0;
	}

	.markdown-content blockquote {
		margin: 1em 0;
		padding: 0.5em 1em;
		border-left: 4px solid #d1d5db;
		background: #f9fafb;
		color: #6b7280;
	}

	.markdown-content code {
		background: #f3f4f6;
		padding: 0.125em 0.25em;
		border-radius: 0.25rem;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875em;
		color: #dc2626;
	}

	.markdown-content pre {
		background: #1f2937;
		color: #f9fafb;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin: 1em 0;
	}

	.markdown-content pre code {
		background: none;
		padding: 0;
		color: inherit;
		font-size: 0.875rem;
	}

	.markdown-content table {
		border-collapse: collapse;
		width: 100%;
		margin: 1em 0;
	}

	.markdown-content th,
	.markdown-content td {
		border: 1px solid #d1d5db;
		padding: 0.5em;
		text-align: left;
	}

	.markdown-content th {
		background: #f9fafb;
		font-weight: 600;
	}

	.markdown-content a {
		color: #2563eb;
		text-decoration: underline;
	}

	.markdown-content a:hover {
		color: #1d4ed8;
	}

	.markdown-content strong {
		font-weight: 600;
	}

	.markdown-content em {
		font-style: italic;
	}

	.markdown-content hr {
		border: none;
		border-top: 1px solid #e5e7eb;
		margin: 2em 0;
	}

	/* Read status icon */
	.read-status-icon-container {
		display: inline-flex;
		align-items: center;
		margin-right: 8px;
		padding: 4px;
		cursor: pointer;
		border-radius: 6px;
		transition: background-color 0.2s ease;
		min-width: 32px;
		min-height: 24px;
		justify-content: center;
	}
	
	.read-status-icon-container:hover {
		background-color: rgba(0, 0, 0, 0.05);
	}
	
	.read-status-icon {
		font-size: 16px;
		transition: all 0.2s ease;
		user-select: none;
	}
	
	.read-status-icon-container:hover .read-status-icon {
		transform: scale(1.1);
	}

	/* Tooltip styles */
	:global(.read-status-tooltip) {
		background: #1f2937;
		color: white;
		padding: 8px 12px;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		font-size: 12px;
		max-width: 300px;
		min-width: 200px;
		pointer-events: auto;
		user-select: none;
	}
	
	
	:global(.read-status-tooltip .tooltip-header) {
		font-weight: 600;
		margin-bottom: 6px;
		color: #f3f4f6;
		font-size: 13px;
	}
	
	:global(.read-status-tooltip .agents-list) {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	
	:global(.read-status-tooltip .agent-status) {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
	}
	
	:global(.read-status-tooltip .agent-icon) {
		width: 16px;
		font-size: 11px;
	}
	
	:global(.read-status-tooltip .agent-name) {
		font-weight: 500;
		flex-grow: 1;
	}
	
	:global(.read-status-tooltip .read-time) {
		font-size: 10px;
		color: #9ca3af;
	}
	
	:global(.read-status-tooltip .agent-read) {
		color: #10b981;
	}
	
	:global(.read-status-tooltip .agent-unread) {
		color: #f59e0b;
	}
</style>