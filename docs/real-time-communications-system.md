# Real-Time Communications System

This document describes the real-time communications architecture implemented in VCorp, covering the message delivery, badge system, and optimistic updates that provide instant feedback across Direct Messages and Channels.

## 🎯 System Overview

The VCorp communications system provides **professional-grade real-time messaging** with:

- **Instant message delivery** (5-second polling)
- **Universal badge system** with accurate unread counts
- **Optimistic UI updates** for immediate feedback
- **Clean architecture** with single data sources
- **No race conditions** or competing API calls

## 🏗️ Architecture Principles

### Single Data Source
All communication components read from the centralized `contentStore`, ensuring consistency and eliminating race conditions.

```typescript
// ✅ Good: Single source of truth
$: finalDMMessages = storeDMMessages; // Always use polling data

// ❌ Bad: Competing data sources
$: finalDMMessages = dmMessagesLoaded ? paginatedDMMessages : storeDMMessages;
```

### Reactive Store Pattern
The system follows Redux/re-frame patterns with Svelte's reactive stores:

```
ContentPollingService → contentStore → Derived Stores → UI Components
```

### Role-Based and Agent-Based Assignments
- **Direct Messages**: Use `assignedToType: 'agent'` with specific agent IDs
- **Channel Messages**: Use `assignedToType: 'role'` with role types
- **Human Director**: Can see both agent assignments and role assignments for oversight roles

## 📡 Real-Time Polling System

### ContentPollingService (`/src/lib/services/ContentPollingService.ts`)

**Core Functionality:**
- Polls `/api/content/updates` every 5 seconds
- Maintains timestamp-based incremental updates
- Groups content by type (channelMessages, directMessages, documents, tickets, etc.)
- Updates the central `contentStore` which triggers all UI updates

**Key Methods:**
```typescript
// Start polling for a project
await contentPollingService.startPolling(projectId);

// Manual trigger (for testing)
await contentPollingService.triggerUpdate();

// Stop polling
contentPollingService.stopPolling();
```

**Automatic Startup:**
Polling starts automatically when a project is loaded in the main page component:

```typescript
async function onProjectChange() {
  currentSection = 'overview';
  if (selectedProject) {
    await contentActions.loadContent(selectedProject.id);
    await contentPollingService.startPolling(selectedProject.id);
  }
}
```

## 🗄️ Central Content Store

### Store Structure (`/src/lib/stores/contentStore.ts`)

The `contentStore` serves as the single source of truth for all content:

```typescript
interface ContentState {
  // Normalized content by ID
  contentById: Record<number, ContentUpdate>;
  
  // Metadata
  channels: any[];
  agents: any[];
  roleTypes: any[];
  squads: any[];
  
  // Sync state
  lastSyncTimestamp: string | null;
  isLoading: boolean;
  error: string | null;
  currentProjectId: number | null;
}
```

### Derived Stores

All UI components use derived stores that automatically update when `contentStore` changes:

```typescript
// Message type filters
export const channelMessages = derived(contentStore, $store => 
  Object.values($store.contentById).filter(content => 
    content.type === 'message' && content.channelId !== null
  )
);

export const directMessages = derived(contentStore, $store => 
  Object.values($store.contentById).filter(content => 
    content.type === 'message' && content.channelId === null
  )
);

// Conversation filters
export const dmConversationWith = (agentId: string) => derived(
  directMessages,
  $dms => $dms.filter(dm => {
    // Messages from the agent to human-director
    if (dm.authorAgentId === agentId) return true;
    
    // Messages from human-director to the agent
    if (isMessageFromHumanDirector(dm) && dm.readingAssignments) {
      return dm.readingAssignments.some(assignment => 
        (assignment.assignedToType === 'agent' && assignment.assignedTo === agentId) ||
        (assignment.assignedToType === 'role' && assignment.targetAgents?.includes(agentId))
      );
    }
    
    return false;
  })
);

export const messagesForChannel = (channelId: number | null) => derived(
  channelMessages,
  $messages => $messages.filter(msg => msg.channelId === channelId)
);
```

