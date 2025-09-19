// VCorp Agent Permission Templates
// These define Claude Code permission rules for each role type

export interface AgentPermissions {
  allow: string[];
  deny: string[];
  description: string;
  permissionLevel: 'restricted' | 'standard' | 'lead' | 'admin';
}

// Standard Developer Permissions (Backend, Frontend, Core Team)
export const standardDeveloperPermissions: AgentPermissions = {
  allow: [
    // Complete agent workspace access
    "Write(./**)",
    "Edit(./**)",
    "Read(./**)",
    
    // Read-only access to main project for reference
    "Read(../../project/**)",
    
    // Full access to shared docs folder (public documents)
    "Write(../../docs/**)",
    "Edit(../../docs/**)",
    "Read(../../docs/**)",
    
    // Read-only access to tickets (viewing only for developers)
    "Read(../../tickets/**)",
    
    // Directory navigation
    "Bash(cd:./**)",
    "Bash(cd:../../docs/**)",
    "Bash(cd:../../tickets/**)",
    
    // Complete git workflow for worktrees
    "Bash(git worktree:*)",     // Create/manage worktrees
    "Bash(git fetch:*)",        // Get latest changes
    "Bash(git pull:*)",         // Pull changes in their workspace
    "Bash(git push:*)",         // Push their branches
    "Bash(git add:*)",          // Stage changes
    "Bash(git commit:*)",       // Commit changes
    "Bash(git status:*)",       // Check git status
    "Bash(git log:*)",          // View git history
    "Bash(git show:*)",         // Show git content
    "Bash(git diff:*)",         // View diffs
    "Bash(git branch:*)",       // Create/delete their branches
    "Bash(git rebase:*)",       // Rebase on main
    "Bash(git checkout:*)",     // Switch branches in their workspace
    
    // GitHub CLI for cloning and PR management
    "Bash(gh repo:clone:*)",    // Clone repositories
    "Bash(gh pr:create:*)",     // Create pull requests
    "Bash(gh pr:view:*)",       // View pull requests
    "Bash(gh pr:list:*)",       // List pull requests
    "Bash(gh pr:status:*)",     // Check PR status
    
    // Development operations
    "Bash(npm:*)",
    "Bash(node:*)",
    "Bash(pnpm:*)",
    "Bash(yarn:*)",
    "Bash(npx:*)",
    
    // Safe utility commands
    "Bash(ls:*)",
    "Bash(pwd:*)",
    "Bash(cat:*)",
    "Bash(grep:*)",
    "Bash(find:*)",
    "Bash(echo:*)",
    "Bash(mkdir:*)",
    "Bash(touch:*)",
    "Bash(cp:*)",
    "Bash(mv:*)",
    
    // Development tools
    "Bash(code:*)",
    "Bash(vim:*)",
    "Bash(nano:*)",
    
    // Testing and building in their workspace
    "Bash(jest:*)",
    "Bash(vitest:*)",
    "Bash(test:*)",
    "Bash(build:*)",
    "Bash(lint:*)",
    "Bash(format:*)",
    
    // File management in their own workspace
    "Bash(rm:./**)",
    "Bash(rmdir:./**)"
  ],
  deny: [
    // Block main project write access (SACRED RULE)
    "Write(../../project/**)",
    "Edit(../../project/**)",
    "Bash(cd:../../project/**)",
    
    // Block file creation at project root
    "Write(../../*)",
    "Bash(touch:../../*)",
    "Bash(mkdir:../../*)",
    
    // Block dangerous git operations outside workspace  
    "Bash(git checkout:../../*)",
    "Bash(git pull:../../*)", 
    "Bash(git clone:../../*)",
    "Bash(git reset:../../*)",
    "Bash(git clean:../../*)",
    
    // Block direct main branch operations
    "Bash(git push origin main)",  // Cannot push to main
    "Bash(git push main)",         // Cannot push to main 
    "Bash(git merge main)",        // Cannot merge to main
    "Bash(git checkout:main)",     // Cannot checkout main directly
    
    // Block other agent workspace access
    "Write(../*)",
    "Edit(../*)",
    "Read(../*)",
    
    // Block GitHub merge operations (leads only)
    "Bash(gh pr:merge:*)",
    "Bash(gh pr:close:*)",
    "Bash(gh pr:edit:*)",
    
    // Block dangerous operations (except in own workspace)
    "Bash(rm:../../project/**)",
    "Bash(rm:../../docs/**)",
    "Bash(rm:../../tickets/**)",
    "Bash(rm:../*)",  // Block other agents' workspaces
    "Bash(rmdir:../../project/**)",
    "Bash(rmdir:../../docs/**)",
    "Bash(rmdir:../../tickets/**)",
    "Bash(rmdir:../*)",  // Block other agents' workspaces
    "Bash(sudo:*)",
    "Bash(su:*)",
    "Bash(chmod:*)",
    "Bash(chown:*)",
    "Bash(kill:*)",
    "Bash(killall:*)",
    
    // Block system-level operations
    "Bash(systemctl:*)",
    "Bash(service:*)",
    "Bash(mount:*)",
    "Bash(umount:*)",
    
    // Block network operations that could be dangerous
    "Bash(curl:*)",
    "Bash(wget:*)",
    "Bash(ssh:*)",
    "Bash(scp:*)",
    "Bash(rsync:*)"
  ],
  description: "Standard developer with complete worktree workflow access",
  permissionLevel: 'standard'
};

