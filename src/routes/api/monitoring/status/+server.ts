import { json } from '@sveltejs/kit';
import MonitoringManager from '$lib/services/MonitoringManager';

// GET /api/monitoring/status - Get monitoring service status and stats
export async function GET() {
	try {
		const manager = MonitoringManager.getInstance();
		
		return json({
			isRunning: manager.isRunning,
			stats: manager.getStats(),
			timestamp: new Date().toISOString()
		});

	} catch (error) {
		console.error('Failed to get monitoring status:', error);
		return json({ error: 'Failed to get monitoring status' }, { status: 500 });
	}
}