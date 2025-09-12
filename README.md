# VCorp - AI Agent Software Development Platform

VCorp is an advanced multi-agent AI system that operates as a virtual software development company. Multiple specialized AI agents collaborate in defined roles to build complete applications from requirements to production-ready code.

## Core Concept

VCorp simulates a real software development company where AI agents take on roles like Product Manager, System Architect, Backend Developer, Frontend Developer, and more. Each agent has carefully crafted prompts that define their expertise, responsibilities, and communication patterns, enabling them to work together autonomously on complex software projects.

## Key Features

### 🤖 **Multi-Agent Coordination**
- Specialized AI agents with distinct roles and expertise
- Autonomous collaboration through structured communication channels
- Real-time message threading and reply systems
- Reading assignments to ensure agents stay informed

### 📋 **Project Management**
- Complete project lifecycle from setup to delivery
- Phase-based development with automatic progression
- Ticket system for task tracking and assignment
- Role-based access control and permissions

### 💬 **Real-Time Communications Center**
- **Live polling system** with 5-second updates for instant message delivery
- **Unread badge system** with cross-section visibility and accurate counting
- **Channel-based communication** for different project areas with role assignments
- **Direct messaging** between agents with conversation threading
- **Document reply system** for threaded comments on documents (separate from chat)
- **Reading assignments** with automatic role-based distribution and tracking
- **Message threading** with visual hierarchy and reply-to-reply support
- **forHumanDirector channels** for automatic escalation to human oversight

### 🏗️ **Template System**
- Pre-configured role templates with optimized prompts
- Phase templates for structured development workflows
- Channel templates for organized communication
- Squad templates for team composition

### 🎯 **Quality Standards**
- Excellence-focused role definitions demanding production-grade output
- Product Manager with absolute veto power over feature shipping
- System Architect ensuring bulletproof technical architecture
- Uncompromising quality standards across all roles

## System Architecture

### **Database Layer**
- PostgreSQL with Drizzle ORM
- Comprehensive schema for projects, agents, roles, content, and communications
- Support for complex relationships between agents, squads, and projects

### **API Layer** 
- SvelteKit-based REST API endpoints
- Real-time communication management
- Reading assignment tracking and notification system
- Project template instantiation

### **Frontend**
- Responsive SvelteKit web interface
- Real-time updates and message threading
- Director dashboard for project oversight
- Channel management with role-based access

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- pnpm (recommended) or npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up your database and configure environment variables

4. Seed the system with templates:
   ```bash
   # Initialize role and phase templates
   curl -X POST http://localhost:5173/api/templates/seed
   
   # Or visit in browser: http://localhost:5173/api/templates/seed
   ```

5. Start the development server:
   ```bash
   pnpm run dev
   ```

### Creating Your First Project

1. Navigate to the VCorp interface
2. Click "Create Project" and provide:
   - Project name and description  
   - Local development path
3. The system automatically creates:
   - All role assignments from templates
   - Communication channels with proper permissions
   - Development phases with role assignments
   - Initial project structure

## Role System

VCorp includes several pre-configured roles with excellence-focused prompts:

- **Product Manager**: Quality guardian with final approval authority
- **System Architect**: Technical excellence and bulletproof architecture
- **Backend Developer**: Robust, scalable server-side solutions  
- **Frontend Developer**: Intuitive, performant user interfaces
- **Tech Lead**: Code quality and team coordination
- **Core Team Member**: Supporting development and quality assurance

Each role has carefully crafted prompts that emphasize:
- Production-grade quality standards
- User-centric thinking and decision making
- Clear communication within the VCorp system
- Autonomous collaboration and problem-solving

## Communication Flow

1. **Director Inbox**: Receives urgent messages and decisions requiring human oversight
2. **Project Channels**: Role-based communication for specific project areas
3. **Message Threading**: Replies are visually organized under parent messages
4. **Reading Assignments**: Ensures all relevant agents see important communications
5. **Status Tracking**: Visual indicators for read/unread and acknowledged messages

## API Endpoints

### Core Communication APIs
- `GET /api/content/updates?projectId={id}&since={timestamp}` - Incremental content polling for real-time updates
- `POST /api/send-message` - Send messages with automatic reading assignment creation
- `GET /api/channels/{id}/messages` - Channel message history with threading support
- `GET /api/messages/direct?projectId={id}&agentId={id}` - Direct message conversations
- `POST /api/channels/{id}/messages` - Channel message posting with forHumanDirector support

### Project & Agent Management
- `GET /api/projects` - List all projects with status information
- `GET /api/projects/{id}/role-types` - Available role types (excludes Human Director)
- `GET /api/agents?projectId={id}` - Project agents with role and status information
- `POST /api/templates/seed` - Initialize system templates
- `DELETE /api/templates/reset` - Reset all templates

### Error Handling Standards
All APIs return descriptive error messages with specific validation details:
```json
{
  "error": "Missing required field: projectId must be provided to identify which project the message belongs to"
}
```

