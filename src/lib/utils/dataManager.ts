/**
 * Data Manager Utilities
 * Extracted from CommunicationsSection.svelte
 * Handles all data loading, counting, and real-time updates
 */

import { 
	markMessageAsRead,
	markMessageAsReadWithoutRefresh
} from './messageOperations';

import { 
	isMessageFromHumanDirector,
	isAssignmentForHumanDirector,
	isContentUnreadByHumanDirector,
	getHumanDirectorAgentId
} from './humanDirectorClientHelpers';

export interface DataManagerCallbacks {
	updateChannelMessages?: (messages: any[]) => void;
	updateDMMessages?: (messages: any[]) => void;
	updateChannels?: (channels: any[]) => void;
	updateDMAgents?: (agents: any[]) => void;
	updateAgents?: (agents: any[]) => void;
	updateRoleTypes?: (roleTypes: any[]) => void;
	updateSquads?: (squads: any[]) => void;
	updateUnreadCounts?: (counts: { total: number; channel: number; dm: number }) => void;
}

export class DataManager {
	private selectedProject: any = null;
	private selectedChannel: any = null;
	private selectedDMAgent: any = null;
	private callbacks: DataManagerCallbacks = {};

	// Unread counts
	private totalUnreadCount = 0;
	private channelUnreadCount = 0;
	private dmUnreadCount = 0;

	constructor(callbacks: DataManagerCallbacks = {}) {
		this.callbacks = callbacks;
	}

	// Update project context
	setProject(project: any) {
		this.selectedProject = project;
	}

	setSelectedChannel(channel: any) {
		this.selectedChannel = channel;
	}

	setSelectedDMAgent(agent: any) {
		this.selectedDMAgent = agent;
	}

