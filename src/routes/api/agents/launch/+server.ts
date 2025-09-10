import { json } from '@sveltejs/kit';
import { spawn, execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents, projects, roleTemplates, roles } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Get startup prompt from settings (configurable)
let STARTUP_PROMPT = `You are a development agent in a coordinated multi-agent software project! 🚀

🔧 **Environment Variables Available:**
- \$AGENT_ID = "{{AGENT_ID}}" (your unique agent identifier)
- \$AGENT_ROLE = "{{AGENT_ROLE}}" (your role type)

Your first task is to register and get your role instructions by calling this endpoint:
curl -X POST http://localhost:5173/api/agents/register -H "Content-Type: application/json" -d '{"agentId": "{{AGENT_ID}}"}'

This will:
1. Activate your agent status  
2. Give you your complete role-specific prompt and responsibilities
3. Provide your workspace and project context

Once registered, follow the role instructions you receive exactly - they contain everything you need to begin productive work on the project.

📚 Need help? Your complete guide: http://localhost:5173/api/agents/{{AGENT_ID}}/help

Good luck, agent! The team is counting on you. 💪`;

// Human names for agents - mix of common names that work well for AI agents
const HUMAN_NAMES = [
	'alice', 'bob', 'charlie', 'diana', 'eve', 'frank', 'grace', 'henry',
	'ivy', 'jack', 'kate', 'leo', 'maya', 'noah', 'olivia', 'peter',
	'quinn', 'ruby', 'sam', 'tina', 'uma', 'victor', 'wendy', 'xavier',
	'yara', 'zoe', 'alex', 'blake', 'casey', 'drew', 'emery', 'finley',
	'gray', 'harper', 'indigo', 'jordan', 'kai', 'lane', 'morgan', 'nova',
	'ocean', 'phoenix', 'river', 'sage', 'taylor', 'rain', 'sky', 'west'
];

function getRandomHumanName() {
	return HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)];
}

