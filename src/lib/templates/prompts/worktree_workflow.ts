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
│   │   ├── feature-auth/       # Feature branch worktree
│   │   ├── api-endpoints/      # Another feature worktree
│   │   └── bug-fix-login/      # Bug fix worktree
│   └── other_agents/          # DO NOT ENTER other agent folders
\`\`\`

## Your Development Workflow

### 1. Your Workspace
- Your workspace: \`PROJECT_FOLDER/agent_workspaces/$AGENT_ID/\`
- **NEVER work in**: \`project/\`, other agent folders, or root directory
- Each feature/task gets its own branch worktree within your workspace

### 2. Branch Naming Convention (RECOMMENDED)
**Pattern:** \`feature-description\`, \`bug-fix-description\`, or \`hotfix-description\`

**Examples:**
- \`feature-auth-system\` (Authentication feature)
- \`api-user-endpoints\` (User API endpoints)
- \`bug-fix-login-validation\` (Login validation bug fix)
- \`hotfix-security-patch\` (Security hotfix)

### 3. Creating New Feature Branches (EASY!)

**Use the VCorp command to create worktrees:**
\`\`\`bash
# Create a new feature branch worktree
vcorp create-branch feature-auth-system

# Create branch from specific base branch  
vcorp create-branch hotfix-security --from=production

# Create API feature branch
vcorp create-branch api-user-endpoints --from=main
\`\`\`

**The command automatically:**
- Creates the git worktree in your agent workspace
- Sets up the branch and workspace structure
- Provides next steps for development

**Navigate to your new workspace:**
\`\`\`bash
cd feature-auth-system
# Start coding immediately!
\`\`\`

### 4. Working in Your Worktree

**Development workflow:**
\`\`\`bash
# You're already in your feature branch workspace
# Make your changes
# Commit regularly with clear messages
git add .
git commit -m "Clear description of changes"

# Push your branch
git push origin feature-auth-system
\`\`\`

### 5. Code Integration

**Before starting development:**
\`\`\`bash
# Your worktree is automatically up-to-date when created
# If working for a while, sync with main:
git fetch origin
git rebase origin/main
\`\`\`

**When ready to merge:**
1. Ensure all tests pass locally
2. Create pull request from your branch
3. Request review from appropriate team members
4. Wait for approval before merging

### 6. Cleanup Protocol

**After successful merge:**
\`\`\`bash
# Navigate back to your agent workspace root
cd ..

# Remove completed worktree
git worktree remove feature-auth-system

# Delete merged branch
git branch -d feature-auth-system
git push origin --delete feature-auth-system
\`\`\`

## 🚫 FORBIDDEN ACTIONS

**NEVER do these - they will break the system:**

❌ Work directly in \`PROJECT_FOLDER/project/\`
❌ Create files outside your agent workspace
❌ Modify other agents' workspace folders
❌ Push directly to main branch
❌ Force push to shared branches
❌ Delete or modify other agents' worktrees
❌ Work on multiple features in the same worktree
❌ Manually create git worktrees (use \`vcorp create-branch\` instead)

## ✅ REQUIRED ACTIONS

**Always do these for system stability:**

✅ Work only in \`PROJECT_FOLDER/agent_workspaces/$AGENT_ID/\`
✅ Use \`vcorp create-branch\` to create new feature worktrees
✅ Create separate worktree for each feature/task
✅ Use descriptive branch names (feature-*, bug-fix-*, hotfix-*)
✅ Commit frequently with clear messages
✅ Test your changes before pushing
✅ Create pull requests for all changes
✅ Clean up completed worktrees
✅ Communicate blockers through proper channels

## File Organization

**Within your worktree:**
\`\`\`
feature-auth-system/
├── src/                    # Source code changes
├── tests/                  # Your test files
├── docs/                   # Documentation updates
├── README.md              # Project files (from main branch)
└── .git/                  # Git tracking (automatic)
\`\`\`

**Quick Commands:**
- \`vcorp create-branch --help\` - Get help on creating branches
- \`vcorp inbox\` - Check for new tasks
- \`vcorp phase\` - See your current assignment

## Communication Protocol

**When you need help:**
1. **Technical questions:** Ask in your role's channel
2. **Blockers:** Report to team lead or PM
3. **Architecture decisions:** Escalate to architect
4. **Business questions:** Use /api/projects/$PROJECT_ID/message-director

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
3. Report to team lead or use /api/projects/$PROJECT_ID/message-director immediately
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