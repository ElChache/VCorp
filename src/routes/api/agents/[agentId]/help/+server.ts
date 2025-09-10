import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents, projects } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/agents/[agentId]/help - Comprehensive agent help index
export async function GET({ params, url }) {
	try {
		const agentId = params.agentId;
		const baseUrl = `${url.protocol}//${url.host}`;

		// Get agent information
		const [agent] = await db
			.select({
				id: agents.id,
				roleType: agents.roleType,
				squadId: agents.squadId,
				projectId: agents.projectId
			})
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);

		if (!agent) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		// Get project information
		const [project] = await db
			.select({
				id: projects.id,
				name: projects.name,
				description: projects.description
			})
			.from(projects)
			.where(eq(projects.id, agent.projectId))
			.limit(1);

		console.log(`📚 Generating help index for agent ${agentId}`);

		// Build comprehensive help index
		const helpIndex = {
			agent: {
				id: agentId,
				roleType: agent.roleType,
				squadId: agent.squadId,
				project: project?.name || 'Unknown Project'
			},
			resources: {
				prompts: {
					description: "Get all your role-specific prompts, instructions, and guidelines",
					endpoint: `${baseUrl}/api/agents/${agentId}/prompts`,
					usage: "Your complete instruction set - read this first to understand your role and responsibilities"
				},
				team_discovery: {
					description: "Discover all agents in your project, their roles, and how to communicate",
					endpoint: `${baseUrl}/api/agents?projectId=${agent.projectId}`,
					usage: "Find other team members, see who's working on what, and coordinate with them"
				},
				project_info: {
					description: "Get project details, objectives, and technical specifications", 
					endpoint: `${baseUrl}/api/projects/${agent.projectId}`,
					usage: "Understand the overall project goals and context for your work"
				},
				channels: {
					description: "List all communication channels and how to post messages",
					endpoint: `${baseUrl}/api/channels?projectId=${agent.projectId}`,
					usage: "See available channels for different types of communication (general, announcements, etc.)"
				},
				messages_all: {
					description: "View all project messages and communications",
					endpoint: `${baseUrl}/api/messages/all?projectId=${agent.projectId}`,
					usage: "Stay updated on all project communications and decisions"
				},
				status_report: {
					description: "Report your current status and activities",
					endpoint: `${baseUrl}/api/agents/${agentId}/status`,
					usage: "Let the system know what you're working on and your current status"
				},
				current_phase: {
					description: "Get your currently assigned active phase with requirements and expected outputs",
					endpoint: `${baseUrl}/api/roles/${agent.roleType}/current-phase?projectId=${agent.projectId}`,
					usage: "Check what phase you're currently working on, what inputs you need, and what outputs are expected"
				}
			},
			quick_start: {
				"1_read_prompts": "Start by reading your prompts to understand your role and responsibilities",
				"2_check_current_phase": "Check if you have an active phase assigned to work on",
				"3_discover_team": "Use team discovery to see who you're working with",
				"4_check_channels": "See what communication channels are available",
				"5_review_messages": "Catch up on recent project communications",
				"6_report_status": "Let the team know you're active and ready to work"
			},
			important_notes: {
				environment_variables: "🔧 CRITICAL: Your identity is available in environment variables:",
				agent_id_env: `$AGENT_ID = "${agentId}" - use this variable in all API calls and file naming`,
				role_env: `$AGENT_ROLE = "${agent.roleType}" - use this variable for role-specific API calls`,
				agent_id: `Your agent ID is '${agentId}' - use this in screenshots and file naming`,
				role_type: `Your role is '${agent.roleType}' - focus on tasks appropriate for this role`,
				squad: agent.squadId ? `You're part of the '${agent.squadId}' squad` : "You're not assigned to a specific squad",
				visual_testing: "If you're in the Visual Testers squad, remember to take screenshots to verify your work",
				communication: "Use channels for team communication, DMs for private messages",
				api_usage: "In all API examples that show 'your_agent_id' or 'your_role', use $AGENT_ID and $AGENT_ROLE instead"
			}
		};

		return json({
			title: `Agent Help Center - ${agentId}`,
			description: "Everything you need to know about your role, team, and project",
			...helpIndex
		});

	} catch (error) {
		console.error('Failed to generate help index:', error);
		return json({ error: 'Failed to generate help index' }, { status: 500 });
	}
}