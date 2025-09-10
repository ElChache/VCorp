import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Lightweight endpoint to get just agent status without heavy checking
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		// Get only essential status information (no heavy tmux checking)
		const agentStatuses = await db
			.select({
				id: agents.id,
				status: agents.status,
				lastHeartbeat: agents.lastHeartbeat,
				roleType: agents.roleType,
				model: agents.model,
			})
			.from(agents)
			.where(eq(agents.projectId, parseInt(projectId)));

		// Add time since last heartbeat for UI
		const statusWithTiming = agentStatuses.map(agent => {
			const now = Date.now();
			const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
			const minutesSinceLastUpdate = Math.floor((now - lastHeartbeat) / (1000 * 60));
			
			return {
				...agent,
				minutesSinceLastUpdate,
				lastHeartbeatFormatted: new Date(agent.lastHeartbeat).toLocaleTimeString()
			};
		});

		return json(statusWithTiming);
	} catch (error) {
		console.error('Failed to fetch agent status:', error);
		return json({ error: 'Failed to fetch agent status' }, { status: 500 });
	}
}