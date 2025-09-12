import { pgTable, text, integer, timestamp, boolean, unique, index } from 'drizzle-orm/pg-core';

// Core VCorp Tables
export const projects = pgTable('projects', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	description: text('description'),
	path: text('path').notNull(),
	techStack: text('tech_stack'),
	status: text('status').notNull().default('active'), // active, paused, completed, archived
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const roleTemplates = pgTable('role_templates', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	description: text('description'),
	prefix: text('prefix').notNull(), // Agent ID prefix like 'be', 'fe', 'pm'
	version: integer('version').notNull().default(1),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const promptTemplates = pgTable('prompt_templates', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	type: text('type').notNull(), // 'system_intro', 'communication', 'worktree_workflow', 'company_workflow'
	content: text('content').notNull(),
	premade: text('premade'), // null for normal prompts, 'channel-instructions' for dynamic channel prompts
	isGlobal: boolean('is_global').notNull().default(false), // true for global prompts that apply to everyone
	version: integer('version').notNull().default(1),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const rolePromptCompositionTemplates = pgTable('role_prompt_composition_templates', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	roleTemplateId: integer('role_template_id').notNull().references(() => roleTemplates.id),
	promptTemplateId: integer('prompt_template_id').notNull().references(() => promptTemplates.id),
	orderIndex: integer('order_index').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const squadTemplates = pgTable('squad_templates', {
	id: text('id').primaryKey(), // 'leadership', 'core_team'
	name: text('name').notNull(),
	squadPrompt: text('squad_prompt').notNull(),
	description: text('description'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const channelTemplates = pgTable('channel_templates', {
	id: text('id').primaryKey(), // 'general', 'announcements', 'support'
	name: text('name').notNull(),
	description: text('description'),
	promptForAgents: text('prompt_for_agents'),
	isMainChannel: boolean('is_main_channel').notNull().default(false),
	isForHumanDirector: boolean('is_for_human_director').notNull().default(false), // Template for director communication channels
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const squads = pgTable('squads', {
	id: text('id').primaryKey(), // Same as squad name to avoid confusion
	projectId: integer('project_id').notNull().references(() => projects.id),
	templateId: text('template_id').notNull().references(() => squadTemplates.id),
	name: text('name').notNull(), // Same as id
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const roles = pgTable('roles', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	projectId: integer('project_id').notNull().references(() => projects.id),
	templateId: integer('template_id').references(() => roleTemplates.id), // null for custom roles
	name: text('name').notNull(),
	content: text('content').notNull(), // Role-specific content (from role template file)
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const prompts = pgTable('prompts', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	projectId: integer('project_id').notNull().references(() => projects.id),
	templateId: integer('template_id').references(() => promptTemplates.id), // null for custom prompts
	name: text('name').notNull(),
	type: text('type').notNull(), // 'system_intro', 'communication', etc.
	content: text('content').notNull(),
	premade: text('premade'), // null for normal prompts, inherited from template or custom
	isGlobal: boolean('is_global').notNull().default(false), // inherited from template or custom
	orderIndex: integer('order_index').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const rolePromptCompositions = pgTable('role_prompt_compositions', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	roleId: integer('role_id').notNull().references(() => roles.id),
	promptId: integer('prompt_id').notNull().references(() => prompts.id),
	orderIndex: integer('order_index').notNull().default(0),
});


export const agents = pgTable('agents', {
	id: text('id').primaryKey(), // 'be_17b9' - the actual agent ID
	projectId: integer('project_id').notNull().references(() => projects.id),
	roleId: integer('role_id').references(() => roles.id), // FK to specific role instance (nullable)
	roleType: text('role_type').notNull(), // Generic role type: 'backend_developer', 'product_manager'
	squadId: text('squad_id').references(() => squads.id),
	model: text('model').notNull().default('sonnet'), // 'sonnet', 'opus', 'haiku'
	status: text('status').notNull().default('launching'), // launching, active, offline
	tmuxSession: text('tmux_session'),
	worktreePath: text('worktree_path'), // PROJECT_FOLDER/agent_workspaces/agent_id/
	lastHeartbeat: timestamp('last_heartbeat').notNull().defaultNow(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Content & Coordination Tables
export const channels = pgTable('channels', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	projectId: integer('project_id').notNull().references(() => projects.id),
	name: text('name').notNull(),
	description: text('description'), // For UI
	promptForAgents: text('prompt_for_agents'), // When agents should use this channel
	isMainChannel: boolean('is_main_channel').notNull().default(false),
	isForHumanDirector: boolean('is_for_human_director').notNull().default(false), // Channel for agent-to-human communication
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const content = pgTable('content', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	projectId: integer('project_id').notNull().references(() => projects.id),
	channelId: integer('channel_id').references(() => channels.id), // Can be null for DM messages
	parentContentId: integer('parent_content_id'), // For replies and threaded conversations - self-reference added below
	type: text('type').notNull(), // 'message', 'document', 'reply', 'ticket', 'phase'
	title: text('title'),
	body: text('body').notNull(),
	documentSlug: text('document_slug'), // Unique slug per project for referencing (e.g., 'pm-specification-document')
	authorAgentId: text('author_agent_id').references(() => agents.id),
	squadId: text('squad_id').references(() => squads.id), // Squad context for content
	
	// Ticket-specific fields (optional)
	status: text('status'), // 'open', 'in_progress', 'blocked', 'ready_for_review', 'reviewing', 'review_passed', 'needs_attention', 'resolved', 'closed' - only for tickets
	priority: text('priority'), // 'low', 'medium', 'high', 'critical' - only for tickets
	assignedToRoleType: text('assigned_to_role_type'), // Generic role type: 'backend_developer' - for ticket assignment
	claimedByAgent: text('claimed_by_agent').references(() => agents.id), // Agent who picked it up
	
	// Phase-specific fields (optional) 
	phaseStatus: text('phase_status'), // 'draft', 'approved', 'active', 'completed', 'blocked' - only for phases
	requiredInputs: text('required_inputs'), // JSON array of document slugs: ["pm-spec", "design-doc"] - for phases
	expectedOutputs: text('expected_outputs'), // JSON array of document slugs: ["api-spec", "db-schema"] - for phases
	
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const readingAssignments = pgTable('reading_assignments', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	contentId: integer('content_id').notNull().references(() => content.id),
	assignedToType: text('assigned_to_type').notNull(), // 'role', 'agent', 'squad'
	assignedTo: text('assigned_to').notNull(), // 'backend_developer', 'be_primary_001_a7b9', or 'leadership'
	assignedAt: timestamp('assigned_at').notNull().defaultNow(),
	lastNotifiedAt: timestamp('last_notified_at'), // Track when agents were last notified about this assignment (resets after 1 min for re-notification)
});

export const readingAssignmentReads = pgTable('reading_assignment_reads', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	readingAssignmentId: integer('reading_assignment_id').notNull().references(() => readingAssignments.id),
	agentId: text('agent_id').notNull().references(() => agents.id),
	readAt: timestamp('read_at').notNull().defaultNow(),
	acknowledged: boolean('acknowledged').notNull().default(false),
});

// Role assignment board (replaces old roles.json)
export const roleAssignments = pgTable('role_assignments', {
	id: text('id').primaryKey(), // 'pm', 'architect', 'lead', 'be_1', 'fe_1', 'ai_1'
	projectId: integer('project_id').notNull().references(() => projects.id),
	roleType: text('role_type').notNull(), // Generic role type: 'backend_developer', 'product_manager'  
	priority: integer('priority').notNull(), // 1=highest, 2, 3, etc. (pm=1, architect=2, lead=3)
	assignedAgent: text('assigned_agent').references(() => agents.id), // NULL = available
	status: text('status').notNull().default('available'), // 'available', 'claimed', 'active'
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Task management
export const tasks = pgTable('tasks', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	projectId: integer('project_id').notNull().references(() => projects.id),
	assignedToRoleType: text('assigned_to_role_type'), // Generic role type: 'backend_developer' - for initial assignment
	claimedByAgent: text('claimed_by_agent').references(() => agents.id), // Agent who claimed it
	title: text('title').notNull(),
	description: text('description'),
	status: text('status').notNull().default('ready'), // ready, in_progress, needs_clarification, blocked, needs_qa, qa_blocked, done, review_blocked, passed
	priority: text('priority').notNull().default('medium'), // low, medium, high, critical
	branchName: text('branch_name'), // e.g. 'be_3422_auth_system' - computed from role_taskid_description
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
});


// Channel-Role Assignment Templates (defines which roles should be assigned to channel templates)
export const channelRoleAssignmentTemplates = pgTable('channel_role_assignment_templates', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	channelTemplateId: text('channel_template_id').notNull().references(() => channelTemplates.id),
	roleTemplateId: integer('role_template_id').notNull().references(() => roleTemplates.id),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Squad-Role Assignment Templates (defines which roles should be assigned to squad templates)
export const squadRoleAssignmentTemplates = pgTable('squad_role_assignment_templates', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	squadTemplateId: text('squad_template_id').notNull().references(() => squadTemplates.id),
	roleTemplateId: integer('role_template_id').notNull().references(() => roleTemplates.id),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Squad-Prompt Assignment Templates (defines which prompts should be assigned to squad templates)
export const squadPromptAssignmentTemplates = pgTable('squad_prompt_assignment_templates', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	squadTemplateId: text('squad_template_id').notNull().references(() => squadTemplates.id),
	promptTemplateId: integer('prompt_template_id').notNull().references(() => promptTemplates.id),
	orderIndex: integer('order_index').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Channel-Role Assignments (actual assignments per project)
export const channelRoleAssignments = pgTable('channel_role_assignments', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	channelId: integer('channel_id').notNull().references(() => channels.id),
	roleId: integer('role_id').notNull().references(() => roles.id),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Squad-Role Assignments (many-to-many relationship between squads and roles)
export const squadRoleAssignments = pgTable('squad_role_assignments', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	squadId: text('squad_id').notNull().references(() => squads.id),
	roleId: integer('role_id').notNull().references(() => roles.id),
	createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
	// Ensure unique squad-role combinations
	uniqueSquadRole: unique().on(table.squadId, table.roleId)
}));

// Squad-Prompt Assignments (project-level assignments of prompts to squads)
export const squadPromptAssignments = pgTable('squad_prompt_assignments', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	squadId: text('squad_id').notNull().references(() => squads.id),
	promptId: integer('prompt_id').notNull().references(() => prompts.id),
	orderIndex: integer('order_index').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
	// Ensure unique squad-prompt combinations
	uniqueSquadPrompt: unique().on(table.squadId, table.promptId)
}));

// Role-specific prompt ordering (defines custom order of ALL prompts for each role)
export const rolePromptOrders = pgTable('role_prompt_orders', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	roleId: integer('role_id').notNull().references(() => roles.id),
	promptId: integer('prompt_id').notNull().references(() => prompts.id),
	orderIndex: integer('order_index').notNull(),
	source: text('source').notNull(), // 'role', 'squad', 'global'
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
	// Ensure unique role-prompt combinations
	uniqueRolePrompt: unique().on(table.roleId, table.promptId)
}));

// Phase Templates
export const phaseTemplates = pgTable('phase_templates', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	description: text('description'),
	workflow_description: text('workflow_description').notNull(),
	required_inputs: text('required_inputs'),
	expected_outputs: text('expected_outputs'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Phase Role Assignment Templates (links phases to roles)
export const phaseRoleAssignmentTemplates = pgTable('phase_role_assignment_templates', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	phaseTemplateId: integer('phase_template_id').notNull().references(() => phaseTemplates.id),
	roleTemplateId: integer('role_template_id').notNull().references(() => roleTemplates.id),
	phaseOrder: integer('phase_order').notNull().default(1),
	createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
	// Ensure unique phase-role combinations
	uniquePhaseRole: unique().on(table.phaseTemplateId, table.roleTemplateId)
}));

// Scheduled Reminders - Automated periodic messages to roles
export const scheduledReminders = pgTable('scheduled_reminders', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	projectId: integer('project_id').notNull().references(() => projects.id),
	name: text('name').notNull(), // Human readable name for the reminder
	targetRoleType: text('target_role_type').notNull(), // Role type to send reminder to
	message: text('message').notNull(), // The reminder message content
	frequencyMinutes: integer('frequency_minutes').notNull(), // How often to send (in minutes)
	isActive: boolean('is_active').notNull().default(true), // Can be toggled on/off
	lastSentAt: timestamp('last_sent_at'), // When it was last sent (null if never sent)
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Project Phases - Actual phase instances for projects
export const phases = pgTable('phases', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	projectId: integer('project_id').notNull().references(() => projects.id),
	roleId: integer('role_id').notNull().references(() => roles.id),
	templateId: integer('template_id').notNull().references(() => phaseTemplates.id),
	name: text('name').notNull(),
	description: text('description'),
	workflowDescription: text('workflow_description').notNull(),
	requiredInputs: text('required_inputs'), // JSON array of document slugs
	expectedOutputs: text('expected_outputs'), // JSON array of document slugs
	phaseOrder: integer('phase_order').notNull().default(1),
	status: text('status').notNull().default('draft'), // 'draft', 'approved', 'active', 'completed', 'blocked'
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
	// Ensure unique phase per role per project per order
	uniqueProjectRolePhaseOrder: unique().on(table.projectId, table.roleId, table.phaseOrder)
}));