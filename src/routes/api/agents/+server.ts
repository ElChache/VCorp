import { json, type RequestHandler } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Get all agents with status monitoring
export const GET: RequestHandler = async ({ url }) => {
	try {
		const projectId = url.searchParams.get('projectId');
		console.log(`🔍 GET /api/agents - projectId: ${projectId}`);
		
		if (!projectId) {
			console.log('❌ No projectId provided');
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		console.log(`📊 Fetching agents for project ${projectId}...`);
		const allAgents = await db
			.select()
			.from(agents)
			.where(eq(agents.projectId, parseInt(projectId)));

		console.log(`📋 Found ${allAgents.length} agents in database:`, allAgents.map(a => ({ id: a.id, status: a.status })));

		// Check status of each agent
		const agentsWithStatus = await Promise.all(
			allAgents.map(async (agent) => {
				console.log(`🔍 Checking status for agent ${agent.id}...`);
				const status = await checkAgentStatus(agent);
				console.log(`📊 Agent ${agent.id} status: ${agent.status} → ${status}`);
				
				// Update status in database if it changed
				if (status !== agent.status) {
					console.log(`💾 Updating agent ${agent.id} status in database`);
					await db
						.update(agents)
						.set({ 
							status,
							lastHeartbeat: new Date()
						})
						.where(eq(agents.id, agent.id));
				}

				return {
					...agent,
					status,
					lastChecked: new Date().toISOString()
				};
			})
		);

		console.log(`✅ Returning ${agentsWithStatus.length} agents with updated status`);
		return json(agentsWithStatus);
	} catch (error) {
		console.error('❌ Failed to fetch agents:', error);
		return json({ error: 'Failed to fetch agents' }, { status: 500 });
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