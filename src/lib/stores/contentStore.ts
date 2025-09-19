/**
 * Centralized Content Store
 * 
 * Following the Om/Re-frame pattern:
 * - Single source of truth for all content data
 * - Derived stores for different views
 * - Actions for state mutations
 * - Real-time sync integration
 */

import { writable, derived, get } from 'svelte/store';
import type { ContentUpdate, GroupedUpdates } from '$lib/services/ContentPollingService';
import { 
	isContentUnreadByHumanDirector,
	getHumanDirectorAssignments,
	isMessageFromHumanDirector,
	getHumanDirectorAgentId,
	isAssignmentForHumanDirector,
	isHumanDirectorAgent
} from '$lib/utils/humanDirectorClientHelpers';

// ==================== Core State ====================

interface ContentState {
	// Main data - normalized by ID
	contentById: Record<number, ContentUpdate>;
	
	// Metadata
	channels: any[];
	agents: any[]; 
	roleTypes: any[];
	squads: any[];
	
	// DM Oversight data
	dmOversightAgents: any[];
	dmOversightConversations: Record<string, any>;
	
	// Sync state
	lastSyncTimestamp: string | null;
	isLoading: boolean;
	error: string | null;
	
	// Current context
	currentProjectId: number | null;
}

const initialState: ContentState = {
	contentById: {},
	channels: [],
	agents: [],
	roleTypes: [],
	squads: [],
	dmOversightAgents: [],
	dmOversightConversations: {},
	lastSyncTimestamp: null,
	isLoading: false,
	error: null,
	currentProjectId: null
};

// Core writable store
export const contentStore = writable<ContentState>(initialState);

// ==================== Derived Stores ====================
// These automatically update when contentStore changes

export const allContent = derived(contentStore, $store => 
	Object.values($store.contentById)
);

export const channelMessages = derived(contentStore, $store => 
	Object.values($store.contentById).filter(content => 
		content.type === 'message' && content.channelId !== null
	)
);

export const directMessages = derived(contentStore, $store => 
	Object.values($store.contentById).filter(content => 
		(content.type === 'message' || content.type === 'reply') && content.channelId === null
	)
);

export const documents = derived(contentStore, $store => 
	Object.values($store.contentById).filter(content => 
		content.type === 'document'
	)
);

export const replies = derived(contentStore, $store => 
	Object.values($store.contentById).filter(content => 
		content.parentContentId !== null
	)
);

export const tickets = derived(contentStore, $store => 
	Object.values($store.contentById).filter(content => 
		content.type === 'ticket'
	)
);

export const phases = derived(contentStore, $store => 
	Object.values($store.contentById).filter(content => 
		content.type === 'phase'
	)
);

// Channel-specific messages
export const messagesForChannel = (channelId: number | null) => derived(
	channelMessages,
	$messages => $messages.filter(msg => msg.channelId === channelId)
);

// DM conversation between human-director and specific agent
export const dmConversationWith = (agentId: string) => derived(
	directMessages,
	$dms => {
		const humanDirectorId = getHumanDirectorAgentId();
		if (!humanDirectorId) {
			console.log('❌ No human director ID found');
			return [];
		}
		
		return $dms.filter(dm => {
			// Only agent-based assignments, no role logic
			// Show messages that are part of the conversation between these two specific agents
			
			// Message from target agent to human director
			if (dm.authorAgentId === agentId) {
				return dm.readingAssignments?.some(assignment => 
					assignment.assignedToType === 'agent' && assignment.assignedTo === humanDirectorId
				) || false;
			}
			
			// Message from human director to target agent  
			if (dm.authorAgentId === humanDirectorId) {
				return dm.readingAssignments?.some(assignment => 
					assignment.assignedToType === 'agent' && assignment.assignedTo === agentId
				) || false;
			}
			
			return false;
		});
	}
);

// Metadata selectors
export const channels = derived(contentStore, $store => $store.channels);
export const agents = derived(contentStore, $store => $store.agents);
export const roleTypes = derived(contentStore, $store => $store.roleTypes);
export const squads = derived(contentStore, $store => $store.squads);

