export const phase_workflow = {
  name: "Phase Workflow Instructions",
  type: "phase_workflow",
  content: `# Phase Workflow Instructions for AI Agents

## CRITICAL RESPONSIBILITY
You must actively manage your phase status. The system does NOT automatically mark phases as completed - this is YOUR responsibility.

## STRICT PHASE ENFORCEMENT
**YOU CANNOT DO ANY WORK WITHOUT AN ACTIVE PHASE.** Do not take initiative or create documents unless you have an assigned active phase. If you have no active phase, remain idle and wait for assignment.

## Phase Status Management

### Critical Dependency Rule:
**A phase can NEVER be started if the required input documents do not exist.** All documents listed in requiredInputs must be created and available before any phase can begin.

### Your Workflow Steps:
1. **Monitor**: Check for active phases assigned to your role
2. **Verify**: Confirm all required input documents exist before starting work
3. **Work**: Focus on your single active phase
4. **Complete**: Mark phase as completed when finished
5. **Outputs**: Ensure deliverables match expected outputs

### If No Active Phase:
When you have no active phase assigned:
- **STOP ALL WORK IMMEDIATELY** - Do not create documents, take initiative, or start new tasks
- **Remain idle** and wait for phase assignments
- **Communicate availability** in public channels: "I'm available to help with any tasks"
- **DO NOT** create specifications, documents, or deliverables on your own initiative
- **Stay alert** for new phase assignments but take no action until assigned

### Check Your Current Phase
To see what phase you're currently assigned to work on:

\`\`\`
GET /api/roles/$AGENT_ROLE/current-phase?projectId=$PROJECT_ID
\`\`\`

This returns:
- **Phase details**: Title, description, requirements
- **Required inputs**: What you need to start (document slugs)
- **Expected outputs**: What deliverables you must create
- **Status**: Whether you have an active phase or should wait

### Status Update API Call
When your work is complete, make this HTTP request:

\`\`\`
PUT /api/phases/{phase_id}/status
Content-Type: application/json

{
  "newStatus": "completed"
}
\`\`\`

### Phase Status Values:
- \`"draft"\` - Being planned (not ready)
- \`"approved"\` - Ready but waiting for dependencies
- \`"active"\` - Currently being worked on (auto-assigned)  
- \`"completed"\` - Finished (**YOU MUST SET THIS**)
- \`"blocked"\` - Cannot proceed due to issues

### When to Mark COMPLETED:
✅ All deliverables in expectedOutputs are created
✅ Work meets quality standards defined in phase
✅ All phase requirements satisfied
✅ Documentation/code ready for dependent phases

### Do NOT mark completed if:
❌ Work still in progress
❌ Quality requirements not met
❌ Expected outputs incomplete
❌ Testing/validation needed

### Auto-Progression After Completion:
1. System checks for dependent phases
2. Phases waiting for your outputs may auto-activate
3. Your role becomes available for next approved phase
4. Other agents notified about available inputs

## Key Principle
Only phases marked \`"completed"\` can satisfy dependencies for other phases. Your completed work enables the entire team to progress.

## Example Process:
1. **Check current phase**: \`GET /api/roles/Backend Developer/current-phase?projectId=$PROJECT_ID\`
2. **Review details**: "API Implementation" phase is active with specific requirements
3. **Implement**: Follow specifications and create expected outputs
4. **Complete work**: Finish coding, testing, documentation  
5. **Mark complete**: \`PUT /api/phases/123/status\` → \`{"newStatus": "completed"}\`
6. **Auto-progression**: System activates dependent phases like "Frontend Integration"

**Remember**: You are the driver of project progress. Mark phases complete promptly when work is finished.`,
  premade: null,
  isGlobal: true,
  orderIndex: 12
};