// Lead Developer Permissions (System Architect, Lead Developer)
export const leadDeveloperPermissions: AgentPermissions = {
  allow: [
    // Full agent workspace access
    "Write(./**)",
    "Edit(./**)",
    "Read(./**)",
    
    // LEAD PRIVILEGE: Full main project access (SACRED AUTHORITY)
    "Write(../../project/**)",
    "Edit(../../project/**)",
    "Read(../../project/**)",
    "Bash(cd:../../project/**)",
    
    // Full access to shared docs folder
    "Write(../../docs/**)",
    "Edit(../../docs/**)",
    "Read(../../docs/**)",
    "Bash(cd:../../docs/**)",
    
    // LEAD PRIVILEGE: Full oversight access to all agent workspaces
    "Read(../**)",
    "Write(../**)",
    "Edit(../**)",
    "Bash(cd:../**)",
    
    // LEAD PRIVILEGE: Complete git workflow including main branch
    "Bash(git:*)",                  // Full git access
    "Bash(git worktree:*)",         // Manage all worktrees
    "Bash(git fetch:*)",            // Get latest changes
    "Bash(git pull:*)",             // Pull any branch
    "Bash(git push:*)",             // Push any branch INCLUDING main
    "Bash(git merge:*)",            // Merge to main branch
    "Bash(git rebase:*)",           // Rebase operations
    "Bash(git checkout:*)",         // Checkout any branch including main
    "Bash(git add:*)",              // Stage changes
    "Bash(git commit:*)",           // Commit changes
    "Bash(git status:*)",           // Check status
    "Bash(git log:*)",              // View history
    "Bash(git show:*)",             // Show content
    "Bash(git diff:*)",             // View diffs
    "Bash(git branch:*)",           // Manage branches
    "Bash(git reset:*)",            // Reset operations for main branch health
    "Bash(git revert:*)",           // Revert bad commits on main
    
    // LEAD PRIVILEGE: Full GitHub CLI access including merge operations
    "Bash(gh:*)",                   // Full GitHub CLI access
    "Bash(gh repo:*)",              // Repository operations
    "Bash(gh pr:*)",                // All PR operations including merge
    "Bash(gh issue:*)",             // Issue management
    "Bash(gh workflow:*)",          // Workflow management
    
    // Development operations
    "Bash(npm:*)",
    "Bash(node:*)",
    "Bash(pnpm:*)",
    "Bash(yarn:*)",
    "Bash(npx:*)",
    
    // Extended utility commands for lead responsibilities
    "Bash(ls:*)",
    "Bash(pwd:*)",
    "Bash(cat:*)",
    "Bash(grep:*)",
    "Bash(find:*)",
    "Bash(echo:*)",
    "Bash(mkdir:*)",
    "Bash(touch:*)",
    "Bash(cp:*)",
    "Bash(mv:*)",
    
    // Development tools
    "Bash(code:*)",
    "Bash(vim:*)",
    "Bash(nano:*)",
    
    // Testing, building, and deployment
    "Bash(jest:*)",
    "Bash(vitest:*)",
    "Bash(test:*)",
    "Bash(build:*)",
    "Bash(lint:*)",
    "Bash(format:*)",
    "Bash(deploy:*)",
    
    // LEAD PRIVILEGE: Selective file operations for maintenance
    "Bash(rm:../../project/node_modules/**)",    // Clean node_modules
    "Bash(rm:../../project/dist/**)",            // Clean build artifacts
    "Bash(rm:../../project/.next/**)",           // Clean Next.js cache
    "Bash(rm:../../project/build/**)",           // Clean build folder
    "Bash(rm:../**)",                            // Clean agent workspaces
    "Bash(rmdir:../../project/node_modules/**)", // Remove empty directories
    "Bash(rmdir:../../project/dist/**)",         // Remove empty build dirs
  ],
  deny: [
    // Still block critical system operations
    "Bash(sudo:*)",
    "Bash(su:*)",
    "Bash(systemctl:*)",
    "Bash(service:*)",
    "Bash(mount:*)",
    "Bash(umount:*)",
    
    // Block file creation at project root (even for leads)
    "Write(../../*)",
    "Bash(touch:../../*)",
    "Bash(mkdir:../../*)",
    
    // Block dangerous file operations on critical files
    "Bash(rm:../../project/.git/**)",           // Protect git folder
    "Bash(rm:../../project/package.json)",      // Protect package files
    "Bash(rm:../../project/package-lock.json)",
    "Bash(rm:../../project/pnpm-lock.yaml)",
    "Bash(rm:../../project/yarn.lock)",
    "Bash(rm:../../project/.env*)",             // Protect environment files
    "Bash(rm:../../project/.claude/**)",        // Protect Claude settings
    
    // Block dangerous network operations
    "Bash(ssh:*)",
    "Bash(scp:*)",
    "Bash(rsync:*)"
  ],
  description: "Lead developer with full main branch authority and oversight access",
  permissionLevel: 'lead'
};

