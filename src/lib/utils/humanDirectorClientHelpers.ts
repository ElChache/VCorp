/**
 * Human Director Client-Side Helper Functions
 * Frontend utilities for finding and working with human director agents using the store
 */

import { get } from 'svelte/store';
import { agents } from '$lib/stores/contentStore';

/**
 * Check if an agent ID represents a human director by looking up in the agents store
 */
export function isHumanDirectorAgent(agentId: string | null): boolean {
	if (!agentId) return false;
	
	const allAgents = get(agents);
	const agent = allAgents.find(a => a.id === agentId);
	
	return agent?.isHumanDirector === true;
}

/**
 * Get the human director agent for the current project from the store
 */
export function getHumanDirectorAgent() {
	const allAgents = get(agents);
	return allAgents.find(agent => agent.isHumanDirector === true);
}

/**
 * Get the human director agent ID for the current project from the store
 */
export function getHumanDirectorAgentId(): string | null {
	const humanDirector = getHumanDirectorAgent();
	return humanDirector?.id || null;
}

/**
 * Check if an agent ID represents a legacy human director identifier
 */
export function isLegacyHumanDirectorId(agentId: string): boolean {
	return agentId === 'human-director' || agentId === 'director';
}

/**
 * Check if an assignment is for the human director (including legacy IDs)
 * This checks both legacy IDs and actual agent IDs via the store
 */
export function isAssignmentForHumanDirector(assignment: any): boolean {
	if (!assignment) return false;
	
	// Check for role-based assignment
	if (assignment.assignedToType === 'role' && assignment.assignedTo === 'Human Director') {
		return true;
	}
	
	// Check for agent-based assignment
	if (assignment.assignedToType === 'agent') {
		// Legacy IDs
		if (isLegacyHumanDirectorId(assignment.assignedTo)) {
			return true;
		}
		
		// Check if the assigned agent is the human director via store lookup
		return isHumanDirectorAgent(assignment.assignedTo);
	}
	
	return false;
}

/**
 * Check if a read record is from the human director (including legacy IDs)
 */
export function isReadByHumanDirector(read: any): boolean {
	if (!read) return false;
	
	// Legacy IDs
	if (isLegacyHumanDirectorId(read.agentId)) {
		return true;
	}
	
	// Check via store lookup
	return isHumanDirectorAgent(read.agentId);
}

/**
 * Check if content has been read by the human director
 */
export function isContentReadByHumanDirector(content: any): boolean {
	if (!content?.readingAssignments) return false;
	
	return content.readingAssignments.some((assignment: any) => {
		if (!isAssignmentForHumanDirector(assignment)) return false;
		
		// Check both readBy and reads arrays (different API responses may use either)
		const reads = assignment.readBy || assignment.reads || [];
		return reads.some((read: any) => isReadByHumanDirector(read));
	});
}

/**
 * Check if content is unread by the human director
 */
export function isContentUnreadByHumanDirector(content: any): boolean {
	if (!content?.readingAssignments) return false;
	
	// Check if there's any assignment for human director that hasn't been read
	return content.readingAssignments.some((assignment: any) => {
		if (!isAssignmentForHumanDirector(assignment)) return false;
		
		// Check both readBy and reads arrays
		const reads = assignment.readBy || assignment.reads || [];
		return !reads.some((read: any) => isReadByHumanDirector(read));
	});
}

/**
 * Check if a message author is the human director
 */
export function isMessageFromHumanDirector(message: any): boolean {
	if (!message?.authorAgentId) return false;
	
	// Legacy check
	if (isLegacyHumanDirectorId(message.authorAgentId)) {
		return true;
	}
	
	// Store lookup
	return isHumanDirectorAgent(message.authorAgentId);
}

/**
 * Get human director assignments from content
 */
export function getHumanDirectorAssignments(content: any): any[] {
	if (!content?.readingAssignments) return [];
	
	return content.readingAssignments.filter((assignment: any) => 
		isAssignmentForHumanDirector(assignment)
	);
}