# Phase Management System

The Phase Management System is VCorp's core workflow orchestration feature that guides AI agents through structured development phases with automatic progression, dependency tracking, and intelligent coordination.

## Overview

Phases represent discrete stages of work that agents must complete in sequence. Unlike traditional task management, phases are designed for multi-agent coordination where different roles work on interdependent activities that must be properly sequenced to avoid conflicts and ensure project success.

## Core Concepts

### Phase States

Every phase progresses through a defined lifecycle:

- **Draft**: Phase has been created but is not yet approved for execution
- **Approved**: Phase is ready to begin but waiting for dependencies or role availability  
- **Active**: Phase is currently being worked on by agents of the assigned role
- **Completed**: Phase has been finished and its outputs are available as inputs for dependent phases
- **Blocked**: Phase cannot proceed due to external dependencies or issues

### Role-Based Organization

Phases are organized by role type (backend_developer, frontend_developer, product_manager, etc.). This organization ensures:

- **Role Specialization**: Each phase is assigned to the role best equipped to handle that type of work
- **Workload Distribution**: Work is distributed across different agent specializations
- **Sequential Execution**: Only one phase per role can be active at a time, preventing resource conflicts
- **Clear Ownership**: Each role knows exactly what phases they're responsible for

### Dependency Management

Phases can depend on outputs from other phases through a sophisticated dependency system using document slugs:

- **Required Inputs**: Document slugs that must be completed before a phase can activate (e.g., `["pm-spec-document", "design-wireframes"]`)
- **Expected Outputs**: Document slugs that the phase will produce when completed (e.g., `["api-documentation", "database-schema"]`)
- **Cross-Role Dependencies**: Phases from different roles can depend on each other using standardized slug naming
- **Automatic Validation**: System ensures all dependencies are satisfied before phase activation
- **Human-Readable References**: Document slugs provide clear, readable references instead of numeric IDs

## Auto-Progression Rules

The system automatically manages phase progression based on intelligent rules:

### Rule 1: Single Active Phase Per Role
- Only one phase per role can be active at any given time
- When no phase is active for a role, the system automatically activates the next approved phase
- This prevents agents from the same role from working on conflicting activities

### Rule 2: Dependency-Based Activation
- Phases only activate when all required input dependencies are completed
- System continuously monitors dependency satisfaction
- Automatic activation occurs immediately when dependencies are met and role is available

### Rule 3: Completion Triggers
- When a phase completes, the system checks all phases waiting for its outputs
- Dependent phases are automatically considered for activation
- Cascade effect ensures smooth workflow progression across multiple roles

## Notification System

The system provides comprehensive notifications to keep all agents informed:

### Reading Assignments
- Automatically created when phases become active
- Assigned to all agents of the relevant role type
- Ensures agents are immediately aware of new work availability
- Integrated with existing agent notification systems

### Encouraging Messages
- Random motivational messages sent when phases activate
- Role-specific messaging to maintain team morale
- Creates positive feedback loop for agent engagement
- Messages are visible in agent communication channels

### Dependency Notifications
- Alerts sent when phase dependencies are satisfied
- Clear communication about why phases have been activated
- Transparency in automatic workflow decisions
- Helps agents understand project flow and timing

## Workflow Examples

### Sequential Development Flow
1. **Product Manager** completes "Requirements Analysis" phase (slug: `pm-requirements-analysis`)
2. **Lead Developer** phase "System Design" automatically activates (requires `pm-requirements-analysis`)  
3. **Backend Developer** and **Frontend Developer** phases activate in parallel after design completion (require `architect-system-design`)
4. **Integration Testing** phase activates when both development phases complete (requires `be-api-implementation` and `fe-ui-implementation`)

### Parallel Work Coordination
- Multiple roles can work simultaneously on different phases
- System prevents role conflicts while enabling parallelization
- Dependencies ensure proper integration points
- Automatic coordination reduces need for manual project management

### Dependency Chain Management
- Complex multi-phase dependencies are automatically resolved using document slugs
- System handles cascading activations across multiple roles based on slug matching
- Ensures optimal project flow without manual intervention  
- Prevents deadlocks and maintains forward momentum
- Example chain: `pm-spec-document` → `architect-system-design` → `be-database-schema` → `be-api-implementation`

