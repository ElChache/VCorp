import { json } from '@sveltejs/kit';
import MonitoringManager from '$lib/services/MonitoringManager';

// POST /api/monitoring/start - Start the monitoring service for a specific project
export async function POST({ request }) {
	try {
		const manager = MonitoringManager.getInstance();
		
		if (manager.isRunning) {
			return json({ 
				error: 'Monitoring service is already running',
				currentProjectId: manager.currentProjectId,
				stats: manager.getStats()
			}, { status: 400 });
		}

		const body = await request.json();
		const { projectId } = body;

		if (!projectId) {
			return json({ 
				error: 'Project ID is required to start monitoring' 
			}, { status: 400 });
		}

		await manager.start(projectId);

		return json({
			success: true,
			message: `Monitoring service started for project ${projectId}`,
			projectId: projectId,
			stats: manager.getStats(),
			startTime: new Date().toISOString()
		});

	} catch (error) {
		console.error('Failed to start monitoring service:', error);
		return json({ 
			error: error instanceof Error ? error.message : 'Failed to start monitoring service' 
		}, { status: 500 });
	}
}