// DM Oversight selectors
export const dmOversightAgents = derived(contentStore, $store => $store.dmOversightAgents);
export const dmOversightConversations = derived(contentStore, $store => $store.dmOversightConversations);

// Loading/error state
export const isLoading = derived(contentStore, $store => $store.isLoading);
export const error = derived(contentStore, $store => $store.error);
export const currentProjectId = derived(contentStore, $store => $store.currentProjectId);

// ==================== Actions ====================
// These are the only way to mutate the store

export const contentActions = {
	// Set current project context
	setProject(projectId: number) {
		contentStore.update(state => ({
			...state,
			currentProjectId: projectId,
			// Clear data when switching projects
			contentById: {},
			lastSyncTimestamp: null
		}));
	},

	// Set loading state
	setLoading(loading: boolean) {
		contentStore.update(state => ({
			...state,
			isLoading: loading,
			error: loading ? null : state.error
		}));
	},

	// Set error state
	setError(error: string | null) {
		contentStore.update(state => ({
			...state,
			error,
			isLoading: false
		}));
	},

	// Update metadata
	setChannels(channels: any[]) {
		contentStore.update(state => ({
			...state,
			channels
		}));
	},

	setAgents(agents: any[]) {
		contentStore.update(state => ({
			...state,
			agents
		}));
	},

	setRoleTypes(roleTypes: any[]) {
		contentStore.update(state => ({
			...state,
			roleTypes
		}));
	},

	setSquads(squads: any[]) {
		contentStore.update(state => ({
			...state,
			squads
		}));
	},

	// Merge new content updates (central function for real-time updates)
	mergeContentUpdates(updates: GroupedUpdates) {
		contentStore.update(state => {
			const newContentById = { ...state.contentById };
			
			// Merge all content, normalizing by ID
			updates.all.forEach(content => {
				newContentById[content.id] = content;
			});

			return {
				...state,
				contentById: newContentById,
				lastSyncTimestamp: new Date().toISOString()
			};
		});
	},

	// Load initial content for a project
	async loadContent(projectId: number, since?: string) {
		const currentState = get(contentStore);
		if (currentState.currentProjectId !== projectId) {
			contentActions.setProject(projectId);
		}

		contentActions.setLoading(true);

		try {
			// Load metadata first (channels, agents, etc.)
			await Promise.all([
				contentActions.loadChannels(projectId),
				contentActions.loadAgents(projectId),
				contentActions.loadRoleTypes(projectId),
				contentActions.loadSquads(projectId),
				contentActions.loadDMOversightAgents(projectId)
			]);

			// Then load content updates
			const params = new URLSearchParams({ projectId: projectId.toString() });
			if (since) {
				params.set('since', since);
			}

			const response = await fetch(`/api/content/updates?${params}`);
			
			if (!response.ok) {
				throw new Error(`Failed to fetch content: ${response.status}`);
			}

			const data = await response.json();
			contentActions.mergeContentUpdates(data.updates);
			
			return data;
		} catch (error) {
			console.error('Failed to load content:', error);
			contentActions.setError(error instanceof Error ? error.message : 'Failed to load content');
			throw error;
		} finally {
			contentActions.setLoading(false);
		}
	},

	// Mark content as read (updates local state optimistically)
	async markAsRead(contentId: number, assignmentId: number, agentId?: string) {
		// Get human director ID from store if not provided
		const actualAgentId = agentId || getHumanDirectorAgentId();
		if (!actualAgentId) {
			throw new Error('No human director agent found');
		}
		try {
			// Optimistically update local state
			contentStore.update(state => {
				const content = state.contentById[contentId];
				if (!content) return state;

				const updatedContent = { ...content };
				if (updatedContent.readingAssignments) {
					updatedContent.readingAssignments = updatedContent.readingAssignments.map(assignment => {
						if (assignment.id === assignmentId) {
							return {
								...assignment,
								reads: [
									...(assignment.reads || []),
									{ agentId: actualAgentId, readAt: new Date().toISOString() }
								]
							};
						}
						return assignment;
					});
				}

				return {
					...state,
					contentById: {
						...state.contentById,
						[contentId]: updatedContent
					}
				};
			});

			// Make API call
			const response = await fetch('/api/reading-assignments/mark-read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ assignmentId, agentId: actualAgentId })
			});

			if (!response.ok) {
				throw new Error(`Failed to mark as read: ${response.status}`);
			}

		} catch (error) {
			console.error('Failed to mark as read:', error);
			// TODO: Revert optimistic update on failure
			throw error;
		}
	},

	// Load metadata functions
	async loadChannels(projectId: number) {
		try {
			const response = await fetch(`/api/channels?projectId=${projectId}`);
			if (response.ok) {
				const channels = await response.json();
				contentActions.setChannels(channels);
			}
		} catch (error) {
			console.error('Failed to load channels:', error);
		}
	},

	async loadAgents(projectId: number) {
		try {
			const response = await fetch(`/api/agents?projectId=${projectId}`);
			if (response.ok) {
				const agents = await response.json();
				contentActions.setAgents(agents);
			}
		} catch (error) {
			console.error('Failed to load agents:', error);
		}
	},

	async loadRoleTypes(projectId: number) {
		try {
			const response = await fetch(`/api/projects/${projectId}/role-types`);
			if (response.ok) {
				const apiRoleTypes = await response.json();
				// Transform API response to expected format
				const roleTypes = apiRoleTypes.map((role: any) => ({
					id: role.roleType,
					name: role.roleType,
					count: role.count
				}));
				contentActions.setRoleTypes(roleTypes);
			}
		} catch (error) {
			console.error('Failed to load role types:', error);
		}
	},

	async loadSquads(projectId: number) {
		try {
			const response = await fetch(`/api/squads?projectId=${projectId}`);
			if (response.ok) {
				const squads = await response.json();
				contentActions.setSquads(squads);
			}
		} catch (error) {
			console.error('Failed to load squads:', error);
		}
	},

	// Optimistically mark reading assignment as read (for immediate UI updates)
	optimisticallyMarkAsRead(contentId: number, assignmentId: number, agentId: string) {
		if (!agentId) return;

		console.log('🚀 Optimistically marking as read:', { contentId, assignmentId, agentId });

		contentStore.update(state => {
			const content = state.contentById[contentId];
			if (!content) {
				console.warn('Content not found for optimistic update:', contentId);
				return state;
			}

			// Create completely new content object to ensure Svelte detects the change
			const updatedContent = {
				...content,
				readingAssignments: content.readingAssignments ? content.readingAssignments.map(assignment => {
					if (assignment.id === assignmentId) {
						return {
							...assignment,
							readBy: [
								...(assignment.readBy || []),
								{ agentId: agentId, readAt: new Date().toISOString() }
							]
						};
					}
					return assignment;
				}) : []
			};

			// Create completely new state - rebuild everything to ensure reactivity
			return {
				...state,
				contentById: {
					...state.contentById,
					[contentId]: updatedContent
				}
			};
		});
		
		// Force a second update to trigger reactivity
		setTimeout(() => {
			contentStore.update(state => ({ ...state }));
		}, 0);
	},

	// DM Oversight data loading
	async loadDMOversightAgents(projectId: number) {
		try {
			const response = await fetch(`/api/dm-oversight/agents?projectId=${projectId}`);
			if (response.ok) {
				const agents = await response.json();
				contentActions.setDMOversightAgents(agents);
			}
		} catch (error) {
			console.error('Failed to load DM oversight agents:', error);
		}
	},

	async loadDMOversightConversations(projectId: number, agentId: string) {
		try {
			const response = await fetch(`/api/dm-oversight/${agentId}/conversations?projectId=${projectId}`);
			if (response.ok) {
				const data = await response.json();
				contentActions.setDMOversightConversations(agentId, data);
			}
		} catch (error) {
			console.error('Failed to load DM oversight conversations:', error);
		}
	},

	// DM Oversight setters
	setDMOversightAgents(agents: any[]) {
		contentStore.update(state => ({
			...state,
			dmOversightAgents: agents
		}));
	},

	setDMOversightConversations(agentId: string, conversationData: any) {
		contentStore.update(state => ({
			...state,
			dmOversightConversations: {
				...state.dmOversightConversations,
				[agentId]: conversationData
			}
		}));
	},

	// Clear all data (useful for logout/project switch)
	clear() {
		contentStore.set(initialState);
	}
};

