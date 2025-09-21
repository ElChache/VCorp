import { spawn, execSync } from 'child_process';
import { mkdir, writeFile, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { db } from '$lib/db/index';
import { projects, roles, prompts, rolePromptOrders } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolveAgentPermissions, validatePermissionRules, type AgentPermissions } from '$lib/templates/permissions';
import os from 'os';

export interface AgentLaunchOptions {
	agentId: string;
	roleType: string;
	projectId: string;
	model?: string;
	customStartupPrompt?: string;
}

/**
 * Clean up old Claude session files for an agent to reset context tracking
 */
async function cleanupAgentClaudeSession(agentId: string): Promise<void> {
	try {
		const claudeProjectsDir = join(os.homedir(), '.claude', 'projects');
		
		// Check if Claude projects directory exists
		try {
			await stat(claudeProjectsDir);
		} catch {
			return; // Directory doesn't exist, nothing to clean
		}

		console.log(`🧹 Cleaning up old Claude session files for agent ${agentId}...`);

		// Look for session directories that match this agent
		const files = await readdir(claudeProjectsDir);
		
		// Convert agent ID to both formats for pattern matching
		const agentIdDashes = agentId.replace(/_/g, '-');
		const agentIdUnderscores = agentId.replace(/-/g, '_');
		
		let cleanedCount = 0;
		
		for (const file of files) {
			// Look for directories that match agent workspace patterns
			if (file.includes(`agent-workspaces-${agentIdDashes}`) || 
				file.includes(`agent_workspaces-${agentIdUnderscores}`) || 
				file.endsWith(`-${agentIdDashes}`) || 
				file.endsWith(`-${agentIdUnderscores}`)) {
				
				const sessionDir = join(claudeProjectsDir, file);
				
				try {
					// Check if it's a directory
					const stats = await stat(sessionDir);
					if (!stats.isDirectory()) continue;
					
					// Remove all .jsonl files in this directory
					const sessionFiles = await readdir(sessionDir);
					
					for (const sessionFile of sessionFiles) {
						if (sessionFile.endsWith('.jsonl')) {
							const sessionPath = join(sessionDir, sessionFile);
							await unlink(sessionPath);
							cleanedCount++;
							console.log(`🗑️ Removed old session file: ${sessionFile}`);
						}
					}
				} catch (error) {
					console.warn(`⚠️ Failed to clean session directory ${file}:`, (error as Error).message);
					continue;
				}
			}
		}
		
		if (cleanedCount > 0) {
			console.log(`✅ Cleaned up ${cleanedCount} old session files for agent ${agentId}`);
		} else {
			console.log(`🔍 No old session files found for agent ${agentId}`);
		}
	} catch (error) {
		console.error(`❌ Failed to cleanup Claude session files for agent ${agentId}:`, error);
		// Don't throw - this shouldn't block agent launch
	}
}

export async function launchAgentSession(options: AgentLaunchOptions) {
	const { agentId, roleType, projectId, model = 'sonnet', customStartupPrompt } = options;
	
	// Clean up old Claude session files to reset context tracking
	await cleanupAgentClaudeSession(agentId);

	// Get the project to fetch its path
	const [project] = await db
		.select()
		.from(projects)
		.where(eq(projects.id, parseInt(projectId)))
		.limit(1);

	if (!project) {
		throw new Error('Project not found');
	}

	const workingDirectory = project.path?.trim() || process.cwd();

	// Find the role in the project that matches the roleType
	const [projectRole] = await db
		.select()
		.from(roles)
		.where(and(
			eq(roles.projectId, parseInt(projectId)),
			eq(roles.name, roleType)
		))
		.limit(1);

	if (!projectRole) {
		throw new Error(`Role ${roleType} not found in project`);
	}


	// Get permissions for this role
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
			
			claudePermissionArgs = []; // No command line args needed
			
		} catch (error) {
			console.error(`❌ Failed to parse permissions for role ${projectRole.name}:`, error);
			throw new Error(`Failed to parse role permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	} else {
		
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
		
		
		// Default to very restricted permissions if none configured
		claudePermissionArgs = [
			'--disallowedTools "Write(./**) Edit(./**) Bash(**)"'
		];
	}

	// Create tmux session name
	const sessionName = `vcorp-${agentId}`;

	// Launch tmux session with Claude in the agent's workspace directory
	const agentWorkspace = `${workingDirectory}/agent_workspaces/${agentId}`;
	
	// Ensure the agent workspace directory exists
	// This serves as the base directory for git worktrees (e.g., feature-auth/, api-endpoints/)
	await mkdir(agentWorkspace, { recursive: true });
	
	// SOPHISTICATED COMMAND (using settings file for permissions)
	const claudeCommand = [
		'claude', 
		`--model=${model}`,
		'--dangerously-skip-permissions', // Skip all permission prompts for autonomous operation
		...claudePermissionArgs
	];
	if (agentPermissions) {
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

	// Wait a moment for tmux to start
	await new Promise(resolve => setTimeout(resolve, 2000));

	// Verify tmux session was created
	try {
		execSync(`tmux has-session -t "${sessionName}"`, { stdio: 'ignore' });
	} catch (error) {
		throw new Error('Failed to create tmux session');
	}

	// Send the startup prompt to the agent (use custom prompt if provided)
	const startupMessage = customStartupPrompt || `Agent ${agentId} ready`;
	
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
		
		// Query prompts available to this agent role
		const availablePrompts = await db
			.select({
				slug: prompts.slug
			})
			.from(rolePromptOrders)
			.innerJoin(prompts, eq(rolePromptOrders.promptId, prompts.id))
			.where(eq(rolePromptOrders.roleId, projectRole.id))
			.orderBy(rolePromptOrders.orderIndex);
		
		const promptSlugs = availablePrompts.map(p => p.slug).join(',');
		
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

	
	return {
		sessionName,
		workspacePath: agentWorkspace,
		settingsFile: claudeSettingsFile
	};
}