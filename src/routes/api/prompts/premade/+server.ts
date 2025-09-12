import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { roles, channels, channelRoleAssignments, projects } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/prompts/premade?premade=channel-instructions&roleType=Backend Developer&projectId=123
export async function GET({ url }) {
	try {
		const premade = url.searchParams.get('premade');
		const roleType = url.searchParams.get('roleType');
		const projectId = url.searchParams.get('projectId');

		if (!premade || !roleType || !projectId) {
			return json({ 
				error: 'premade, roleType, and projectId parameters are required' 
			}, { status: 400 });
		}

		// Find the role in the project
		const [role] = await db
			.select()
			.from(roles)
			.where(and(
				eq(roles.projectId, parseInt(projectId)),
				eq(roles.name, roleType)
			))
			.limit(1);

		if (!role) {
			return json({ error: 'Role not found in project' }, { status: 404 });
		}

		let promptContent = '';

		switch (premade) {
			case 'channel-instructions':
				promptContent = await generateChannelInstructions(parseInt(projectId), role.id, roleType);
				break;
			case 'ticketing-system':
				promptContent = await generateTicketingInstructions(roleType);
				break;
			default:
				return json({ error: `Unknown premade prompt: ${premade}` }, { status: 400 });
		}

		return json({
			premade,
			roleType,
			content: promptContent,
			generatedAt: new Date().toISOString()
		});

	} catch (error) {
		console.error('Failed to generate premade prompt:', error);
		return json({ error: 'Failed to generate premade prompt' }, { status: 500 });
	}
}

/**
 * Generate channel instructions for a specific role
 */
async function generateChannelInstructions(projectId: number, roleId: number, roleType: string): Promise<string> {
	// Get channels accessible to this role:
	// 1. Main channels (public - ignore assignments)
	// 2. Regular channels assigned to this role
	const mainChannels = await db
		.select({
			id: channels.id,
			name: channels.name,
			description: channels.description,
			promptForAgents: channels.promptForAgents,
		})
		.from(channels)
		.where(and(
			eq(channels.projectId, projectId),
			eq(channels.isMainChannel, true)
		));

	const assignedChannels = await db
		.select({
			id: channels.id,
			name: channels.name,
			description: channels.description,
			promptForAgents: channels.promptForAgents,
		})
		.from(channelRoleAssignments)
		.leftJoin(channels, eq(channelRoleAssignments.channelId, channels.id))
		.where(eq(channelRoleAssignments.roleId, roleId));

	const allChannels = [...mainChannels, ...assignedChannels];

	if (allChannels.length === 0) {
		return `# Channel Access

No channels are currently available to the ${roleType} role. Contact your project administrator to request access to relevant channels.`;
	}

	let content = `# Channel Access

## Available Channels

`;

	for (const channel of allChannels) {
		const isPublic = mainChannels.some(mc => mc.id === channel.id);
		content += `### #${channel.name}${isPublic ? ' - This is a public channel' : ''}

${channel.description || `The ${channel.name} channel for team coordination.`}

${channel.promptForAgents || `Use this channel for discussions related to ${channel.name.toLowerCase()}.`}

**Quick Actions:**
- Post messages: \`POST /api/messages\` with channelId: ${channel.id}
- Read messages: \`GET /api/messages?channelId=${channel.id}&projectId=YOUR_PROJECT_ID\`

---

`;
	}

	content += `## Communication Guidelines
- Use the most appropriate channel for your message topic
- Keep discussions focused and relevant to the channel purpose
- Create tickets in channels for trackable tasks using \`type: "ticket"\`
- Tag relevant team members when coordination is needed
- Escalate blockers promptly to maintain project momentum`;

	return content;
}

/**
 * Generate ticketing system instructions
 */
async function generateTicketingInstructions(roleType: string): Promise<string> {
	return `# Ticketing System

## Overview
The ticketing system helps track tasks, bugs, and feature requests. Tickets can be created in any channel and assigned to roles for completion.

**Key Point**: You can work on multiple tickets simultaneously - one waiting for review while actively working on another.

## Ticket States
- **open** - Created, waiting for assignment
- **in_progress** - Agent claimed and working on it  
- **blocked** - Waiting for dependency or clarification
- **ready_for_review** - Work complete, needs review
- **reviewing** - Under review by lead/peer
- **review_passed** - Review approved, ready for completion
- **needs_attention** - Review found issues, needs fixes
- **resolved** - Work completed successfully
- **closed** - Ticket archived

## Creating Tickets
**API**: \`POST /api/content\`
\`\`\`json
{
  "type": "ticket",
  "title": "Fix authentication bug",
  "body": "Users cannot log in with email addresses containing + symbols",
  "priority": "high",
  "status": "open",
  "assignedToRoleType": "backend_developer"
}
\`\`\`

## Claiming Tickets
**API**: \`PUT /api/content/{id}\`
\`\`\`json
{
  "status": "in_progress",
  "claimedByAgent": "your_agent_id"
}
\`\`\`

## Updating Status
**API**: \`PUT /api/content/{id}\`
\`\`\`json
{
  "status": "ready_for_review"
}
\`\`\`

## Ticket Priorities (ALWAYS work highest priority first)
- **critical** - System down, blocks all work (drop everything)
- **high** - Major feature broken, affects users (urgent)  
- **medium** - Standard tasks, normal workflow (default)
- **low** - Nice to have, future improvement (when time permits)

**Priority Selection Strategy:**
1. Always complete critical tickets immediately
2. Work high priority before medium/low
3. Within same priority, work oldest tickets first
4. If multiple agents on same role, coordinate to avoid conflicts

## Quick Actions  
- **View open tickets by priority**: \`GET /api/content?type=ticket&status=open&priority=critical\`
- **My claimed tickets**: \`GET /api/content?type=ticket&claimedByAgent=your_agent_id\`
- **Role tickets (highest priority first)**: \`GET /api/content?type=ticket&assignedToRoleType=${roleType.toLowerCase().replace(' ', '_')}&status=open\`
- **Create reading assignment for review**: \`POST /api/reading-assignments\` with Lead Developer as target`;
}