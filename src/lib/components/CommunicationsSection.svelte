<script lang="ts">
	import { onMount } from 'svelte';

	// Props
	export let selectedProject: any = null;

	// Communications Center variables
	let directorInbox: any = { messages: [], categorized: { urgent: [], regular: [], read: [] }, stats: {}, summary: {} };
	let directorActivity: any = { recentActivity: [], agentStats: [], channelStats: [], summary: {} };
	let commsViewMode: 'urgent' | 'dashboard' | 'messages' | 'documents' | 'assistant' = 'urgent';
	let selectedMessage: any = null;
	let showReplyDialog = false;
	let replyContent = '';
	let replyToMessageId: number | null = null;

	// Send Message variables
	let showSendMessageDialog = false;
	let newMessage = {
		type: 'message',
		title: '',
		body: '',
		channelId: null as number | null
	};
	let messageReadingAssignments: Array<{
		assignedToType: 'role' | 'agent' | 'squad';
		assignedTo: string;
	}> = [];

	// All Messages variables
	let allMessages: any[] = [];
	let allMessagesSummary: any = {};

	// Assistant variables
	let assistantMessages: any[] = [];
	let assistantMessageContent = '';
	let assistantForwardingEnabled = false;

	// Channels for dropdown
	let channels: any[] = [];

	// Event dispatcher for parent communication
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	// Functions for loading director data
	async function loadDirectorMessages() {
		if (!selectedProject) {
			directorInbox = { messages: [], categorized: { urgent: [], regular: [], read: [] }, stats: {}, summary: {} };
			return;
		}

		try {
			const response = await fetch(`/api/director/inbox?projectId=${selectedProject.id}`);
			if (response.ok) {
				directorInbox = await response.json();
			} else {
				console.error('Failed to load director messages:', response.status);
			}
		} catch (error) {
			console.error('Failed to load director messages:', error);
		}
	}

	async function loadDirectorActivity() {
		if (!selectedProject) {
			directorActivity = { recentActivity: [], agentStats: [], channelStats: [], summary: {} };
			return;
		}

		try {
			const response = await fetch(`/api/director/activity?projectId=${selectedProject.id}`);
			if (response.ok) {
				directorActivity = await response.json();
			} else {
				console.error('Failed to load director activity:', response.status);
			}
		} catch (error) {
			console.error('Failed to load director activity:', error);
		}
	}

	async function loadChannels() {
		if (!selectedProject) {
			channels = [];
			return;
		}

		try {
			const response = await fetch(`/api/channels?projectId=${selectedProject.id}`);
			if (response.ok) {
				channels = await response.json();
			} else {
				console.error('Failed to load channels:', response.status);
			}
		} catch (error) {
			console.error('Failed to load channels:', error);
		}
	}

	async function loadAllMessages() {
		if (!selectedProject) {
			allMessages = [];
			allMessagesSummary = {};
			return;
		}

		try {
			const response = await fetch(`/api/messages/all?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				allMessages = data.messages;
				allMessagesSummary = data.summary;
				console.log(`📬 Loaded ${allMessages.length} messages for All Messages view`);
			} else {
				console.error('Failed to load all messages:', response.status);
			}
		} catch (error) {
			console.error('Failed to load all messages:', error);
		}
	}
	
	async function loadAssistantMessages() {
		if (!selectedProject) {
			assistantMessages = [];
			return;
		}
		
		try {
			const response = await fetch(`/api/messages/assistant?projectId=${selectedProject.id}`);
			if (response.ok) {
				const data = await response.json();
				assistantMessages = data.messages;
				console.log(`🤖 Loaded ${assistantMessages.length} assistant messages`);
			} else {
				console.error('Failed to load assistant messages:', response.status);
			}
		} catch (error) {
			console.error('Failed to load assistant messages:', error);
		}
	}
	
	async function sendAssistantMessage() {
		if (!assistantMessageContent.trim() || !selectedProject) return;
		
		try {
			// Create the message
			const response = await fetch(`/api/channels/0/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'message',
					title: null,
					body: assistantMessageContent,
					authorAgentId: null, // Human director
					projectId: selectedProject.id
				})
			});
			
			if (response.ok) {
				const newMessage = await response.json();
				
				// Create reading assignment for Director Assistant role
				await fetch(`/api/reading-assignments`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contentId: newMessage.id,
						assignedToType: 'role',
						assignedTo: 'Director Assistant'
					})
				});
				
				// Reset form and reload messages
				assistantMessageContent = '';
				await loadAssistantMessages();
				console.log('✅ Message sent to Director Assistant');
			} else {
				console.error('Failed to send assistant message:', response.status);
			}
		} catch (error) {
			console.error('Failed to send assistant message:', error);
		}
	}

	async function toggleAssistantForwarding() {
		try {
			const response = await fetch('/api/assistant/forwarding', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					enabled: assistantForwardingEnabled,
					projectId: selectedProject?.id
				})
			});

			if (response.ok) {
				console.log(`✅ Assistant forwarding ${assistantForwardingEnabled ? 'enabled' : 'disabled'}`);
				
				// Send notification to assistant about forwarding status
				if (assistantForwardingEnabled) {
					await notifyAssistantAboutForwarding();
				}
			} else {
				console.error('Failed to toggle assistant forwarding:', response.status);
				// Revert the toggle on failure
				assistantForwardingEnabled = !assistantForwardingEnabled;
			}
		} catch (error) {
			console.error('Failed to toggle assistant forwarding:', error);
			// Revert the toggle on failure
			assistantForwardingEnabled = !assistantForwardingEnabled;
		}
	}

	async function notifyAssistantAboutForwarding() {
		if (!selectedProject) return;

		try {
			const response = await fetch(`/api/channels/0/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'message',
					title: 'Assistant Forwarding Activated',
					body: `🤖 ASSISTANT FORWARDING ENABLED

The Human Director has enabled message forwarding to you. You are now authorized to:

• Receive copies of all messages directed to 'human-director'
• Respond on behalf of the Human Director when appropriate
• Make decisions within your defined authority scope
• Escalate only when necessary per your role guidelines

You should now actively monitor for incoming messages and respond promptly to keep projects moving forward during unsupervised periods.

Status: ACTIVE - Ready to assist with full authority`,
					authorAgentId: null,
					projectId: selectedProject.id
				})
			});

			if (response.ok) {
				// Create reading assignment for Director Assistant
				await fetch('/api/reading-assignments', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contentId: (await response.json()).id,
						assignedToType: 'role',
						assignedTo: 'Director Assistant'
					})
				});
			}
		} catch (error) {
			console.error('Failed to notify assistant about forwarding:', error);
		}
	}

	function openReplyDialog(message: any) {
		selectedMessage = message;
		replyToMessageId = message.messageId;
		replyContent = '';
		showReplyDialog = true;
	}

	function closeReplyDialog() {
		showReplyDialog = false;
		selectedMessage = null;
		replyToMessageId = null;
		replyContent = '';
	}

	async function sendReply() {
		if (!replyContent.trim() || !replyToMessageId || !selectedProject) return;

		try {
			const response = await fetch('/api/send-message', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject.id,
					authorAgentId: null, // Human director
					title: null,
					body: replyContent,
					channelId: selectedMessage?.channelId || null,
					parentContentId: replyToMessageId,
					type: 'reply',
					assignTo: [
						{
							type: 'agent',
							target: selectedMessage?.authorAgentId || 'unknown'
						}
					]
				})
			});

			if (response.ok) {
				closeReplyDialog();
				await loadDirectorMessages(); // Refresh inbox
			} else {
				console.error('Failed to send reply:', response.status);
			}
		} catch (error) {
			console.error('Failed to send reply:', error);
		}
	}

	// Send Message Functions
	function addReadingAssignment() {
		messageReadingAssignments = [...messageReadingAssignments, {
			assignedToType: 'role',
			assignedTo: ''
		}];
	}

	function removeReadingAssignment(index: number) {
		messageReadingAssignments = messageReadingAssignments.filter((_, i) => i !== index);
	}

	function resetSendMessageDialog() {
		showSendMessageDialog = false;
		newMessage = {
			type: 'message',
			title: '',
			body: '',
			channelId: null
		};
		messageReadingAssignments = [];
	}

	async function sendMessage() {
		if (!newMessage.body.trim() || !selectedProject) return;

		try {
			// Create the message
			const response = await fetch(`/api/channels/${newMessage.channelId || 0}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: newMessage.type,
					title: newMessage.title || null,
					body: newMessage.body,
					authorAgentId: null, // Human director
					projectId: selectedProject.id
				})
			});

			if (!response.ok) {
				console.error('Failed to create message:', response.status);
				return;
			}

			const createdMessage = await response.json();

			// Create reading assignments if any
			if (messageReadingAssignments.length > 0) {
				for (const assignment of messageReadingAssignments) {
					if (assignment.assignedTo.trim()) {
						try {
							await fetch('/api/reading-assignments', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									contentId: createdMessage.id,
									assignedToType: assignment.assignedToType,
									assignedTo: assignment.assignedTo
								})
							});
						} catch (error) {
							console.error('Failed to create reading assignment:', error);
						}
					}
				}
			}

			resetSendMessageDialog();
			await loadDirectorMessages(); // Refresh inbox
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	}

	async function markAsRead(messageId: number, assignmentId: number) {
		try {
			const response = await fetch('/api/reading-assignments/mark-read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					assignmentId,
					agentId: 'director'
				})
			});

			if (response.ok) {
				await loadDirectorMessages(); // Refresh inbox
			}
		} catch (error) {
			console.error('Failed to mark as read:', error);
		}
	}

	function formatTimeAgo(timestamp: string): string {
		const now = new Date();
		const messageTime = new Date(timestamp);
		const diffMs = now.getTime() - messageTime.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		
		return messageTime.toLocaleDateString();
	}

	function getMessageIcon(message: any): string {
		if (message.isDM) return '💬';
		if (message.isDirectorChannel) return '📢';
		if (message.isReply) return '↩️';
		if (message.type === 'announcement') return '📣';
		if (message.type === 'report') return '📊';
		if (message.type === 'document') return '📄';
		return '💭';
	}

	// Load data when project changes
	$: if (selectedProject) {
		loadDirectorMessages();
		loadDirectorActivity();
		loadChannels();
	}
