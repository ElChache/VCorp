import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST({ params }) {
	try {
		const { agentId } = params;
		console.log(`⏰ CLOCK OUT request from agent: ${agentId}`);

		if (!agentId) {
			return json({ error: 'Agent ID is required' }, { status: 400 });
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

		console.log(`👋 Agent ${agent.id} is clocking out from session: ${agent.tmuxSession}`);

		// Kill the tmux session gracefully
		if (agent.tmuxSession) {
			try {
				console.log(`⏰ Gracefully ending tmux session: ${agent.tmuxSession}`);
				execSync(`tmux kill-session -t "${agent.tmuxSession}"`, { stdio: 'ignore' });
				console.log(`✅ Agent successfully clocked out`);
			} catch (tmuxError) {
				console.log(`⚠️ Failed to end tmux session (might already be gone):`, tmuxError.message);
				// Continue anyway - agent called clock-out so we should mark them as offline
			}
		}

		// Update agent status to 'offline' 
		console.log(`📝 Updating agent status to offline...`);
		const [updatedAgent] = await db
			.update(agents)
			.set({
				status: 'offline',
				tmuxSession: null // Clear the session since it's gone
			})
			.where(eq(agents.id, agentId))
			.returning();

		if (!updatedAgent) {
			return json({ error: 'Failed to update agent status' }, { status: 500 });
		}

		console.log(`👋 Agent ${agentId} successfully clocked out. See you tomorrow!`);
		return json({ 
			success: true, 
			message: `Thanks for your hard work today, ${agentId}! You're now clocked out.`,
			agent: updatedAgent
		});

	} catch (error) {
		console.error('❌ Failed to clock out agent:', error);
		return json({ error: 'Failed to clock out' }, { status: 500 });
	}
}