// ==================== Utilities ====================

// Get current state snapshot (useful for actions)
export const getContentState = () => get(contentStore);

// Check if content is loaded for current project
export const isContentLoaded = derived(contentStore, $store => 
	$store.currentProjectId !== null && Object.keys($store.contentById).length > 0
);

// Reading assignments derived stores
export const allReadingAssignments = derived(contentStore, $store => {
	const assignments: any[] = [];
	Object.values($store.contentById).forEach(content => {
		if (content.readingAssignments) {
			content.readingAssignments.forEach(assignment => {
				assignments.push({
					...assignment,
					contentId: content.id,
					content: content
				});
			});
		}
	});
	return assignments;
});

// ==================== Unread Count System ====================
// Centralized unread badge logic

// All unread content for human director (simple rule: has unread assignment)
export const humanDirectorUnreadContent = derived(allContent, $content => 
	$content.filter(content => isContentUnreadByHumanDirector(content))
);

// Channel messages that are unread
export const unreadChannelMessages = derived(channelMessages, $messages => 
	$messages.filter(msg => isContentUnreadByHumanDirector(msg))
);

// Direct messages that are unread  
export const unreadDirectMessages = derived(directMessages, $messages =>
	$messages.filter(msg => isContentUnreadByHumanDirector(msg))
);

