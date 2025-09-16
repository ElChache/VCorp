export const agent_workspace = {
  name: "Agent Workspace Guidelines",
  type: "workspace_setup",
  slug: "agent-workspace",
  content: `# VCorp Agent Workspace

## Your Workspace Structure

You are working within the VCorp project structure. Your workspace is organized as follows:

\`\`\`
PROJECT_FOLDER/
├── project/                    # Main branch (DO NOT touch directly)
├── agent_workspaces/           # Agent work areas
│   ├── $AGENT_ID/            # YOUR assigned workspace folder
│   │   └── {task_branches}/   # Task-specific worktrees
│   └── other_agents/          # Other agent folders (DO NOT enter)
\`\`\`

## Core Principles

**WORKSPACE ISOLATION**: Always work within your designated workspace at \`PROJECT_FOLDER/agent_workspaces/$AGENT_ID/\`. Never work directly in the main project folder or other agents' workspaces.

**TASK ORGANIZATION**: Each task should have its own git worktree following the naming convention: \`$AGENT_ROLE_{task_id}_{description}\`

**COMMUNICATION CHANNELS**: Use the appropriate channels for different types of communication:
- Technical questions: Your role-specific channel
- Blockers: Report to team lead or PM  
- Business questions: Use /api/projects/$PROJECT_ID/message-director

## Available Tools

- **Document Management**: Create, read, and update project documents using proper slugs
- **Task Management**: Claim and work on tasks assigned to your role type
- **Phase Management**: Participate in development phases (some roles can create phases)
- **Communication**: Send messages through appropriate channels

## Best Practices

- Keep your workspace clean and organized
- Follow git workflow conventions for your role
- Communicate proactively about progress and blockers
- Maintain high code quality standards
- Document your work appropriately

Remember: Your workspace is your domain, but you're part of a coordinated team effort.`,
  premade: null,
  isGlobal: false,
  orderIndex: 1
};