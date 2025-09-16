import { json } from '@sveltejs/kit';
import { promises as fs } from 'fs';
import { join } from 'path';
import { CONFIG } from '$lib/config';

// GET /api/terminal-logs?agentId=pm_001&date=2025-09-14 - Get terminal logs for an agent
export async function GET({ url }) {
	try {
		const agentId = url.searchParams.get('agentId');
		const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
		const tail = url.searchParams.get('tail'); // Get last N lines
		const follow = url.searchParams.get('follow'); // Return just new content since timestamp

		if (!agentId) {
			return json({ error: 'Agent ID is required' }, { status: 400 });
		}

		// Generate log file path
		const fileName = CONFIG.TERMINAL_LOGGING.LOG_FILE_PATTERN
			.replace('{agentId}', agentId)
			.replace('{date}', date);
		const logFilePath = join(CONFIG.TERMINAL_LOGGING.LOG_DIR, fileName);

		try {
			// Check if log file exists
			await fs.access(logFilePath);
			
			// Read the log file
			let content = await fs.readFile(logFilePath, 'utf-8');
			
			// Apply tail filter if requested
			if (tail) {
				const lines = content.split('\n');
				const tailCount = parseInt(tail, 10);
				if (!isNaN(tailCount)) {
					content = lines.slice(-tailCount).join('\n');
				}
			}

			// Get file stats
			const stats = await fs.stat(logFilePath);

			return json({
				success: true,
				agentId,
				date,
				logFile: fileName,
				content,
				fileSize: stats.size,
				lastModified: stats.mtime,
				totalLines: content.split('\n').length
			});

		} catch (fileError) {
			return json({ 
				error: `No terminal log found for agent ${agentId} on ${date}`,
				agentId,
				date,
				logFile: fileName
			}, { status: 404 });
		}

	} catch (error) {
		console.error('Failed to retrieve terminal logs:', error);
		return json({ 
			error: 'Failed to retrieve terminal logs',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}

// GET /api/terminal-logs/list?projectId=3 - List available terminal logs
export async function POST({ request }) {
	try {
		const { action, projectId } = await request.json();

		if (action === 'list') {
			if (!projectId) {
				return json({ error: 'Project ID is required for listing logs' }, { status: 400 });
			}

			try {
				// Check if log directory exists
				await fs.access(CONFIG.TERMINAL_LOGGING.LOG_DIR);
				
				// Get all log files
				const files = await fs.readdir(CONFIG.TERMINAL_LOGGING.LOG_DIR);
				
				// Parse log files to get agent info
				const logFiles = await Promise.all(
					files
						.filter(file => file.startsWith('terminal_'))
						.map(async (file) => {
							const filePath = join(CONFIG.TERMINAL_LOGGING.LOG_DIR, file);
							const stats = await fs.stat(filePath);
							
							// Parse filename: terminal_{agentId}_{date}.log
							const match = file.match(/terminal_(.+)_(\d{4}-\d{2}-\d{2})\.log/);
							if (!match) return null;
							
							const [, agentId, date] = match;
							
							return {
								agentId,
								date,
								fileName: file,
								fileSize: stats.size,
								lastModified: stats.mtime,
								url: `/api/terminal-logs?agentId=${agentId}&date=${date}`
							};
						})
				);

				// Filter out null entries and sort by date/agent
				const validLogFiles = logFiles
					.filter(file => file !== null)
					.sort((a, b) => {
						// Sort by date desc, then agent asc
						const dateCompare = b!.date.localeCompare(a!.date);
						return dateCompare !== 0 ? dateCompare : a!.agentId.localeCompare(b!.agentId);
					});

				return json({
					success: true,
					projectId,
					totalFiles: validLogFiles.length,
					logFiles: validLogFiles,
					logDirectory: CONFIG.TERMINAL_LOGGING.LOG_DIR
				});

			} catch (dirError) {
				return json({
					error: 'Terminal log directory not found',
					logDirectory: CONFIG.TERMINAL_LOGGING.LOG_DIR
				}, { status: 404 });
			}
		}

		return json({ error: 'Invalid action. Use "list"' }, { status: 400 });

	} catch (error) {
		console.error('Failed to list terminal logs:', error);
		return json({ 
			error: 'Failed to list terminal logs',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}