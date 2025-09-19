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
 * Check if an assignment is for the human director
 * Checks for agent assignments AND role assignments that human director can see
 */
export function isAssignmentForHumanDirector(assignment: any): boolean {
	if (!assignment) return false;
	
	// Check for direct agent-based assignment
	if (assignment.assignedToType === 'agent') {
		return isHumanDirectorAgent(assignment.assignedTo);
	}
	
	// Check for role-based assignment that human director can see
	// Human director can see assignments for director-assistant, system-architect, etc.
	if (assignment.assignedToType === 'role') {
		const humanDirectorRoles = ['director-assistant', 'system-architect', 'it-administrator', 'human-director'];
		return humanDirectorRoles.includes(assignment.assignedTo);
	}
	
	return false;
}

/**
 * Check if an assignment is for the human director (DM context only)
 * Only checks for direct agent assignments - used for direct messages
 */
export function isDirectAssignmentForHumanDirector(assignment: any): boolean {
	if (!assignment) return false;
	
	// For DMs, only check for direct agent-based assignments
	return assignment.assignedToType === 'agent' && isHumanDirectorAgent(assignment.assignedTo);
}

/**
 * Check if a read record is from the human director
 * Only checks for actual agent IDs with isHumanDirector === true
 */
export function isReadByHumanDirector(read: any): boolean {
	if (!read) return false;
	
	return isHumanDirectorAgent(read.agentId);
}

/**
 * Check if content has been read by the human director
 * Simple logic: has assignment for human director AND that assignment has been read
 */
export function isContentReadByHumanDirector(content: any): boolean {
	if (!content?.readingAssignments) return false;
	
	return content.readingAssignments.some((assignment: any) => {
		if (!isAssignmentForHumanDirector(assignment)) return false;
		
		const reads = assignment.readBy || [];
		return reads.some((read: any) => isReadByHumanDirector(read));
	});
}

/**
 * Check if content is unread by the human director
 * Simple logic: has assignment for human director AND that assignment has NOT been read
 */
export function isContentUnreadByHumanDirector(content: any): boolean {
	if (!content?.readingAssignments) return false;
	
	// Debug logging for message 72
	if (content.id === 72) {
		console.log('🔍 isContentUnreadByHumanDirector for message 72:', {
			contentId: content.id,
			readingAssignments: content.readingAssignments,
			humanDirectorAgentId: getHumanDirectorAgentId()
		});
	}
	
	// Check if there's any assignment for human director that hasn't been read
	return content.readingAssignments.some((assignment: any) => {
		if (!isAssignmentForHumanDirector(assignment)) return false;
		
		const reads = assignment.readBy || [];
		const isUnread = !reads.some((read: any) => isReadByHumanDirector(read));
		
		// Debug logging for message 72
		if (content.id === 72) {
			console.log('🔍 Assignment check for message 72:', {
				assignment,
				reads,
				isUnread,
				humanDirectorAgentId: getHumanDirectorAgentId()
			});
		}
		
		return isUnread;
	});
}

/**
 * Check if a message author is the human director
 */
export function isMessageFromHumanDirector(message: any): boolean {
	if (!message?.authorAgentId) return false;
	
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