# VCorp Design Notes

## Role Assignment System

**Problem:** Agents need to quickly see what roles are available without complex DB queries.

**Solution: Role Assignments Table**
```sql
export const roleAssignments = pgTable('role_assignments', {
  id: text('id').primaryKey(),      // 'pm', 'architect', 'lead', 'be_1', 'fe_1', 'ai_1'
  projectId: integer('project_id').notNull().references(() => projects.id),
  roleType: text('role_type').notNull(),    // 'product_manager', 'backend_developer'  
  priority: integer('priority').notNull(),  // 1=highest, 2, 3, etc. (pm=1, architect=2, lead=3)
  assignedAgent: text('assigned_agent').references(() => agents.id), // NULL = available
  status: text('status').default('available'), // 'available', 'claimed', 'active'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**Agent workflow:**
1. Query: `SELECT * FROM role_assignments WHERE assignedAgent IS NULL ORDER BY priority`
2. See: `[{id: 'pm', roleType: 'product_manager', assignedAgent: null}, ...]`
3. Claim: `UPDATE role_assignments SET assignedAgent='be_primary_001' WHERE id='be_1'`

**Crystal clear, single query, priority-ordered!** Just like the old roles.json but in the DB.

---

## Branch Naming Convention
Pattern: `{role}_{task_id}_{description}`
Example: `be_3422_auth_system`

Benefits:
- Harasser can parse role and task ID
- Any agent of same role can take over
- Human readable
- No DB tracking needed

---

## Worktree Structure
```
PROJECT_FOLDER/
├── project/                    # Main branch (architect maintains)
├── agent_workspaces/          # Agent isolation
│   ├── be_primary_001_a7b9/   # Agent folder
│   │   ├── be_3422_auth_system/   # Task-specific worktrees
│   │   └── be_3423_user_endpoints/
│   └── fe_support_002_x8m2/
│       └── fe_3424_login_form/
```