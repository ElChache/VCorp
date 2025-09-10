import { db } from '$lib/db/index';
import { channels, channelRoleAssignments, roles } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Type definition for premade prompt handlers
type PremadeHandler = (context: PremadeContext) => Promise<string>;

interface PremadeContext {
	projectId: number;
	roleId: number;
	roleName: string;
	channelName?: string; // For channel-specific instructions
}

// Map of premade identifiers to their handler functions
const premadeHandlers: Record<string, PremadeHandler> = {
	'channel-instructions': generateChannelInstructions,
	'channel-specific-instructions': generateChannelSpecificInstructions,
	'ticketing-system': generateTicketingInstructions,
};

/**
 * Main function to handle premade prompt generation
 */
export async function generatePremadeContent(
	premadeId: string, 
	context: PremadeContext
): Promise<string> {
	const handler = premadeHandlers[premadeId];
	if (!handler) {
		throw new Error(`Unknown premade prompt: ${premadeId}`);
	}
	return await handler(context);
}

/**
 * Handler for 'channel-instructions' premade prompt
 * Generates dynamic instructions about available channels for a role
 */
async function generateChannelInstructions(context: PremadeContext): Promise<string> {
	const { projectId, roleId, roleName } = context;

	// Get channels accessible to this role:
	// 1. Main channels (public - ignore assignments)
	// 2. Regular channels assigned to this role
	const mainChannels = await db
		.select({
			id: channels.id,
			name: channels.name,
			description: channels.description,
			promptForAgents: channels.promptForAgents,
			isMainChannel: channels.isMainChannel,
		})
		.from(channels)
		.where(and(
			eq(channels.projectId, projectId),
			eq(channels.isMainChannel, true)
		));

	const assignedRegularChannels = await db
		.select({
			id: channels.id,
			name: channels.name,
			description: channels.description,
			promptForAgents: channels.promptForAgents,
			isMainChannel: channels.isMainChannel,
		})
		.from(channelRoleAssignments)
		.innerJoin(channels, eq(channelRoleAssignments.channelId, channels.id))
		.where(and(
			eq(channelRoleAssignments.roleId, roleId),
			eq(channels.isMainChannel, false)
		)); // Only non-main channels

	// Combine main channels and assigned regular channels
	const allAccessibleChannels = [...mainChannels, ...assignedRegularChannels];

	if (allAccessibleChannels.length === 0) {
		return `# Channel Access

You currently have no channel assignments.`;
	}

	// Generate the instructions
	let instructions = `# Channel Access

## Available Channels

`;

	// Add each channel with its specific information
	for (const channel of allAccessibleChannels) {
		instructions += `### #${channel.name}`;
		if (channel.isMainChannel) {
			instructions += ` - This is a public channel`;
		}
		instructions += `\n\n`;

		if (channel.promptForAgents) {
			instructions += `${channel.promptForAgents}\n\n`;
		}

		instructions += `**How to send messages**: Use the API endpoint \`POST /api/channels/name/${channel.name}/messages\` with your message content.\n\n`;
		
		instructions += `---\n\n`;
	}

	return instructions;
}

/**
 * Handler for 'ticketing-system' premade prompt
 * Generates instructions for the ticket management system
 */
async function generateTicketingInstructions(context: PremadeContext): Promise<string> {
	const { roleName } = context;

	return `# Ticket Management System

## Overview
Use tickets to track work items, bugs, and feature requests. Tickets flow through role assignment to agent pickup and completion.

## Ticket Lifecycle
1. **open** - Created, waiting for role assignment
2. **in_progress** - Agent claimed and working on it
3. **blocked** - Waiting for dependency or clarification
4. **ready_for_review** - Work complete, needs review
5. **reviewing** - Under review by lead/peer
6. **review_passed** - Review approved, ready for completion
7. **needs_attention** - Review found issues, needs fixes
8. **resolved** - Work completed successfully
9. **closed** - Ticket archived

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

## Priorities
- **critical** - System down, blocks all work
- **high** - Major feature broken, affects users
- **medium** - Minor issues, can wait
- **low** - Nice to have, future improvement

## Quick Actions
- **View tickets**: \`GET /api/content?type=ticket&status=open\`
- **My tickets**: \`GET /api/content?type=ticket&claimedByAgent=your_agent_id\`
- **Role tickets**: \`GET /api/content?type=ticket&assignedToRoleType=${roleName.toLowerCase().replace(' ', '_')}\``;
}

/**
 * Handler for 'channel-specific-instructions' premade prompt
 * Generates dynamic instructions for a specific channel showing roles and usage
 */
async function generateChannelSpecificInstructions(context: PremadeContext): Promise<string> {
	const { projectId, channelName } = context;
	
	if (!channelName) {
		throw new Error('Channel name is required for channel-specific instructions');
	}

	// Get the specific channel information
	const [channel] = await db
		.select({
			id: channels.id,
			name: channels.name,
			description: channels.description,
			promptForAgents: channels.promptForAgents,
			isMainChannel: channels.isMainChannel,
		})
		.from(channels)
		.where(and(
			eq(channels.projectId, projectId),
			eq(channels.name, channelName)
		))
		.limit(1);

	if (!channel) {
		return `# ${channelName} Channel Instructions\n\nChannel not found.`;
	}

	// Get roles assigned to this channel
	const assignedRoles = await db
		.select({
			roleName: roles.name,
		})
		.from(channelRoleAssignments)
		.leftJoin(roles, eq(channelRoleAssignments.roleId, roles.id))
		.where(eq(channelRoleAssignments.channelId, channel.id));

	const rolesList = assignedRoles.length > 0 
		? assignedRoles.map(r => r.roleName).join(', ')
		: 'All roles (public channel)';

	return `# ${channel.name} Channel Instructions

## Channel Purpose
${channel.description || `The ${channel.name} channel for team coordination.`}

## Access & Permissions
${channel.isMainChannel 
	? 'This is a **public channel** - accessible to all team members.'
	: `This channel is restricted to: **${rolesList}**`
}

## Usage Guidelines
${channel.promptForAgents || `Use this channel for discussions related to ${channel.name.toLowerCase()}.`}

## Quick Actions
- Post messages: \`POST /api/channels/${channel.id}/messages\`
- Read messages: \`GET /api/channels/${channel.id}/messages\`
- Create tickets: Use \`type: "ticket"\` in message body for trackable tasks

## Communication Tips
- Keep discussions focused on ${channel.name.toLowerCase()} topics
- Use clear, descriptive titles for important messages
- Tag relevant team members when coordination is needed
- Escalate blockers promptly to maintain project momentum`;
}


// Export available premade identifiers for validation
export const availablePremades = Object.keys(premadeHandlers);