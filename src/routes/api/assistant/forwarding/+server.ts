import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { projects } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Simple in-memory storage for forwarding settings
// In production, this could be stored in the database or Redis
const forwardingSettings = new Map<number, boolean>();

export async function POST({ request }) {
	try {
		const { enabled, projectId } = await request.json();

		if (typeof enabled !== 'boolean' || !projectId) {
			return json({ error: 'Invalid parameters' }, { status: 400 });
		}

		console.log(`📬 Assistant forwarding ${enabled ? 'ENABLED' : 'DISABLED'} for project ${projectId}`);
		
		// Store the setting
		forwardingSettings.set(parseInt(projectId), enabled);

		return json({ 
			success: true, 
			enabled,
			message: `Assistant forwarding ${enabled ? 'enabled' : 'disabled'} for project ${projectId}`
		});

	} catch (error) {
		console.error('Failed to toggle assistant forwarding:', error);
		return json({ error: 'Failed to toggle assistant forwarding' }, { status: 500 });
	}
}

export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID required' }, { status: 400 });
		}

		const enabled = forwardingSettings.get(parseInt(projectId)) || false;

		return json({ enabled });

	} catch (error) {
		console.error('Failed to get assistant forwarding status:', error);
		return json({ error: 'Failed to get assistant forwarding status' }, { status: 500 });
	}
}

// Export function to check if forwarding is enabled (for use by other modules)
export function isForwardingEnabled(projectId: number): boolean {
	return forwardingSettings.get(projectId) || false;
}