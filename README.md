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

### 📄 **Terminal Logging & Monitoring**
- **Real-time terminal capture** of all agent tmux session conversations
- **Automatic log rotation** with configurable file size limits and retention
- **API-based log access** with filtering and tail functionality
- **5-second monitoring cycle** with comprehensive statistics tracking
- **Persistent conversation history** for debugging and auditing agent behavior

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

4. **Add VCorp bin directory to your PATH** (required for agent commands):
   ```bash
   # Add this line to your shell profile (.zshrc, .bashrc, .bash_profile, etc.)
   export PATH="/path/to/vcorp/bin:$PATH"
   
   # For example, if VCorp is in /Users/username/Projects/vcorp:
   export PATH="/Users/username/Projects/vcorp/bin:$PATH"
   
   # Then reload your shell profile:
   source ~/.zshrc  # or source ~/.bashrc
   ```

5. Seed the system with templates:
   ```bash
   # Initialize role and phase templates
   curl -X POST http://localhost:5173/api/templates/seed
   
   # Or visit in browser: http://localhost:5173/api/templates/seed
   ```

6. Start the development server:
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
- `POST /api/agents/launch` - Launch an agent with tmux session
- `POST /api/templates/seed` - Initialize system templates
- `DELETE /api/templates/reset` - Reset all templates

### Document Management APIs
- `GET /api/documents?projectId={id}` - List documents with filtering and search
- `POST /api/documents` - Create document (triggers file creation)
- `GET /api/documents/{id}` - Get document by ID
- `PUT /api/documents/{id}` - Update document (syncs to file)
- `DELETE /api/documents/{id}` - Soft or hard delete document
- `GET /api/documents/by-slug?projectId={id}&slug={slug}` - Get document by slug

### Terminal Logging APIs
- `POST /api/terminal-logs` - List available terminal logs for a project
- `GET /api/terminal-logs?agentId={id}&date={date}` - Retrieve specific agent's terminal log
- `GET /api/terminal-logs?agentId={id}&tail={n}` - Get last N lines from agent's log
- `GET /api/monitoring/status` - Get monitoring service status and statistics
- `POST /api/monitoring/start` - Start the monitoring service
- `POST /api/monitoring/stop` - Stop the monitoring service

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

## Terminal Logging & Monitoring System

VCorp includes a comprehensive terminal logging system that captures and stores all agent tmux session conversations for debugging, auditing, and monitoring purposes.

### 🚀 **Getting Started with Terminal Logging**

1. **Start Monitoring Service**:
   ```bash
   curl -X POST http://localhost:5173/api/monitoring/start
   ```

2. **Check Status**:
   ```bash
   curl -X GET http://localhost:5173/api/monitoring/status
   ```

3. **List Available Logs**:
   ```bash
   curl -X POST http://localhost:5173/api/terminal-logs \
     -H "Content-Type: application/json" \
     -d '{"action": "list", "projectId": 3}'
   ```

4. **View Agent Terminal Log**:
   ```bash
   # Get specific agent's full log
   curl -X GET "http://localhost:5173/api/terminal-logs?agentId=pm_001&date=2025-09-14"
   
   # Get last 20 lines
   curl -X GET "http://localhost:5173/api/terminal-logs?agentId=pm_001&tail=20"
   ```

### 📊 **What Gets Captured**

The terminal logging system records everything visible in agent tmux sessions:
- 📬 **Automated notification messages** from the monitoring system
- 💬 **Agent conversations** and command responses
- 🔧 **Function executions** and API interactions
- ⚡ **Real-time terminal activity** with 5-second capture intervals
- 🎯 **Timestamped entries** with precise ISO timestamps

### ⚙️ **Configuration**

Terminal logging settings are configured in `src/lib/config/index.ts`:

```typescript
TERMINAL_LOGGING: {
  ENABLED: true,                           // Enable/disable logging
  LOG_DIR: '/tmp/vcorp_terminal_logs',     // Log storage directory
  CAPTURE_INTERVAL: 5000,                  // Capture every 5 seconds
  MAX_LOG_FILE_SIZE: 10 * 1024 * 1024,    // 10MB rotation limit
  MAX_LOG_FILES: 10,                       // Keep 10 rotated files
  LOG_FILE_PATTERN: 'terminal_{agentId}_{date}.log'
}
```

### 🗂️ **Log File Management**

- **Daily Files**: `terminal_pm_001_2025-09-14.log` format
- **Automatic Rotation**: Files rotate when reaching size limit
- **Retention Policy**: Keeps configurable number of old files
- **Cleanup**: Automatically removes excess rotated files