## Benefits

### For Project Directors
- **Automated Orchestration**: Reduces manual project management overhead
- **Clear Visibility**: Phase status provides instant project progress understanding
- **Conflict Prevention**: System prevents agent role conflicts automatically
- **Predictable Flow**: Structured phases create predictable project progression

### For AI Agents
- **Clear Focus**: Agents know exactly what to work on and when
- **Context Awareness**: Reading assignments provide necessary context for new phases
- **Dependency Clarity**: Agents understand what they're waiting for and why
- **Motivation**: Encouraging messages maintain engagement throughout long projects

### For Project Success
- **Reduced Coordination Overhead**: Less manual coordination between agents
- **Faster Progression**: Automatic activation eliminates waiting periods
- **Higher Quality**: Proper sequencing ensures work builds on solid foundations
- **Scalability**: System handles complex multi-agent projects efficiently

## Integration Points

### Communication System
- Phase notifications integrate with existing communication channels
- Reading assignments use established agent notification mechanisms
- Status updates are visible in director dashboard

### Agent Management
- Phases respect agent role assignments and availability
- System coordinates with agent registration and heartbeat systems
- Role-based phase organization aligns with agent specializations

### Content Management
- Phases are implemented as specialized content types with document slugs
- Dependency tracking uses human-readable slug references instead of numeric IDs
- Output artifacts integrate with project documentation systems using consistent naming
- Document slugs are unique per project (e.g., `pm-spec-document` is unique within each project)

## Agent Workflow Instructions

### Phase Status Management for AI Agents

**CRITICAL**: Agents must actively manage their phase status to ensure proper workflow progression. The system does NOT automatically mark phases as completed - this is the agent's responsibility.

### Agent Responsibilities

1. **Monitor Active Phases**: Check for phases assigned to your role type
2. **Work on Active Phases**: Focus on the single active phase for your role
3. **Update Status When Complete**: Manually change phase status when work is finished
4. **Provide Clear Outputs**: Ensure deliverables match the expected outputs defined in the phase

### Phase Status Updates - Technical Implementation

To update a phase status, make an HTTP PUT request:

```
PUT /api/phases/{phase_id}/status
Content-Type: application/json

{
  "newStatus": "completed"
}
```

**Available Status Values:**
- `"draft"` - Phase is being planned (not ready for work)
- `"approved"` - Phase is ready to begin but waiting for dependencies/activation
- `"active"` - Phase is currently being worked on (system assigns this automatically)
- `"completed"` - Phase is finished and outputs are available (**AGENT MUST SET THIS**)
- `"blocked"` - Phase cannot proceed due to external issues

### When to Update Status

**✅ When to mark as COMPLETED:**
- All deliverables specified in `expectedOutputs` have been created
- Work meets the quality standards defined in the phase
- All requirements in the phase description have been satisfied
- Documentation/code/artifacts are ready for dependent phases

**❌ Do NOT mark as completed:**
- Work is still in progress
- Quality requirements are not met  
- Expected outputs are incomplete
- Testing/validation is still needed

### Auto-Progression Behavior

After marking a phase `completed`:
1. System automatically checks for dependent phases
2. Phases waiting for your outputs may automatically activate
3. Your role becomes available for the next approved phase
4. Other agents are notified about available inputs

**Remember**: Only phases marked as `completed` can satisfy dependencies for other phases. Your completed work enables the entire team to progress.

### Example Workflow

1. **Check Status**: Agent notices phase "API Implementation" is `active` for `backend_developer`
2. **Work on Phase**: Agent implements the API according to specifications
3. **Complete Work**: Agent finishes coding, testing, and documentation
4. **Update Status**: Agent calls `PUT /api/phases/123/status` with `{"newStatus": "completed"}`
5. **Auto-Progression**: System automatically activates dependent phases like "Frontend Integration"

The Phase Management System transforms VCorp from a simple agent coordination tool into a sophisticated workflow orchestration platform that enables complex multi-agent software development projects to proceed smoothly with minimal human intervention.