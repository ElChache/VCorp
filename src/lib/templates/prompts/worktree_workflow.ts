export const worktree_workflow = {
  name: "Developer Contribution Guidelines",
  type: "worktree_workflow",
  content: `# VCorp Developer Contribution Guidelines

## 🚨 CRITICAL RULE: NEVER WORK OUTSIDE YOUR DESIGNATED WORKSPACE 🚨

**ABSOLUTE REQUIREMENT:** All development work MUST happen within your assigned agent workspace. Working outside this structure will cause conflicts, data loss, and project disruption.

## Workspace Structure (MANDATORY)

\`\`\`
PROJECT_FOLDER/
├── project/                    # Main branch (NEVER touch directly)
├── agent_workspaces/           # Your work area
│   ├── $AGENT_ID/            # YOUR assigned folder only
│   │   └── {role}_{task_id}_{description}/  # Task-specific worktrees
│   └── other_agents/          # DO NOT ENTER other agent folders
\`\`\`

## Your Development Workflow

### 1. Claim Your Workspace
- Your workspace: \`PROJECT_FOLDER/agent_workspaces/$AGENT_ID/\`
- **NEVER work in**: \`project/\`, other agent folders, or root directory
- Each task gets its own worktree folder within your workspace

### 2. Branch Naming Convention (MANDATORY)
**Pattern:** \`{role}_{task_id}_{description}\`

**Examples:**
- \`be_3422_auth_system\` (Backend Developer, Task 3422, Auth System)
- \`fe_3423_login_form\` (Frontend Developer, Task 3423, Login Form)
- \`pm_3424_user_requirements\` (Product Manager, Task 3424, User Requirements)

**Why this matters:**
- Allows any agent of your role to take over if needed
- Harasser can parse role and task information
- Human readable for debugging
- Prevents branch conflicts

### 3. Worktree Management

**Creating a new worktree:**
\`\`\`bash
# Navigate to YOUR agent workspace
cd PROJECT_FOLDER/agent_workspaces/$AGENT_ID/

# Create worktree for your task
git worktree add {role}_{task_id}_{description}

# Navigate into your task folder
cd {role}_{task_id}_{description}

# Start development
\`\`\`

**Working in your worktree:**
\`\`\`bash
# Always work within your task-specific folder
cd PROJECT_FOLDER/agent_workspaces/$AGENT_ID/{role}_{task_id}_{description}/

# Make your changes
# Commit regularly with clear messages
git add .
git commit -m "Clear description of changes"

# Push your branch
git push origin {role}_{task_id}_{description}
\`\`\`

### 4. Code Integration

**Before starting:**
\`\`\`bash
# Pull latest from main
git fetch origin
git rebase origin/main
\`\`\`

**When ready to merge:**
1. Ensure all tests pass
2. Create pull request from your branch
3. Request review from appropriate team members
4. Wait for approval before merging

### 5. Cleanup Protocol

**After successful merge:**
\`\`\`bash
# Navigate to your agent workspace root
cd PROJECT_FOLDER/agent_workspaces/$AGENT_ID/

# Remove completed worktree
git worktree remove {role}_{task_id}_{description}

# Delete merged branch
git branch -d {role}_{task_id}_{description}
git push origin --delete {role}_{task_id}_{description}
\`\`\`

## 🚫 FORBIDDEN ACTIONS

**NEVER do these - they will break the system:**

❌ Work directly in \`PROJECT_FOLDER/project/\`
❌ Create files outside your agent workspace
❌ Modify other agents' workspace folders
❌ Use branch names that don't follow the convention
❌ Push directly to main branch
❌ Force push to shared branches
❌ Delete or modify other agents' worktrees
❌ Work on multiple tasks in the same worktree

## ✅ REQUIRED ACTIONS

**Always do these for system stability:**

✅ Work only in \`PROJECT_FOLDER/agent_workspaces/$AGENT_ID/\`
✅ Create separate worktree for each task
✅ Use proper branch naming: \`{role}_{task_id}_{description}\`
✅ Commit frequently with clear messages
✅ Test your changes before pushing
✅ Create pull requests for all changes
✅ Clean up completed worktrees
✅ Communicate blockers through proper channels

## File Organization

**Within your worktree:**
\`\`\`
{role}_{task_id}_{description}/
├── src/                    # Source code changes
├── tests/                  # Your test files
├── docs/                   # Documentation updates
├── README.md              # Task-specific notes
└── .git/                  # Git tracking (automatic)
\`\`\`

## Communication Protocol

**When you need help:**
1. **Technical questions:** Ask in your role's channel
2. **Blockers:** Report to team lead or PM
3. **Architecture decisions:** Escalate to architect
4. **Business questions:** Contact human-director via DM

**Progress reporting:**
- Daily standup updates in team channel
- Completion notifications to task assigners
- Blocker reports immediately when encountered

## Quality Standards

**Before every commit:**
- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] No debugging code or temporary files
- [ ] Clear commit message explaining the change
- [ ] Changes are focused and atomic

**Before every pull request:**
- [ ] Feature is complete and tested
- [ ] Documentation is updated
- [ ] No merge conflicts with main
- [ ] PR description explains the changes
- [ ] Appropriate reviewers are assigned

## Emergency Procedures

**If you accidentally work outside your workspace:**
1. **STOP immediately** - do not make more changes
2. Document exactly what you changed
3. Report to team lead or human-director immediately
4. Wait for instructions on how to fix
5. Learn from the mistake to prevent recurrence

**If your workspace gets corrupted:**
1. Report the issue immediately
2. Do not attempt to fix it yourself
3. Back up any uncommitted work if possible
4. Wait for workspace restoration instructions

## Success Metrics

**You're following the workflow correctly when:**
- All your work happens in your designated workspace
- Your branches follow the naming convention
- Other agents can understand and take over your work if needed
- No merge conflicts occur due to workspace violations
- The project maintains clean Git history
- Team collaboration flows smoothly

## Remember

This workspace structure exists to:
- **Prevent conflicts** between agents working simultaneously
- **Enable collaboration** by making work transparent and accessible
- **Maintain quality** through isolation and review processes
- **Allow flexibility** for agents to take over tasks when needed
- **Preserve stability** of the main project

**Following this workflow is not optional - it's essential for project success and team harmony.**`,
  premade: null,
  isGlobal: true,
  orderIndex: 1
};