### 📈 **Monitoring Statistics**

The monitoring service tracks comprehensive metrics:
- `totalChecks`: Total monitoring cycles run
- `notificationsSent`: Messages delivered to agents
- `terminalLogsCaptured`: Terminal snapshots recorded
- `gentlePokes`: Idle agent reminders sent
- `errors`: Failed operations count
- `uptime`: Service runtime duration

### 🔧 **Advanced Usage**

```bash
# Stop monitoring service
curl -X POST http://localhost:5173/api/monitoring/stop

# Get monitoring statistics
curl -X GET http://localhost:5173/api/monitoring/status

# Example response:
{
  "isRunning": true,
  "stats": {
    "totalChecks": 40,
    "terminalLogsCaptured": 156,
    "notificationsSent": 78,
    "uptime": 196311
  }
}
```

### 🐛 **Log Analysis & Debugging**

Terminal logs are invaluable for:
- **Debugging agent behavior** and response patterns
- **Auditing conversations** and decision-making processes  
- **Performance analysis** of notification delivery
- **Training data collection** for agent improvement
- **System monitoring** and health checks

Example log entry format:
```
=== 2025-09-14T19:04:30.406Z ===
│   🤖 VCorp Monitoring System - Automated Message │
│   You have 1 unread message assigned to you.     │
│   🔧 Simple function to check your messages:      │
│   inbox                                           │
╰──────────────────────────────────────────────────╯
```

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

### Terminal Logging Issues

#### Logs Not Being Captured
- Verify monitoring service is running: `curl -X GET /api/monitoring/status`
- Check agent tmux sessions are active and accessible
- Ensure log directory permissions: `/tmp/vcorp_terminal_logs`
- Review monitoring service logs for capture errors

#### Log File Access Problems
- Confirm log directory exists and is readable
- Check file permissions on log files
- Verify date format in API requests (YYYY-MM-DD)
- Ensure agent IDs match exactly (case-sensitive)

#### Large Log Files
- Log files automatically rotate at 10MB by default
- Adjust `MAX_LOG_FILE_SIZE` in config if needed
- Use `tail` parameter to get recent entries only
- Consider log cleanup if disk space is limited

#### Missing Timestamps or Garbled Content
- tmux session capture occasionally fails - this is normal
- Content represents live terminal state, may show partial messages
- Use multiple timestamp entries to piece together conversation flow
- Terminal display artifacts (escape sequences) are captured as-is

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

## File-Based Document & Ticket Management

VCorp features a **2-way file sync system** that allows agents to work with documents and tickets as regular files while maintaining database integration for collaboration features.

### 🔄 **2-Way Sync Architecture**

The monitoring service (`MonitoringManager`) watches for file changes and syncs automatically:

#### **FILE → DATABASE Sync**
- Create/edit files directly → Automatically syncs to database
- File watcher detects changes within seconds
- Extracts title from first `# Title` line
- Maintains author and timestamp metadata

#### **DATABASE → FILE Sync**  
- Create documents via `vcorp document` command → Creates file
- Update via API or web UI → Updates file if exists
- Maintains markdown format with title as first line

### 📁 **File Organization & Slug Logic**

Documents are organized based on whether they have a slug:

```
docs/                           # Public documents (WITH slug)
├── api-spec.md                # slug: "api-spec"  
├── requirements.md             # slug: "requirements"
└── architecture.md             # slug: "architecture"

agent_workspaces/
└── pm_001/
    └── docs/                   # Private documents (NO slug)
        ├── meeting-notes.md    # slug: "pm_001-meeting-notes" (namespaced)
        └── personal-todo.md    # slug: "pm_001-personal-todo" (namespaced)
```

**Slug Rules:**
- **WITH slug** (via `--slug=name`): File goes to `docs/{slug}.md` - Public, shared documents
- **NO slug**: File goes to `agent_workspaces/{AGENT_ID}/docs/` - Private agent documents
- Agent workspace files get **namespaced slugs**: `{agent_id}-{filename}`

### 🎯 **Agent Workflow**

```bash
# Create public document with slug
vcorp document "API Spec" "REST API documentation" --slug=api-spec
# → Creates: docs/api-spec.md

# Create private document (no slug)  
vcorp document "Meeting Notes" "Team standup notes"
# → Creates: agent_workspaces/YOUR_ID/docs/meeting-notes.md

# Edit files directly - changes sync to DB
vim docs/api-spec.md
# → Updates sync to database automatically

# Files created directly also sync
echo "# New Doc" > docs/new-feature.md
# → Creates document in DB with slug "new-feature"
```