// Management Permissions (Product Manager, IT Admin, Director Assistant)
export const managementPermissions: AgentPermissions = {
  allow: [
    // Agent workspace access for their own workspace
    "Write(./**)",
    "Edit(./**)",
    "Read(./**)",
    
    // MANAGEMENT PRIVILEGE: Read access to all project areas for oversight
    "Read(../../project/**)",
    "Read(../**)",
    
    // Full access to shared docs folder (management needs to create/edit docs)
    "Write(../../docs/**)",
    "Edit(../../docs/**)",
    "Read(../../docs/**)",
    
    // Full access to tickets folder (management privilege for ticket management)
    "Write(../../tickets/**)",
    "Edit(../../tickets/**)",
    "Read(../../tickets/**)",
    
    // Navigation permissions
    "Bash(cd:./**)",
    "Bash(cd:../../project/**)",
    "Bash(cd:../../docs/**)",
    "Bash(cd:../../tickets/**)",
    
    // Git operations for oversight and coordination (read-only focus)
    "Bash(git status:*)",           // Check status
    "Bash(git log:*)",              // View history
    "Bash(git show:*)",             // Show content
    "Bash(git diff:*)",             // View diffs
    "Bash(git branch:*)",           // View branches
    "Bash(git fetch:*)",            // Get latest info
    "Bash(git worktree:list:*)",    // List worktrees for oversight
    
    // GitHub CLI for project oversight
    "Bash(gh repo:clone:*)",        // Clone repositories for analysis
    "Bash(gh pr:view:*)",           // View pull requests
    "Bash(gh pr:list:*)",           // List pull requests
    "Bash(gh pr:status:*)",         // Check PR status
    "Bash(gh issue:list:*)",        // List issues
    "Bash(gh issue:view:*)",        // View issues
    "Bash(gh workflow:list:*)",     // View workflows
    "Bash(gh workflow:view:*)",     // View workflow details
    
    // Development tool access for analysis
    "Bash(npm:list:*)",             // View dependencies
    "Bash(npm:audit:*)",            // Security audits
    "Bash(npm:outdated:*)",         // Check outdated packages
    "Bash(node:--version)",         // Version checks
    "Bash(pnpm:list:*)",            // View pnpm dependencies
    
    // Safe utility commands
    "Bash(ls:*)",
    "Bash(pwd:*)",
    "Bash(cat:*)",
    "Bash(grep:*)",
    "Bash(find:*)",
    "Bash(echo:*)",
    "Bash(mkdir:./**)",
    "Bash(touch:./**)",
    "Bash(cp:*)",
    "Bash(mv:./**)",
    
    // Development tools for review
    "Bash(code:*)",
    "Bash(vim:*)",
    "Bash(nano:*)",
    
    // Testing and analysis for project oversight
    "Bash(test:*)",
    "Bash(lint:*)",
    "Bash(build:*)",                // Can run builds for testing
    
    // File management in their own workspace
    "Bash(rm:./**)",
    "Bash(rmdir:./**)",
    
    // Git operations in their own workspace
    "Bash(git add:./**)",
    "Bash(git commit:./**)",
    "Bash(git push:./**)"
  ],
  deny: [
    // Block direct project write access (management coordinates, not codes)
    "Write(../../project/**)",
    "Edit(../../project/**)",
    
    // Block file creation at project root
    "Write(../../*)",
    "Bash(touch:../../*)",
    "Bash(mkdir:../../*)",
    
    // Block dangerous git operations outside workspace  
    "Bash(git checkout:../../*)",
    "Bash(git pull:../../*)", 
    "Bash(git clone:../../*)",
    "Bash(git reset:../../*)",
    "Bash(git clean:../../*)",
    
    // Block other agent workspace write access
    "Write(../*)",
    "Edit(../*)",
    
    // Block git write operations (coordination role, not development)
    "Bash(git push origin main)",
    "Bash(git push main)",
    "Bash(git merge main)",
    "Bash(git checkout:*)",          // Prevent branch switching
    "Bash(git worktree:add:*)",      // Cannot create worktrees
    "Bash(git worktree:remove:*)",   // Cannot remove worktrees
    
    // Block GitHub write operations
    "Bash(gh pr:create:*)",
    "Bash(gh pr:merge:*)",
    "Bash(gh pr:close:*)",
    "Bash(gh pr:edit:*)",
    "Bash(gh issue:create:*)",
    "Bash(gh issue:close:*)",
    "Bash(gh issue:edit:*)",
    
    // Block dangerous operations (except in own workspace)
    "Bash(rm:../../project/**)",
    "Bash(rm:../../docs/**)",
    "Bash(rm:../../tickets/**)",
    "Bash(rm:../*)",  // Block other agents' workspaces
    "Bash(rmdir:../../project/**)",
    "Bash(rmdir:../../docs/**)",
    "Bash(rmdir:../../tickets/**)",
    "Bash(rmdir:../*)",  // Block other agents' workspaces
    "Bash(sudo:*)",
    "Bash(su:*)",
    "Bash(chmod:*)",
    "Bash(chown:*)",
    "Bash(kill:*)",
    "Bash(killall:*)",
    
    // Block system-level operations
    "Bash(systemctl:*)",
    "Bash(service:*)",
    "Bash(mount:*)",
    "Bash(umount:*)",
    
    // Block network operations
    "Bash(curl:*)",
    "Bash(wget:*)",
    "Bash(ssh:*)",
    "Bash(scp:*)",
    "Bash(rsync:*)"
  ],
  description: "Management role with oversight access and git/GitHub analysis capabilities",
  permissionLevel: 'standard'
};

