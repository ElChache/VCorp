import { json, type RequestHandler } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { agentId } = params;
		const { prompt } = await request.json();

		console.log(`💬 SEND PROMPT request for agent: ${agentId}`);

		if (!agentId) {
			return json({ error: 'Agent ID is required' }, { status: 400 });
		}

		if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
			return json({ error: 'Prompt is required and must be a non-empty string' }, { status: 400 });
		}

		// Get agent details from database
		const [agent] = await db
			.select()
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);

		if (!agent) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		console.log(`🔍 Found agent: ${agent.id}, tmux session: ${agent.tmuxSession}`);

		// Check if agent has an active tmux session
		if (!agent.tmuxSession) {
			return json({ error: 'Agent has no active session to send prompt to' }, { status: 400 });
		}

		// Check if agent has a status that can receive prompts
		if (!['active', 'idle'].includes(agent.status)) {
			return json({ error: `Agent is ${agent.status}. Can only send prompts to active or idle agents.` }, { status: 400 });
		}

		try {
			console.log(`📝 Sending prompt to agent in session: ${agent.tmuxSession}`);
			
			// Escape the prompt for bash and tmux (using single quotes, so escape single quotes)
			const escapedPrompt = prompt.replace(/'/g, "'\"'\"'");

			// Send the prompt directly to the tmux session
			const tmuxCommand = `tmux send-keys -t "${agent.tmuxSession}" '${escapedPrompt}'`;
			execSync(tmuxCommand, { stdio: 'ignore' });
			
			// Send Enter key as separate command
			const enterCommand = `tmux send-keys -t "${agent.tmuxSession}" Enter`;
			execSync(enterCommand, { stdio: 'ignore' });
			
			// Send second Enter command to ensure message is processed
			const secondEnterCommand = `tmux send-keys -t "${agent.tmuxSession}" Enter`;
			execSync(secondEnterCommand, { stdio: 'ignore' });
			
			console.log(`✅ Successfully sent prompt to agent: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
			
			return json({ 
				success: true, 
				message: `Prompt sent to ${agentId}`,
				agent: {
					id: agent.id,
					roleType: agent.roleType,
					status: agent.status,
					tmuxSession: agent.tmuxSession
				},
				promptLength: prompt.length
			});

		} catch (tmuxError: unknown) {
			console.log(`⚠️ Failed to send prompt to tmux session:`, (tmuxError as Error).message);
			return json({ 
				error: 'Failed to send prompt to agent session',
				details: (tmuxError as Error).message 
			}, { status: 500 });
		}

	} catch (error: unknown) {
		console.error('❌ Failed to send prompt to agent:', error);
		return json({ 
			error: 'Failed to send prompt to agent',
			details: (error as Error).message 
		}, { status: 500 });
	}
}