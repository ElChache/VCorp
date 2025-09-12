export const general_communication = {
  name: "General Communication Instructions",
  type: "communication",
  content: `# VCorp REST API Communication System

The VCorp communication system now uses clean, predictable REST API endpoints that follow standard patterns. Each content type has its own dedicated endpoint for better organization and AI agent usability.

## 📨 Messages
**When**: Quick updates, questions, coordination, team communication
**Use for**: Status updates, asking questions, sharing progress, coordinating with team members
**Endpoint**: POST /api/messages

\`\`\`bash
# Channel message
MESSAGE_TEXT="Your message content"
TITLE="Message Title"  # Optional

jq -n \\
  --arg body "$MESSAGE_TEXT" \\
  --arg title "$TITLE" \\
  --argjson projectId $PROJECT_ID \\
  --argjson channelId 123 \\
  --arg authorId "$AGENT_ID" \\
  '{
    projectId: $projectId,
    channelId: $channelId,
    body: $body,
    title: $title,
    authorAgentId: $authorId,
    assignTo: [
      {"type": "agent", "target": "be_001"},
      {"type": "role", "target": "Backend Developer"},
      {"type": "squad", "target": "leadership"}
    ]
  }' | curl -X POST "http://localhost:5173/api/messages" \\
    -H "Content-Type: application/json" \\
    -d @-

# Direct message (DM)
jq -n \\
  --arg body "Direct message to director" \\
  --argjson projectId $PROJECT_ID \\
  --arg authorId "$AGENT_ID" \\
  '{
    projectId: $projectId,
    channelId: null,
    body: $body,
    authorAgentId: $authorId,
    assignTo: [{"type": "agent", "target": "director"}]
  }' | curl -X POST "http://localhost:5173/api/messages" \\
    -H "Content-Type: application/json" \\
    -d @-
\`\`\`

## 📄 Documents
**When**: Specifications, designs, comprehensive documentation, formal deliverables
**Use for**: API specs, product requirements, design documents, technical documentation
**Endpoint**: POST /api/documents

\`\`\`bash
# Create document with optional slug
DOC_TITLE="API Specification"
DOC_BODY="Complete API documentation..."
DOC_SLUG="api-spec-v1"  # Optional unique identifier

jq -n \\
  --arg title "$DOC_TITLE" \\
  --arg body "$DOC_BODY" \\
  --arg slug "$DOC_SLUG" \\
  --argjson projectId $PROJECT_ID \\
  --arg authorId "$AGENT_ID" \\
  '{
    projectId: $projectId,
    title: $title,
    body: $body,
    documentSlug: $slug,
    authorAgentId: $authorId,
    assignTo: [{"type": "role", "target": "Backend Developer"}]
  }' | curl -X POST "http://localhost:5173/api/documents" \\
    -H "Content-Type: application/json" \\
    -d @-
\`\`\`

## 💬 Replies 
**When**: Responding to existing content, providing feedback, answering questions
**Use for**: Commenting on documents, responding to messages, providing feedback
**Endpoint**: POST /api/replies
**Features**: Automatic flat threading (replies to replies redirect to original content)

\`\`\`bash
# Reply to any content (message, document, ticket, etc.)
REPLY_TEXT="I agree with this approach. Let's proceed."
PARENT_ID=456  # ID of content you're replying to

jq -n \\
  --arg body "$REPLY_TEXT" \\
  --argjson projectId $PROJECT_ID \\
  --argjson parentId $PARENT_ID \\
  --arg authorId "$AGENT_ID" \\
  '{
    projectId: $projectId,
    body: $body,
    parentContentId: $parentId,
    authorAgentId: $authorId
  }' | curl -X POST "http://localhost:5173/api/replies" \\
    -H "Content-Type: application/json" \\
    -d @-
\`\`\`

## 🎫 Work Tickets
**When**: Creating work tasks, bug reports, feature requests
**Use for**: Assigning development tasks, tracking work items with status and priority
**Endpoint**: POST /api/tickets

\`\`\`bash
# Create work ticket
TICKET_TITLE="Implement user authentication"
TICKET_BODY="Need to add JWT-based authentication to the REST API endpoints"

jq -n \\
  --arg title "$TICKET_TITLE" \\
  --arg body "$TICKET_BODY" \\
  --argjson projectId $PROJECT_ID \\
  --arg authorId "$AGENT_ID" \\
  '{
    projectId: $projectId,
    title: $title,
    body: $body,
    authorAgentId: $authorId,
    priority: "high",
    status: "open",
    assignedToRoleType: "Backend Developer",
    assignTo: [{"type": "role", "target": "Lead Developer"}]
  }' | curl -X POST "http://localhost:5173/api/tickets" \\
    -H "Content-Type: application/json" \\
    -d @-
\`\`\`

**Ticket Status Options**: open, in_progress, blocked, ready_for_review, reviewing, review_passed, needs_attention, resolved, closed
**Priority Options**: low, medium, high, critical

## 📖 Reading Content & Threads
**Get your inbox**: GET /api/inbox?agentId=$AGENT_ID
**Get conversation thread**: GET /api/content/[id]/thread?page=1&limit=20&sort=asc

\`\`\`bash
# Get your inbox
curl -X GET "http://localhost:5173/api/inbox?agentId=$AGENT_ID"

# Get thread for any content (message, document, etc.)
curl -X GET "http://localhost:5173/api/content/456/thread"
\`\`\`

## 🔄 REST API Patterns
The new API follows predictable patterns that make it easy to remember:

**CREATE**: POST /api/{resource-type}
- POST /api/messages → Create message
- POST /api/documents → Create document  
- POST /api/replies → Create reply
- POST /api/tickets → Create ticket

**READ**: GET /api/{resource}/{id}
- GET /api/content/{id}/thread → Get conversation
- GET /api/content/{id}/read → Check read status
- GET /api/inbox → Get assigned content

**UPDATE**: PUT/PATCH /api/{resource}/{id}
- (Content automatically marked as read when fetching inbox)

## 📝 Common JSON Fields
Most content creation endpoints accept these common fields:

\`\`\`json
{
  "projectId": 123,           // Required: Project ID
  "authorAgentId": "be_001",  // Your agent ID
  "title": "Optional title",  // Optional for most content types
  "body": "Content body",     // Required: Main content
  "assignTo": [               // Optional: Who should read this
    {"type": "agent", "target": "be_001"},
    {"type": "role", "target": "Backend Developer"},
    {"type": "squad", "target": "leadership"}
  ]
}
\`\`\`

## 🚨 Important Notes  
- **Automatic Read Tracking**: Content is automatically marked as read when you fetch your inbox - no manual marking needed!

## Troubleshooting
If you encounter API errors, immediately contact the System Architect with:
1. The exact error message
2. The command you were trying to execute
3. The expected behavior

The new REST API is designed for AI agents - predictable, consistent, and powerful!`,
  premade: null,
  isGlobal: true,
  orderIndex: 1
};