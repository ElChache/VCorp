/**
 * Human Director Helper Functions
 * Centralized utilities for finding and working with human director agents
 */

import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Get the human director agent for a project
 * Throws an error if no human director is found
 */
export async function getHumanDirectorForProject(projectId: number) {
	const [humanDirector] = await db
		.select()
		.from(agents)
		.where(and(
			eq(agents.projectId, projectId),
			eq(agents.isHumanDirector, true)
		))
		.limit(1);

	if (!humanDirector) {
		throw new Error(`No human director found for project ${projectId}`);
	}

	return humanDirector;
}

/**
 * Get the human director agent ID for a project
 * Returns null if no human director is found (non-throwing version)
 */
export async function getHumanDirectorIdForProject(projectId: number): Promise<string | null> {
	try {
		const humanDirector = await getHumanDirectorForProject(projectId);
		return humanDirector.id;
	} catch {
		return null;
	}
}

/**
 * Check if an agent ID represents a human director (including legacy IDs)
 */
export function isHumanDirectorId(agentId: string): boolean {
	return agentId === 'human-director' || agentId === 'director';
}

/**
 * Resolve an agent ID to the actual human director ID for a project
 * If the agentId is a legacy human director ID, returns the actual human director ID
 * Otherwise returns the original agentId
 */
export async function resolveAgentId(agentId: string, projectId: number): Promise<string> {
	if (isHumanDirectorId(agentId)) {
		const actualDirectorId = await getHumanDirectorIdForProject(projectId);
		if (actualDirectorId) {
			return actualDirectorId;
		}
		// Fallback to original if no actual director found
		return agentId;
	}
	return agentId;
}

/**
 * Map legacy assignment targets to actual agent IDs
 * Used for assignment processing in message/document creation
 */
export async function resolveAssignmentTarget(
	assignment: { type: string; target: string },
	projectId: number
): Promise<{ type: string; target: string }> {
	if (assignment.type === 'agent' && isHumanDirectorId(assignment.target)) {
		const actualDirectorId = await getHumanDirectorIdForProject(projectId);
		if (actualDirectorId) {
			return { ...assignment, target: actualDirectorId };
		}
	}
	return assignment;
}