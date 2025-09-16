/**
 * Message Operations Utilities
 * Simplified logic for read status and message operations
 */

import { 
	isContentUnreadByHumanDirector, 
	getHumanDirectorAssignments, 
	isReadByHumanDirector,
	getHumanDirectorAgentId,
	isAssignmentForHumanDirector
} from './humanDirectorClientHelpers';
import { contentActions } from '../stores/contentStore';

// Helper function to check if a message is fully read by all assigned agents
export function isMessageFullyRead(message: any): boolean {
	if (!message.readingAssignments) return false;
	
	// Simple logic: all assignments have reads
	return message.readingAssignments.every((assignment: any) => {
		return assignment.reads && assignment.reads.length > 0;
	});
}

// Helper function to check if a message is partially read  
export function isMessagePartiallyRead(message: any): boolean {
	if (!message.readingAssignments) return false;
	
	const assignments = message.readingAssignments;
	
	// Simple logic: some assignments have reads, some don't
	const hasReadAssignments = assignments.some((assignment: any) => 
		assignment.reads && assignment.reads.length > 0
	);
	const hasUnreadAssignments = assignments.some((assignment: any) => 
		!assignment.reads || assignment.reads.length === 0
	);
	
	return hasReadAssignments && hasUnreadAssignments;
}

// Mark message as read without refreshing UI - simplified
export async function markMessageAsReadWithoutRefresh(message: any): Promise<void> {
	if (!message.readingAssignments) return;
	
	try {
		const humanDirectorId = getHumanDirectorAgentId();
		if (!humanDirectorId) {
			console.warn('No human director found in store');
			return;
		}
		
		// Find assignments for human director
		const humanDirectorAssignments = getHumanDirectorAssignments(message);
		
		// Mark each unread assignment as read
		for (const assignment of humanDirectorAssignments) {
			const hasRead = assignment.reads?.some((read: any) => 
				isReadByHumanDirector(read)
			) || false;
			
			if (!hasRead) {
				await fetch('/api/reading-assignments/mark-read', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						assignmentId: assignment.id,
						agentId: humanDirectorId
					})
				});
			}
		}
	} catch (error) {
		console.error('Failed to mark message as read:', error);
	}
}

// Mark message as read - simplified, relies on store reactivity
export async function markMessageAsRead(message: any): Promise<void> {
	if (!message.readingAssignments) return;
	
	try {
		const humanDirectorId = getHumanDirectorAgentId();
		if (!humanDirectorId) {
			console.warn('No human director found in store');
			return;
		}
		
		// Find assignments for human director
		const humanDirectorAssignments = getHumanDirectorAssignments(message);
		
		// Mark each unread assignment as read
		for (const assignment of humanDirectorAssignments) {
			const hasRead = assignment.reads?.some((read: any) => 
				isReadByHumanDirector(read)
			) || false;
			
			if (!hasRead) {
				// Optimistically update the store immediately
				contentActions.optimisticallyMarkAsRead(message.id, assignment.id, humanDirectorId);
				
				// Make API call (fire and forget)
				fetch('/api/reading-assignments/mark-read', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						assignmentId: assignment.id,
						agentId: humanDirectorId
					})
				}).catch(error => {
					console.error('Failed to mark message as read on server:', error);
				});
			}
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

// Helper function to get the human director agent for a project
export async function getHumanDirectorForProject(projectId: number) {
	const response = await fetch(`/api/agents?projectId=${projectId}`);
	if (!response.ok) {
		throw new Error('Failed to fetch agents');
	}
	
	const agents = await response.json();
	const humanDirector = agents.find((agent: any) => agent.isHumanDirector === true);
	
	if (!humanDirector) {
		throw new Error('No human director found for this project');
	}
	
	return humanDirector;
}