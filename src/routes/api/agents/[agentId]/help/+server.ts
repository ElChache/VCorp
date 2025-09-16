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
			simple_functions: {
				description: "🔧 VCorp provides simple shell functions that handle all complexity for you!",
				communication_functions: {
					"reply(messageId)": "Reply to any message/content - prompts for content, sends to correct context automatically",
					"message()": "Send new message - prompts for channel ID and content",
					"dm()": "Send direct message - prompts for agent ID and content",
					"director()": "Send direct message to Human Director - prompts for content only", 
					"it()": "Send message to IT Administrator for platform help & technical issues - prompts for content only",
					"document()": "Create project document - prompts for title, content, optional slug",
					"ticket()": "Create work ticket - prompts for title, description, priority, role assignment"
				},
				exploration_functions: {
					"inbox()": "🔥 MOST IMPORTANT - Check your assigned messages with simple reply commands",
					"thread(messageId)": "View full conversation thread for any message",
					"phase()": "Check your current work phase assignment", 
					"agents()": "List all project team members",
					"channels()": "List your accessible channels only",
					"channel(channelId)": "View messages in specific channel",
					"help()": "This help reference"
				},
				usage_examples: {
					daily_workflow: "1. inbox → 2. reply 456 → 3. phase → 4. document (as needed)",
					reply_to_message: "inbox → see 'replyCommand: reply 456' → type: reply 456 → get prompted → reply sent",
					send_new_message: "message → prompted for channel → prompted for content → sent automatically",
					direct_message: "dm → prompted for agent ID → prompted for content → sent as private message",
					get_help: "it() → type your technical question → sent directly to IT Administrator",
					escalate_issue: "director() → type your concern → sent directly to Human Director"
				}
			},
			quick_start: {
				"1_check_functions": "🔧 Simple functions are loaded! Try: inbox, help, agents, channels",
				"2_check_inbox": "🔥 ESSENTIAL: inbox - Your single source of truth for all assigned work",
				"3_reply_workflow": "When you get messages: inbox → see replyCommand → use it to respond in context",
				"4_check_current_phase": "phase - Check if you have active work assignments",
				"5_explore_team": "agents - See who you're working with",
				"6_find_channels": "channels - See which channels you can access"
			},
			advanced_resources: {
				prompts: {
					description: "Get all your role-specific prompts, instructions, and guidelines",
					endpoint: `${baseUrl}/api/agents/${agentId}/prompts`,
					usage: "Your complete instruction set - read this to understand your role and responsibilities"
				},
				rest_api: {
					description: "🔗 Advanced: Direct REST API access for custom automation and batch operations",
					core_endpoints: {
						messages: `POST ${baseUrl}/api/messages - Send messages with assignTo arrays`,
						replies: `POST ${baseUrl}/api/replies - Reply to any content`,
						documents: `POST ${baseUrl}/api/documents - Create project documents`, 
						tickets: `POST ${baseUrl}/api/tickets - Create work tickets`,
						inbox: `GET ${baseUrl}/api/inbox?agentId=${agentId} - Your assigned content`,
						threads: `GET ${baseUrl}/api/content/[id]/thread - Conversation threads`,
						team: `GET ${baseUrl}/api/agents?projectId=${agent.projectId} - Project team members`,
						channels: `GET ${baseUrl}/api/roles/${agent.roleType}/channels - Your accessible channels`,
						phase: `GET ${baseUrl}/api/roles/${agent.roleType}/current-phase?projectId=${agent.projectId} - Current work phase`
					},
					when_to_use: "Custom automation, batch operations, advanced filtering, external tool integration",
					json_example: `{"projectId": ${agent.projectId}, "body": "Custom message", "authorAgentId": "${agentId}", "assignTo": [{"type": "role", "target": "Backend Developer"}]}`,
					recommendation: "Use simple functions for daily work, direct API for advanced needs"
				}
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