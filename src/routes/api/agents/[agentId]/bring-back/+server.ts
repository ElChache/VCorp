import { json, type RequestHandler } from '@sveltejs/kit';
import { spawn, execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents, projects } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateWelcomeBackPrompt } from '$lib/utils/agentStartup';

export const POST: RequestHandler = async ({ params, request }) => {
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

		// Get the project to fetch its path (same as launch endpoint)
		console.log(`🔍 Fetching project ${projectId} details...`);
		const [project] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, parseInt(projectId)))
			.limit(1);

		if (!project) {
			console.log(`❌ Project ${projectId} not found`);
			return json({ error: 'Project not found' }, { status: 404 });
		}

		console.log(`✅ Project found: ${project.name}, path: ${project.path || 'not specified'}`);
		const workingDirectory = project.path?.trim() || process.cwd();

		// Generate new session name and ensure workspace exists  
		const newSessionName = `vcorp-${agentId}`;
		const workspacePath = `${workingDirectory}/agent_workspaces/${agentId}/`;

		console.log(`🔧 Creating new session: ${newSessionName}`);
		console.log(`📁 Workspace: ${workspacePath}`);

		// Create workspace directory if it doesn't exist
		try {
			execSync(`mkdir -p "${workspacePath}"`, { stdio: 'inherit' });
		} catch (error: unknown) {
			console.error('❌ Failed to create workspace directory:', (error as Error).message);
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

		// Generate friendly welcome back prompt using shared function
		const startupPrompt = generateWelcomeBackPrompt(agentId, agent.roleType, projectId.toString());

		// Start new tmux session with Claude
		console.log(`🚀 Starting new tmux session for returning agent...`);
		
		// Launch tmux session with Claude (same as launch endpoint)
		console.log(`📂 Starting Claude in directory: ${workingDirectory}`);
		const tmuxProcess = spawn('tmux', [
			'new-session', '-d', '-s', newSessionName, '-c', workingDirectory,
			'claude', `--model=${agent.model}`, '--dangerously-skip-permissions'
		], {
			detached: true,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { 
				...process.env, 
				ENABLE_BACKGROUND_TASKS: '1',
				AGENT_ID: agentId,
				AGENT_ROLE: agent.roleType,
				PROJECT_ID: projectId.toString()
			}
		});

		console.log(`⏳ Waiting for tmux session to start...`);
		// Wait a moment for tmux to start
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Verify tmux session was created
		try {
			execSync(`tmux has-session -t "${newSessionName}"`, { stdio: 'ignore' });
			console.log(`✅ Tmux session ${newSessionName} created successfully`);
		} catch (error) {
			console.log(`❌ Failed to create tmux session ${newSessionName}:`, error);
			// Update agent status to error
			await db
				.update(agents)
				.set({ status: 'error' })
				.where(eq(agents.id, agentId));
			
			return json({ error: 'Failed to create tmux session' }, { status: 500 });
		}

		// Send the startup prompt to the agent (two-stage approach like launch endpoint)
		console.log(`💬 Sending startup prompt to agent (two-stage)...`);
		
		// Stage 1: Send the prompt text
		spawn('tmux', [
			'send-keys', '-t', newSessionName,
			startupPrompt
		], {
			detached: true,
			stdio: 'ignore'
		});

		// Stage 2: Send Enter key after a brief delay
		setTimeout(() => {
			spawn('tmux', [
				'send-keys', '-t', newSessionName,
				'Enter'
			], {
				detached: true,
				stdio: 'ignore'
			});
		}, 500);

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