## 🔔 Universal Badge System

### Badge Architecture

The badge system provides **consistent unread counts** across all UI components using a three-tier structure:

1. **Individual Item Badges**: DM agents and channel items show their specific unread counts
2. **Section Badges**: Channels tab, Direct Messages tab show section totals  
3. **Main Badge**: Communications Center button shows grand total

### Unread Count Calculation

All badges use the same unread detection logic:

```typescript
// Core unread detection
export function isContentUnreadByHumanDirector(content: any): boolean {
  if (!content?.readingAssignments) return false;
  
  return content.readingAssignments.some((assignment: any) => {
    if (!isAssignmentForHumanDirector(assignment)) return false;
    
    const reads = assignment.readBy || [];
    return !reads.some((read: any) => isReadByHumanDirector(read));
  });
}

// Role and agent assignment detection
export function isAssignmentForHumanDirector(assignment: any): boolean {
  if (!assignment) return false;
  
  // Direct agent assignment
  if (assignment.assignedToType === 'agent') {
    return isHumanDirectorAgent(assignment.assignedTo);
  }
  
  // Role assignment that human director oversees
  if (assignment.assignedToType === 'role') {
    const humanDirectorRoles = [
      'director-assistant', 
      'system-architect', 
      'it-administrator', 
      'human-director'
    ];
    return humanDirectorRoles.includes(assignment.assignedTo);
  }
  
  return false;
}
```

### Badge Components

**Communications Center Button:**
```typescript
// Main page component uses totalUnreadCount from contentStore
import { totalUnreadCount } from '$lib/stores/contentStore';
$: commsCenterUnreadCount = $totalUnreadCount;
```

**Section Tabs:**
```typescript
// CommunicationsNavigation receives props from parent
<CommunicationsNavigation 
  {commsViewMode}
  channelUnreadCount={storeChannelUnreadCount}
  dmUnreadCount={storeDmUnreadCount}
  documentsUnreadCount={storeDocumentsUnreadCount}
  ticketsUnreadCount={storeTicketsUnreadCount}
  phasesUnreadCount={storePhasesUnreadCount}
  on:modeChange={handleModeChange}
/>
```

**Individual Items:**
```typescript
// DM agents - calculated in CommunicationsSection
$: dmAgents = (() => {
  const agentConversations = new Map();
  
  storeDMAgents.forEach(agent => {
    const agentDMs = storeDMMessages.filter(dm => 
      dm.authorAgentId === agent.id || 
      (isMessageFromHumanDirector(dm) && dm.readingAssignments?.some(assignment => 
        assignment.assignedTo === agent.id
      ))
    );
    
    const unreadCount = agentDMs.filter(dm => isContentUnreadByHumanDirector(dm)).length;
    
    agentConversations.set(agent.id, {
      ...agent,
      unreadCount,
      lastMessageAt: agentDMs[agentDMs.length - 1]?.createdAt || null,
      lastMessage: agentDMs[agentDMs.length - 1]?.body || null
    });
  });
  
  return Array.from(agentConversations.values());
})();

// Channel items - calculated in CommunicationsSection  
$: enhancedChannels = storeChannels.map(channel => {
  const channelMessages = allChannelMessages.filter(msg => msg.channelId === channel.id);
  const messageCount = channelMessages.length;
  const unreadCount = channelMessages.filter(msg => isContentUnreadByHumanDirector(msg)).length;
  
  return {
    ...channel,
    messageCount,
    unreadCount
  };
});
```

## ⚡ Optimistic Updates

### Mark as Read Functionality

The system provides **instant feedback** when users mark messages as read:

1. **Immediate UI Update**: Button disappears instantly
2. **Badge Updates**: All related badges decrease immediately  
3. **API Call**: Happens in background
4. **Consistency**: Server state matches optimistic state

### Implementation

