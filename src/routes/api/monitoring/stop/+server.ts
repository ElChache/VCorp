import { json } from '@sveltejs/kit';
import MonitoringManager from '$lib/services/MonitoringManager';

// POST /api/monitoring/stop - Stop the monitoring service
export async function POST() {
	try {
		const manager = MonitoringManager.getInstance();
		
		if (!manager.isRunning) {
			return json({ 
				error: 'Monitoring service is not running'
			}, { status: 400 });
		}

		const stats = manager.getStats();
		manager.stop();

		return json({
			success: true,
			message: 'Monitoring service stopped',
			finalStats: stats,
			stopTime: new Date().toISOString()
		});

	} catch (error) {
		console.error('Failed to stop monitoring service:', error);
		return json({ 
			error: error instanceof Error ? error.message : 'Failed to stop monitoring service' 
		}, { status: 500 });
	}
}