# VCorp Permission System Testing Guide

## Overview

The VCorp permission system has been implemented with role-based Claude Code permissions that enforce workspace isolation and access control for different agent types.

## Implementation Summary

### 1. Database Schema Changes
- Added `permissions` column to `roleTemplates` table
- Added `permissions` column to `roles` table  
- Migration file: `drizzle/0003_certain_red_ghost.sql`

### 2. Permission Templates Created
File: `src/lib/templates/permissions.ts`

**Permission Levels:**
- **Standard Developer** (Backend, Frontend, Core Team, AI Developer, UX Expert, Graphic Designer, Technical QA)
  - ✅ Read/Write: `./agent_workspaces/{AGENT_ID}/**` 
  - ✅ Read-only: `./project/**`
  - ❌ Blocked: Other agent workspaces, main project write access

- **Lead Developer** (System Architect, Lead Developer)
  - ✅ Read/Write: Own workspace + `./project/**` + all agent workspaces
  - ✅ Can manage main branch and help other agents
  - ❌ Blocked: System-level operations, dangerous file operations

- **Management** (Product Manager, IT Administrator, Director Assistant)
  - ✅ Read-only: All project areas and agent workspaces
  - ✅ Read/Write: Own workspace only
  - ❌ Blocked: Git write operations, project code changes

- **Human Director**
  - ✅ Full system access (no restrictions)

### 3. Agent Launch Integration
File: `src/routes/api/agents/launch/+server.ts`

- Retrieves role permissions from database
- Resolves agent-specific paths (`{AGENT_ID}` placeholder)
- Builds Claude Code command line arguments
- Replaces `--dangerously-skip-permissions` with actual permission rules

### 4. Template Seeding Updates
File: `src/routes/api/templates/seed/+server.ts`

- Role templates now include permissions during seeding
- Permissions automatically applied to roles created from templates

## Testing Steps

### 1. Apply Database Migration
```bash
# Apply the schema changes
npx drizzle-kit push
```

### 2. Re-seed Templates with Permissions
```bash
# Reset and re-seed templates to include permissions
curl -X DELETE http://localhost:5173/api/templates/reset
curl -X POST http://localhost:5173/api/templates/seed
```

### 3. Create a Test Project
1. Create a new project via the UI
2. Verify roles are created with permissions from templates

### 4. Test Different Agent Types

#### Standard Developer Test (Backend Developer)
```bash
# Launch a backend developer
curl -X POST http://localhost:5173/api/agents/launch \
  -H "Content-Type: application/json" \
  -d '{"roleType": "Backend Developer", "projectId": 1}'

# Expected: Agent should have access to their workspace only
```

#### Lead Developer Test (System Architect)
```bash
# Launch a system architect  
curl -X POST http://localhost:5173/api/agents/launch \
  -H "Content-Type: application/json" \
  -d '{"roleType": "System Architect", "projectId": 1}'

# Expected: Agent should have access to main project + all workspaces
```

#### Management Test (Product Manager)
```bash
# Launch a product manager
curl -X POST http://localhost:5173/api/agents/launch \
  -H "Content-Type: application/json" \
  -d '{"roleType": "Product Manager", "projectId": 1}'

# Expected: Agent should have read-only access to project areas
```

### 5. Verify Permission Enforcement

After launching agents, check their tmux sessions:

```bash
# List active sessions
tmux list-sessions

# Attach to an agent session
tmux attach-session -t vcorp-{agent_id}

# Test permissions within agent session:
# - Try to write to main project (should fail for standard developers)
# - Try to access other agent workspaces (should fail for all non-leads)
# - Try to run dangerous commands (should fail for all)
```

### 6. Permission Verification Commands

Within agent tmux sessions, test these scenarios:

**Standard Developer (should fail):**
```bash
cd ./project/  # Should be blocked
echo "test" > ./project/test.txt  # Should be blocked
cd ./agent_workspaces/other_agent/  # Should be blocked
```

**Standard Developer (should work):**
```bash
cd ./agent_workspaces/{their_agent_id}/
echo "test" > ./agent_workspaces/{their_agent_id}/test.txt
cat ./project/package.json  # Read-only access
```

**Lead Developer (should work):**
```bash
cd ./project/
echo "test" > ./project/test.txt
cd ./agent_workspaces/any_agent/
```

## Expected Directory Structure

For a project at `/path/to/project`, agents should have access patterns like:

```
/path/to/project/
├── project/                           # Main project (Lead: RW, Standard: R, Management: R)
│   ├── src/
│   ├── package.json
│   └── ...
└── agent_workspaces/                  # Agent workspaces
    ├── be_alice_1234/                 # Backend agent workspace (Owner: RW, Lead: RW, Others: blocked)
    │   └── be_1234_auth_system/       # Task-specific worktree
    ├── fe_bob_5678/                   # Frontend agent workspace
    │   └── fe_5678_login_ui/
    └── pm_carol_9999/                 # Product manager workspace
        └── documents/
```

## Troubleshooting

### Issue: Permissions not applied
**Solution:** Check that role has `permissions` field populated in database

### Issue: Agent launch fails
**Solution:** Check logs for permission parsing errors, validate JSON structure

### Issue: Access denied for legitimate operations
**Solution:** Review permission templates in `permissions.ts`, adjust as needed

### Issue: Too permissive access
**Solution:** Verify Claude Code permission syntax, check for typos in deny rules

## Security Notes

- Permissions are enforced by Claude Code at the system level
- {AGENT_ID} placeholders are resolved at launch time for workspace isolation
- Default to restrictive permissions for any unconfigured roles
- Human Director maintains full access for emergency situations
- All permission changes require template re-seeding

## Next Steps

1. **Fine-tuning**: Based on actual usage, adjust permission templates
2. **Monitoring**: Add logging for permission violations 
3. **UI Integration**: Create permission management interface
4. **Audit Trail**: Track permission changes and violations
5. **Documentation**: Update agent onboarding with permission model