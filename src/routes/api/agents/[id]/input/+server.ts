import { json } from '@sveltejs/kit';
import { spawn } from 'child_process';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST({ params, request }) {
	try {
		const agentId = params.id;
		const { command, sendEnter = true } = await request.json();

		if (!command?.trim()) {
			return json({ error: 'Command is required' }, { status: 400 });
		}

		// Get agent to verify it exists and get tmux session
		const [agent] = await db
			.select()
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);

		if (!agent) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		// Send command to tmux session
		const args = ['send-keys', '-t', agent.tmuxSession, command.trim()];
		if (sendEnter) {
			args.push('Enter');
		}

		const tmuxProcess = spawn('tmux', args, {
			stdio: 'pipe'
		});

		return new Promise((resolve) => {
			let stderr = '';

			tmuxProcess.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			tmuxProcess.on('close', (code) => {
				if (code === 0) {
					resolve(json({
						success: true,
						message: `Command sent to agent ${agentId}`,
						command: command.trim(),
						timestamp: new Date().toISOString()
					}));
				} else {
					// Session might be dead
					db.update(agents)
						.set({ status: 'offline' })
						.where(eq(agents.id, agentId))
						.then(() => {});

					resolve(json({
						error: 'Failed to send command - agent may be offline',
						details: stderr,
						agentId
					}, { status: 400 }));
				}
			});
		});

	} catch (error) {
		console.error('Failed to send input to agent:', error);
		return json({ error: 'Failed to send input to agent' }, { status: 500 });
	}
}