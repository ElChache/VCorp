import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { agents, roleTemplates } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateStartupPrompt } from '$lib/utils/agentStartup';
import { launchAgentSession } from '$lib/utils/agentLauncher';

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

function generateAgentId(rolePrefix: string) {
	const humanName = HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)];
	const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit number (1000-9999)
	return `${rolePrefix}_${humanName}_${randomSuffix}`;
}

export async function POST({ request }: RequestEvent) {
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

		// Create agent record in database with "launching" status
		console.log(`📝 Creating agent ${agentId} in database...`);
		const [newAgent] = await db
			.insert(agents)
			.values({
				id: agentId,
				projectId: parseInt(projectId),
				roleType: roleType,
				model: model,
				status: 'launching',
				tmuxSession: `vcorp-${agentId}`,
				worktreePath: `${process.cwd()}/agent_workspaces/${agentId}/`,
			})
			.returning();

		console.log(`✅ Agent ${agentId} created in database`);

		// Generate startup prompt
		const startupMessage = generateStartupPrompt(agentId, roleType, projectId.toString());

		// Use the shared launcher function
		const launchResult = await launchAgentSession({
			agentId,
			roleType,
			projectId: projectId.toString(),
			model,
			customStartupPrompt: startupMessage
		});

		// Update agent with final session info
		await db
			.update(agents)
			.set({
				tmuxSession: launchResult.sessionName,
				worktreePath: launchResult.workspacePath,
				status: 'active'
			})
			.where(eq(agents.id, agentId));

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
export async function PUT({ request }: RequestEvent) {
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