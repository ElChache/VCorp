// Simple in-memory storage for forwarding settings
// In production, this could be stored in the database or Redis
const forwardingSettings = new Map<number, boolean>();

export function setForwardingEnabled(projectId: number, enabled: boolean): void {
	forwardingSettings.set(projectId, enabled);
}

export function isForwardingEnabled(projectId: number): boolean {
	return forwardingSettings.get(projectId) || false;
}

export async function checkForwardingStatus(projectId: number): Promise<boolean> {
	try {
		const response = await fetch(`http://localhost:5173/api/assistant/forwarding?projectId=${projectId}`);
		if (response.ok) {
			const data = await response.json();
			return data.enabled || false;
		}
	} catch (error) {
		console.error('Failed to check forwarding status:', error);
	}
	return false;
}