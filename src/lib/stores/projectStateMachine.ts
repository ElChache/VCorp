/**
 * Unified Project State Machine
 * 
 * Eliminates race conditions through atomic state transitions
 * and event-driven coordination. Replaces fragmented state 
 * management with a single source of truth.
 */

import { writable, derived, get } from 'svelte/store';
import type { ContentUpdate, GroupedUpdates } from '$lib/services/ContentPollingService';

// ==================== State Machine Types ====================

type LoadingState = 'idle' | 'switching' | 'loading' | 'ready' | 'error';

interface ProjectContext {
	id: number;
	name?: string;
	path?: string;
}

interface NormalizedContent {
	byId: Record<number, ContentUpdate>;
	allIds: number[];
	// Pre-computed indexes for performance
	channelMessages: number[];
	directMessages: number[];
	documents: number[];
	tickets: number[];
	phases: number[];
}

interface ProjectMetadata {
	channels: any[];
	agents: any[];
	roleTypes: any[];
	squads: any[];
	dmOversightAgents: any[];
}

interface PollingState {
	isActive: boolean;
	lastTimestamp: string | null;
	intervalId: number | null;
	error: string | null;
}

interface ProjectMachineState {
	// Core state
	currentProject: ProjectContext | null;
	loadingState: LoadingState;
	error: string | null;
	
	// Content data (normalized and indexed)
	content: NormalizedContent;
	metadata: ProjectMetadata;
	
	// Polling state
	polling: PollingState;
	
	// Event tracking
	lastStateChange: string;
	transitionHistory: string[];
}

// ==================== Initial State ====================

const initialContent: NormalizedContent = {
	byId: {},
	allIds: [],
	channelMessages: [],
	directMessages: [],
	documents: [],
	tickets: [],
	phases: []
};

const initialMetadata: ProjectMetadata = {
	channels: [],
	agents: [],
	roleTypes: [],
	squads: [],
	dmOversightAgents: []
};

const initialPolling: PollingState = {
	isActive: false,
	lastTimestamp: null,
	intervalId: null,
	error: null
};

const initialState: ProjectMachineState = {
	currentProject: null,
	loadingState: 'idle',
	error: null,
	content: initialContent,
	metadata: initialMetadata,
	polling: initialPolling,
	lastStateChange: new Date().toISOString(),
	transitionHistory: ['init']
};

// ==================== Core State Machine ====================

export const projectMachine = writable<ProjectMachineState>(initialState);

// ==================== Derived Stores (High Performance) ====================

// Content selectors use pre-computed indexes
export const allContent = derived(projectMachine, $state => 
	$state.content.allIds.map(id => $state.content.byId[id])
);

export const channelMessages = derived(projectMachine, $state => 
	$state.content.channelMessages.map(id => $state.content.byId[id])
);

export const directMessages = derived(projectMachine, $state => 
	$state.content.directMessages.map(id => $state.content.byId[id])
);

export const documents = derived(projectMachine, $state => 
	$state.content.documents.map(id => $state.content.byId[id])
);

export const tickets = derived(projectMachine, $state => 
	$state.content.tickets.map(id => $state.content.byId[id])
);

export const phases = derived(projectMachine, $state => 
	$state.content.phases.map(id => $state.content.byId[id])
);

// Metadata selectors
export const channels = derived(projectMachine, $state => $state.metadata.channels);
export const agents = derived(projectMachine, $state => $state.metadata.agents);
export const roleTypes = derived(projectMachine, $state => $state.metadata.roleTypes);
export const squads = derived(projectMachine, $state => $state.metadata.squads);

// Loading and error states
export const isLoading = derived(projectMachine, $state => 
	$state.loadingState === 'loading' || $state.loadingState === 'switching'
);
export const currentProject = derived(projectMachine, $state => $state.currentProject);
export const machineError = derived(projectMachine, $state => $state.error);

// ==================== State Machine Actions ====================

class ProjectStateMachine {
	private readonly POLL_INTERVAL = 5000; // 5 seconds

	/**
	 * Atomically switch to a new project
	 * Eliminates race conditions through synchronized state transitions
	 */
	async switchProject(projectId: number, projectName?: string): Promise<void> {
		console.log(`🔄 Project State Machine: Switching to project ${projectId}`);
		
		try {
			// Phase 1: Set switching state (prevents UI updates)
			this.setState({
				loadingState: 'switching',
				error: null,
				lastStateChange: new Date().toISOString()
			});

			// Phase 2: Stop existing polling synchronously
			await this.stopPollingSync();

			// Phase 3: Load new project data in parallel
			const [contentData, metadataData] = await Promise.all([
				this.loadProjectContent(projectId),
				this.loadProjectMetadata(projectId)
			]);

			// Phase 4: Normalize and index content for performance
			const normalizedContent = this.normalizeContent(contentData);

			// Phase 5: Atomically commit all changes
			this.setState({
				currentProject: { id: projectId, name: projectName },
				content: normalizedContent,
				metadata: metadataData,
				loadingState: 'ready',
				error: null,
				lastStateChange: new Date().toISOString()
			});

			// Phase 6: Start polling for new project
			await this.startPollingSync(projectId);

			// Emit project switched event
			this.emitEvent('projectSwitched', { projectId, projectName });

		} catch (error) {
			console.error('❌ Project switching failed:', error);
			this.setState({
				loadingState: 'error',
				error: error instanceof Error ? error.message : 'Failed to switch project',
				lastStateChange: new Date().toISOString()
			});
		}
	}

