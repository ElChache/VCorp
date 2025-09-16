import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

export const POST = async ({ params }: RequestEvent) => {
	try {
		const { agentId } = params;
		console.log(`⚡ FORCE HOME request for agent: ${agentId}`);

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

		console.log(`🔍 Found unresponsive agent: ${agent.id}, tmux session: ${agent.tmuxSession}`);

		// Forcefully kill the tmux session (agent was unresponsive to polite request)
		if (agent.tmuxSession) {
			try {
				console.log(`⚡ Forcefully ending tmux session for unresponsive agent: ${agent.tmuxSession}`);
				execSync(`tmux kill-session -t "${agent.tmuxSession}"`, { stdio: 'ignore' });
				console.log(`✅ Successfully forced agent home`);
			} catch (tmuxError: unknown) {
				console.log(`⚠️ Failed to kill tmux session (might not exist):`, (tmuxError as Error).message);
				// Continue anyway - we still want to update status
			}
		}

		// Update agent status to 'offline' but keep all data
		console.log(`📝 Updating unresponsive agent status to offline...`);
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

		console.log(`⚡ Unresponsive agent ${agentId} forcefully sent home (data preserved)`);
		return json({ 
			success: true, 
			message: `Unresponsive agent ${agentId} forced home - session terminated, data preserved`,
			agent: updatedAgent
		});

	} catch (error) {
		console.error('❌ Failed to force agent home:', error);
		return json({ error: 'Failed to force agent home' }, { status: 500 });
	}
}