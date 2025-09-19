import { spawn, execSync } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { db } from '$lib/db/index';
import { projects, roles, prompts, rolePromptOrders } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolveAgentPermissions, validatePermissionRules, type AgentPermissions } from '$lib/templates/permissions';

export interface AgentLaunchOptions {
	agentId: string;
	roleType: string;
	projectId: string;
	model?: string;
	customStartupPrompt?: string;
}

export async function launchAgentSession(options: AgentLaunchOptions) {
	const { agentId, roleType, projectId, model = 'sonnet', customStartupPrompt } = options;
	
	console.log(`🚀 Launching agent session - agentId: ${agentId}, roleType: ${roleType}, projectId: ${projectId}`);

	// Get the project to fetch its path
	console.log(`🔍 Fetching project ${projectId} details...`);
	const [project] = await db
		.select()
		.from(projects)
		.where(eq(projects.id, parseInt(projectId)))
		.limit(1);

	if (!project) {
		console.log(`❌ Project ${projectId} not found`);
		throw new Error('Project not found');
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
		throw new Error(`Role ${roleType} not found in project`);
	}

	console.log(`✅ Found role: ${projectRole.name} with ID: ${projectRole.id}`);

	// Get permissions for this role
	console.log(`🔒 Loading permissions for role: ${projectRole.name}`);
	let agentPermissions: AgentPermissions | null = null;
	let claudePermissionArgs: string[] = [];

	// Always create settings file for agent workspace and PATH
	const claudeSettingsDir = `${workingDirectory}/agent_workspaces/${agentId}/.claude`;
	const claudeSettingsFile = `${claudeSettingsDir}/settings.json`;
	
	if (projectRole.permissions) {
		try {
			agentPermissions = JSON.parse(projectRole.permissions) as AgentPermissions;
			
			// Validate permissions
			const validation = validatePermissionRules(agentPermissions);
			if (!validation.isValid) {
				console.error(`❌ Invalid permissions for role ${projectRole.name}:`, validation.errors);
				throw new Error(`Invalid permissions configured for role ${projectRole.name}`);
			}

			// Resolve agent-specific permissions (replace {AGENT_ID} and relative paths)
			const resolvedPermissions = resolveAgentPermissions(agentPermissions, agentId, workingDirectory);
			
			// Create permissions settings object with environment variables
			const claudeSettings = {
				permissions: {
					allow: resolvedPermissions.allow,
					deny: resolvedPermissions.deny
				},
				env: {
					PATH: `./bin:${process.env.PATH}`,
					AGENT_ID: agentId,
					AGENT_ROLE: roleType,
					PROJECT_ID: projectId.toString()
				}
			};
			
			// Ensure .claude directory exists
			await mkdir(claudeSettingsDir, { recursive: true });
			
			// Write settings file
			await writeFile(claudeSettingsFile, JSON.stringify(claudeSettings, null, 2));
			
			console.log(`📄 Created agent-specific Claude settings file: ${claudeSettingsFile}`);
			claudePermissionArgs = []; // No command line args needed
			
			console.log(`✅ Resolved ${resolvedPermissions.allow.length} allow rules and ${resolvedPermissions.deny.length} deny rules`);
			console.log(`🔒 Permission level: ${agentPermissions.permissionLevel}`);
		} catch (error) {
			console.error(`❌ Failed to parse permissions for role ${projectRole.name}:`, error);
			throw new Error(`Failed to parse role permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	} else {
		console.log(`⚠️ No permissions configured for role ${projectRole.name}, creating settings with PATH only`);
		
		// Create basic settings with just PATH (no permissions)
		const claudeSettings = {
			env: {
				PATH: `./bin:${process.env.PATH}`,
				AGENT_ID: agentId,
				AGENT_ROLE: roleType,
				PROJECT_ID: projectId.toString()
			}
		};
		
		// Ensure .claude directory exists
		await mkdir(claudeSettingsDir, { recursive: true });
		
		// Write settings file
		await writeFile(claudeSettingsFile, JSON.stringify(claudeSettings, null, 2));
		
		console.log(`📄 Created basic Claude settings file: ${claudeSettingsFile}`);
		
		// Default to very restricted permissions if none configured
		claudePermissionArgs = [
			'--disallowedTools "Write(./**) Edit(./**) Bash(**)"'
		];
	}

	// Create tmux session name
	const sessionName = `vcorp-${agentId}`;
	console.log(`📺 Creating tmux session: ${sessionName}`);

	// Launch tmux session with Claude in the agent's workspace directory
	const agentWorkspace = `${workingDirectory}/agent_workspaces/${agentId}`;
	console.log(`📂 Starting Claude in agent workspace: ${agentWorkspace}`);
	
	// Ensure the agent workspace directory exists
	// This serves as the base directory for git worktrees (e.g., feature-auth/, api-endpoints/)
	await mkdir(agentWorkspace, { recursive: true });
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
	
	spawn('tmux', [
		'new-session', '-d', '-s', sessionName, '-c', agentWorkspace,
		...claudeCommand
	], {
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { 
			...process.env, 
			ENABLE_BACKGROUND_TASKS: '1'
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
		throw new Error('Failed to create tmux session');
	}

	// Send the startup prompt to the agent (use custom prompt if provided)
	const startupMessage = customStartupPrompt || `Agent ${agentId} ready`;
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
		
		// Query prompts available to this agent role
		console.log(`🔍 Querying available prompts for role: ${roleType}...`);
		const availablePrompts = await db
			.select({
				slug: prompts.slug
			})
			.from(rolePromptOrders)
			.innerJoin(prompts, eq(rolePromptOrders.promptId, prompts.id))
			.where(eq(rolePromptOrders.roleId, projectRole.id))
			.orderBy(rolePromptOrders.orderIndex);
		
		const promptSlugs = availablePrompts.map(p => p.slug).join(',');
		console.log(`📄 Available prompt slugs: ${promptSlugs}`);
		
		const vcorpWrapper = `#!/bin/bash
# VCorp agent wrapper - auto-generated for ${agentId}
# Available prompt slugs: ${promptSlugs}
AVAILABLE_PROMPTS="${promptSlugs}"
export AVAILABLE_PROMPTS
# Use absolute path to ensure we always find vcorp-admin
exec /Users/davidcerezo/Projects/vcorp/bin/vcorp-admin --project=${projectId} --agent=${agentId} --role=${roleType} "$@"
`;
		
		// Create agent-specific bin directory
		const agentBinDir = `${workingDirectory}/agent_workspaces/${agentId}/bin`;
		await mkdir(agentBinDir, { recursive: true });
		
		// Create the vcorp wrapper script directly in agent's bin folder
		const agentVcorpScript = `${agentBinDir}/vcorp`;
		await writeFile(agentVcorpScript, vcorpWrapper);
		// Make it executable
		spawn('chmod', ['+x', agentVcorpScript], {
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

	console.log(`✅ Agent ${agentId} session launched successfully`);
	
	return {
		sessionName,
		workspacePath: agentWorkspace,
		settingsFile: claudeSettingsFile
	};
}