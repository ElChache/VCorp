import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ params, url }) {
	try {
		const agentId = params.id;
		const lines = parseInt(url.searchParams.get('lines') || '50');

		// Get agent to verify it exists and get tmux session
		const [agent] = await db
			.select()
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);

		if (!agent) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		try {
			// Capture tmux pane content
			const output = execSync(
				`tmux capture-pane -t "${agent.tmuxSession}" -S -${lines} -p`,
				{ encoding: 'utf8', timeout: 5000 }
			);

			return json({
				agentId,
				sessionName: agent.tmuxSession,
				output: output || '(No output available)',
				timestamp: new Date().toISOString()
			});

		} catch (tmuxError) {
			// Session might be dead
			await db
				.update(agents)
				.set({ status: 'offline' })
				.where(eq(agents.id, agentId));

			return json({
				agentId,
				sessionName: agent.tmuxSession,
				output: '(Agent offline - tmux session not found)',
				timestamp: new Date().toISOString(),
				status: 'offline'
			});
		}

	} catch (error) {
		console.error('Failed to get agent output:', error);
		return json({ error: 'Failed to get agent output' }, { status: 500 });
	}
}