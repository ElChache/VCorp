import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents, roles, squads } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/team-members?projectId=123 - Get team structure for agent messaging
export async function GET({ url }) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		// Get all active agents in the project
		const allAgents = await db
			.select({
				id: agents.id,
				roleType: agents.roleType,
				squadId: agents.squadId,
				status: agents.status,
				roleId: agents.roleId,
			})
			.from(agents)
			.where(eq(agents.projectId, parseInt(projectId)));

		// Get roles for this project  
		const projectRoles = await db
			.select({
				id: roles.id,
				name: roles.name,
			})
			.from(roles)
			.where(eq(roles.projectId, parseInt(projectId)));

		// Get squads for this project
		const projectSquads = await db
			.select({
				id: squads.id,
				name: squads.name,
			})
			.from(squads)
			.where(eq(squads.projectId, parseInt(projectId)));

		// Group agents by role type
		const agentsByRole = {};
		projectRoles.forEach(role => {
			agentsByRole[role.name] = allAgents
				.filter(agent => agent.roleType === role.name)
				.map(agent => ({
					id: agent.id,
					status: agent.status
				}));
		});

		// Group agents by squad
		const agentsBySquad = {};
		projectSquads.forEach(squad => {
			agentsBySquad[squad.name] = allAgents
				.filter(agent => agent.squadId === squad.id)
				.map(agent => ({
					id: agent.id,
					roleType: agent.roleType,
					status: agent.status
				}));
		});

		// Format agents list for easy reference
		const agentsList = allAgents.map(agent => ({
			id: agent.id,
			roleType: agent.roleType,
			squadId: agent.squadId,
			status: agent.status
		}));

		// Add the special "human-director" agent as always available
		agentsList.unshift({
			id: 'human-director',
			roleType: 'Human Director',
			squadId: null,
			status: 'active'
		});

		return json({
			agents: agentsList,
			roles: Object.keys(agentsByRole),
			squads: Object.keys(agentsBySquad),
			agentsByRole,
			agentsBySquad,
			totalAgents: allAgents.length + 1, // Include human-director
			activeAgents: allAgents.filter(a => a.status === 'active').length + 1, // Human-director is always active
			specialAgents: {
				'human-director': {
					id: 'human-director',
					roleType: 'Human Director',
					description: 'Send messages to the human project director for guidance, decisions, or reporting'
				}
			}
		});

	} catch (error) {
		console.error('Failed to load team members:', error);
		return json({ error: 'Failed to load team members' }, { status: 500 });
	}
}