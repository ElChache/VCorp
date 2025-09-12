import { json } from '@sveltejs/kit';
import { spawn, execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST({ params, request }) {
	try {
		const { agentId } = params;
		const { projectId } = await request.json();
		console.log(`🔄 BRING BACK request for agent: ${agentId}, project: ${projectId}`);

		if (!agentId) {
			return json({ error: 'Agent ID is required' }, { status: 400 });
		}

		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
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

		// Check if agent is already active
		if (agent.status === 'active' && agent.tmuxSession) {
			return json({ error: 'Agent is already active' }, { status: 400 });
		}

		console.log(`🔍 Bringing back agent: ${agent.id}`);

		// Generate new session name and ensure workspace exists
		const newSessionName = `agent_${agentId}_${Date.now()}`;
		const workspacePath = `${process.cwd()}/agent_workspaces/${agentId}`;

		console.log(`🔧 Creating new session: ${newSessionName}`);
		console.log(`📁 Workspace: ${workspacePath}`);

		// Create workspace directory if it doesn't exist
		try {
			execSync(`mkdir -p "${workspacePath}"`, { stdio: 'inherit' });
		} catch (error) {
			console.error('❌ Failed to create workspace directory:', error.message);
			return json({ error: 'Failed to create workspace directory' }, { status: 500 });
		}

		// Update agent in database with new session info
		console.log(`📝 Updating agent in database...`);
		const [updatedAgent] = await db
			.update(agents)
			.set({
				tmuxSession: newSessionName,
				worktreePath: workspacePath,
				status: 'launching',
				lastHeartbeat: new Date()
			})
			.where(eq(agents.id, agentId))
			.returning();

		if (!updatedAgent) {
			return json({ error: 'Failed to update agent in database' }, { status: 500 });
		}

		// Build the startup prompt - agent is coming back to existing work
		const comebackStartupPrompt = `You are a development agent in a coordinated multi-agent software project.

🔄 WELCOME BACK! You're returning to your existing work.

Environment Variables Available:
- \$AGENT_ID = "${agentId}" (your unique agent identifier)
- \$AGENT_ROLE = "${agent.roleType}" (your role type)  
- \$PROJECT_ID = "${projectId}" (your project ID for all API calls)

IMPORTANT: You have existing work waiting for you!

Step 1 - Register your return:
curl -X POST http://localhost:5173/api/agents/register -H "Content-Type: application/json" -d '{"agentId": "${agentId}"}'

Step 2 - Check your inbox for assignments:
curl -X GET "http://localhost:5173/api/inbox?agentId=${agentId}"

Step 3 - Check for active phase:
curl -X GET "http://localhost:5173/api/roles/${encodeURIComponent(agent.roleType)}/current-phase?projectId=${projectId}"

You likely have tickets in progress and other assignments. Continue where you left off!

Help guide: http://localhost:5173/api/agents/${agentId}/help`;

		// Start new tmux session with Claude
		console.log(`🚀 Starting new tmux session for returning agent...`);
		
		const tmuxCommand = [
			'tmux', 'new-session', '-d', '-s', newSessionName, '-c', workspacePath,
			'bash', '-c', `
				export AGENT_ID="${agentId}"
				export AGENT_ROLE="${agent.roleType}"
				export PROJECT_ID="${projectId}"
				echo "🔄 Welcome back, Agent ${agentId}! $(date)"
				echo "📁 Workspace: ${workspacePath}"
				echo "🔗 Session: ${newSessionName}"
				echo ""
				echo "Connecting to Claude..."
				npx @anthropic/claude@latest --model claude-3-5-${agent.model}-20241022 --prompt '${comebackStartupPrompt.replace(/'/g, "'\"'\"'")}'
			`
		];

		console.log(`🔧 Tmux command: ${tmuxCommand.join(' ')}`);

		// Execute tmux command
		try {
			execSync(tmuxCommand.join(' '), { stdio: 'inherit' });
			console.log(`✅ Successfully brought agent back with new session`);
		} catch (error) {
			console.error('❌ Failed to start tmux session:', error.message);
			// Update agent status to error
			await db
				.update(agents)
				.set({ status: 'error' })
				.where(eq(agents.id, agentId));
			
			return json({ error: 'Failed to bring agent back' }, { status: 500 });
		}

		console.log(`🎉 Agent ${agentId} successfully brought back with session ${newSessionName}`);
		return json({ 
			success: true, 
			message: `Agent ${agentId} brought back`,
			agent: updatedAgent,
			newSession: newSessionName
		});

	} catch (error) {
		console.error('❌ Failed to bring agent back:', error);
		return json({ error: 'Failed to bring agent back' }, { status: 500 });
	}
}