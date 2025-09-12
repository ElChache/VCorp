import { writable } from 'svelte/store';

export interface ContentUpdate {
	id: number;
	projectId: number;
	channelId: number | null;
	parentContentId: number | null;
	type: string;
	title: string | null;
	body: string;
	authorAgentId: string | null;
	squadId: string | null;
	status: string | null;
	priority: string | null;
	assignedToRoleType: string | null;
	claimedByAgent: string | null;
	phaseStatus: string | null;
	requiredInputs: string | null;
	expectedOutputs: string | null;
	createdAt: string;
	updatedAt: string;
	readingAssignments: any[];
}

export interface GroupedUpdates {
	channelMessages: ContentUpdate[];
	directMessages: ContentUpdate[];
	tickets: ContentUpdate[];
	documents: ContentUpdate[];
	replies: ContentUpdate[];
	phases: ContentUpdate[];
	all: ContentUpdate[];
}

export interface ContentPollingState {
	isPolling: boolean;
	lastUpdate: string | null;
	updates: GroupedUpdates;
	error: string | null;
}

// Global stores for real-time content updates
export const contentPollingStore = writable<ContentPollingState>({
	isPolling: false,
	lastUpdate: null,
	updates: {
		channelMessages: [],
		directMessages: [],
		tickets: [],
		documents: [],
		replies: [],
		phases: [],
		all: []
	},
	error: null
});

class ContentPollingService {
	private intervalId: number | null = null;
	private projectId: number | null = null;
	private lastTimestamp: string | null = null;
	private readonly POLL_INTERVAL = 5000; // 5 seconds

	/**
	 * Start polling for content updates
	 */
	async startPolling(projectId: number) {
		if (this.intervalId) {
			this.stopPolling();
		}

		this.projectId = projectId;
		this.lastTimestamp = new Date().toISOString(); // Start from now

		console.log(`🔄 Starting content polling for project ${projectId}`);

		// Update store state
		contentPollingStore.update(state => ({
			...state,
			isPolling: true,
			error: null
		}));

		// Initial fetch
		await this.fetchUpdates();

		// Set up interval
		this.intervalId = window.setInterval(async () => {
			await this.fetchUpdates();
		}, this.POLL_INTERVAL);
	}

	/**
	 * Stop polling for content updates
	 */
	stopPolling() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		console.log('⏹️ Stopped content polling');

		contentPollingStore.update(state => ({
			...state,
			isPolling: false
		}));
	}

	/**
	 * Fetch updates from the server
	 */
	private async fetchUpdates() {
		if (!this.projectId) return;

		try {
			const params = new URLSearchParams({
				projectId: this.projectId.toString()
			});

			if (this.lastTimestamp) {
				params.set('since', this.lastTimestamp);
			}

			const response = await fetch(`/api/content/updates?${params}`);
			
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Update the timestamp for next poll
			this.lastTimestamp = data.timestamp;

			// Only process if there are new updates
			if (data.count > 0) {
				console.log(`📬 Received ${data.count} content updates:`, data.updates);

				contentPollingStore.update(state => ({
					...state,
					lastUpdate: data.timestamp,
					updates: data.updates,
					error: null
				}));

				// Emit custom event for other components to listen to
				window.dispatchEvent(new CustomEvent('contentUpdates', {
					detail: {
						updates: data.updates,
						count: data.count,
						timestamp: data.timestamp
					}
				}));
			}

		} catch (error) {
			console.error('❌ Failed to fetch content updates:', error);
			
			contentPollingStore.update(state => ({
				...state,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			}));
		}
	}

	/**
	 * Get the current polling state
	 */
	getState() {
		let currentState: ContentPollingState;
		contentPollingStore.subscribe(state => {
			currentState = state;
		})();
		return currentState!;
	}

	/**
	 * Manually trigger an update fetch (useful for testing or immediate updates)
	 */
	async triggerUpdate() {
		if (!this.projectId) return;
		await this.fetchUpdates();
	}

	/**
	 * Check if currently polling
	 */
	isPolling() {
		return this.intervalId !== null;
	}
}

// Export singleton instance
export const contentPollingService = new ContentPollingService();

// Helper function to format content updates for display
export function formatContentForDisplay(content: ContentUpdate): string {
	const authorDisplay = content.authorAgentId === 'human-director' 
		? 'Human Director' 
		: content.authorAgentId || 'System';
		
	const timeAgo = formatTimeAgo(content.updatedAt);
	
	return `${authorDisplay} • ${timeAgo}`;
}

// Helper function to format time ago
export function formatTimeAgo(timestamp: string): string {
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

// Helper function to get unread count for human director
export function getUnreadCountForHumanDirector(content: ContentUpdate): number {
	if (!content.readingAssignments) return 0;
	
	let unreadCount = 0;
	content.readingAssignments.forEach(assignment => {
		// Check if this assignment is for human-director and unread
		if ((assignment.assignedToType === 'agent' && assignment.assignedTo === 'human-director') ||
		    (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director')) {
			// Check if human-director has read this assignment
			const hasRead = assignment.readBy.some((read: any) => read.agentId === 'human-director');
			if (!hasRead) {
				unreadCount++;
			}
		}
	});
	
	return unreadCount;
}