import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateWelcomeBackPrompt } from '$lib/utils/agentStartup';
import { launchAgentSession } from '$lib/utils/agentLauncher';

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

		// Update agent in database with launching status
		console.log(`📝 Updating agent status to launching...`);
		const [updatedAgent] = await db
			.update(agents)
			.set({
				status: 'launching',
				lastHeartbeat: new Date()
			})
			.where(eq(agents.id, agentId))
			.returning();

		if (!updatedAgent) {
			return json({ error: 'Failed to update agent in database' }, { status: 500 });
		}

		// Generate friendly welcome back prompt using shared function
		const welcomeBackPrompt = generateWelcomeBackPrompt(agentId, agent.roleType, projectId.toString());

		// Use the shared launcher function with the welcome back prompt
		const launchResult = await launchAgentSession({
			agentId,
			roleType: agent.roleType,
			projectId: projectId.toString(),
			model: agent.model,
			customStartupPrompt: welcomeBackPrompt
		});

		// Update agent with final session info
		await db
			.update(agents)
			.set({
				tmuxSession: launchResult.sessionName,
				worktreePath: launchResult.workspacePath,
				status: 'active'
			})
			.where(eq(agents.id, agentId));

		console.log(`🎉 Agent ${agentId} successfully brought back with session ${launchResult.sessionName}`);
		return json({ 
			success: true, 
			message: `Agent ${agentId} brought back`,
			agent: updatedAgent,
			newSession: launchResult.sessionName
		});

	} catch (error) {
		console.error('❌ Failed to bring agent back:', error);
		return json({ error: 'Failed to bring agent back' }, { status: 500 });
	}
}