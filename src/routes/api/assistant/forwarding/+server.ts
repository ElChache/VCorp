import { json } from '@sveltejs/kit';
import { setForwardingEnabled, isForwardingEnabled } from '$lib/services/ForwardingService';

export async function POST({ request }) {
	try {
		const { enabled, projectId } = await request.json();

		if (typeof enabled !== 'boolean' || !projectId) {
			return json({ error: 'Invalid parameters' }, { status: 400 });
		}

		console.log(`📬 Assistant forwarding ${enabled ? 'ENABLED' : 'DISABLED'} for project ${projectId}`);
		
		// Store the setting
		setForwardingEnabled(parseInt(projectId), enabled);

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

		const enabled = isForwardingEnabled(parseInt(projectId));

		return json({ enabled });

	} catch (error) {
		console.error('Failed to get assistant forwarding status:', error);
		return json({ error: 'Failed to get assistant forwarding status' }, { status: 500 });
	}
}