	/**
	 * Merge real-time content updates
	 * Uses incremental updates to avoid clearing existing data
	 */
	mergeContentUpdates(updates: GroupedUpdates): void {
		const currentState = get(projectMachine);
		
		// Only proceed if we have a current project
		if (!currentState.currentProject || currentState.loadingState !== 'ready') {
			return;
		}

		// Merge updates into normalized state
		const newContent = { ...currentState.content };
		const newById = { ...newContent.byId };
		
		updates.all.forEach(content => {
			newById[content.id] = content;
			
			// Add to allIds if new
			if (!newContent.allIds.includes(content.id)) {
				newContent.allIds.push(content.id);
			}
		});

		// Rebuild indexes efficiently
		const updatedContent = this.rebuildIndexes({
			...newContent,
			byId: newById
		});

		// Atomically update state
		this.setState({
			content: updatedContent,
			lastStateChange: new Date().toISOString()
		});

		// Emit content updated event
		this.emitEvent('contentUpdated', { 
			count: updates.all.length,
			types: Object.keys(updates).filter(k => k !== 'all' && updates[k as keyof GroupedUpdates].length > 0)
		});
	}

	/**
	 * Start polling with synchronized state
	 */
	private async startPollingSync(projectId: number): Promise<void> {
		// Set up polling state
		const intervalId = window.setInterval(async () => {
			await this.fetchAndMergeUpdates(projectId);
		}, this.POLL_INTERVAL);

		// Update polling state
		this.setState({
			polling: {
				isActive: true,
				lastTimestamp: new Date().toISOString(),
				intervalId,
				error: null
			}
		});

		// Initial fetch
		await this.fetchAndMergeUpdates(projectId);
	}

	/**
	 * Stop polling synchronously
	 */
	private async stopPollingSync(): Promise<void> {
		const currentState = get(projectMachine);
		
		if (currentState.polling.intervalId) {
			clearInterval(currentState.polling.intervalId);
		}

		this.setState({
			polling: {
				isActive: false,
				lastTimestamp: null,
				intervalId: null,
				error: null
			}
		});
	}

	/**
	 * Fetch and merge updates from polling endpoint
	 */
	private async fetchAndMergeUpdates(projectId: number): Promise<void> {
		try {
			const currentState = get(projectMachine);
			const params = new URLSearchParams({ projectId: projectId.toString() });
			
			if (currentState.polling.lastTimestamp) {
				params.set('since', currentState.polling.lastTimestamp);
			}

			const response = await fetch(`/api/content/updates?${params}`);
			
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Update polling timestamp
			this.setState({
				polling: {
					...currentState.polling,
					lastTimestamp: data.timestamp,
					error: null
				}
			});

			// Merge updates if any
			if (data.count > 0) {
				this.mergeContentUpdates(data.updates);
			}

		} catch (error) {
			console.error('❌ Polling fetch failed:', error);
			this.setState({
				polling: {
					...get(projectMachine).polling,
					error: error instanceof Error ? error.message : 'Polling failed'
				}
			});
		}
	}

	/**
	 * Load initial project content
	 */
	private async loadProjectContent(projectId: number): Promise<GroupedUpdates> {
		const params = new URLSearchParams({ projectId: projectId.toString() });
		const response = await fetch(`/api/content/updates?${params}`);
		
		if (!response.ok) {
			throw new Error(`Failed to load content: ${response.status}`);
		}

		const data = await response.json();
		return data.updates;
	}

	/**
	 * Load project metadata in parallel
	 */
	private async loadProjectMetadata(projectId: number): Promise<ProjectMetadata> {
		const [channels, agents, roleTypes, squads, dmOversightAgents] = await Promise.all([
			this.fetchMetadata(`/api/channels?projectId=${projectId}`),
			this.fetchMetadata(`/api/agents?projectId=${projectId}`),
			this.fetchMetadata(`/api/projects/${projectId}/role-types`),
			this.fetchMetadata(`/api/squads?projectId=${projectId}`),
			this.fetchMetadata(`/api/dm-oversight/agents?projectId=${projectId}`)
		]);

		return {
			channels: channels || [],
			agents: agents || [],
			roleTypes: (roleTypes || []).map((role: any) => ({
				id: role.roleType,
				name: role.roleType,
				count: role.count
			})),
			squads: squads || [],
			dmOversightAgents: dmOversightAgents || []
		};
	}

	/**
	 * Helper to fetch metadata with error handling
	 */
	private async fetchMetadata(url: string): Promise<any[]> {
		try {
			const response = await fetch(url);
			return response.ok ? await response.json() : [];
		} catch (error) {
			console.warn(`Failed to fetch metadata from ${url}:`, error);
			return [];
		}
	}