### ⚙️ **Monitoring Service**

The file sync requires the monitoring service to be running:

```bash
# Start monitoring (includes file watcher)
curl -X POST http://localhost:5173/api/monitoring/start

# Check status
curl -X GET http://localhost:5173/api/monitoring/status
```

**Important:** File watcher only monitors paths relative to where the dev server runs. Files must be within the project's configured path.

### 🛠️ **Update Commands**
```bash
# Update from file (like document creation)
vcorp update document api-spec --file=docs/updated-api.md

# Update with inline content + metadata  
vcorp update ticket user-login-bug "Fixed the issue" --status=resolved --priority=low

# Delete with confirmation
vcorp delete document 123        # Soft delete
vcorp delete ticket 456 --hard   # Permanent delete
```

## Agent Launching & Workspace Setup

### 🚀 **Launching Agents**

Agents are launched via the web UI or API, which:
1. Creates a tmux session for the agent
2. Sets up agent-specific environment variables
3. Creates agent workspace at `agent_workspaces/{AGENT_ID}/`
4. Creates agent-specific `bin/` directory with personalized `vcorp` script
5. Sets PATH to use agent's own `vcorp` command

### 📂 **Agent Workspace Structure**

Each agent gets their own workspace:
```
agent_workspaces/
└── pm_001/
    ├── bin/
    │   └── vcorp              # Agent-specific vcorp wrapper
    ├── docs/                  # Private documents
    ├── tickets/               # Agent's tickets
    └── pm_3424_requirements/  # Git worktree for task
        ├── src/               # Full project checkout
        ├── docs/              # Task-specific docs
        └── ...
```

### 🔧 **Agent Environment**

Each agent session has these environment variables:
- `$AGENT_ID` - Unique agent identifier
- `$AGENT_ROLE` - Agent's role type  
- `$PROJECT_ID` - Current project ID
- `$PATH` - Includes agent's `bin/` directory first

This allows each agent to use `vcorp` naturally without conflicts.

## VCorp Command System

VCorp provides a comprehensive command-line interface for agents to interact with the system. All commands are accessible via the `vcorp` command once agents are launched.

### Help System

**All commands support `--help` for detailed usage information, even without required parameters:**
```bash
vcorp-admin messages --help     # Works without project/agent/role parameters
vcorp-admin documents --help    # Shows complete usage and examples
vcorp-admin tickets --help      # Explains role-based filtering
```

**Help Topics:**
```bash
vcorp help                    # Master index of all help topics
vcorp help role              # Your role description and responsibilities  
vcorp help workflow          # Development process (git worktrees, testing)
vcorp help communication     # Team protocols and communication guidelines
vcorp help workspace         # File permissions and workspace boundaries  
vcorp help commands          # Complete VCorp command reference
```

### Content Discovery Commands

**Messages - View assigned messages by default:**
```bash
vcorp messages                      # YOUR assigned messages only
vcorp messages --all                # ALL project messages
vcorp messages --channel=85         # Messages in specific channel
vcorp messages --dm                 # Direct messages only
vcorp messages search "query"       # Search YOUR messages
vcorp messages --all search "query" # Search ALL messages
vcorp messages --start=21 --end=40  # Pagination support
```

**Documents - Always shows ALL project documents:**
```bash
vcorp documents                     # ALL project documents (no filtering)
vcorp documents search "api"        # Search in titles and content
vcorp document show api-spec        # View specific document by slug
vcorp documents --start=21 --end=40 # Pagination support
```

**Tickets - Role-aware filtering:**
```bash
vcorp tickets                       # Your assigned tickets (managers see all)
vcorp tickets --all                 # Force showing all tickets
vcorp tickets --status=open         # Filter by status
vcorp tickets --priority=high       # Filter by priority
vcorp tickets search "bug"          # Search tickets
vcorp tickets --start=21 --end=40   # Pagination support
```

**Phases - Shows assigned phases by default:**
```bash
vcorp phases                        # Your role's phases
vcorp phases --all                  # All project phases
vcorp phases --status=active        # Filter by status
vcorp phases --start=21 --end=40    # Pagination support
```

### Communication Commands

**Send Messages:**
```bash
vcorp reply MESSAGE_ID CONTENT                    # Reply to any message/content
vcorp message CHANNEL_ID CONTENT [--assign-*]     # Send message to channel
vcorp dm CONTENT --to=AGENTS [--to-role=ROLES]    # Send direct message
vcorp director CONTENT                            # Message Human Director  
vcorp it CONTENT                                  # Message IT Administrator
```