</script>

<div class="communications-section">
	<div class="section-header">
		<h2>📬 Communications Center</h2>
		<button 
			class="btn-primary"
			on:click={() => showSendMessageDialog = true}
		>
			✉️ Send Message
		</button>
	</div>

	<div class="comms-nav">
		<button 
			class="comms-nav-btn" 
			class:active={commsViewMode === 'urgent'}
			on:click={() => commsViewMode = 'urgent'}
		>
			🚨 Urgent ({directorInbox.categorized?.urgent?.length || 0})
		</button>
		<button 
			class="comms-nav-btn" 
			class:active={commsViewMode === 'dashboard'}
			on:click={() => commsViewMode = 'dashboard'}
		>
			📊 Dashboard
		</button>
		<button 
			class="comms-nav-btn" 
			class:active={commsViewMode === 'messages'}
			on:click={() => { commsViewMode = 'messages'; loadAllMessages(); }}
		>
			💬 All Messages ({allMessagesSummary.total || 0})
		</button>
		<button 
			class="comms-nav-btn" 
			class:active={commsViewMode === 'assistant'}
			on:click={() => { commsViewMode = 'assistant'; loadAssistantMessages(); }}
		>
			🤖 Assistant ({assistantMessages.length || 0})
		</button>
	</div>

	<div class="comms-content">
		{#if commsViewMode === 'urgent'}
			<div class="urgent-view">
				<h3>🚨 Urgent Messages</h3>
				{#if directorInbox.categorized?.urgent?.length > 0}
					<div class="message-list">
						{#each directorInbox.categorized.urgent as message}
							<div class="message-card urgent" class:unread={!message.isRead}>
								<div class="message-header">
									<div class="message-meta">
										<span class="message-icon">{getMessageIcon(message)}</span>
										<span class="message-source">
											{#if message.isDM}
												DM from {message.authorAgentId}
											{:else if message.isDirectorChannel}
												#{message.channelName} (Director Channel)
											{:else}
												#{message.channelName}
											{/if}
										</span>
										<span class="message-time">{formatTimeAgo(message.createdAt)}</span>
									</div>
									<div class="message-actions">
										{#if !message.isRead}
											<button class="btn-small" on:click={() => markAsRead(message.messageId, message.assignmentId)}>
												Mark Read
											</button>
										{/if}
										<button class="btn-small btn-primary" on:click={() => openReplyDialog(message)}>
											Reply
										</button>
									</div>
								</div>
								<div class="message-content">
									<div class="message-body">{message.body}</div>
									{#if message.parentMessage}
										<div class="parent-context">
											<small>↩️ Replying to: "{message.parentMessage.body.substring(0, 50)}..."</small>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="empty-state">
						<h4>✅ No urgent messages!</h4>
						<p>All caught up on priority communications.</p>
					</div>
				{/if}
			</div>

		{:else if commsViewMode === 'assistant'}
			<div class="assistant-view">
				<div class="assistant-header">
					<div class="assistant-title-row">
						<div>
							<h3>🤖 Director Assistant</h3>
							<p class="assistant-description">Direct communication with your assistant</p>
						</div>
						<div class="assistant-controls">
							<label class="toggle-container">
								<span class="toggle-label">Forward messages to assistant</span>
								<input 
									type="checkbox" 
									bind:checked={assistantForwardingEnabled}
									on:change={toggleAssistantForwarding}
								/>
								<span class="toggle-slider"></span>
							</label>
						</div>
					</div>
					{#if assistantForwardingEnabled}
						<div class="forwarding-notice">
							<span class="notice-icon">📬</span>
							<span>Assistant will receive copies of all messages directed to you and can respond on your behalf</span>
						</div>
					{/if}
				</div>
				
				<div class="assistant-chat">
					{#if assistantMessages.length > 0}
						<div class="message-list">
							{#each assistantMessages as message}
								<div class="assistant-message" class:from-assistant={message.isFromAssistant} class:from-director={message.isFromDirector}>
									<div class="message-header">
										<span class="message-author">
											{#if message.isFromAssistant}
												🤖 Assistant ({message.authorAgentId})
											{:else}
												👤 You
											{/if}
										</span>
										<span class="message-time">{formatTimeAgo(message.createdAt)}</span>
									</div>
									<div class="message-body">{message.body}</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty-chat">
							<div class="empty-icon">💬</div>
							<h4>No messages yet</h4>
							<p>Start a conversation with your Director Assistant</p>
						</div>
					{/if}
				</div>
				
				<div class="assistant-input">
					<div class="input-container">
						<textarea
							bind:value={assistantMessageContent}
							placeholder="Type your message to the assistant..."
							rows="3"
							on:keydown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									sendAssistantMessage();
								}
							}}
						></textarea>
						<button 
							class="send-btn" 
							on:click={sendAssistantMessage}
							disabled={!assistantMessageContent.trim()}
						>
							Send
						</button>
					</div>
					<div class="input-hint">
						<span>📝 Press Enter to send, Shift+Enter for new line</span>
					</div>
				</div>
			</div>

		{:else if commsViewMode === 'dashboard'}
			<div class="dashboard-view">
				<div class="dashboard-grid">
					<div class="dashboard-card">
						<h3>📊 Activity Overview</h3>
						{#if directorActivity.summary}
							<div class="activity-stats">
								<div class="stat-item">
									<span class="stat-number">{directorActivity.summary.totalMessages}</span>
									<span class="stat-label">Total Messages</span>
								</div>
								<div class="stat-item">
									<span class="stat-number">{directorActivity.summary.activeAgents}</span>
									<span class="stat-label">Active Agents</span>
								</div>
								<div class="stat-item">
									<span class="stat-number">{directorActivity.summary.activeChannels}</span>
									<span class="stat-label">Active Channels</span>
								</div>
							</div>
						{/if}
					</div>

					<div class="dashboard-card">
						<h3>🤖 Agent Activity</h3>
						{#if directorActivity.agentStats?.length > 0}
							<div class="agent-activity-list">
								{#each directorActivity.agentStats.slice(0, 5) as agentStat}
									<div class="activity-item">
										<span class="agent-name">{agentStat.agentId}</span>
										<span class="activity-count">{agentStat.messageCount} messages</span>
										<span class="activity-time">{formatTimeAgo(agentStat.lastActivity)}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="empty-note">No agent activity yet</p>
						{/if}
					</div>

					<div class="dashboard-card">
						<h3>📢 Channel Activity</h3>
						{#if directorActivity.channelStats?.length > 0}
							<div class="channel-activity-list">
								{#each directorActivity.channelStats.slice(0, 5) as channelStat}
									<div class="activity-item">
										<span class="channel-name">
											#{channelStat.channelName}
										</span>
										<span class="activity-count">{channelStat.messageCount} messages</span>
										<span class="activity-time">{formatTimeAgo(channelStat.lastActivity)}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="empty-note">No channel activity yet</p>
						{/if}
					</div>

					<div class="dashboard-card">
						<h3>📈 Recent Activity</h3>
						{#if directorActivity.recentActivity?.length > 0}
							<div class="recent-activity-list">
								{#each directorActivity.recentActivity.slice(0, 5) as activity}
									<div class="activity-item recent">
										<span class="activity-icon">{getMessageIcon(activity)}</span>
										<div class="activity-details">
											<span class="activity-summary">
												{activity.authorAgentId || 'System'} 
												{#if activity.channelName}in #{activity.channelName}{/if}
											</span>
											<span class="activity-preview">{activity.body.substring(0, 40)}...</span>
										</div>
										<span class="activity-time">{formatTimeAgo(activity.createdAt)}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="empty-note">No recent activity</p>
						{/if}
					</div>
				</div>
			</div>

		{:else if commsViewMode === 'messages'}
			<div class="all-messages-view">
				<div class="messages-header">
					<h3>💬 All Messages</h3>
					{#if allMessagesSummary.total}
						<div class="messages-stats">
							<span class="stat">Total: {allMessagesSummary.total}</span>
							<span class="stat">With Assignments: {allMessagesSummary.withAssignments}</span>
							<span class="stat">Direct: {allMessagesSummary.withoutAssignments}</span>
						</div>
					{/if}
				</div>
				
				{#if allMessages.length > 0}
					<div class="message-list">
						{#each allMessages as message}
							<div class="message-card enhanced">
								<div class="message-header">
									<div class="message-meta">
										<span class="message-icon">{getMessageIcon(message)}</span>
										<div class="message-info">
											<div class="message-title-line">
												{#if message.title}
													<strong>{message.title}</strong>
												{:else}
													<span class="message-type">{message.type}</span>
												{/if}
												{#if message.isReply}
													<span class="reply-badge">Reply</span>
												{/if}
											</div>
											<div class="message-source-line">
												<span class="message-source">
													{#if message.authorAgentId}
														{message.authorAgentId}
													{:else}
														Director
													{/if}
												</span>
												{#if message.channelName}
													<span class="channel-name">#{message.channelName}</span>
												{:else if message.isDM}
													<span class="dm-badge">DM</span>
												{/if}
												<span class="message-time">{formatTimeAgo(message.createdAt)}</span>
											</div>
										</div>
									</div>
									<div class="message-actions">
										<button 
											class="btn-small btn-primary" 
											on:click={() => { selectedMessage = message; replyToMessageId = message.id; showReplyDialog = true; }}
										>
											Reply
										</button>
									</div>
								</div>
								
								<div class="message-content">
									<div class="message-body">{message.body}</div>
								</div>

								<!-- Reading Assignments Status -->
								{#if message.readingAssignments && message.readingAssignments.length > 0}
									{@const assignmentsByType = message.readingAssignments.reduce((groups, assignment) => {
										const key = assignment.assignedToType;
										if (!groups[key]) groups[key] = [];
										groups[key].push(assignment);
										return groups;
									}, {})}
									<div class="reading-status-section">
										<h5>📋 Reading Assignments ({message.readingAssignments.length})</h5>
										<div class="assignments-grouped">
											
											{#each Object.entries(assignmentsByType) as [type, assignments]}
												<div class="assignment-group">
													<div class="group-header">
														<span class="group-type-icon">
															{#if type === 'role'}👥{:else if type === 'agent'}🤖{:else if type === 'squad'}👨‍👩‍👧‍👦{/if}
														</span>
														<strong>{type.charAt(0).toUpperCase() + type.slice(1)}s</strong>
														<span class="group-count">({assignments.length})</span>
													</div>
													<div class="assignment-items">
														{#each assignments as assignment}
															<div class="assignment-item" class:fully-read={assignment.isFullyRead}>
																<div class="assignment-info">
																	<span class="assignment-name">{assignment.assignedTo}</span>
																	<div class="read-indicators">
																		<span class="read-count" class:all-read={assignment.isFullyRead}>
																			{assignment.readCount}/{assignment.totalTargets}
																		</span>
																		{#if assignment.isFullyRead}
																			<span class="status-indicator read">✓</span>
																		{:else if assignment.readCount > 0}
																			<span class="status-indicator partial">◐</span>
																		{:else}
																			<span class="status-indicator unread">○</span>
																		{/if}
																	</div>
																</div>
																
																{#if assignment.readBy && assignment.readBy.length > 0}
																	<div class="read-by-list">
																		<span class="read-by-label">Read:</span>
																		{#each assignment.readBy as read}
																			<span class="read-by-agent">
																				{read.agentId}
																				<small>({formatTimeAgo(read.readAt)})</small>
																			</span>
																		{/each}
																	</div>
																{/if}
																
																{#if assignment.unreadAgents && assignment.unreadAgents.length > 0}
																	<div class="unread-agents-list">
																		<span class="unread-label">Unread:</span>
																		{#each assignment.unreadAgents as agentId}
																			<span class="unread-agent">{agentId}</span>
																		{/each}
																	</div>
																{/if}
															</div>
														{/each}
													</div>
												</div>
											{/each}
										</div>
									</div>
								{:else}
									<div class="no-assignments">
										<small>📝 No reading assignments</small>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<div class="empty-state">
						<h4>📭 No messages yet</h4>
						<p>All project messages will appear here with reading assignment status.</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if showReplyDialog}
	<div class="dialog-overlay" on:click={closeReplyDialog}>
		<div class="dialog" on:click|stopPropagation>
			<div class="dialog-header">
				<h3>💬 Reply to Message</h3>
				<button class="close-btn" on:click={closeReplyDialog}>×</button>
			</div>
			
			{#if selectedMessage}
				<div class="reply-context">
					<div class="original-message">
						<div class="message-meta">
							<span class="message-icon">{getMessageIcon(selectedMessage)}</span>
							<span class="message-author">
								{selectedMessage.authorAgentId || 'System'}
							</span>
							<span class="message-time">{formatTimeAgo(selectedMessage.createdAt)}</span>
						</div>
						<div class="message-preview">
							{selectedMessage.body.substring(0, 100)}...
						</div>
					</div>
				</div>
			{/if}
			
			<div class="form-group">
				<label for="reply-content">Your Reply:</label>
				<textarea 
					id="reply-content"
					bind:value={replyContent}
					placeholder="Type your reply..."
					rows="4"
				></textarea>
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={closeReplyDialog}>Cancel</button>
				<button class="send-btn" on:click={sendReply} disabled={!replyContent.trim()}>
					Send Reply
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showSendMessageDialog}
	<div class="dialog-overlay" on:click={() => showSendMessageDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Send Message</h3>
			
			<div class="form-group">
				<label for="message-type">Type:</label>
				<select id="message-type" bind:value={newMessage.type}>
					<option value="message">Message</option>
					<option value="announcement">Announcement</option>
					<option value="report">Report</option>
					<option value="document">Document</option>
				</select>
			</div>

			<div class="form-group">
				<label for="message-title">Title (optional):</label>
				<input 
					id="message-title"
					type="text" 
					bind:value={newMessage.title} 
					placeholder="Message title"
				/>
			</div>
			
			<div class="form-group">
				<label for="message-body">Message:</label>
				<textarea 
					id="message-body"
					bind:value={newMessage.body} 
					placeholder="Type your message here..."
					rows="6"
				></textarea>
			</div>
			
			<div class="form-group">
				<label for="message-channel">Channel (optional):</label>
				<select 
					id="message-channel"
					bind:value={newMessage.channelId}
				>
					<option value={null}>General (no specific channel)</option>
					{#each channels as channel}
						<option value={channel.id}>{channel.name}</option>
					{/each}
				</select>
			</div>

			<div class="reading-assignments-section">
				<div class="assignments-header">
					<h4>📋 Reading Assignments</h4>
					<button type="button" class="add-assignment-btn" on:click={addReadingAssignment}>
						+ Add Assignment
					</button>
				</div>

				{#each messageReadingAssignments as assignment, index}
					<div class="assignment-row">
						<select bind:value={assignment.assignedToType}>
							<option value="role">Role</option>
							<option value="agent">Agent</option>
							<option value="squad">Squad</option>
						</select>
						<input 
							type="text" 
							bind:value={assignment.assignedTo} 
							placeholder="Enter {assignment.assignedToType} name"
						/>
						<button type="button" class="remove-btn" on:click={() => removeReadingAssignment(index)}>
							Remove
						</button>
					</div>
				{/each}
			</div>
			
			<div class="dialog-buttons">
				<button class="cancel-btn" on:click={() => showSendMessageDialog = false}>Cancel</button>
				<button class="send-btn" on:click={sendMessage} disabled={!newMessage.body.trim()}>
					Send Message
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.communications-section {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: white;
		border-radius: 8px;
		overflow: hidden;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.section-header h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		color: #374151;
	}

	.btn-primary {
		background: #2563eb;
		color: white;
		border: none;
		padding: 10px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.btn-primary:hover {
		background: #1d4ed8;
	}

	.btn-primary:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.comms-nav {
		display: flex;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
		padding: 0;
	}

	.comms-nav-btn {
		background: none;
		border: none;
		padding: 12px 20px;
		cursor: pointer;
		font-weight: 500;
		color: #6b7280;
		border-bottom: 2px solid transparent;
		transition: all 0.2s ease;
	}

	.comms-nav-btn:hover {
		color: #374151;
		background: #f3f4f6;
	}

	.comms-nav-btn.active {
		color: #2563eb;
		border-bottom-color: #2563eb;
		background: white;
	}

	.comms-content {
		flex: 1;
		overflow: hidden;
		padding: 20px;
	}

	.urgent-view {
		height: 100%;
		overflow-y: auto;
	}

	.urgent-view h3 {
		margin: 0 0 16px 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}

	.message-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.message-card {
		background: #fafbfc;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 16px;
		transition: all 0.2s ease;
	}

	.message-card.urgent {
		border-left: 4px solid #ef4444;
	}

	.message-card.unread {
		background: #fef7ff;
		border-color: #d8b4fe;
	}

	.message-card.enhanced {
		border-left: 4px solid #2563eb;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.message-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
	}

	.message-info {
		flex: 1;
		min-width: 0;
	}

	.message-title-line {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.message-source-line {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: #6b7280;
	}

	.message-icon {
		font-size: 18px;
		min-width: 24px;
	}

	.message-source,
	.channel-name {
		font-weight: 500;
		color: #374151;
	}

	.message-time {
		font-size: 12px;
		color: #9ca3af;
	}

	.message-actions {
		display: flex;
		gap: 8px;
	}

	.btn-small {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.btn-small:hover {
		background: #e5e7eb;
	}

	.btn-small.btn-primary {
		background: #2563eb;
		color: white;
		border-color: #2563eb;
	}

	.btn-small.btn-primary:hover {
		background: #1d4ed8;
	}

	.message-content {
		margin-top: 8px;
	}

	.message-body {
		color: #374151;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.parent-context {
		margin-top: 8px;
		color: #6b7280;
		font-style: italic;
	}

	.empty-state {
		text-align: center;
		padding: 40px 20px;
		color: #6b7280;
	}

	.empty-state h4 {
		margin: 0 0 8px 0;
		color: #374151;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	.assistant-view {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.assistant-header {
		margin-bottom: 20px;
	}

	.assistant-header h3 {
		margin: 0 0 8px 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}

	.assistant-description {
		margin: 0 0 16px 0;
		color: #6b7280;
		font-size: 14px;
	}

	.assistant-title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.assistant-controls {
		display: flex;
		align-items: center;
	}

	.toggle-container {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		user-select: none;
	}

	.toggle-label {
		font-size: 14px;
		color: #374151;
		font-weight: 500;
	}

	.toggle-container input[type="checkbox"] {
		display: none;
	}

	.toggle-slider {
		position: relative;
		width: 44px;
		height: 24px;
		background: #d1d5db;
		border-radius: 12px;
		transition: background-color 0.2s ease;
	}

	.toggle-slider::before {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s ease;
	}

	.toggle-container input:checked + .toggle-slider {
		background: #2563eb;
	}

	.toggle-container input:checked + .toggle-slider::before {
		transform: translateX(20px);
	}

	.forwarding-notice {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 6px;
		padding: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: #1e40af;
	}

	.notice-icon {
		font-size: 16px;
		min-width: 20px;
	}

	.assistant-chat {
		flex: 1;
		overflow-y: auto;
		margin-bottom: 16px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		background: #fafbfc;
	}

	.assistant-message {
		padding: 12px 16px;
		border-bottom: 1px solid #f3f4f6;
	}

	.assistant-message:last-child {
		border-bottom: none;
	}

	.assistant-message.from-director {
		background: #eff6ff;
	}

	.assistant-message.from-assistant {
		background: #f0fdf4;
	}

	.assistant-message .message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
		font-size: 14px;
		font-weight: 500;
	}

	.assistant-message.from-director .message-header {
		color: #1e40af;
	}

	.assistant-message.from-assistant .message-header {
		color: #15803d;
	}

	.assistant-message .message-body {
		color: #374151;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.empty-chat {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: #6b7280;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.empty-chat h4 {
		margin: 0 0 8px 0;
		color: #374151;
	}

	.empty-chat p {
		margin: 0;
		font-size: 14px;
	}

	.assistant-input {
		margin-top: auto;
	}

	.input-container {
		display: flex;
		gap: 12px;
		align-items: flex-end;
	}

	.input-container textarea {
		flex: 1;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 10px 12px;
		resize: none;
		font-family: inherit;
		font-size: 14px;
		line-height: 1.4;
	}

	.input-container textarea:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.send-btn {
		background: #2563eb;
		color: white;
		border: none;
		padding: 10px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s ease;
		white-space: nowrap;
	}

	.send-btn:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.send-btn:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.input-hint {
		margin-top: 6px;
		font-size: 12px;
		color: #6b7280;
	}

	.dashboard-view {
		height: 100%;
		overflow-y: auto;
	}

	.dashboard-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		height: 100%;
	}

	.dashboard-card {
		background: #fafbfc;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 16px;
		overflow-y: auto;
	}

	.dashboard-card h3 {
		margin: 0 0 16px 0;
		font-size: 16px;
		font-weight: 600;
		color: #374151;
	}

	.activity-stats {
		display: flex;
		gap: 16px;
		margin-bottom: 16px;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px;
		background: white;
		border-radius: 6px;
		border: 1px solid #f3f4f6;
		flex: 1;
	}

	.stat-number {
		font-size: 24px;
		font-weight: 700;
		color: #2563eb;
		margin-bottom: 4px;
	}

	.stat-label {
		font-size: 12px;
		color: #6b7280;
		text-align: center;
	}

	.agent-activity-list,
	.channel-activity-list,
	.recent-activity-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.activity-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px;
		background: white;
		border-radius: 6px;
		border: 1px solid #f3f4f6;
	}

	.activity-item.recent {
		padding: 12px;
	}

	.agent-name,
	.channel-name {
		font-weight: 500;
		color: #374151;
		min-width: 100px;
	}

	.activity-count {
		font-size: 14px;
		color: #6b7280;
		flex: 1;
	}

	.activity-time {
		font-size: 12px;
		color: #9ca3af;
		min-width: 80px;
		text-align: right;
	}

	.activity-icon {
		font-size: 18px;
		min-width: 24px;
	}

	.activity-details {
		flex: 1;
		min-width: 0;
	}

	.activity-summary {
		display: block;
		font-weight: 500;
		color: #374151;
		font-size: 14px;
	}

	.activity-preview {
		display: block;
		font-size: 13px;
		color: #6b7280;
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-note {
		color: #6b7280;
		font-style: italic;
		margin: 0;
	}

	.all-messages-view {
		height: 100%;
		overflow-y: auto;
	}

	.messages-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.messages-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}

	.messages-stats {
		display: flex;
		gap: 16px;
		font-size: 14px;
		color: #6b7280;
	}

	.stat {
		padding: 4px 8px;
		background: #f3f4f6;
		border-radius: 4px;
	}

	.reply-badge,
	.dm-badge {
		background: #dbeafe;
		color: #1e40af;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.reading-status-section {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid #f3f4f6;
	}

	.reading-status-section h5 {
		margin: 0 0 12px 0;
		font-size: 14px;
		font-weight: 600;
		color: #374151;
	}

	.assignments-grouped {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.assignment-group {
		background: #f9fafb;
		border-radius: 6px;
		padding: 12px;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
		font-size: 14px;
		color: #374151;
	}

	.group-type-icon {
		font-size: 16px;
	}

	.group-count {
		color: #6b7280;
		font-weight: normal;
	}

	.assignment-items {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.assignment-item {
		background: white;
		border-radius: 4px;
		padding: 8px;
		border: 1px solid #e5e7eb;
	}

	.assignment-item.fully-read {
		background: #f0fdf4;
		border-color: #bbf7d0;
	}

	.assignment-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.assignment-name {
		font-weight: 500;
		color: #374151;
	}

	.read-indicators {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.read-count {
		font-size: 12px;
		color: #6b7280;
	}

	.read-count.all-read {
		color: #059669;
		font-weight: 600;
	}

	.status-indicator {
		font-size: 14px;
	}

	.status-indicator.read {
		color: #059669;
	}

	.status-indicator.partial {
		color: #f59e0b;
	}

	.status-indicator.unread {
		color: #9ca3af;
	}

	.read-by-list,
	.unread-agents-list {
		font-size: 12px;
		margin-top: 4px;
	}

	.read-by-label,
	.unread-label {
		color: #6b7280;
		margin-right: 6px;
	}

	.read-by-agent,
	.unread-agent {
		display: inline-block;
		margin-right: 8px;
		color: #374151;
	}

	.no-assignments {
		margin-top: 8px;
		color: #6b7280;
		font-style: italic;
	}

	/* Dialog styles */
	.dialog-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.dialog {
		background: white;
		border-radius: 8px;
		padding: 24px;
		max-width: 500px;
		width: 90%;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
	}

	.dialog-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.dialog h3 {
		margin: 0 0 20px 0;
		font-size: 18px;
		font-weight: 600;
		color: #374151;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		color: #6b7280;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		color: #374151;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-weight: 500;
		color: #374151;
		font-size: 14px;
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		width: 100%;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 14px;
		font-family: inherit;
		transition: border-color 0.2s ease;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
	}

	.reply-context {
		margin-bottom: 16px;
		padding: 12px;
		background: #f9fafb;
		border-radius: 6px;
		border: 1px solid #e5e7eb;
	}

	.original-message .message-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		font-size: 14px;
		color: #6b7280;
	}

	.message-preview {
		color: #374151;
		font-style: italic;
	}

	.reading-assignments-section {
		margin-bottom: 16px;
	}

	.assignments-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.assignments-header h4 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: #374151;
	}

	.add-assignment-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.add-assignment-btn:hover {
		background: #e5e7eb;
	}

	.assignment-row {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-bottom: 8px;
	}

	.assignment-row select {
		width: 120px;
	}

	.assignment-row input {
		flex: 1;
	}

	.remove-btn {
		background: #fecaca;
		color: #dc2626;
		border: 1px solid #fca5a5;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.remove-btn:hover {
		background: #fca5a5;
	}

	.dialog-buttons {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 20px;
	}

	.cancel-btn {
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
		padding: 10px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.cancel-btn:hover {
		background: #e5e7eb;
	}
</style>