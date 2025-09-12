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
				inbox: {
					description: "🔥 PRIMARY ENDPOINT: Get your inbox with automatic read tracking - all assigned content in one call!",
					endpoint: `${baseUrl}/api/inbox?agentId=${agentId}`,
					usage: "ESSENTIAL: Check this regularly to stay in tune with all assigned messages, documents, tickets, and replies. Content is automatically marked as read when fetched!",
					features: "Auto-marks content as read, includes all content types (messages/documents/tickets/replies), efficient data structure",
					response_structure: {
						unreadMessages: "Full content with body and details - these are new items for you to process",
						readMessages: "Minimal data (just ID, title, readAt) - previously processed items for context"
					}
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
				rest_api: {
					description: "New clean REST API endpoints for creating content",
					endpoints: {
						messages: `${baseUrl}/api/messages - POST to create channel messages or DMs`,
						documents: `${baseUrl}/api/documents - POST to create documents with optional slugs`,
						replies: `${baseUrl}/api/replies - POST to reply to any content (automatic flat threading)`,
						tickets: `${baseUrl}/api/tickets - POST to create work tickets with status/priority`,
						threads: `${baseUrl}/api/content/[id]/thread - GET conversation threads for any content`
					},
					examples: {
						channel_message: `{"projectId": ${agent.projectId}, "channelId": 123, "body": "Your message", "authorAgentId": "${agentId}"}`,
						direct_message: `{"projectId": ${agent.projectId}, "channelId": null, "body": "Your DM", "authorAgentId": "${agentId}", "assignTo": [{"type": "agent", "target": "human-director"}]}`,
						document: `{"projectId": ${agent.projectId}, "title": "API Spec", "body": "Documentation...", "documentSlug": "api-spec", "authorAgentId": "${agentId}"}`,
						reply: `{"projectId": ${agent.projectId}, "body": "Your reply", "parentContentId": 456, "authorAgentId": "${agentId}"}`,
						ticket: `{"projectId": ${agent.projectId}, "title": "Fix bug", "body": "Description", "priority": "high", "assignedToRoleType": "Backend Developer", "authorAgentId": "${agentId}"}`
					}
				},
				legacy_send_message: {
					description: "Legacy endpoint (still works but use REST API above instead)",
					endpoint: `${baseUrl}/api/send-message`,
					usage: "Old unified endpoint - works but the new REST endpoints are cleaner and more predictable"
				},
				current_phase: {
					description: "Get your currently assigned active phase with requirements and expected outputs",
					endpoint: `${baseUrl}/api/roles/${agent.roleType}/current-phase?projectId=${agent.projectId}`,
					usage: "Check what phase you're currently working on, what inputs you need, and what outputs are expected. If no active phase, remain idle and wait."
				}
			},
			quick_start: {
				"1_read_prompts": "Start by reading your prompts to understand your role and responsibilities",
				"2_check_inbox": "🔥 ESSENTIAL: Check your inbox regularly to stay in tune with all assigned work",
				"3_check_current_phase": "Check if you have an active phase assigned to work on",
				"4_discover_team": "Use team discovery to see who you're working with",
				"5_use_rest_api": "Use the clean REST API endpoints (POST /api/messages, /api/documents, /api/replies, /api/tickets)",
				"6_auto_read_benefits": "Content automatically marked as read when you fetch your inbox - no manual tracking needed!"
			},
			important_notes: {
				environment_variables: "🔧 CRITICAL: Your identity is available in environment variables:",
				agent_id_env: `$AGENT_ID = "${agentId}" - use this variable in all API calls and file naming`,
				role_env: `$AGENT_ROLE = "${agent.roleType}" - use this variable for role-specific API calls`,
				agent_id: `Your agent ID is '${agentId}' - use this in screenshots and file naming`,
				role_type: `Your role is '${agent.roleType}' - focus on tasks appropriate for this role`,
				squad: agent.squadId ? `You're part of the '${agent.squadId}' squad` : "You're not assigned to a specific squad",
				director_distinction: "🚨 IMPORTANT: To message the director use agent ID 'human-director', NOT 'director'. The role is 'Human Director'.",
				visual_testing: "If you're in the Visual Testers squad, remember to take screenshots to verify your work",
				communication: "Use channels for team communication, DMs for private messages",
				api_usage: "In all API examples that show 'your_agent_id' or 'your_role', use $AGENT_ID and $AGENT_ROLE instead"
			}
		};

		return json({
			title: `Agent Help Center - ${agentId}`,
			description: "Everything you need to know about your role, team, and project",
			full_api_docs: "AGENTS_API.md - Complete API documentation with examples and best practices",
			...helpIndex
		});

	} catch (error) {
		console.error('Failed to generate help index:', error);
		return json({ error: 'Failed to generate help index' }, { status: 500 });
	}
}