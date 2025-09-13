/**
 * Message Operations Utilities
 * Extracted from CommunicationsSection.svelte
 * Handles message read status, marking as read, and related operations
 */

// Helper function to check if a message is unread by human director
export function isUnreadByHumanDirector(message: any): boolean {
	if (!message.readingAssignments) return false;
	
	return message.readingAssignments.some((assignment: any) => {
		// Check if this assignment is for human-director (including old 'director' assignments)
		const isForHumanDirector = (assignment.assignedToType === 'agent' && (assignment.assignedTo === 'human-director' || assignment.assignedTo === 'director')) ||
		                          (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director');
		
		if (!isForHumanDirector) return false;
		
		// Check if human-director has read this assignment (including old 'director' reads)
		const hasRead = assignment.readBy ? assignment.readBy.some((read: any) => read.agentId === 'human-director' || read.agentId === 'director') : 
		                assignment.reads ? assignment.reads.some((read: any) => read.agentId === 'human-director' || read.agentId === 'director') : false;
		return !hasRead;
	});
}

// Helper function to check if a message is fully read by all assigned agents
export function isMessageFullyRead(message: any): boolean {
	if (!message.readingAssignments) return false;
	
	const assignments = message.readingAssignments;
	
	// Filter to only assignments that have targets/should be read
	const assignmentsToCheck = assignments.filter((assignment: any) => {
		// Old format: use totalTargets
		if (assignment.totalTargets !== undefined) {
			return assignment.totalTargets > 0;
		}
		// New format: assume all assignments should be checked (simplified)
		return true;
	});
	
	if (assignmentsToCheck.length === 0) return false;
	
	return assignmentsToCheck.every((assignment: any) => {
		// Old format: use isFullyRead
		if (assignment.isFullyRead !== undefined) {
			return assignment.isFullyRead;
		}
		// New format: assignment is fully read if it has reads
		return assignment.reads && assignment.reads.length > 0;
	});
}

// Helper function to check if a message is partially read
export function isMessagePartiallyRead(message: any): boolean {
	if (!message.readingAssignments) return false;
	
	const assignments = message.readingAssignments;
	
	// Calculate read status for each assignment based on available data
	const hasFullyReadAssignments = assignments.some((assignment: any) => {
		// Check if assignment has the pre-calculated isFullyRead field (old format)
		if (assignment.isFullyRead !== undefined) {
			return assignment.isFullyRead;
		}
		// For new format, assignment is "fully read" if it has any reads (simplified logic)
		return assignment.reads && assignment.reads.length > 0;
	});
	
	const hasUnreadAssignments = assignments.some((assignment: any) => {
		// Check if assignment has the pre-calculated isFullyRead field (old format)
		if (assignment.isFullyRead !== undefined) {
			return !assignment.isFullyRead;
		}
		// For new format, assignment is "unread" if it has no reads
		return !assignment.reads || assignment.reads.length === 0;
	});
	
	// Partially read = some assignments are fully read AND some are not fully read
	return hasFullyReadAssignments && hasUnreadAssignments;
}

// Check if a message has unread assignment for human director
export function hasUnreadAssignmentForHumanDirector(message: any): boolean {
	if (!message.readingAssignments) return false;
	
	return message.readingAssignments.some((assignment: any) => {
		// Check if this assignment is for human-director (including old 'director' assignments)
		const isForHumanDirector = (assignment.assignedToType === 'agent' && (assignment.assignedTo === 'human-director' || assignment.assignedTo === 'director')) ||
		                          (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director');
		
		if (!isForHumanDirector) return false;
		
		// Check if human-director has read this assignment (including old 'director' reads)
		const hasRead = assignment.readBy ? assignment.readBy.some((read: any) => read.agentId === 'human-director' || read.agentId === 'director') : 
		                assignment.reads ? assignment.reads.some((read: any) => read.agentId === 'human-director' || read.agentId === 'director') : false;
		return !hasRead;
	});
}

// Mark message as read without refreshing UI
export async function markMessageAsReadWithoutRefresh(message: any): Promise<void> {
	if (!message.readingAssignments) return;
	
	try {
		// Find the assignment(s) for human-director (including old 'director' assignments)
		const humanDirectorAssignments = message.readingAssignments.filter((assignment: any) => {
			return (assignment.assignedToType === 'agent' && (assignment.assignedTo === 'human-director' || assignment.assignedTo === 'director')) ||
			       (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director');
		});
		
		// Mark each assignment as read
		for (const assignment of humanDirectorAssignments) {
			// Check if already read to avoid duplicate marking (handle both data formats, including old 'director' reads)
			const hasRead = assignment.readBy ? assignment.readBy.some((read: any) => read.agentId === 'human-director' || read.agentId === 'director') : 
			                assignment.reads ? assignment.reads.some((read: any) => read.agentId === 'human-director' || read.agentId === 'director') : false;
			if (!hasRead) {
				await fetch('/api/reading-assignments/mark-read', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						assignmentId: assignment.id,
						agentId: 'human-director'
					})
				});
			}
		}
	} catch (error) {
		console.error('Failed to mark message as read:', error);
	}
}

// Mark message as read and update counts/UI
export async function markMessageAsRead(
	message: any,
	callbacks: {
		updateCounts?: (channelDecrement: number, dmDecrement: number) => void;
		refreshChannel?: () => Promise<void>;
		refreshDM?: () => Promise<void>;
		triggerPolling?: () => void;
	} = {}
): Promise<void> {
	if (!message.readingAssignments) return;
	
	try {
		// Find the assignment(s) for human-director (including old 'director' assignments)
		const humanDirectorAssignments = message.readingAssignments.filter((assignment: any) => {
			return (assignment.assignedToType === 'agent' && (assignment.assignedTo === 'human-director' || assignment.assignedTo === 'director')) ||
			       (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director');
		});
		
		// Mark each assignment as read
		let markedAsRead = false;
		for (const assignment of humanDirectorAssignments) {
			// Check if already read to avoid duplicate marking (handle both data formats, including old 'director' reads)
			const hasRead = assignment.readBy ? assignment.readBy.some((read: any) => read.agentId === 'human-director' || read.agentId === 'director') : 
			                assignment.reads ? assignment.reads.some((read: any) => read.agentId === 'human-director' || read.agentId === 'director') : false;
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
			const channelDecrement = message.channelId ? 1 : 0;
			const dmDecrement = !message.channelId ? 1 : 0;
			
			if (callbacks.updateCounts) {
				callbacks.updateCounts(channelDecrement, dmDecrement);
			}
			
			console.log(`📖 Marked message as read. Decrements - Channel: ${channelDecrement}, DM: ${dmDecrement}`);
		}
		
		// Refresh the content to reflect read status changes
		if (callbacks.refreshChannel) {
			await callbacks.refreshChannel();
		}
		
		if (callbacks.refreshDM) {
			await callbacks.refreshDM();
		}
		
		// Trigger a content polling refresh to update unread badges immediately
		if (callbacks.triggerPolling) {
			callbacks.triggerPolling();
		}
	} catch (error) {
		console.error('Failed to mark message as read:', error);
	}
}

// Format message timestamp
export function formatMessageTime(timestamp: string): string {
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