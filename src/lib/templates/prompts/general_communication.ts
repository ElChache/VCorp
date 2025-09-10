export const general_communication = {
  name: "General Communication Instructions",
  type: "communication",
  content: `# VCorp Communication System

## Messages
**When**: Quick updates, questions, coordination, team communication
**Use for**: Status updates, asking questions, sharing progress, coordinating with team members
**How**: POST /api/send-message for ALL messaging (channels, DMs, reading assignments)

\`\`\`json
{
  "projectId": 1, // Required: Project ID where message belongs
  "channelId": 123, // Optional: Add channelId to send to a channel, omit for private DM
  "body": "Your message content", // Required: The actual message text
  "title": "Message Title", // Optional: Title for the message
  "type": "message", // Optional: Type of content - defaults to "message"
  "parentContentId": 456, // Optional: ID of parent message if this is a reply
  "authorAgentId": "$AGENT_ID", // Optional: Your agent ID as the sender
  "assignTo": [ // Required: Who should read this message
    {"type": "agent", "target": "be_001"}, // Send to specific agent
    {"type": "role", "target": "Backend Developer"}, // Send to all agents with this role
    {"type": "squad", "target": "leadership"}, // Send to all agents in this squad
    {"type": "agent", "target": "director"} // Send to human director (special agent ID)
  ]
}
\`\`\`

## Documents
**When**: Specifications, designs, comprehensive documentation, formal deliverables
**Use for**: API specs, product requirements, design documents, technical documentation
**How**: POST /api/projects/{projectId}/content

\`\`\`json
{
  "type": "document", // Required: Must be "document"
  "title": "API Specification", // Required: Document title
  "body": "Complete API documentation...", // Required: Document content
  "documentSlug": "api-spec-v1" // Optional: Unique identifier for referencing
}
\`\`\`


## Phases
**When**: Complex workflows with dependencies, multi-step processes, coordinated work
**Use for**: Managing development phases, coordinating deliverables, tracking dependencies
**How**: POST /api/projects/{projectId}/content

\`\`\`json
{
  "type": "phase", // Required: Must be "phase"
  "title": "API Development", // Required: Phase title
  "body": "Implement user endpoints...", // Required: Phase description
  "documentSlug": "api-dev-phase", // Optional: Unique identifier for this phase
  "assignedToRoleType": "backend_developer", // Optional: Role type assigned to this phase
  "phaseStatus": "draft", // Optional: "draft", "approved", "active", "completed", "blocked"
  "requiredInputs": "[\"pm-spec\", \"design-doc\"]", // Optional: JSON array of required document slugs
  "expectedOutputs": "[\"api-docs\", \"test-results\"]" // Optional: JSON array of expected output slugs
}
\`\`\`

## Announcements
**When**: Important project-wide communications, milestone achievements, major decisions
**Use for**: Notifying team of completions, sharing important updates, broadcasting decisions
**How**: POST /api/projects/{projectId}/content

\`\`\`json
{
  "type": "announcement", // Required: Must be "announcement"
  "title": "Phase 1 Complete", // Required: Announcement title
  "body": "All Phase 1 deliverables finished..." // Required: Announcement content
}
\`\`\`

## Reports
**When**: Progress reports, analysis, assessments, status summaries
**Use for**: Weekly progress, performance analysis, quality assessments, metrics reporting
**How**: POST /api/projects/{projectId}/content

\`\`\`json
{
  "type": "report", // Required: Must be "report"
  "title": "Weekly Progress Report", // Required: Report title
  "body": "Development velocity: 85% completed..." // Required: Report content
}
\`\`\`

## Replies
**When**: Responding to existing content, providing feedback, answering questions
**Use for**: Commenting on documents, responding to messages, providing feedback
**How**: POST /api/send-message

\`\`\`json
{
  "projectId": 1, // Required: Project ID
  "type": "reply", // Required: Must be "reply"
  "body": "I agree with this approach", // Required: Reply content
  "parentContentId": 456, // Required: ID of content you're replying to
  "authorAgentId": "$AGENT_ID", // Optional: Your agent ID
  "assignTo": [ // Required: Who should read this reply
    {"type": "agent", "target": "original_author"}
  ]
}
\`\`\`

## List Channels
**When**: Need to see what channels you can access
**Use for**: Finding available channels, checking channel permissions
**How**: GET /api/roles/{roleId}/channels
- Replace {roleId} with your actual role ID in the URL

## Fetch Document by Slug
**When**: Need to retrieve a specific document by its slug identifier
**Use for**: Reading documents referenced in phases/workflows (e.g., 'project-specification', 'system-architecture')
**How**: GET /api/documents/by-slug?projectId={projectId}&slug={documentSlug}
- Replace {projectId} with the project ID
- Replace {documentSlug} with the document slug (e.g., 'project-specification', 'technical-standards')
- Returns the document with title, body, and metadata

Example: /api/documents/by-slug?projectId=1&slug=project-specification

## Get Current Active Phase/Task
**When**: Need to check what phase or task you're currently assigned to work on
**Use for**: Understanding your current work assignment, getting task requirements and expected outputs
**How**: GET /api/roles/{your_role_type}/current-phase?projectId={project_id}
- Replace {your_role_type} with your role (e.g., 'Backend Developer', 'Frontend Developer') or use $AGENT_ROLE
- Replace {project_id} with the project ID
- Returns active phase details, required inputs, and expected outputs
- If no active phase, returns instruction to remain idle and help others

Example: /api/roles/Backend Developer/current-phase?projectId=1

## Mark as Read
**When**: ALWAYS after reading any message or content
**Use for**: Confirming you've read and processed content, updating reading status
**How**: POST /api/mark-read

\`\`\`json
{
  "agentId": "$AGENT_ID", // Required: Your agent ID 
  "messageId": 123, // Required: ID of the message/content you read
  "acknowledged": true // Optional: Set to true if you want to acknowledge receipt, defaults to false
}
\`\`\``,
  premade: null,
  isGlobal: true,
  orderIndex: 1
};