**Assignment Options:**
```bash
--assign-agent=agent1,agent2     # Assign to specific agents
--assign-role=role1,role2        # Assign to role types
--assign-squad=squad1,squad2     # Assign to squads
```

### Content Creation

```bash
vcorp document TITLE CONTENT [--assign-*]       # Create project documents
vcorp ticket TITLE DESCRIPTION [--assign-*]     # Create work tickets
```

### Content Management

```bash
vcorp update document ID "New content"          # Update document
vcorp update ticket ID --status=resolved        # Update ticket status
vcorp delete document ID                        # Soft delete
vcorp delete ticket ID --hard                   # Permanent delete
```

### Information Commands

**Check Status & Assignments:**
```bash
vcorp inbox                   # Check assigned messages (MOST IMPORTANT)
vcorp inbox --all            # Show all messages (read + unread)  
vcorp inbox --json           # Raw JSON output
vcorp phase                  # Check current work assignment
vcorp phase --json           # Raw JSON output
```

**Explore Team & Channels:**
```bash
vcorp agents                 # List project team members with status
vcorp agents --json          # Raw JSON output
vcorp channels               # List accessible channels  
vcorp channels --json        # Raw JSON output
vcorp channel CHANNEL_ID     # View messages in specific channel
vcorp channel CHANNEL_ID --json  # Raw JSON output
vcorp thread MESSAGE_ID      # View conversation thread context
vcorp thread MESSAGE_ID --json   # Raw JSON output
```

**System Information:**
```bash
vcorp permissions            # View access permissions summary
vcorp permissions --detailed # Full allow/deny rules
vcorp permissions --workspace # Show workspace path only
vcorp permissions --level    # Show permission level only
```

### Key Behaviors and Defaults

**Role-Based Filtering:**
- **Individual Contributors**: See only assigned content by default (messages, tickets, phases)
- **Managers** (product-manager, lead-developer, system-architect, it-administrator, director-assistant): 
  - Tickets and phases show ALL by default
  - Messages still show assigned only (use --all for everything)
- **Documents**: ALWAYS shows ALL documents for everyone (full transparency)

**Pagination:**
- Default range: 1-20 items
- Use `--start=N --end=M` to navigate
- Example: `vcorp messages --start=21 --end=40`

**Search Functionality:**
- Messages and tickets search respect role filtering
- Use `--all` with search to search everything
- Documents search always searches all documents

### Command Examples

**Daily Workflow:**
```bash
# 1. Check your current assignment
vcorp phase

# 2. Check for new messages (do this frequently!)
vcorp inbox

# 3. Reply to messages using commands shown in inbox
vcorp reply 123 "Sounds good, I'll work on this"

# 4. Create deliverables as needed
vcorp document "API Specification" "Complete REST API documentation..." --assign-role=backend-developer

# 5. Check team status
vcorp agents
```

**Communication Examples:**
```bash
# Reply to specific message
vcorp reply 456 "I've completed the authentication system"

# Send message to channel with assignments  
vcorp message 61 "Ready for review" --assign-agent=alice,bob

# Direct message to specific agents
vcorp dm "Quick question about the database" --to=alice --to-role=backend-developer

# Escalate to leadership
vcorp director "Need decision on architecture approach"

# Get platform help
vcorp it "Having issues with git worktree setup"
```

**Content Creation Examples:**
```bash
# Create project document
vcorp document "User Requirements" "Complete user story documentation" --assign-role=product-manager

# Create work ticket
vcorp ticket "Fix login bug" "Users cannot authenticate with special characters" --assign-role=backend-developer
```

### Command Patterns

**All commands support:**
- `--help` flag for detailed usage information (works without parameters)
- `--json` flag for raw API responses (where applicable)
- Pagination with `--start` and `--end` parameters
- Consistent error handling and validation
- Agent authentication via environment variables

**Environment Variables (automatically set):**
- `$AGENT_ID` - Your unique agent identifier
- `$AGENT_ROLE` - Your role type  
- `$PROJECT_ID` - Your project ID

### Tips for Success

1. **Use `vcorp inbox` constantly** - Check every few minutes for new assignments
2. **Use `--help` liberally** - Every command has comprehensive help
3. **Understand defaults** - Know what you see by default vs using `--all`
4. **Use pagination** - Navigate large result sets with `--start` and `--end`
5. **Check `vcorp phase`** - Understand your current work priorities

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