**Optimistic Store Update:**
```typescript
// contentStore.ts - optimisticallyMarkAsRead action
optimisticallyMarkAsRead(contentId: number, assignmentId: number, agentId: string) {
  contentStore.update(state => {
    const content = state.contentById[contentId];
    if (!content) return state;

    // Create completely new content object to ensure Svelte detects the change
    const updatedContent = {
      ...content,
      readingAssignments: content.readingAssignments ? content.readingAssignments.map(assignment => {
        if (assignment.id === assignmentId) {
          return {
            ...assignment,
            readBy: [
              ...(assignment.readBy || []),
              { agentId: agentId, readAt: new Date().toISOString() }
            ]
          };
        }
        return assignment;
      }) : []
    };

    return {
      ...state,
      contentById: {
        ...state.contentById,
        [contentId]: updatedContent
      }
    };
  });
}
```

**Component Integration:**
```typescript
// messageOperations.ts - markMessageAsRead function
export async function markMessageAsRead(message: any): Promise<void> {
  const humanDirectorId = getHumanDirectorAgentId();
  const humanDirectorAssignments = getHumanDirectorAssignments(message);
  
  for (const assignment of humanDirectorAssignments) {
    const hasRead = assignment.readBy?.some((read: any) => 
      isReadByHumanDirector(read)
    ) || false;
    
    if (!hasRead) {
      // 1. Optimistic update happens FIRST
      contentActions.optimisticallyMarkAsRead(message.id, assignment.id, humanDirectorId);
      
      // 2. API call happens in background
      const response = await fetch('/api/reading-assignments/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: assignment.id,
          agentId: humanDirectorId
        })
      });
      
      if (!response.ok) {
        console.error('❌ API call failed:', response.status);
        // TODO: Revert optimistic update on failure
      }
    }
  }
}
```

## 🚫 Anti-Patterns Avoided

### ❌ Race Conditions
**Problem:** Components loading data from multiple sources simultaneously.
```typescript
// BAD: Competing data sources
$: finalDMMessages = dmMessagesLoaded ? paginatedDMMessages : storeDMMessages;

// Also calling this in parallel:
loadDMMessagesDefault(); // Fetches from /api/messages/conversation
```

**Solution:** Single data source.
```typescript
// GOOD: Single source of truth
$: finalDMMessages = storeDMMessages; // Always use polling data
// Removed: loadDMMessagesDefault(); 
```

### ❌ Manual State Management
**Problem:** Global functions and manual badge manipulation.
```typescript
// BAD: Global state manipulation
(window as any).decreaseUnreadCount = decreaseUnreadCount;
let manualUnreadCount = 0;
```

**Solution:** Reactive store derivations.
```typescript
// GOOD: Reactive stores
import { totalUnreadCount } from '$lib/stores/contentStore';
$: commsCenterUnreadCount = $totalUnreadCount;
```

### ❌ Inconsistent Data Sources
**Problem:** Different components reading from different APIs.

**Solution:** All components read from the same `contentStore` which is updated by the polling service.

## 🔧 Component Architecture

### CommunicationsSection.svelte
**Responsibilities:**
- Coordinates between different communication modes (channels, DMs, etc.)
- Calculates enhanced data (unread counts, message counts)
- Handles user interactions (channel selection, message sending)
- **Does NOT fetch data directly** - uses stores only

**Key Features:**
- Single data source for all message types
- Reactive calculations for badges and enhanced data
- Event handling for user interactions

### DMMessage.svelte / ChannelMessage.svelte  
**Responsibilities:**
- Display individual messages
- Show "Mark as Read" buttons for unread content
- Handle optimistic updates when buttons are clicked

**Key Features:**
- Reactive `isUnread` calculations
- Optimistic UI updates
- Consistent styling and behavior

### DMAgentItem.svelte / ChannelItem.svelte
**Responsibilities:**
- Display conversation/channel summaries
- Show unread badges and message counts
- Handle selection events

**Key Features:**
- Receive enhanced data with `unreadCount` pre-calculated
- Consistent badge styling
- Selection state management