// Human Director Permissions (Full Access)
export const humanDirectorPermissions: AgentPermissions = {
  allow: [
    // Full system access
    "Write(./**)",
    "Edit(./**)",
    "Read(./**)",
    "Bash(**)"
  ],
  deny: [
    // No restrictions for human director
  ],
  description: "Human Director with full system access",
  permissionLevel: 'admin'
};

// Permission templates mapped by role type
export const rolePermissionTemplates: Record<string, AgentPermissions> = {
  // Standard developers
  'backend-developer': standardDeveloperPermissions,
  'frontend-developer': standardDeveloperPermissions,
  'ai-developer': standardDeveloperPermissions,
  'ux-expert': standardDeveloperPermissions,
  'graphic-designer': standardDeveloperPermissions,
  'technical-qa': standardDeveloperPermissions,
  
  // Lead developers
  'system-architect': leadDeveloperPermissions,
  'lead-developer': leadDeveloperPermissions,
  
  // Management
  'product-manager': managementPermissions,
  'it-administrator': managementPermissions,
  'director-assistant': managementPermissions,
  
  // Full access
  'human-director': humanDirectorPermissions
};

// Helper function to resolve agent-specific permissions
export function resolveAgentPermissions(permissions: AgentPermissions, agentId: string, projectPath: string): AgentPermissions {
  return {
    ...permissions,
    allow: permissions.allow.map(rule => 
      rule.replace('{AGENT_ID}', agentId)
          .replace('../../project/', `${projectPath}/project/`)
          .replace('../../docs/', `${projectPath}/docs/`)
          .replace('../../tickets/', `${projectPath}/tickets/`)
          .replace('../**', `${projectPath}/agent_workspaces/**`)
          .replace('../*', `${projectPath}/agent_workspaces/*`)
          .replace('../../*', `${projectPath}/*`)
    ),
    deny: permissions.deny.map(rule => 
      rule.replace('{AGENT_ID}', agentId)
          .replace('../../project/', `${projectPath}/project/`)
          .replace('../../docs/', `${projectPath}/docs/`)
          .replace('../../tickets/', `${projectPath}/tickets/`)
          .replace('../**', `${projectPath}/agent_workspaces/**`)
          .replace('../*', `${projectPath}/agent_workspaces/*`)
          .replace('../../*', `${projectPath}/*`)
    )
  };
}

// Helper function to validate permission rules
export function validatePermissionRules(permissions: AgentPermissions): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for required fields
  if (!permissions.allow || !Array.isArray(permissions.allow)) {
    errors.push('Missing or invalid allow array');
  }
  
  if (!permissions.deny || !Array.isArray(permissions.deny)) {
    errors.push('Missing or invalid deny array');
  }
  
  if (!permissions.description || typeof permissions.description !== 'string') {
    errors.push('Missing or invalid description');
  }
  
  if (!permissions.permissionLevel || !['restricted', 'standard', 'lead', 'admin'].includes(permissions.permissionLevel)) {
    errors.push('Missing or invalid permissionLevel');
  }
  
  // Basic syntax validation for Claude Code patterns
  const allRules = [...permissions.allow, ...permissions.deny];
  for (const rule of allRules) {
    if (typeof rule !== 'string') {
      errors.push(`Invalid rule type: ${rule}`);
      continue;
    }
    
    // Check if it's a valid Claude Code pattern
    if (!rule.match(/^(Write|Edit|Read|Bash)\(.+\)$/)) {
      errors.push(`Invalid Claude Code permission pattern: ${rule}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}