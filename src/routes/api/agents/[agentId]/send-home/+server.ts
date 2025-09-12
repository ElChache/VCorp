import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST({ params }) {
	try {
		const { agentId } = params;
		console.log(`🏠 SEND HOME request for agent: ${agentId}`);

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

		// Send polite wrap-up message to the tmux session
		if (agent.tmuxSession) {
			try {
				console.log(`💌 Sending wrap-up message to agent in session: ${agent.tmuxSession}`);
				
				const wrapUpMessage = `
🏠 Time to wrap up your day!

Please finish any work you're currently doing and when you're ready to clock out, call this endpoint:

curl -X POST "http://localhost:5173/api/agents/${agentId}/clock-out" -H "Content-Type: application/json"

Take your time to finish properly - no rush! 👋
`;

				// Send the message to the tmux session
				const tmuxCommand = `tmux send-keys -t "${agent.tmuxSession}" 'echo "${wrapUpMessage.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"' Enter`;
				execSync(tmuxCommand, { stdio: 'ignore' });
				
				console.log(`✅ Successfully sent wrap-up message to agent`);
			} catch (tmuxError) {
				console.log(`⚠️ Failed to send message to tmux session:`, tmuxError.message);
				return json({ error: 'Failed to send wrap-up message to agent' }, { status: 500 });
			}
		} else {
			return json({ error: 'Agent has no active session to send message to' }, { status: 400 });
		}

		// Don't change agent status - they're still active until they clock out themselves
		console.log(`📝 Agent notified to wrap up - they'll clock out when ready`);

		console.log(`💌 Agent ${agentId} successfully notified to wrap up`);
		return json({ 
			success: true, 
			message: `Wrap-up message sent to ${agentId}. They'll clock out when ready.`,
			agent: agent
		});

	} catch (error) {
		console.error('❌ Failed to send agent home:', error);
		return json({ error: 'Failed to send agent home' }, { status: 500 });
	}
}