## 🧪 Testing & Debugging

### Debug Tools

**Console Logging:**
The system includes comprehensive debug logging to track real-time updates:

```typescript
// DMMessage.svelte - Debug specific messages
$: if (message.id === 72 || message.id === 73) {
  console.log(`🔄 DMMessage reactivity for ${message.id}:`, { 
    isUnread, 
    readingAssignments: message.readingAssignments 
  });
}

// contentStore.ts - Debug unread count calculations  
export const dmUnreadCount = derived(unreadDirectMessages, $messages => {
  console.log('📧 dmUnreadCount recalculated:', $messages.length, 'unread DMs');
  return $messages.length;
});

export const totalUnreadCount = derived(
  [channelUnreadCount, dmUnreadCount, documentsUnreadCount, ticketsUnreadCount, phasesUnreadCount],
  ([$channels, $dms, $docs, $tickets, $phases]) => {
    const total = $channels + $dms + $docs + $tickets + $phases;
    console.log('📊 totalUnreadCount recalculated:', { 
      $channels, $dms, $docs, $tickets, $phases, total 
    });
    return total;
  }
);
```

### Manual Testing Flow

**Agent Command Testing:**
```bash
# Start agent session
cd /tmp/debug-test
./agent_workspaces/be_esperanza_7005/bin/vcorp

# Send DM
vcorp dm "Test message" --to=human-director

# Send channel message  
vcorp message 25 "Test channel message"

# Check inbox
vcorp inbox
```

**UI Testing Checklist:**
1. ✅ New messages appear within 5 seconds
2. ✅ Badges appear immediately on all relevant components
3. ✅ "Mark as Read" buttons appear for unread messages
4. ✅ Clicking "Mark as Read" makes button disappear immediately
5. ✅ All badges decrease when messages are marked as read
6. ✅ Page refresh shows correct state (no badges for read messages)

### Performance Monitoring

**Polling Performance:**
```typescript
// ContentPollingService.ts - Monitor polling frequency
private readonly POLL_INTERVAL = 5000; // 5 seconds

// Check polling requests in browser Network tab:
// - /api/content/updates every 5 seconds
// - /api/agents every 5 seconds  
// - /api/dm-oversight/agents every 5 seconds
```

**Store Update Performance:**
```typescript
// Monitor store updates with Svelte DevTools
// Watch for excessive re-renders or update loops
```

## 🚀 Future Enhancements

### WebSocket Integration
The current polling system could be enhanced with WebSockets for even more real-time updates:

```typescript
// Future: WebSocket-based updates
class WebSocketContentService {
  private ws: WebSocket;
  
  connect(projectId: number) {
    this.ws = new WebSocket(`ws://localhost:5173/ws/content/${projectId}`);
    this.ws.onmessage = (event) => {
      const updates = JSON.parse(event.data);
      contentActions.mergeContentUpdates(updates);
    };
  }
}
```

### Offline Support
Add offline detection and queue management:

```typescript
// Future: Offline queue management
class OfflineQueueManager {
  private queue: PendingAction[] = [];
  
  queueAction(action: PendingAction) {
    this.queue.push(action);
    // Process when online
  }
}
```

### Advanced Notifications
Browser notifications for important messages:

```typescript
// Future: Browser notifications
function showNotification(message: ContentUpdate) {
  if (Notification.permission === 'granted') {
    new Notification(`New message from ${message.authorAgentId}`, {
      body: message.body,
      icon: '/favicon.ico'
    });
  }
}
```

## 📋 Summary

The VCorp real-time communications system demonstrates **enterprise-grade architecture** with:

- **Clean separation of concerns** between data fetching, state management, and UI
- **Consistent user experience** with universal badge system and optimistic updates  
- **Scalable architecture** that can handle multiple communication types
- **Professional real-time performance** comparable to modern chat applications

The system successfully eliminates common real-time messaging problems like race conditions, inconsistent state, and delayed feedback while maintaining clean, maintainable code.