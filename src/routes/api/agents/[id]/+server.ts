import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// Get agent details
export async function GET({ params }) {
	try {
		const agentId = params.id;

		const [agent] = await db
			.select()
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);

		if (!agent) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		return json(agent);
	} catch (error) {
		console.error('Failed to fetch agent:', error);
		return json({ error: 'Failed to fetch agent' }, { status: 500 });
	}
}

// Terminate agent
export async function DELETE({ params }) {
	try {
		const agentId = params.id;

		const [agent] = await db
			.select()
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);

		if (!agent) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		// Kill tmux session
		const { spawn } = await import('child_process');
		spawn('tmux', ['kill-session', '-t', agent.tmuxSession], {
			stdio: 'ignore'
		});

		// Remove from database
		await db
			.delete(agents)
			.where(eq(agents.id, agentId));

		return json({ success: true, message: `Agent ${agentId} terminated` });
	} catch (error) {
		console.error('Failed to terminate agent:', error);
		return json({ error: 'Failed to terminate agent' }, { status: 500 });
	}
}