import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq, ne } from 'drizzle-orm';

// Background monitoring service that updates agent status
export async function POST({ request }) {
	try {
		const { projectId } = await request.json();
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		console.log(`🔍 [Monitor] Checking agent status for project ${projectId}...`);
		
		// Get all agents for the project that are not offline
		const allAgents = await db
			.select()
			.from(agents)
			.where(eq(agents.projectId, parseInt(projectId)));

		if (allAgents.length === 0) {
			return json({ 
				message: 'No agents found for project', 
				projectId: parseInt(projectId),
				totalAgents: 0,
				updatedCount: 0,
				statusUpdates: [],
				timestamp: new Date().toISOString()
			});
		}

		let updatedCount = 0;
		const statusUpdates: any[] = [];

		// Check status of each agent
		for (const agent of allAgents) {
			try {
				const currentStatus = await checkAgentStatus(agent);
				
				// Only update if status changed
				if (currentStatus !== agent.status) {
					console.log(`📊 [Monitor] Agent ${agent.id}: ${agent.status} → ${currentStatus}`);
					
					await db
						.update(agents)
						.set({ 
							status: currentStatus,
							lastHeartbeat: new Date()
						})
						.where(eq(agents.id, agent.id));
					
					updatedCount++;
					statusUpdates.push({
						agentId: agent.id,
						oldStatus: agent.status,
						newStatus: currentStatus
					});
				}
			} catch (error) {
				console.error(`❌ [Monitor] Failed to check agent ${agent.id}:`, error.message);
				// Mark as offline if we can't check it
				if (agent.status !== 'offline') {
					await db
						.update(agents)
						.set({ 
							status: 'offline',
							lastHeartbeat: new Date()
						})
						.where(eq(agents.id, agent.id));
					
					updatedCount++;
					statusUpdates.push({
						agentId: agent.id,
						oldStatus: agent.status,
						newStatus: 'offline'
					});
				}
			}
		}

		const result = {
			projectId,
			totalAgents: allAgents.length,
			updatedCount,
			statusUpdates,
			timestamp: new Date().toISOString()
		};

		if (updatedCount > 0) {
			console.log(`✅ [Monitor] Updated ${updatedCount}/${allAgents.length} agents for project ${projectId}`);
		}

		return json(result);
	} catch (error) {
		console.error('❌ [Monitor] Failed to update agent status:', error);
		return json({ error: 'Failed to update agent status' }, { status: 500 });
	}
}

async function checkAgentStatus(agent: any): Promise<'active' | 'idle' | 'offline'> {
	try {
		// Check if tmux session exists
		execSync(`tmux has-session -t "${agent.tmuxSession}"`, { 
			stdio: 'ignore', 
			timeout: 2000 
		});

		// Session exists - now check if it's active or idle
		try {
			const output = execSync(
				`tmux capture-pane -t "${agent.tmuxSession}" -S -5 -p`,
				{ encoding: 'utf8', timeout: 2000 }
			);

			// Simple heuristic: if the last few lines contain recent activity
			const now = Date.now();
			const recentLines = output.split('\n').slice(-3);
			
			// Check for common indicators of activity
			const hasActivity = recentLines.some(line => 
				line.includes('$') || // Command prompt
				line.includes('>') || // Some other prompt
				line.includes('claude') || // Claude output
				line.includes('✓') || // Success indicators
				line.includes('×') || // Error indicators
				line.trim().length > 0 // Any non-empty content
			);

			// If last heartbeat was more than 10 minutes ago, consider idle
			const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
			const minutesSinceLastUpdate = (now - lastHeartbeat) / (1000 * 60);

			if (minutesSinceLastUpdate > 10) {
				return 'idle';
			}

			return hasActivity ? 'active' : 'idle';

		} catch (captureError) {
			// Can't capture output but session exists - assume idle
			return 'idle';
		}

	} catch (sessionError) {
		// Session doesn't exist
		return 'offline';
	}
}