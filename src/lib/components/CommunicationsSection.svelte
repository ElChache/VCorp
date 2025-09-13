<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { marked } from 'marked';
	import { contentPollingService, contentPollingStore } from '$lib/services/ContentPollingService';
	import CommunicationsNavigation from './CommunicationsNavigation.svelte';
	import ChannelItem from './ChannelItem.svelte';
	import DMAgentItem from './DMAgentItem.svelte';
	import DMMessage from './DMMessage.svelte';
	import ChannelList from './ChannelList.svelte';
	import DMAgentList from './DMAgentList.svelte';
	import DMMessageList from './DMMessageList.svelte';
	import ChannelMessageList from './ChannelMessageList.svelte';
	import ThreadView from './ThreadView.svelte';
	import SendMessageDialog from './SendMessageDialog.svelte';
	import { toggleReadStatusTooltip } from '$lib/utils/tooltipManager';
	import { 
		isUnreadByHumanDirector, 
		isMessageFullyRead, 
		isMessagePartiallyRead, 
		hasUnreadAssignmentForHumanDirector, 
		markMessageAsReadWithoutRefresh, 
		markMessageAsRead, 
		formatMessageTime 
	} from '$lib/utils/messageOperations';
	import { DataManager, type DataManagerCallbacks } from '$lib/utils/dataManager';

	// Props
	export let selectedProject: any = null;

	// Communications Center variables
	let commsViewMode: 'communications' | 'direct-messages' = 'communications';
	let replyContent = '';

	// Send Message variables
	let showSendMessageDialog = false;

	// Communications variables
	let selectedChannel: any = null;
	let channelMessages: any[] = [];
	let newMessageContent = '';
	let replyingToMessage: any = null;
	
	// Thread variables for 3-column layout (now managed by ThreadView component)
	let selectedThreadMessage: any = null;
	let isThreadsColumnOpen: boolean = false;
	let threadViewRef: any;

	// Direct Messages variables
	let dmAgents: any[] = [];
	let selectedDMAgent: any = null;
	let dmMessages: any[] = [];
	let newDMContent = '';

	// Channels for dropdown
	let channels: any[] = [];
	
	// Data for dropdowns
	let agents: any[] = [];
	let roleTypes: any[] = [];
	let squads: any[] = [];

	// Event dispatcher for parent communication
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	// Real-time updates
	let contentUpdatesListener: any = null;
	$: pollingState = $contentPollingStore;

	// Unread message counts for badges
	let totalUnreadCount = 0;
	let channelUnreadCount = 0;
	let dmUnreadCount = 0;

	// Create DataManager instance with callbacks
	const dataManager = new DataManager({
		updateChannelMessages: (messages) => { channelMessages = messages; },
		updateDMMessages: (messages) => { dmMessages = messages; },
		updateChannels: (channelList) => { channels = channelList; },
		updateDMAgents: (agentList) => { dmAgents = agentList; },
		updateAgents: (agentList) => { agents = agentList; },
		updateRoleTypes: (roleTypeList) => { roleTypes = roleTypeList; },
		updateSquads: (squadList) => { squads = squadList; },
		updateUnreadCounts: (counts) => {
			totalUnreadCount = counts.total;
			channelUnreadCount = counts.channel;
			dmUnreadCount = counts.dm;
		}
	});

	// Handler for navigation mode changes
	function handleModeChange(event: CustomEvent<'communications' | 'direct-messages'>) {
		commsViewMode = event.detail;
	}

	// Handler for channel item selection
	function handleChannelSelect(event: CustomEvent) {
		onChannelSelect(event.detail);
	}

	// Handler for DM agent item selection
	function handleDMAgentSelect(event: CustomEvent) {
		onDMAgentSelect(event.detail);
	}

	// Handler for DM agent list send message
	function handleDMSendMessage() {
		showSendMessageDialog = true;
	}

	// Handlers for DMMessageList events
	function handleSendReply() {
		sendReply();
	}

	function handleCancelReply() {
		cancelReply();
	}

	function handleSendDM() {
		sendDMMessage();
	}




	// Start polling when project changes
	function startPolling() {
		if (selectedProject && selectedProject.id) {
			console.log(`🚀 Starting real-time polling for project ${selectedProject.id}`);
			contentPollingService.startPolling(selectedProject.id);
		}
	}

	// Stop polling
	function stopPolling() {
		console.log('⏹️ Stopping real-time polling');
		contentPollingService.stopPolling();
	}

	// Functions for loading channel messages

	function onChannelSelect(channel) {
		selectedChannel = channel;
		dataManager.setSelectedChannel(channel);
		dataManager.loadChannelMessages(channel);
	}


	function startReply(message) {
		replyingToMessage = message;
		replyContent = '';
	}

	function cancelReply() {
		replyingToMessage = null;
		replyContent = '';
	}












	function onDMAgentSelect(agent) {
		selectedDMAgent = agent;
		dataManager.setSelectedDMAgent(agent);
		dataManager.loadDMMessages(agent.id);
	}

	async function sendDMMessage() {
		if (!newDMContent.trim() || !selectedDMAgent || !selectedProject) return;

		try {
			const response = await fetch('/api/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject.id,
					authorAgentId: 'human-director',
					body: newDMContent,
					channelId: null, // This makes it a DM
					assignTo: [
						{
							type: 'agent',
							target: selectedDMAgent.id
						}
					]
				})
			});

			if (response.ok) {
				newDMContent = '';
				// Add a small delay to ensure the message is saved before reloading
				setTimeout(async () => {
					await dataManager.loadDMMessages(selectedDMAgent.id);
					await dataManager.loadDMAgents(); // Refresh agent list to update timestamps
					// Polling service will automatically pick up new data
				}, 100);
			} else {
				console.error('Failed to send DM:', response.status);
			}
		} catch (error) {
			console.error('Failed to send DM:', error);
		}
	}



	async function sendReply() {
		// Support thread replies (selectedThreadMessage) and inline replies 
		const messageId = selectedThreadMessage?.id || replyingToMessage?.id;
		const message = selectedThreadMessage || replyingToMessage;
		
		if (!replyContent.trim() || !messageId || !selectedProject) return;

		try {
			const response = await fetch('/api/replies', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject.id,
					authorAgentId: 'human-director',
					body: replyContent,
					parentContentId: messageId,
					assignTo: message?.authorAgentId && message.authorAgentId !== 'human-director' ? [
						{
							type: 'agent',
							target: message.authorAgentId
						}
					] : []
				})
			});

			if (response.ok) {
				// Handle thread reply
				if (selectedThreadMessage) {
					replyContent = '';
					// ThreadView will handle reloading its own replies automatically
				}
				// Handle inline reply
				else if (replyingToMessage) {
					cancelReply(); // Clear inline reply state
					if (selectedChannel) {
						await dataManager.loadChannelMessages(selectedChannel); // Refresh channel messages
					}
				}
			} else {
				console.error('Failed to send reply:', response.status);
			}
		} catch (error) {
			console.error('Failed to send reply:', error);
		}
	}


	// Handler for SendMessageDialog component
	function handleSendMessageDialogSend(event) {
		const { newMessage, assignTo } = event.detail;
		sendMessageFromDialog(newMessage, assignTo);
	}

	function handleSendMessageDialogClose() {
		showSendMessageDialog = false;
	}

	async function sendMessageFromDialog(newMessage, assignTo) {
		if (!newMessage.body.trim() || !selectedProject) return;

		try {
			const requestBody = {
				projectId: selectedProject.id,
				authorAgentId: 'human-director',
				title: newMessage.title || null,
				body: newMessage.body,
				channelId: newMessage.channelId || null,
				assignTo: assignTo.length > 0 ? assignTo : undefined
			};

			const response = await fetch('/api/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				console.error('Failed to create message:', response.status);
				return;
			}

			// Close dialog and refresh data
			showSendMessageDialog = false;
			
			// Add a small delay to ensure the message is saved before reloading
			setTimeout(async () => {
				await dataManager.loadDMAgents(); // Refresh agent list to show the new recipient
				
				// If a DM agent was selected from the assignTo, refresh their conversation
				const firstAssignment = assignTo[0];
				if (firstAssignment && firstAssignment.type === 'agent') {
					// Find the agent in the list and select them
					const targetAgent = dmAgents.find(agent => agent.id === firstAssignment.target);
					if (targetAgent) {
						selectedDMAgent = targetAgent;
						dataManager.setSelectedDMAgent(targetAgent);
						await dataManager.loadDMMessages(targetAgent.id);
					}
				}
			}, 100);
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	}

	async function sendMessage() {
		// Handle channel messaging (newMessageContent)
		if (!newMessageContent.trim() || !selectedProject) return;

		try {
			const requestBody = {
				projectId: selectedProject.id,
				authorAgentId: 'human-director',
				body: newMessageContent,
				channelId: selectedChannel?.id || null
			};

			const response = await fetch('/api/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				console.error('Failed to create message:', response.status);
				return;
			}

			// Clear the channel input and reload channel messages
			newMessageContent = '';
			if (selectedChannel) {
				await dataManager.loadChannelMessages(selectedChannel);
			}
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	}

	// Thread handling functions (now managed by ThreadView component)
	function onMessageSelect(message: any) {
		selectedThreadMessage = message;
		isThreadsColumnOpen = true;
	}

	function closeThreadsColumn() {
		isThreadsColumnOpen = false;
		selectedThreadMessage = null;
	}



	// Load data when project changes
	$: if (selectedProject) {
		// Set project context in DataManager
		dataManager.setProject(selectedProject);
		
		// Load all data through DataManager
		dataManager.loadChannels();
		dataManager.loadAgents();
		dataManager.loadRoleTypes();
		dataManager.loadSquads();
		dataManager.loadDMAgents();
		dataManager.loadUnreadCounts();
		startPolling(); // Start real-time polling for the new project
	}

	// Lifecycle management
	onMount(() => {
		// Set up event listener for content updates
		contentUpdatesListener = (event: CustomEvent) => {
			const { updates } = event.detail;
			dataManager.handleContentUpdates(updates);
			
			// Update thread replies if we have a selected thread message
			if (threadViewRef) {
				threadViewRef.updateThreadReplies(updates);
			}
		};
		window.addEventListener('contentUpdates', contentUpdatesListener);
		
		// Start polling if we already have a selected project
		if (selectedProject) {
			startPolling();
		}
	});

	onDestroy(() => {
		// Clean up event listener
		if (contentUpdatesListener) {
			window.removeEventListener('contentUpdates', contentUpdatesListener);
		}
		
		// Stop polling
		stopPolling();
	});
</script>

<div class="communications-section">
	<!-- Removed section header to save space -->

	<CommunicationsNavigation 
		{commsViewMode}
		{channelUnreadCount}
		{dmUnreadCount}
		on:modeChange={handleModeChange}
	/>

	<div class="comms-content">
		{#if commsViewMode === 'communications'}
			<!-- Flexible Layout with Sliding Threads Column -->
			<div class="communications-layout">
				<!-- Column 1: Channels List (Fixed width) -->
				<ChannelList 
					{channels}
					{selectedChannel}
					on:channelSelect={handleChannelSelect}
				/>
				
				<!-- Column 2: Messages View -->
				<div class="messages-viewer">
					<ChannelMessageList 
						{selectedChannel}
						{channelMessages}
						{selectedThreadMessage}
						bind:newMessageContent
						{formatMessageTime}
						{isMessageFullyRead}
						{isMessagePartiallyRead}
						{toggleReadStatusTooltip}
						{startReply}
						on:messageSelect={(e) => onMessageSelect(e.detail)}
						on:sendMessage={sendMessage}
					/>
				</div>
				
				<!-- Column 3: Sliding Threads/Replies (now handled by ThreadView component) -->
				<ThreadView 
					bind:this={threadViewRef}
					{selectedProject}
					{selectedThreadMessage}
					{isThreadsColumnOpen}
					bind:replyContent
					{formatMessageTime}
					{isMessageFullyRead}
					{isMessagePartiallyRead}
					{toggleReadStatusTooltip}
					on:close={closeThreadsColumn}
					on:sendReply={handleSendReply}
				/>
			</div>
		{:else if commsViewMode === 'direct-messages'}
			<div class="direct-messages-view">
				<div class="dm-left">
					<DMAgentList 
						{dmAgents}
						{selectedDMAgent}
						{formatMessageTime}
						on:agentSelect={handleDMAgentSelect}
						on:sendMessage={handleDMSendMessage}
					/>
				</div>
				
				<div class="dm-right">
					<DMMessageList 
						{selectedDMAgent}
						{dmMessages}
						{replyingToMessage}
						bind:replyContent
						bind:newDMContent
						{formatMessageTime}
						{isMessageFullyRead}
						{isMessagePartiallyRead}
						{toggleReadStatusTooltip}
						{startReply}
						on:sendReply={handleSendReply}
						on:cancelReply={handleCancelReply}
						on:sendDM={handleSendDM}
					/>
				</div>			</div>
		{/if}
	</div>
</div>


<!-- SendMessageDialog Component -->
<SendMessageDialog 
	{showSendMessageDialog}
	{channels}
	{agents}
	{roleTypes}
	{squads}
	on:sendMessage={handleSendMessageDialogSend}
	on:close={handleSendMessageDialogClose}
/>


<style>
	.communications-section {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 170px); /* Increased to fully eliminate scroll */
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

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.section-header h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		color: #374151;
	}

	.unread-badge {
		background: #ef4444;
		color: white;
		border-radius: 10px;
		padding: 2px 6px;
		font-size: 11px;
		font-weight: 700;
		min-width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: pulse-badge 2s infinite;
	}


	.nav-badge {
		margin-left: 6px;
	}

	@keyframes pulse-badge {
		0% { transform: scale(1); }
		50% { transform: scale(1.1); }
		100% { transform: scale(1); }
	}

	.polling-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: #dcfce7;
		border: 1px solid #bbf7d0;
		border-radius: 12px;
		font-size: 12px;
	}

	.polling-dot {
		width: 8px;
		height: 8px;
		background: #22c55e;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	.polling-text {
		color: #15803d;
		font-weight: 500;
	}

	.polling-error {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 12px;
		font-size: 12px;
	}

	.error-dot {
		width: 8px;
		height: 8px;
		background: #ef4444;
		border-radius: 50%;
	}

	.error-text {
		color: #dc2626;
		font-weight: 500;
	}

	@keyframes pulse {
		0% { opacity: 1; }
		50% { opacity: 0.5; }
		100% { opacity: 1; }
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


	/* Reply Input Interface Styles */
	.reply-input-container {
		margin-top: 8px;
		padding: 12px;
		background: #f9fafb;
		border-radius: 6px;
		border: 1px solid #e5e7eb;
	}

	.reply-input-wrapper {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.reply-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 14px;
		background: white;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.reply-input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);
	}

	.cancel-reply-btn {
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		color: #6b7280;
		padding: 6px 10px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s ease;
		min-width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cancel-reply-btn:hover {
		background: #e5e7eb;
		color: #374151;
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

	.nav-btn-content {
		display: flex;
		align-items: center;
		gap: 4px;
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
		padding: 0; /* Remove padding to give full space to columns */
		height: 100%; /* Ensure it takes full available height */
	}

	/* Flexible Layout with Sliding Threads Column */
	.communications-layout {
		display: flex;
		height: 100%;
		flex: 1;
		min-height: 0;
		position: relative;
		overflow: hidden;
	}

	/* Subtle backdrop when threads are open - only over messages area */
	.messages-viewer::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0);
		pointer-events: none;
		transition: background 0.3s ease;
		z-index: 1;
		opacity: 0;
	}

	.communications-layout:has(.threads-column.open) .messages-viewer::before {
		background: rgba(0, 0, 0, 0.05);
		opacity: 1;
	}

	/* Column 1: Channels Sidebar (Fixed width) */
	.channels-sidebar {
		width: 300px;
		flex-shrink: 0;
		border-right: 1px solid #ddd;
		padding: 1rem;
		overflow-y: auto;
		background: white;
		height: 100%; /* Full height of layout */
	}

	.channels-header {
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e7eb;
		margin-bottom: 1rem;
	}

	.channels-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.channel-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}


	.channel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.channel-name {
		font-weight: 600;
		color: #333;
		font-size: 0.9rem;
	}

	.channel-badge {
		font-size: 0.7rem;
		padding: 2px 6px;
		border-radius: 8px;
		background: #e9ecef;
		color: #495057;
	}

	.channel-badge.human-director {
		background: #fee2e2;
		color: #dc2626;
	}

	.channel-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.75rem;
		color: #6b7280;
	}

	.message-count {
		font-weight: 500;
	}

	.unread-count {
		color: #ef4444;
		font-weight: 600;
	}

	/* Column 2: Messages Viewer (Flexible) */
	.messages-viewer {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: white;
		min-width: 0;
		position: relative;
		height: 100%; /* Full height of layout */
		overflow: hidden;
	}

	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		min-height: 0; /* Allow shrinking for scroll */
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.communications-placeholder {
		padding: 40px;
		text-align: center;
		color: #6b7280;
		background: #f9fafb;
		border: 2px dashed #d1d5db;
		border-radius: 8px;
		margin: 20px;
	}

	.communications-placeholder h3 {
		margin: 0 0 16px 0;
		font-size: 20px;
		font-weight: 600;
		color: #374151;
	}

	.communications-placeholder p {
		margin: 8px 0;
		font-size: 14px;
		line-height: 1.5;
	}

	/* Channel list styles - copied from ChannelsSection */
	.channels-panel {
		background: #f9f9f9;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 16px;
	}

	.channels-panel h3 {
		margin: 0 0 12px 0;
		color: #333;
	}

	.channels-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.channels-header h3 {
		margin: 0;
	}

	.channel-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}


	.channel-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.channel-name {
		font-weight: 500;
		color: #333;
	}

	.channel-badge {
		background: #28a745;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 500;
	}

	.channel-badge.human-director {
		background: #f59e0b;
		color: white;
	}

	.channel-badge.unread-badge {
		background: #ef4444;
		color: white;
		font-weight: 700;
		min-width: 20px;
		text-align: center;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0% { transform: scale(1); }
		50% { transform: scale(1.05); }
		100% { transform: scale(1); }
	}

	.channel-details {
		display: flex;
		gap: 8px;
		font-size: 12px;
		color: #666;
	}

	.channel-stats {
		font-size: 12px;
		color: #666;
	}

	.unread-count {
		color: #ef4444;
		font-weight: 600;
	}

	/* Messages view styles - copied from ChannelsSection */
	.messages-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0;
		margin: 0;
	}
	
	.messages-container {
		flex: 1;
		overflow-y: auto;
		margin-bottom: 16px;
		padding: 0;
	}
	
	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0;
	}
	
	/* Message input styles */
	.message-input-container {
		border-top: 1px solid #e5e5e5;
		padding: 16px 1rem 1rem 1rem;
		background: white;
		flex-shrink: 0; /* Don't shrink when messages grow */
	}
	
	.message-input-wrapper {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}
	
	.message-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		outline: none;
	}

	.message-input:disabled {
		background: #f5f5f5;
		color: #999;
	}
	
	.send-btn {
		background: #007acc;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.send-btn:hover {
		background: #0056a3;
	}

	.send-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.input-note {
		font-size: 12px;
		color: #666;
		margin: 0;
	}

	.btn-icon {
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 14px;
		color: #666;
		transition: all 0.2s ease;
	}

	.btn-icon:hover {
		background: #e5e5e5;
		color: #333;
	}

	/* Inline assignment badges */
	.inline-assignments {
		display: flex;
		gap: 4px;
		margin-top: 4px;
		flex-wrap: wrap;
	}

	.assignment-badge {
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 10px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.assignment-badge.fully-read {
		background: #dcfce7;
		color: #166534;
		border: 1px solid #bbf7d0;
	}

	.assignment-badge.unread {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}

	.assignment-badge:not(.fully-read):not(.unread) {
		background: #fef3c7;
		color: #d97706;
		border: 1px solid #fed7aa;
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

	.direct-messages-view {
		height: 100%;
		display: flex;
		gap: 20px;
		overflow: hidden;
	}

	.dm-left {
		width: 400px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-y: auto;
	}

	.dm-right {
		flex: 1;
		display: flex;
		flex-direction: column;
	}


	.no-dm-agents {
		text-align: center;
		padding: 20px;
		color: #6b7280;
	}

	.no-dm-agents p {
		margin: 4px 0;
		font-size: 14px;
	}

	/* DM Messages View Styles */
	.dm-messages-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0;
		margin: 0;
	}
	
	.dm-messages-container {
		flex: 1;
		overflow-y: auto;
		margin-bottom: 16px;
		padding: 0;
	}
	
	.dm-messages-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0;
	}

	.dm-input-container {
		border-top: 1px solid #e5e5e5;
		padding-top: 16px;
	}
	
	.dm-input-wrapper {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}

	.dm-placeholder {
		padding: 40px;
		text-align: center;
		color: #6b7280;
		background: #f9fafb;
		border: 2px dashed #d1d5db;
		border-radius: 8px;
		margin: 20px;
	}

	.dm-placeholder h3 {
		margin: 0 0 16px 0;
		font-size: 20px;
		font-weight: 600;
		color: #374151;
	}

	.dm-placeholder p {
		margin: 8px 0;
		font-size: 14px;
		line-height: 1.5;
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
</style>