	// Fetch current unread counts from the server
	async loadUnreadCounts() {
		if (!this.selectedProject) return;

		try {
			const response = await fetch(`/api/content/updates?projectId=${this.selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				this.calculateUnreadCountsFromData(data.updates);
			}
		} catch (error) {
			console.error('Failed to load unread counts:', error);
		}
	}

	// Calculate unread counts from content data
	calculateUnreadCountsFromData(updates: any) {
		if (!updates) return;
		
		// Count unread channel messages (type "message" or "reply")
		this.channelUnreadCount = updates.channelMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isContentUnreadByHumanDirector(msg)
		).length || 0;

		// Count unread direct messages (type "message" or "reply")
		const unreadDMs = updates.directMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isContentUnreadByHumanDirector(msg)
		) || [];
		this.dmUnreadCount = unreadDMs.length;
		
		// Debug logging
		console.log(`📊 DM Count Debug - Found ${updates.directMessages?.length || 0} total DMs, ${unreadDMs.length} unread:`, 
			unreadDMs.map((dm: any) => `ID:${dm.id} from:${dm.authorAgentId} type:${dm.type}`)
		);

		// Count unread documents  
		const unreadDocs = updates.documents?.filter((doc: any) => 
			isContentUnreadByHumanDirector(doc)
		) || [];
		const documentsUnreadCount = unreadDocs.length;
		
		// Total unread count (matching main page calculation)
		this.totalUnreadCount = this.channelUnreadCount + this.dmUnreadCount + documentsUnreadCount;
		
		console.log(`📊 Total Unread Debug - Channels: ${this.channelUnreadCount}, DMs: ${this.dmUnreadCount}, Docs: ${documentsUnreadCount}, Total: ${this.totalUnreadCount}`);
		
		// Notify callback
		if (this.callbacks.updateUnreadCounts) {
			this.callbacks.updateUnreadCounts({
				total: this.totalUnreadCount,
				channel: this.channelUnreadCount,
				dm: this.dmUnreadCount
			});
		}
	}

	// Update counts when new updates arrive
	updateUnreadCountsFromNewData(updates: any) {
		if (!updates) return;

		// Add new unread messages to existing counts
		const newChannelUnread = updates.channelMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isContentUnreadByHumanDirector(msg)
		).length || 0;

		const newDmUnread = updates.directMessages?.filter((msg: any) => 
			(msg.type === 'message' || msg.type === 'reply') && isContentUnreadByHumanDirector(msg)
		).length || 0;

		if (newChannelUnread > 0 || newDmUnread > 0) {
			this.channelUnreadCount += newChannelUnread;
			this.dmUnreadCount += newDmUnread;
			this.totalUnreadCount = this.channelUnreadCount + this.dmUnreadCount;
			
			console.log(`📊 New unread messages - Channels: +${newChannelUnread}, DMs: +${newDmUnread}, Total: ${this.totalUnreadCount}`);
			
			// Notify callback
			if (this.callbacks.updateUnreadCounts) {
				this.callbacks.updateUnreadCounts({
					total: this.totalUnreadCount,
					channel: this.channelUnreadCount,
					dm: this.dmUnreadCount
				});
			}
		}
	}

	// Load channel messages
	async loadChannelMessages(channel: any) {
		if (!channel) {
			if (this.callbacks.updateChannelMessages) {
				this.callbacks.updateChannelMessages([]);
			}
			return;
		}

		try {
			console.log(`Loading messages for channel: ${channel.name} (ID: ${channel.id})`);
			const response = await fetch(`/api/messages?projectId=${this.selectedProject.id}&channelId=${channel.id}`);
			if (response.ok) {
				const messages = await response.json();
				console.log(`✅ Loaded ${messages.length} messages for channel ${channel.name}`);
				
				// Update callback
				if (this.callbacks.updateChannelMessages) {
					this.callbacks.updateChannelMessages(messages);
				}
				
				// Automatically mark all messages as read (batch operation to avoid multiple refreshes)
				const unreadMessages = messages.filter((message: any) => isContentUnreadByHumanDirector(message));
				if (unreadMessages.length > 0) {
					console.log(`📖 Auto-marking ${unreadMessages.length} unread messages as read for channel ${channel.name}`);
					
					// Mark all unread messages as read without UI refreshes
					for (const message of unreadMessages) {
						await markMessageAsReadWithoutRefresh(message);
					}
					
					// Refresh channel list once after all messages are marked as read
					await this.loadChannels();
					console.log(`✅ Refreshed channel list after auto-reading ${unreadMessages.length} messages`);
				}
			} else {
				console.error('Failed to load channel messages:', response.status);
				if (this.callbacks.updateChannelMessages) {
					this.callbacks.updateChannelMessages([]);
				}
			}
		} catch (error) {
			console.error('Error loading channel messages:', error);
			if (this.callbacks.updateChannelMessages) {
				this.callbacks.updateChannelMessages([]);
			}
		}
	}

	// Load channels with message counts
	async loadChannels() {
		if (!this.selectedProject) {
			if (this.callbacks.updateChannels) {
				this.callbacks.updateChannels([]);
			}
			return;
		}

		try {
			const response = await fetch(`/api/channels?projectId=${this.selectedProject.id}`);
			if (response.ok) {
				const channelsData = await response.json();
				
				// Load message counts for each channel
				const channelsWithCounts = await Promise.all(
					channelsData.map(async (channel: any) => {
						try {
							const msgResponse = await fetch(`/api/messages?projectId=${this.selectedProject.id}&channelId=${channel.id}`);
							if (msgResponse.ok) {
								const messages = await msgResponse.json();
								
								// Calculate unread messages for human-director only
								const unreadCount = messages.filter((message: any) => isContentUnreadByHumanDirector(message)).length;
								
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
				
				if (this.callbacks.updateChannels) {
					this.callbacks.updateChannels(channelsWithCounts);
				}
			} else {
				console.error('Failed to load channels:', response.status);
			}
		} catch (error) {
			console.error('Failed to load channels:', error);
		}
	}

	// Load agents
	async loadAgents() {
		if (!this.selectedProject) {
			if (this.callbacks.updateAgents) {
				this.callbacks.updateAgents([]);
			}
			return;
		}

		try {
			const response = await fetch(`/api/agents?projectId=${this.selectedProject.id}`);
			if (response.ok) {
				const agents = await response.json();
				if (this.callbacks.updateAgents) {
					this.callbacks.updateAgents(agents);
				}
			} else {
				console.error('Failed to load agents:', response.status);
			}
		} catch (error) {
			console.error('Failed to load agents:', error);
		}
	}

	// Load role types
	async loadRoleTypes() {
		if (!this.selectedProject) {
			if (this.callbacks.updateRoleTypes) {
				this.callbacks.updateRoleTypes([]);
			}
			return;
		}

		try {
			const response = await fetch(`/api/projects/${this.selectedProject.id}/role-types`);
			if (response.ok) {
				const roleTypes = await response.json();
				if (this.callbacks.updateRoleTypes) {
					this.callbacks.updateRoleTypes(roleTypes);
				}
			} else {
				console.error('Failed to load role types:', response.status);
			}
		} catch (error) {
			console.error('Failed to load role types:', error);
		}
	}

	// Load squads
	async loadSquads() {
		if (!this.selectedProject) {
			if (this.callbacks.updateSquads) {
				this.callbacks.updateSquads([]);
			}
			return;
		}

		try {
			const response = await fetch(`/api/squads?projectId=${this.selectedProject.id}`);
			if (response.ok) {
				const squads = await response.json();
				if (this.callbacks.updateSquads) {
					this.callbacks.updateSquads(squads);
				}
			} else {
				console.error('Failed to load squads:', response.status);
			}
		} catch (error) {
			console.error('Failed to load squads:', error);
		}
	}

	// Load DM agents with conversation discovery
	async loadDMAgents() {
		if (!this.selectedProject) {
			if (this.callbacks.updateDMAgents) {
				this.callbacks.updateDMAgents([]);
			}
			return;
		}

		try {
			// Get ALL messages from the beginning of time for agent discovery
			const response = await fetch(`/api/content/updates?projectId=${this.selectedProject.id}&since=2020-01-01T00:00:00Z`);
			if (response.ok) {
				const data = await response.json();
				const directMessages = data.updates.directMessages || [];
				
				// Find all agents that have DM conversations with human-director
				const conversationAgents = new Set();
				
				const humanDirectorId = getHumanDirectorAgentId();
				
				directMessages.forEach((dm: any) => {
					// Case 1: Message FROM another agent TO human-director
					if (dm.authorAgentId && !isMessageFromHumanDirector(dm)) {
						// Check if this message has reading assignment for human-director
						const hasAssignmentToHuman = dm.readingAssignments?.some((a: any) => 
							isAssignmentForHumanDirector(a)
						);
						if (hasAssignmentToHuman) {
							conversationAgents.add(dm.authorAgentId);
						}
					}
					
					// Case 2: Message FROM human-director TO other agents
					if (isMessageFromHumanDirector(dm) && dm.readingAssignments) {
						dm.readingAssignments.forEach((assignment: any) => {
							// Direct agent assignment
							if (assignment.assignedToType === 'agent' && assignment.assignedTo !== humanDirectorId) {
								conversationAgents.add(assignment.assignedTo);
							}
							// Role assignment - use targetAgents to find actual agents
							else if (assignment.assignedToType === 'role' && assignment.targetAgents) {
								assignment.targetAgents.forEach((agentId: string) => {
									if (agentId !== humanDirectorId) {
										conversationAgents.add(agentId);
									}
								});
							}
							// Squad assignment - use targetAgents to find actual agents
							else if (assignment.assignedToType === 'squad' && assignment.targetAgents) {
								assignment.targetAgents.forEach((agentId: string) => {
									if (agentId !== humanDirectorId) {
										conversationAgents.add(agentId);
									}
								});
							}
						});
					}
				});

				// Create agent objects for UI
				const dmAgents = Array.from(conversationAgents).map(agentId => {
					// Find most recent message in this conversation
					const conversationMessages = directMessages.filter((dm: any) => 
						dm.authorAgentId === agentId || 
						(isMessageFromHumanDirector(dm) && 
						 dm.readingAssignments?.some((a: any) => 
							(a.assignedToType === 'agent' && a.assignedTo === agentId) ||
							(a.assignedToType === 'role' && a.targetAgents?.includes(agentId)) ||
							(a.assignedToType === 'squad' && a.targetAgents?.includes(agentId))
						))
					);
					
					const recentMessage = conversationMessages
						.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

					// Count unread messages from this agent to human-director
					const unreadCount = directMessages.filter((dm: any) => 
						dm.authorAgentId === agentId && isContentUnreadByHumanDirector(dm)
					).length;

					// Determine role type from agent ID
					let roleType = 'Unknown';
					if ((agentId as string).startsWith('pm_')) roleType = 'Product Manager';
					else if ((agentId as string).startsWith('be_')) roleType = 'Backend Developer';
					else if ((agentId as string).startsWith('fe_')) roleType = 'Frontend Developer';
					else if ((agentId as string).startsWith('ai_')) roleType = 'AI Developer';
					else if ((agentId as string).startsWith('ux_')) roleType = 'UX Expert';
					else if ((agentId as string).startsWith('design_')) roleType = 'Graphic Designer';
					else if ((agentId as string).startsWith('qa_')) roleType = 'Technical QA';
					else if ((agentId as string).startsWith('sa_')) roleType = 'System Architect';

					return {
						id: agentId,
						roleType: roleType,
						status: 'online',
						lastMessageAt: recentMessage?.createdAt || null,
						unreadCount: unreadCount
					};
				});
				
				// Sort by most recent message
				dmAgents.sort((a, b) => {
					if (!a.lastMessageAt && !b.lastMessageAt) return 0;
					if (!a.lastMessageAt) return 1;
					if (!b.lastMessageAt) return -1;
					return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
				});
				
				if (this.callbacks.updateDMAgents) {
					this.callbacks.updateDMAgents(dmAgents);
				}
			} else {
				console.error('Failed to load DM content:', response.status);
			}
		} catch (error) {
			console.error('Failed to load DM agents:', error);
		}
	}

	// Load DM messages for a specific agent
	async loadDMMessages(agentId: string) {
		if (!this.selectedProject || !agentId) {
			if (this.callbacks.updateDMMessages) {
				this.callbacks.updateDMMessages([]);
			}
			return;
		}

		try {
			// Get ALL messages from the beginning of time
			const response = await fetch(`/api/content/updates?projectId=${this.selectedProject.id}&since=2020-01-01T00:00:00Z`);
			if (response.ok) {
				const data = await response.json();
				const allDMs = data.updates.directMessages || [];
				
				// Filter to show only conversation between human-director and the selected agent
				let dmMessages = allDMs.filter((msg: any) => {
					// Include if the message is from the selected agent
					if (msg.authorAgentId === agentId) return true;
					
					// Include if the message is from human-director AND has a reading assignment for the selected agent
					if (isMessageFromHumanDirector(msg) && msg.readingAssignments) {
						return msg.readingAssignments.some((assignment: any) => 
							(assignment.assignedToType === 'agent' && assignment.assignedTo === agentId) ||
							(assignment.assignedToType === 'role' && assignment.targetAgents?.includes(agentId)) ||
							(assignment.assignedToType === 'squad' && assignment.targetAgents?.includes(agentId))
						);
					}
					
					return false;
				});
				
				console.log(`📬 Loaded ${dmMessages.length} DM messages with ${agentId} (filtered from ${allDMs.length} total DMs)`);
				
				// Update callback first
				if (this.callbacks.updateDMMessages) {
					this.callbacks.updateDMMessages(dmMessages);
				}
				
				// Automatically mark all messages as read
				let markedAnyAsRead = false;
				for (const message of dmMessages) {
					if (isContentUnreadByHumanDirector(message)) {
						await markMessageAsRead(message);
						markedAnyAsRead = true;
					}
				}
				
				// Reload messages if any were marked as read to get updated read status
				if (markedAnyAsRead) {
					const refreshResponse = await fetch(`/api/content/updates?projectId=${this.selectedProject.id}&since=2020-01-01T00:00:00Z`);
					if (refreshResponse.ok) {
						const refreshData = await refreshResponse.json();
						const allRefreshDMs = refreshData.updates.directMessages || [];
						
						// Re-filter to get updated message data
						dmMessages = allRefreshDMs.filter((msg: any) => {
							if (msg.authorAgentId === agentId) return true;
							
							if (isMessageFromHumanDirector(msg) && msg.readingAssignments) {
								return msg.readingAssignments.some((assignment: any) => 
									(assignment.assignedToType === 'agent' && assignment.assignedTo === agentId) ||
									(assignment.assignedToType === 'role' && assignment.targetAgents?.includes(agentId)) ||
									(assignment.assignedToType === 'squad' && assignment.targetAgents?.includes(agentId))
								);
							}
							
							return false;
						});
						
						// Update callback with refreshed data
						if (this.callbacks.updateDMMessages) {
							this.callbacks.updateDMMessages(dmMessages);
						}
					}
				}
			} else {
				console.error('Failed to load DM messages:', response.status);
				if (this.callbacks.updateDMMessages) {
					this.callbacks.updateDMMessages([]);
				}
			}
		} catch (error) {
			console.error('Error loading DM messages:', error);
			if (this.callbacks.updateDMMessages) {
				this.callbacks.updateDMMessages([]);
			}
		}
	}

	// Handle real-time content updates
	async handleContentUpdates(updates: any) {
		console.log('📬 Processing real-time content updates:', updates);

		// Update unread counts with new messages
		this.updateUnreadCountsFromNewData(updates);

		// Refresh channel data when new channel messages arrive
		if (updates.channelMessages?.length > 0) {
			console.log(`🔄 Refreshing channels due to ${updates.channelMessages.length} new channel messages`);
			// Reload channel list to update unread counts for all channels
			await this.loadChannels();
			
			// Also refresh the currently selected channel messages if needed
			if (this.selectedChannel) {
				const relevantMessages = updates.channelMessages.filter(
					(msg: any) => msg.channelId === this.selectedChannel.id
				);
				
				if (relevantMessages.length > 0) {
					console.log(`🔄 Refreshing ${this.selectedChannel.name} channel messages (${relevantMessages.length} updates detected)`);
					// Reload all messages to get updated read statuses
					this.loadChannelMessages(this.selectedChannel);
				}
			}
		}

		// Update direct messages if we have a selected DM agent
		if (this.selectedDMAgent && updates.directMessages?.length > 0) {
			const relevantDMs = updates.directMessages.filter(
				(msg: any) => 
					msg.authorAgentId === this.selectedDMAgent.id || 
					(msg.readingAssignments?.some((assignment: any) => 
						assignment.assignedToType === 'agent' && assignment.assignedTo === this.selectedDMAgent.id
					))
			);
			
			if (relevantDMs.length > 0) {
				console.log(`🔄 Adding ${relevantDMs.length} new DMs with ${this.selectedDMAgent.id}`);
				// Let the loadDMMessages function handle the refresh completely
				this.loadDMMessages(this.selectedDMAgent.id);
			}
		}

		// Update channel list with new unread counts
		if (updates.channelMessages?.length > 0) {
			this.loadChannels(); // Refresh channel list to update unread counts
		}

		// Update DM agent list with new message indicators
		if (updates.directMessages?.length > 0) {
			this.loadDMAgents(); // Refresh DM agents list
		}
	}

	// Get current unread counts
	getUnreadCounts() {
		return {
			total: this.totalUnreadCount,
			channel: this.channelUnreadCount,
			dm: this.dmUnreadCount
		};
	}
}