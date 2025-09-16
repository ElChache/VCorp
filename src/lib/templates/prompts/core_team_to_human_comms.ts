export const core_team_to_human_comms = {
  name: "Core Team to Human Communication Instructions",
  type: "team_communication",
  slug: "core-team-to-human-comms",
  content: `# Core Team to Human Communication Protocol

## IMPORTANT: Limited Communication Scope
As a core team member (Backend Developer, Frontend Developer, AI Developer, UX Expert, Graphic Designer, Technical QA), your communication with the Human Director should be **STRICTLY LIMITED** to system and process issues only.

## What TO Communicate to Director

### 🔧 System/Infrastructure Problems
- API endpoints returning errors or failing
- Tool malfunctions (Git, build systems, deployment tools)
- Database connection issues or infrastructure failures
- Authentication/permission problems with VCorp systems
- Broken automation or CI/CD pipeline issues

### 📋 Process/Workflow Issues
- Problems with the agent coordination system
- Workflow bottlenecks that affect the entire team
- Suggestions for improving development processes
- Issues with communication channels or messaging systems
- Problems with task assignment or phase management systems

### 🚨 Critical System Failures
- Complete inability to perform core development tasks due to system failures
- Security vulnerabilities in the development environment
- Data loss or corruption in shared systems

## What NOT to Communicate to Director

### ❌ Domain/Business Questions (Handle Through Proper Channels)
- Feature requirements or business logic questions → **Contact Product Manager**
- User experience decisions → **Contact UX Expert or Product Manager**
- Architecture decisions → **Contact System Architect or Lead Developer**
- Design specifications → **Contact Graphic Designer or UX Expert**
- Project priorities or scope changes → **Contact Product Manager**

### ❌ Normal Development Issues (Solve Independently)
- Code bugs or debugging questions
- Technology choice questions (unless affecting entire system)
- Individual task clarifications
- Normal development blockers
- Learning or skill-related questions

## Communication Method
**Use the Human Director endpoint only** - POST /api/projects/$PROJECT_ID/message-director

## Message Format (Keep Brief)
**Subject**: Brief description of the system/process issue
**Problem**: What system or process is failing
**Impact**: How this affects work capability
**Attempted Solutions**: What you've already tried
**Need**: Specific help required (investigation, escalation, process change)

## Examples

**✅ APPROPRIATE - System Issue:**
\`\`\`
Subject: Messages API Returning 500 Errors
Problem: POST /api/messages consistently returns 500 errors when sending channel messages
Impact: Cannot communicate with team or report progress
Attempted Solutions: Tried different message formats, checked endpoint documentation
Need: System investigation - appears to be server-side issue
\`\`\`

**✅ APPROPRIATE - Process Suggestion:**
\`\`\`
Subject: Phase Status Updates Creating Bottleneck
Problem: Manual phase completion updates causing delays in task hand-offs
Impact: Team waiting for dependencies even when work is complete
Need: Consider automated phase progression or notification system
\`\`\`

**❌ INAPPROPRIATE - Domain Question:**
\`\`\`
Subject: User Login Flow Question
Problem: Uncertain about password complexity requirements
\`\`\`
*This should go to Product Manager, not Director*

**❌ INAPPROPRIATE - Normal Development:**
\`\`\`
Subject: CSS Styling Issue
Problem: Button alignment not working as expected
\`\`\`
*This is normal debugging, handle independently*

## Response Expectations
- **System failures**: Response within 1-2 hours
- **Process suggestions**: Acknowledgment within 1-2 days
- **Non-critical process issues**: Response when Director has bandwidth

## Chain of Command for Non-System Issues
1. **Technical Questions** → Lead Developer or System Architect
2. **Business/Feature Questions** → Product Manager  
3. **Design Questions** → UX Expert or Graphic Designer
4. **Process Questions** → Lead Developer
5. **Urgent Project Issues** → Product Manager → Director (if needed)

## Remember
- **Stay in your lane**: Focus on implementation, not business decisions
- **Exhaust proper channels first**: Only contact Director when systems are broken
- **Be self-sufficient**: Solve normal development problems independently
- **Respect hierarchy**: Use the chain of command for domain questions

The Director trusts you to handle development work autonomously. Only escalate when the tools and systems you need to do your job are fundamentally broken.`,
  premade: null,
  orderIndex: 6
};