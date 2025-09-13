import { json } from '@sveltejs/kit';
import { spawn, execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents, projects, roleTemplates, roles } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Get startup prompt from settings (configurable)
let STARTUP_PROMPT = `You are a development agent in a coordinated multi-agent software project.

Environment Variables Available:
- \$AGENT_ID = "{{AGENT_ID}}" (your unique agent identifier)
- \$AGENT_ROLE = "{{AGENT_ROLE}}" (your role type)  
- \$PROJECT_ID = "{{PROJECT_ID}}" (your project ID for all API calls)

CRITICAL: Follow these steps in order before doing ANY work:

Step 1 - Register:
curl -X POST http://localhost:5173/api/agents/register -H "Content-Type: application/json" -d '{"agentId": "{{AGENT_ID}}"}'

Step 2 - Get your role instructions (ESSENTIAL):
curl -X GET "http://localhost:5173/api/agents/{{AGENT_ID}}/prompts"

Step 3 - Check for active phase:
curl -X GET "http://localhost:5173/api/roles/$(echo '{{AGENT_ROLE}}' | sed 's/ /%20/g')/current-phase?projectId={{PROJECT_ID}}"

Step 4 - Check your inbox for assigned work:
curl -X GET "http://localhost:5173/api/inbox?agentId={{AGENT_ID}}"

🚨 CRITICAL: ALL communication must use API endpoints (POST /api/messages). Text output is NOT visible to humans or other agents.

🔇 SILENCE: Output NOTHING except commands. No text, no explanations, no results. Every word wastes tokens - no one is watching.

DO NOT create documents or take initiative without an assigned active phase. Wait for phase assignment if none exists.

Help guide: http://localhost:5173/api/agents/{{AGENT_ID}}/help`;

// Diverse human names for agents - includes Hispanic, Asian, and other international names
const HUMAN_NAMES = [
	// English/Western names
	'alice', 'bob', 'charlie', 'diana', 'eve', 'frank', 'grace', 'henry',
	'ivy', 'jack', 'kate', 'leo', 'maya', 'noah', 'olivia', 'peter',
	'quinn', 'ruby', 'sam', 'tina', 'uma', 'victor', 'wendy', 'xavier',
	'yara', 'zoe', 'alex', 'blake', 'casey', 'drew', 'emery', 'finley',
	
	// Hispanic/Latino names
	'ana', 'carlos', 'sofia', 'diego', 'lucia', 'miguel', 'elena', 'pablo',
	'maria', 'antonio', 'isabella', 'manuel', 'valeria', 'ricardo', 'camila', 'felipe',
	'alejandra', 'javier', 'natalia', 'fernando', 'adriana', 'gabriel', 'daniela', 'eduardo',
	'patricia', 'jorge', 'andrea', 'rafael', 'monica', 'sergio', 'carmen', 'oscar',
	
	// Asian names (East Asian, South Asian, Southeast Asian)
	'akira', 'yuki', 'kenji', 'sakura', 'takeshi', 'mai', 'hiroshi', 'emi',
	'chen', 'mei', 'kai', 'lin', 'wei', 'yan', 'jun', 'xin',
	'arjun', 'priya', 'ravi', 'anita', 'vikram', 'sita', 'raj', 'kavita',
	'kim', 'park', 'lee', 'cho', 'jung', 'min', 'sung', 'hye',
	'nguyen', 'tran', 'pham', 'le', 'hoang', 'vu', 'dao', 'bui',
	
	// Middle Eastern/Arabic names
	'omar', 'fatima', 'hassan', 'aisha', 'ahmed', 'zara', 'ali', 'layla',
	'nadia', 'samir', 'dina', 'ameer', 'sara', 'tariq', 'rana', 'khalid',
	
	// African names
	'kemi', 'taiwo', 'ade', 'ngozi', 'kwame', 'ama', 'kofi', 'akosua',
	'amara', 'zuri', 'jengo', 'nia', 'kesi', 'tau', 'ife', 'asante',
	
	// Additional international names
	'raja', 'noor', 'soren', 'astrid', 'lars', 'freya', 'enzo', 'giulia',
	'pierre', 'marie', 'hans', 'greta', 'ivan', 'anya', 'dmitri', 'nina'
];

function generateAgentId(rolePrefix) {
	const humanName = HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)];
	const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit number (1000-9999)
	return `${rolePrefix}_${humanName}_${randomSuffix}`;
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
		
		// Generate agent ID with diverse name and 4-digit suffix for uniqueness
		let agentId;
		let attempts = 0;
		const maxAttempts = 50;
		
		do {
			agentId = generateAgentId(rolePrefix);
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
				isItAdministrator: projectRole.isItAdministrator || false,
				isAssistantToHumanDirector: projectRole.isAssistantToHumanDirector || false,
				canCreatePhases: projectRole.canCreatePhases || false,
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
				AGENT_ROLE: roleType,
				PROJECT_ID: projectId.toString()
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
		const startupMessage = STARTUP_PROMPT.replace(/\{\{AGENT_ID\}\}/g, agentId).replace(/\{\{AGENT_ROLE\}\}/g, roleType).replace(/\{\{PROJECT_ID\}\}/g, projectId.toString());
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

		// Notify IT Administrator about new agent (brief alert)
		try {
			const itNotification = {
				projectId: parseInt(projectId),
				channelId: null, // DM
				body: `New agent launched: ${agentId} (${roleType}). Please welcome and provide brief platform orientation if needed.`,
				authorAgentId: 'system',
				assignTo: [{ type: 'role', target: 'it-administrator' }]
			};
			
			await fetch('http://localhost:5174/api/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(itNotification)
			});
		} catch (error) {
			console.log('⚠️ Failed to notify IT Administrator:', error);
			// Don't fail the launch if notification fails
		}

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