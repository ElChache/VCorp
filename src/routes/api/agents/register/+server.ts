import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents, roles, rolePromptCompositions, prompts } from '$lib/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { generatePremadeContent } from '$lib/premade-prompts';

export async function POST({ request }) {
	console.log(`🔥 REGISTER ENDPOINT CALLED!`);
	try {
		const { agentId } = await request.json();
		console.log(`🤖 POST /api/agents/register - agentId: ${agentId}`);

		if (!agentId) {
			console.log('❌ No agentId provided');
			return json({ error: 'Agent ID is required' }, { status: 400 });
		}

		// Find the agent in database
		console.log(`🔍 Looking for agent ${agentId}...`);
		const [agent] = await db
			.select()
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);

		if (!agent) {
			console.log(`❌ Agent ${agentId} not found`);
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		console.log(`✅ Found agent: ${agent.id}, role: ${agent.roleType}, status: ${agent.status}`);

		// Find matching role in project for prompt
		const [projectRole] = await db
			.select()
			.from(roles)
			.where(and(
				eq(roles.projectId, agent.projectId),
				eq(roles.name, agent.roleType)
			))
			.limit(1);

		let combinedPrompt = `You are a ${agent.roleType} agent.`;
		
		if (projectRole) {
			// Use the final prompt endpoint for consistency
			try {
				const finalPromptResponse = await fetch(`http://localhost:5173/api/roles/${projectRole.id}/final-prompt`);
				if (finalPromptResponse.ok) {
					const finalPromptData = await finalPromptResponse.json();
					combinedPrompt = finalPromptData.finalPrompt;
				} else {
					console.error('Failed to fetch final prompt, falling back to role type');
					combinedPrompt = `You are a ${agent.roleType} agent.`;
				}
			} catch (error) {
				console.error('Error fetching final prompt:', error);
				combinedPrompt = `You are a ${agent.roleType} agent.`;
			}
		}

		// Update agent status to active
		console.log(`🔄 Updating agent ${agentId} status to active...`);
		const [updatedAgent] = await db
			.update(agents)
			.set({ 
				status: 'active',
				roleId: projectRole?.id || null,
				lastHeartbeat: new Date()
			})
			.where(eq(agents.id, agentId))
			.returning();

		// Return clear response for the AI agent
		return json({
			success: true,
			message: `Your assigned role is ${agent.roleType}.`,
			agentId: updatedAgent.id,
			role: agent.roleType,
			model: updatedAgent.model,
			prompt: combinedPrompt,
			tmuxSession: updatedAgent.tmuxSession,
			worktreePath: updatedAgent.worktreePath
		});

	} catch (error) {
		console.error('Failed to register agent:', error);
		return json({ error: 'Failed to register agent' }, { status: 500 });
	}
}