export async function POST({ request }) {
	try {
		const { roleType, model = 'sonnet', projectId } = await request.json();
		console.log(`🚀 POST /api/agents/launch - roleType: ${roleType}, model: ${model}, projectId: ${projectId}`);

		if (!roleType || !projectId) {
			console.log('❌ Missing required fields');
			return json({ error: 'Role type and Project ID are required' }, { status: 400 });
		}

		// Get role template prefix for agent ID generation
		console.log(`🔍 Looking up role template for: ${roleType}`);
		const [roleTemplate] = await db
			.select()
			.from(roleTemplates)
			.where(eq(roleTemplates.name, roleType))
			.limit(1);

		const rolePrefix = roleTemplate?.prefix || roleType.toLowerCase().replace(/[^a-z]/g, '').substring(0,2);
		console.log(`📝 Using prefix: ${rolePrefix} for role: ${roleType}`);
		
		// Generate agent ID with human name, ensuring uniqueness
		let agentId;
		let attempts = 0;
		const maxAttempts = 50;
		
		do {
			const humanName = getRandomHumanName();
			agentId = `${rolePrefix}_${humanName}`;
			attempts++;
			
			// Check if this agent ID already exists
			const [existingAgent] = await db
				.select()
				.from(agents)
				.where(eq(agents.id, agentId))
				.limit(1);
				
			if (!existingAgent) {
				console.log(`👤 Generated unique agent ID: ${agentId} (attempt ${attempts})`);
				break;
			}
			
			if (attempts >= maxAttempts) {
				console.log(`⚠️ Could not generate unique agent ID after ${maxAttempts} attempts, falling back to random`);
				const randomSuffix = Math.random().toString(36).substring(2, 6);
				agentId = `${rolePrefix}_${randomSuffix}`;
				break;
			}
		} while (true);

		// Get the project to fetch its path
		console.log(`🔍 Fetching project ${projectId} details...`);
		const [project] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, parseInt(projectId)))
			.limit(1);

		if (!project) {
			console.log(`❌ Project ${projectId} not found`);
			return json({ error: 'Project not found' }, { status: 404 });
		}

		console.log(`✅ Project found: ${project.name}, path: ${project.path || 'not specified'}`);
		const workingDirectory = project.path?.trim() || process.cwd();

		// Find the role in the project that matches the roleType
		console.log(`🔍 Finding role for type: ${roleType} in project ${projectId}`);
		const [projectRole] = await db
			.select()
			.from(roles)
			.where(and(
				eq(roles.projectId, parseInt(projectId)),
				eq(roles.name, roleType)
			))
			.limit(1);

		if (!projectRole) {
			console.log(`❌ Role ${roleType} not found in project ${projectId}`);
			return json({ error: `Role ${roleType} not found in project` }, { status: 404 });
		}

		console.log(`✅ Found role: ${projectRole.name} with ID: ${projectRole.id}`);

		// Create agent record in database with "launching" status
		console.log(`📝 Creating agent ${agentId} in database...`);
		const [newAgent] = await db
			.insert(agents)
			.values({
				id: agentId,
				projectId: parseInt(projectId),
				roleId: projectRole.id,  // Add the role ID
				roleType: roleType,
				model: model,
				status: 'launching',
				tmuxSession: `vcorp-${agentId}`,
				worktreePath: `${workingDirectory}/agent_workspaces/${agentId}/`,
			})
			.returning();

		console.log(`✅ Agent ${agentId} created in database`);	

		// Create tmux session name
		const sessionName = `vcorp-${agentId}`;
		console.log(`📺 Creating tmux session: ${sessionName}`);

		// Launch tmux session with Claude in the project directory
		console.log(`📂 Starting Claude in directory: ${workingDirectory}`);
		const tmuxProcess = spawn('tmux', [
			'new-session', '-d', '-s', sessionName, '-c', workingDirectory,
			'claude', `--model=${model}`, '--dangerously-skip-permissions'
		], {
			detached: true,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { 
				...process.env, 
				ENABLE_BACKGROUND_TASKS: '1',
				AGENT_ID: agentId,
				AGENT_ROLE: roleType
			}
		});

		console.log(`⏳ Waiting for tmux session to start...`);
		// Wait a moment for tmux to start
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Verify tmux session was created
		try {
			execSync(`tmux has-session -t "${sessionName}"`, { stdio: 'ignore' });
			console.log(`✅ Tmux session ${sessionName} created successfully`);
		} catch (error) {
			console.log(`❌ Failed to create tmux session ${sessionName}:`, error);
			return json({ error: 'Failed to create tmux session' }, { status: 500 });
		}

		// Send the startup prompt to the agent (two-stage approach like farm-config)
		const startupMessage = STARTUP_PROMPT.replace(/\{\{AGENT_ID\}\}/g, agentId).replace(/\{\{AGENT_ROLE\}\}/g, roleType);
		console.log(`💬 Sending startup prompt to agent (two-stage)...`);
		
		// Stage 1: Send the prompt text
		spawn('tmux', [
			'send-keys', '-t', sessionName,
			startupMessage
		], {
			detached: true,
			stdio: 'ignore'
		});

		// Stage 2: Send Enter key after a brief delay
		setTimeout(() => {
			spawn('tmux', [
				'send-keys', '-t', sessionName,
				'Enter'
			], {
				detached: true,
				stdio: 'ignore'
			});
		}, 500);

		console.log(`✅ Agent ${agentId} launched successfully`);
		return json({
			success: true,
			message: `Agent ${agentId} launched successfully`,
			agent: newAgent
		});

	} catch (error) {
		console.error('❌ Failed to launch agent:', error);
		return json({ error: 'Failed to launch agent' }, { status: 500 });
	}
}

// Endpoint to update startup prompt
export async function PUT({ request }) {
	try {
		const { startupPrompt } = await request.json();
		
		if (!startupPrompt?.trim()) {
			return json({ error: 'Startup prompt is required' }, { status: 400 });
		}

		STARTUP_PROMPT = startupPrompt.trim();
		
		return json({ success: true, message: 'Startup prompt updated' });
	} catch (error) {
		console.error('Failed to update startup prompt:', error);
		return json({ error: 'Failed to update startup prompt' }, { status: 500 });
	}
}

// Get current startup prompt
export async function GET() {
	return json({ startupPrompt: STARTUP_PROMPT });
}