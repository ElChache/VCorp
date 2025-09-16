import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents, roles } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/agents/permissions/phases - Get agents with phase creation permissions
export async function GET({ url }: RequestEvent) {
	try {
		const projectId = url.searchParams.get('projectId');
		
		if (!projectId) {
			return json({ 
				error: 'Missing required parameter: projectId must be provided'
			}, { status: 400 });
		}

		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Get all agents with canCreatePhases=true in the project
		const agentsWithPermissions = await db
			.select({
				agentId: agents.id,
				agentRoleType: agents.roleType,
				agentStatus: agents.status,
				canCreatePhases: agents.canCreatePhases,
				roleName: roles.name
			})
			.from(agents)
			.leftJoin(roles, eq(agents.roleId, roles.id))
			.where(and(
				eq(agents.projectId, parsedProjectId),
				eq(agents.canCreatePhases, true)
			))
			.orderBy(agents.roleType, agents.id);

		// Get count of agents with permissions by role
		const permissionsByRole = agentsWithPermissions.reduce((acc: Record<string, any[]>, agent) => {
			if (!acc[agent.agentRoleType]) {
				acc[agent.agentRoleType] = [];
			}
			acc[agent.agentRoleType].push({
				id: agent.agentId,
				status: agent.agentStatus,
				roleName: agent.roleName
			});
			return acc;
		}, {});

		// Get all roles that have canCreatePhases=true (from role templates)
		const rolesWithPermissions = await db
			.select({
				roleType: roles.name,
				canCreatePhases: roles.canCreatePhases
			})
			.from(roles)
			.where(and(
				eq(roles.projectId, parsedProjectId),
				eq(roles.canCreatePhases, true)
			))
			.orderBy(roles.name);

		return json({
			projectId: parsedProjectId,
			agentsWithPermissions: agentsWithPermissions.map(agent => ({
				id: agent.agentId,
				roleType: agent.agentRoleType,
				roleName: agent.roleName,
				status: agent.agentStatus,
				canCreatePhases: agent.canCreatePhases
			})),
			permissionsByRole,
			rolesWithPermissions,
			summary: {
				totalAgentsWithPermissions: agentsWithPermissions.length,
				rolesWithPermissions: rolesWithPermissions.length,
				activeAgentsWithPermissions: agentsWithPermissions.filter(a => a.agentStatus === 'active').length
			}
		});

	} catch (error) {
		console.error('Failed to fetch agents with phase permissions:', error);
		return json({ 
			error: 'Internal server error occurred while fetching agent permissions'
		}, { status: 500 });
	}
}