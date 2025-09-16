import { json } from '@sveltejs/kit';
import { spawn, execSync } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { db } from '$lib/db/index';
import { agents, projects, roleTemplates, roles } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolveAgentPermissions, validatePermissionRules, type AgentPermissions } from '$lib/templates/permissions';
import { generateStartupPrompt } from '$lib/utils/agentStartup';

// Get startup prompt from settings (configurable)
let STARTUP_PROMPT = `You are a development agent in a coordinated multi-agent software project.

Environment Variables Available:
- \$AGENT_ID = "{{AGENT_ID}}" (your unique agent identifier)
- \$AGENT_ROLE = "{{AGENT_ROLE}}" (your role type)  
- \$PROJECT_ID = "{{PROJECT_ID}}" (your project ID for all API calls)

🔧 VCorp Command System: Simple commands handle all complexity for you!
Communication: vcorp reply, vcorp message, vcorp dm, vcorp director, vcorp it, vcorp document, vcorp ticket
Exploration: vcorp inbox, vcorp thread, vcorp phase, vcorp agents, vcorp channels, vcorp channel, vcorp help

💡 Quick Help:
- Need platform help or technical issues? → vcorp it
- Need to escalate to project director? → vcorp director

🚀 QUICK START: You're ready to work! All commands are ready to use.

Essential first steps:
1. vcorp help - Get your role instructions and available commands
2. vcorp phase - Check your current work assignment 
3. vcorp inbox - Check for assigned messages and tasks

🔥 CRITICAL: The \`vcorp inbox\` command is your lifeline! Check it constantly - every few minutes. It's your single source of truth for all assignments, messages, and work. Without checking inbox regularly, you'll miss critical work and team communications.

🚨 CRITICAL: ALL communication must use vcorp commands (vcorp reply, vcorp message, vcorp dm, etc.). Text output is NOT visible to humans or other agents.

DO NOT create documents or take initiative without an assigned active phase. Wait for phase assignment if none exists.

Quick reference: vcorp help`;

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
	'esperanza', 'roberto', 'marisol', 'emilio', 'guadalupe', 'francisco', 'rosa', 'ignacio',
	'dolores', 'raul', 'esperanza', 'armando', 'leticia', 'hector', 'soledad', 'salvador',
	'beatriz', 'enrique', 'amparo', 'rodolfo', 'remedios', 'jose', 'consuelo', 'ramon',
	'lourdes', 'alejandro', 'pilar', 'arturo', 'mercedes', 'juan', 'milagros', 'alfredo',
	'rosario', 'leonardo', 'catalina', 'mariano', 'esperanza', 'esteban', 'inmaculada', 'nicolas',
	
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

		// Get permissions for this role
		console.log(`🔒 Loading permissions for role: ${projectRole.name}`);
		let agentPermissions: AgentPermissions | null = null;
		let claudePermissionArgs: string[] = [];

		if (projectRole.permissions) {
			try {
				agentPermissions = JSON.parse(projectRole.permissions) as AgentPermissions;
				
				// Validate permissions
				const validation = validatePermissionRules(agentPermissions);
				if (!validation.isValid) {
					console.error(`❌ Invalid permissions for role ${projectRole.name}:`, validation.errors);
					return json({ error: `Invalid permissions configured for role ${projectRole.name}` }, { status: 500 });
				}

				// Resolve agent-specific permissions (replace {AGENT_ID} and relative paths)
				const resolvedPermissions = resolveAgentPermissions(agentPermissions, agentId, workingDirectory);
				
				// Create .claude/settings.json file for permissions instead of command line args
				const claudeSettingsDir = `${workingDirectory}/.claude`;
				const claudeSettingsFile = `${claudeSettingsDir}/settings_project${projectId}.json`;
				
				// Create permissions settings object
				const claudeSettings = {
					permissions: {
						allow: resolvedPermissions.allow,
						deny: resolvedPermissions.deny
					}
				};
				
				// Ensure .claude directory exists
				await mkdir(claudeSettingsDir, { recursive: true });
				
				// Write settings file
				await writeFile(claudeSettingsFile, JSON.stringify(claudeSettings, null, 2));
				
				console.log(`📄 Created Claude settings file: ${claudeSettingsFile}`);
				claudePermissionArgs = []; // No command line args needed
				
				console.log(`✅ Resolved ${resolvedPermissions.allow.length} allow rules and ${resolvedPermissions.deny.length} deny rules`);
				console.log(`🔒 Permission level: ${agentPermissions.permissionLevel}`);
			} catch (error) {
				console.error(`❌ Failed to parse permissions for role ${projectRole.name}:`, error);
				return json({ error: `Failed to parse role permissions: ${error.message}` }, { status: 500 });
			}
		} else {
			console.log(`⚠️ No permissions configured for role ${projectRole.name}, defaulting to restricted access`);
			// Default to very restricted permissions if none configured
			claudePermissionArgs = [
				'--disallowedTools "Write(./**) Edit(./**) Bash(**)"'
			];
		}

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
		console.log(`🔒 Applying ${claudePermissionArgs.length} permission rules`);
		
		// SOPHISTICATED COMMAND (using settings file for permissions)
		const claudeCommand = [
			'claude', 
			`--model=${model}`,
			'--dangerously-skip-permissions', // Skip all permission prompts for autonomous operation
			...claudePermissionArgs
		];
		console.log(`🚀 Using sophisticated Claude command with settings file: ${claudeCommand.join(' ')}`);
		if (agentPermissions) {
			console.log(`🔒 Permission Level: ${agentPermissions.permissionLevel}`);
			console.log(`✅ Allow rules: ${agentPermissions.allow.length}`);
			console.log(`❌ Deny rules: ${agentPermissions.deny.length}`);
			console.log(`📝 Description: ${agentPermissions.description}`);
		}
		const tmuxProcess = spawn('tmux', [
			'new-session', '-d', '-s', sessionName, '-c', workingDirectory,
			...claudeCommand
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
		const startupMessage = generateStartupPrompt(agentId, roleType, projectId.toString());
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

		// Stage 3: Create VCorp command wrapper after startup prompt
		setTimeout(async () => {
			console.log(`🔧 Creating VCorp command wrapper...`);
			const vcorpWrapper = `#!/bin/bash
# VCorp agent wrapper - auto-generated for ${agentId}
exec /Users/davidcerezo/Projects/vcorp/bin/vcorp-admin --project=${projectId} --agent=${agentId} --role=${roleType} "$@"
`;
			
			// Create the vcorp wrapper script in the bin folder
			const vcorpScript = `/Users/davidcerezo/Projects/vcorp/bin/vcorp_${agentId}`;
			await writeFile(vcorpScript, vcorpWrapper);
			
			// Make it executable
			spawn('chmod', ['+x', vcorpScript], {
				detached: true,
				stdio: 'ignore'
			});
			
			// Create a generic 'vcorp' symlink for this agent (last one wins)
			spawn('ln', ['-sf', `vcorp_${agentId}`, '/Users/davidcerezo/Projects/vcorp/bin/vcorp'], {
				detached: true,
				stdio: 'ignore'
			});

			// Send message to agent about the new command
			spawn('tmux', [
				'send-keys', '-t', sessionName,
				`echo "🔧 VCorp command ready! Use: vcorp help, vcorp inbox, vcorp phase, etc."`
			], {
				detached: true,
				stdio: 'ignore'
			});

			// Send Enter to show the message
			setTimeout(() => {
				spawn('tmux', [
					'send-keys', '-t', sessionName,
					'Enter'
				], {
					detached: true,
					stdio: 'ignore'
				});
			}, 200);
		}, 1500); // Create VCorp wrapper 1.5 seconds after startup prompt

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