## Real-Time System Architecture

### Content Polling Service
The system uses a centralized polling service (`ContentPollingService.ts`) that:
- Polls `/api/content/updates` every 5 seconds
- Maintains timestamp-based incremental updates
- Groups content by type (channelMessages, directMessages, documents, tickets, etc.)
- Manages Svelte stores for reactive UI updates
- Automatically filters document-related content from communication channels

### Unread Badge System
Three-tier badge counting system:
1. **Total Badge**: On main "Communications Center" button - includes all unread messages and documents
2. **Channel Badge**: On "Channels" tab - counts unread channel messages only
3. **Direct Messages Badge**: On "Direct Messages" tab - counts unread DMs only

Badge counting logic ensures: `Channel Count + DM Count ≤ Total Count` (total includes documents)

### Content Type Separation
- **Messages**: Regular communications in channels or direct messages
- **Documents**: Project documents with threaded reply system (separate from chat)
- **Document Replies**: Comments on documents - kept in Documents section, excluded from Communications
- **Tickets**: Task tracking items with assignment and status management
- **Announcements**: Project-wide notifications
- **Phases**: Development phase management content

## Database Schema Overview

### Key Tables
- **projects**: Project definitions and metadata
- **agents**: AI agents with role types and project assignments
- **content**: Universal content table (messages, documents, tickets, phases)
- **channels**: Communication channels with role-based access
- **readingAssignments**: Automatic message distribution system
- **readingAssignmentReads**: Read receipt tracking for agents

### Content Relationships
```
content (parent) 
  ├── content (reply/thread)
  └── readingAssignments
      └── readingAssignmentReads
```

### Agent-Channel Permissions
- Channels have role-based access control
- `forHumanDirector` channels automatically create reading assignments for all roles except Human Director
- Reading assignments ensure proper message distribution and tracking

## Template Management

### Updating Templates
When role prompts or phase templates are modified in the codebase, you need to reset and re-seed the database:

```bash
# 1. Reset all existing templates
curl -X DELETE http://localhost:5173/api/templates/reset

# 2. Re-seed with updated templates  
curl -X POST http://localhost:5173/api/templates/seed
```

### Template Files
- **Role Templates**: `src/lib/templates/prompts/*_role.ts`
- **Phase Templates**: `src/lib/templates/phases/*.ts`
- **Core Templates**: `src/lib/templates/core-templates.ts`

## Troubleshooting & Common Issues

### Direct Messages Not Showing
If the DM badge shows a count but no messages appear:
- Check if the `/api/messages/direct` endpoint is working correctly
- Verify SQL logic in agent conversation detection
- Alternative: Use polling data from `/api/content/updates` instead

### Badge Count Discrepancies  
If badge counts don't match across sections:
- Ensure document content is included in total count but excluded from communication channels
- Verify the polling service is filtering document replies correctly
- Check `isUnreadByHumanDirector()` logic consistency

### Real-Time Updates Not Working
- Verify the ContentPollingService is properly initialized
- Check browser network tab for 5-second polling requests
- Ensure timestamp tracking is maintained between polls

### Role Selection Issues
If send message dialog shows incorrect roles:
- Verify `/api/projects/{id}/role-types` excludes "Human Director"
- Check agent table for proper role type assignments
- Ensure role-based channel permissions are correctly configured

## Testing & Verification

### Send Test Messages
```bash
# Send channel message as specific agent
curl -X POST http://localhost:5173/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "channelId": 1,
    "type": "message",
    "title": "Test Message",
    "body": "Testing channel communication",
    "authorAgentId": "pm_001"
  }'

# Send direct message
curl -X POST http://localhost:5173/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "type": "message", 
    "title": "DM Test",
    "body": "Testing direct messaging",
    "authorAgentId": "pm_001",
    "sendToAgents": ["human-director"]
  }'
```

### Verify Polling System
1. Open browser developer tools
2. Navigate to Communications Center
3. Check Network tab for regular `/api/content/updates` requests every 5 seconds
4. Verify responses contain grouped content types

## Development Workflow

### Adding New Content Types
1. Update the `content` table schema if needed
2. Modify `/api/content/updates` grouping logic
3. Add filtering logic to ContentPollingService
4. Update UI components to handle new content type
5. Test badge counting includes new content appropriately

### Modifying Communication Channels
1. Update channel templates in `src/lib/templates/`
2. Reset and re-seed templates: `curl -X DELETE /api/templates/reset && curl -X POST /api/templates/seed`
3. Test channel permissions and reading assignments
4. Verify forHumanDirector channel behavior

### Debugging Agent Interactions
1. Check agent assignments: `GET /api/agents?projectId={id}`
2. Verify reading assignments: Review `readingAssignments` and `readingAssignmentReads` tables
3. Test message flow: Send messages and verify assignment creation
4. Monitor real-time updates: Check polling responses for proper content grouping

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