// Documents that are unread
export const unreadDocuments = derived(documents, $docs =>
	$docs.filter(doc => isContentUnreadByHumanDirector(doc))
);

// Tickets that are unread
export const unreadTickets = derived(tickets, $tickets =>
	$tickets.filter(ticket => isContentUnreadByHumanDirector(ticket))
);

// Phases that are unread
export const unreadPhases = derived(phases, $phases =>
	$phases.filter(phase => isContentUnreadByHumanDirector(phase))
);

// Centralized badge counts
export const channelUnreadCount = derived(unreadChannelMessages, $messages => $messages.length);
export const dmUnreadCount = derived(unreadDirectMessages, $messages => {
	console.log('📧 dmUnreadCount recalculated:', $messages.length, 'unread DMs');
	return $messages.length;
});
export const documentsUnreadCount = derived(unreadDocuments, $docs => $docs.length);
export const ticketsUnreadCount = derived(unreadTickets, $tickets => $tickets.length);
export const phasesUnreadCount = derived(unreadPhases, $phases => $phases.length);

// Total unread count (sum of all types)
export const totalUnreadCount = derived(
	[channelUnreadCount, dmUnreadCount, documentsUnreadCount, ticketsUnreadCount, phasesUnreadCount],
	([$channels, $dms, $docs, $tickets, $phases]) => {
		const total = $channels + $dms + $docs + $tickets + $phases;
		console.log('📊 totalUnreadCount recalculated:', { $channels, $dms, $docs, $tickets, $phases, total });
		return total;
	}
);

// Legacy assignments (keeping for compatibility but using simpler logic)
export const humanDirectorUnreadAssignments = derived(humanDirectorUnreadContent, $content => {
	const assignments: any[] = [];
	$content.forEach(content => {
		if (content.readingAssignments) {
			content.readingAssignments.forEach(assignment => {
				if (isAssignmentForHumanDirector(assignment)) {
					assignments.push({
						...assignment,
						contentId: content.id,
						content: content
					});
				}
			});
		}
	});
	return assignments;
});