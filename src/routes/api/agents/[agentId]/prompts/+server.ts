import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents, roles, prompts, rolePromptOrders, squads, squadPromptAssignments } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/agents/[agentId]/prompts - Get all prompts for this agent
export async function GET({ params }) {
	try {
		const agentId = params.agentId;

		// Get agent with role and squad information
		const [agent] = await db
			.select({
				id: agents.id,
				roleId: agents.roleId,
				squadId: agents.squadId,
				projectId: agents.projectId,
				roleType: agents.roleType
			})
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);

		if (!agent) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		console.log(`📋 Loading prompts for agent ${agentId} (role: ${agent.roleType}, squad: ${agent.squadId})`);

		// Get all prompts for this agent based on role prompt orders
		let agentPrompts = [];
		
		if (agent.roleId) {
			// Get role-specific prompts in order
			agentPrompts = await db
				.select({
					id: prompts.id,
					name: prompts.name,
					type: prompts.type,
					content: prompts.content,
					orderIndex: rolePromptOrders.orderIndex,
					source: rolePromptOrders.source,
					isGlobal: prompts.isGlobal
				})
				.from(rolePromptOrders)
				.innerJoin(prompts, eq(rolePromptOrders.promptId, prompts.id))
				.where(eq(rolePromptOrders.roleId, agent.roleId))
				.orderBy(rolePromptOrders.orderIndex);
		}

		// If no role-specific prompts, get basic prompts for the project
		if (agentPrompts.length === 0) {
			agentPrompts = await db
				.select({
					id: prompts.id,
					name: prompts.name,
					type: prompts.type,
					content: prompts.content,
					orderIndex: prompts.orderIndex,
					source: 'project',
					isGlobal: prompts.isGlobal
				})
				.from(prompts)
				.where(eq(prompts.projectId, agent.projectId))
				.orderBy(prompts.orderIndex);
		}

		console.log(`✅ Loaded ${agentPrompts.length} prompts for agent ${agentId}`);

		return json({
			agentId,
			roleType: agent.roleType,
			squadId: agent.squadId,
			prompts: agentPrompts,
			summary: {
				total: agentPrompts.length,
				bySource: agentPrompts.reduce((acc, p) => {
					acc[p.source] = (acc[p.source] || 0) + 1;
					return acc;
				}, {}),
				byType: agentPrompts.reduce((acc, p) => {
					acc[p.type] = (acc[p.type] || 0) + 1;
					return acc;
				}, {})
			}
		});

	} catch (error) {
		console.error('Failed to load agent prompts:', error);
		return json({ error: 'Failed to load agent prompts' }, { status: 500 });
	}
}