	/**
	 * Normalize content into performant indexed structure
	 */
	private normalizeContent(updates: GroupedUpdates): NormalizedContent {
		const byId: Record<number, ContentUpdate> = {};
		const allIds: number[] = [];
		const channelMessages: number[] = [];
		const directMessages: number[] = [];
		const documents: number[] = [];
		const tickets: number[] = [];
		const phases: number[] = [];

		updates.all.forEach(content => {
			byId[content.id] = content;
			allIds.push(content.id);

			// Build type indexes for performance
			if (content.type === 'message' && content.channelId !== null) {
				channelMessages.push(content.id);
			} else if (content.type === 'message' && content.channelId === null) {
				directMessages.push(content.id);
			} else if (content.type === 'document') {
				documents.push(content.id);
			} else if (content.type === 'ticket') {
				tickets.push(content.id);
			} else if (content.type === 'phase') {
				phases.push(content.id);
			}
		});

		return {
			byId,
			allIds,
			channelMessages,
			directMessages,
			documents,
			tickets,
			phases
		};
	}

	/**
	 * Rebuild indexes after incremental updates
	 */
	private rebuildIndexes(content: Omit<NormalizedContent, 'channelMessages' | 'directMessages' | 'documents' | 'tickets' | 'phases'>): NormalizedContent {
		const channelMessages: number[] = [];
		const directMessages: number[] = [];
		const documents: number[] = [];
		const tickets: number[] = [];
		const phases: number[] = [];

		content.allIds.forEach(id => {
			const item = content.byId[id];
			if (!item) return;

			if (item.type === 'message' && item.channelId !== null) {
				channelMessages.push(id);
			} else if (item.type === 'message' && item.channelId === null) {
				directMessages.push(id);
			} else if (item.type === 'document') {
				documents.push(id);
			} else if (item.type === 'ticket') {
				tickets.push(id);
			} else if (item.type === 'phase') {
				phases.push(id);
			}
		});

		return {
			...content,
			channelMessages,
			directMessages,
			documents,
			tickets,
			phases
		};
	}

	/**
	 * Update state with automatic history tracking
	 */
	private setState(partialState: Partial<ProjectMachineState>): void {
		projectMachine.update(state => ({
			...state,
			...partialState,
			transitionHistory: [
				...state.transitionHistory.slice(-10), // Keep last 10
				`${new Date().toISOString()}: ${JSON.stringify(Object.keys(partialState))}`
			]
		}));
	}

	/**
	 * Emit custom events for component coordination
	 */
	private emitEvent(eventName: string, detail: any): void {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent(eventName, { detail }));
		}
	}

	/**
	 * Get current state snapshot
	 */
	getState(): ProjectMachineState {
		return get(projectMachine);
	}

	/**
	 * Check if machine is ready for content operations
	 */
	isReady(): boolean {
		const state = this.getState();
		return state.loadingState === 'ready' && state.currentProject !== null;
	}

	/**
	 * Cleanup all resources
	 */
	async destroy(): Promise<void> {
		await this.stopPollingSync();
		projectMachine.set(initialState);
	}
}

// ==================== Export Singleton ====================

export const projectStateMachine = new ProjectStateMachine();

// ==================== Computed Badge Counts ====================
// Centralized badge calculation eliminates inconsistencies

import { 
	isContentUnreadByHumanDirector,
	isAssignmentForHumanDirector
} from '$lib/utils/humanDirectorClientHelpers';

// All unread content for human director
export const humanDirectorUnreadContent = derived(allContent, $content => 
	$content.filter(content => isContentUnreadByHumanDirector(content))
);

// Unread counts by type
export const channelUnreadCount = derived(channelMessages, $messages => 
	$messages.filter(msg => isContentUnreadByHumanDirector(msg)).length
);

export const dmUnreadCount = derived(directMessages, $messages =>
	$messages.filter(msg => isContentUnreadByHumanDirector(msg)).length
);

export const documentsUnreadCount = derived(documents, $docs =>
	$docs.filter(doc => isContentUnreadByHumanDirector(doc)).length
);

export const ticketsUnreadCount = derived(tickets, $tickets =>
	$tickets.filter(ticket => isContentUnreadByHumanDirector(ticket)).length
);

export const phasesUnreadCount = derived(phases, $phases =>
	$phases.filter(phase => isContentUnreadByHumanDirector(phase)).length
);

// Total unread count (sum of all types)
export const totalUnreadCount = derived(
	[channelUnreadCount, dmUnreadCount, documentsUnreadCount, ticketsUnreadCount, phasesUnreadCount],
	([$channels, $dms, $docs, $tickets, $phases]) => $channels + $dms + $docs + $tickets + $phases
);

// Debug store for development
export const machineDebugInfo = derived(projectMachine, $state => ({
	currentProject: $state.currentProject?.id,
	loadingState: $state.loadingState,
	contentCount: $state.content.allIds.length,
	pollingActive: $state.polling.isActive,
	lastTransition: $state.transitionHistory.slice(-1)[0],
	hasError: !!$state.error
}));