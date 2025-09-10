import { json } from '@sveltejs/kit';
import MonitoringManager from '$lib/services/MonitoringManager';

// POST /api/monitoring/start - Start the monitoring service
export async function POST() {
	try {
		const manager = MonitoringManager.getInstance();
		
		if (manager.isRunning) {
			return json({ 
				error: 'Monitoring service is already running',
				stats: manager.getStats()
			}, { status: 400 });
		}

		await manager.start();

		return json({
			success: true,
			message: 'Monitoring service started',
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