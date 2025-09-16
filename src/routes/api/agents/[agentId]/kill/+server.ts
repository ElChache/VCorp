import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents, content, readingAssignmentReads, roleAssignments, tasks } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { execSync } from 'child_process';

export async function POST({ params }) {
	try {
		const { agentId } = params;
		console.log(`💀 KILL request for agent: ${agentId}`);

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

		console.log(`🔍 Found agent: ${agent.id}, tmux session: ${agent.tmuxSession}`);

		// Hard kill the tmux session
		try {
			console.log(`💥 Killing tmux session: ${agent.tmuxSession}`);
			execSync(`tmux kill-session -t "${agent.tmuxSession}"`, { stdio: 'ignore' });
			console.log(`✅ Successfully killed tmux session`);
		} catch (tmuxError) {
			console.log(`⚠️ Failed to kill tmux session (might not exist):`, tmuxError.message);
			// Continue anyway - we still want to remove from database
		}

		// First, update any content authored by this agent to remove the reference
		console.log(`🔗 Removing agent references from content...`);
		await db
			.update(content)
			.set({ authorAgentId: null })
			.where(eq(content.authorAgentId, agentId));

		// Remove agent from database
		console.log(`🗑️ Removing agent from database...`);
		const deleted = await db
			.delete(agents)
			.where(eq(agents.id, agentId))
			.returning();

		if (deleted.length === 0) {
			console.log(`⚠️ Agent not found in database for deletion`);
			return json({ error: 'Agent not found in database' }, { status: 404 });
		}

		console.log(`✅ Agent ${agentId} hard-killed and removed from database`);
		return json({ 
			success: true, 
			message: `Agent ${agentId} terminated`,
			killedAgent: deleted[0]
		});

	} catch (error) {
		console.error('❌ Failed to kill agent:', error);
		return json({ error: 'Failed to kill agent' }, { status: 500 });
	}
}