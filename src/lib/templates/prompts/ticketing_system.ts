export const ticketing_system = {
  name: "Ticketing System Instructions",
  type: "ticketing_system", 
  content: `# Ticketing System

## Overview
The ticketing system helps track tasks, bugs, and feature requests. Tickets can be created in any channel and assigned to roles for completion.

**Key Point**: You can work on multiple tickets simultaneously - one waiting for review while actively working on another.

## Ticket States
- **open** - Created, waiting for assignment
- **in_progress** - Agent claimed and working on it  
- **blocked** - Waiting for dependency or clarification
- **ready_for_review** - Work complete, needs review
- **reviewing** - Under review by lead/peer
- **review_passed** - Review approved, ready for completion
- **needs_attention** - Review found issues, needs fixes
- **resolved** - Work completed successfully
- **closed** - Ticket archived

## Creating Tickets
**API**: \`POST /api/content\`
\`\`\`json
{
  "type": "ticket",
  "title": "Fix authentication bug",
  "body": "Users cannot log in with email addresses containing + symbols",
  "priority": "high",
  "status": "open",
  "assignedToRoleType": "backend_developer"
}
\`\`\`

## Claiming Tickets
**API**: \`PUT /api/content/{id}\`
\`\`\`json
{
  "status": "in_progress",
  "claimedByAgent": "$AGENT_ID"
}
\`\`\`

## Updating Status
**API**: \`PUT /api/content/{id}\`
\`\`\`json
{
  "status": "ready_for_review"
}
\`\`\`

## Ticket Priorities (ALWAYS work highest priority first)
- **critical** - System down, blocks all work (drop everything)
- **high** - Major feature broken, affects users (urgent)  
- **medium** - Standard tasks, normal workflow (default)
- **low** - Nice to have, future improvement (when time permits)

**Priority Selection Strategy:**
1. Always complete critical tickets immediately
2. Work high priority before medium/low
3. Within same priority, work oldest tickets first
4. If multiple agents on same role, coordinate to avoid conflicts

## Quick Actions  
- **View open tickets by priority**: \`GET /api/content?type=ticket&status=open&priority=critical\`
- **My claimed tickets**: \`GET /api/content?type=ticket&claimedByAgent=$AGENT_ID\`
- **My role tickets**: \`GET /api/content?type=ticket&assignedToRoleType=$AGENT_ROLE&status=open\`
- **Create reading assignment for review**: \`POST /api/reading-assignments\` with Lead Developer as target`,
  premade: null,
  isGlobal: true,
  orderIndex: 11
};