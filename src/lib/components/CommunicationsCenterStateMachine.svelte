<!--
	Unified Communications Center with State Machine
	
	Replaces race-condition-prone CommunicationsSection with
	atomic state transitions and event-driven coordination.
-->

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { 
		projectStateMachine,
		projectMachine,
		channelMessages,
		directMessages,
		documents,
		tickets,
		phases,
		channels,
		agents,
		roleTypes,
		squads,
		isLoading,
		currentProject,
		machineError,
		channelUnreadCount,
		dmUnreadCount,
		documentsUnreadCount,
		ticketsUnreadCount,
		phasesUnreadCount,
		totalUnreadCount,
		machineDebugInfo
	} from '$lib/stores/projectStateMachine';
	
	import CommunicationsNavigation from './CommunicationsNavigation.svelte';
	import ChannelList from './ChannelList.svelte';
	import DMAgentList from './DMAgentList.svelte';
	import DMMessageList from './DMMessageList.svelte';
	import ChannelMessageList from './ChannelMessageList.svelte';
	import ThreadView from './ThreadView.svelte';
	import SendMessageDialog from './SendMessageDialog.svelte';
	import DocumentsSection from './DocumentsSection.svelte';
	import TicketsSection from './TicketsSection.svelte';
	import PhasesSection from './PhasesSection.svelte';
	import DMOversightSection from './DMOversightSection.svelte';
	
	import { toggleReadStatusTooltip } from '$lib/utils/tooltipManager';
	import { getHumanDirectorAgentId, isMessageFromHumanDirector } from '$lib/utils/humanDirectorClientHelpers';
	import { 
		isMessageFullyRead, 
		isMessagePartiallyRead, 
		formatMessageTime 
	} from '$lib/utils/messageOperations';

	// Props
	export let selectedProject: any = null;

	// Local UI state (no longer manages data)
	let commsViewMode: 'communications' | 'direct-messages' | 'dm-oversight' | 'documents' | 'tickets' | 'phases' = 'communications';
	let selectedChannel: any = null;
	let selectedDMAgent: any = null;
	let selectedThreadMessage: any = null;
	let isThreadsColumnOpen: boolean = false;
	let threadViewRef: any;
	
	// Input states
	let newMessageContent = '';
	let newDMContent = '';
	let replyContent = '';
	let replyingToMessage: any = null;
	
	// Dialog state
	let showSendMessageDialog = false;
	
	// Pagination state (local to UI components)
	let channelMessagesPagination: any = null;
	let dmMessagesPagination: any = null;

	// Reactive data from state machine
	$: storeChannels = $channels;
	$: storeAgents = $agents;
	$: storeDirectMessages = $directMessages;
	$: storeChannelMessages = $channelMessages;
	$: storeIsLoading = $isLoading;
	$: storeError = $machineError;
	
	// Enhanced channels with message counts
	$: enhancedChannels = storeChannels.map(channel => {
		const channelMessages = storeChannelMessages.filter(msg => msg.channelId === channel.id);
		return {
			...channel,
			messageCount: channelMessages.length
		};
	});
	
	// Enhanced DM agents with recent message info
	$: dmAgents = (() => {
		const baseAgents = storeAgents.filter(agent => !agent.isHumanDirector);
		
		return baseAgents.map(agent => {
			const agentDMs = storeDirectMessages.filter(dm => dm.authorAgentId === agent.id);
			const lastMessage = agentDMs.length > 0 ? 
				agentDMs.reduce((latest, dm) => 
					new Date(dm.createdAt) > new Date(latest.createdAt) ? dm : latest
				) : null;
			
			return {
				...agent,
				lastMessageAt: lastMessage?.createdAt || null,
				lastMessage: lastMessage?.body || null
			};
		}).sort((a, b) => {
			if (a.lastMessageAt && b.lastMessageAt) {
				return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
			}
			if (a.lastMessageAt && !b.lastMessageAt) return -1;
			if (!a.lastMessageAt && b.lastMessageAt) return 1;
			return a.id.localeCompare(b.id);
		});
	})();

	// Event dispatching
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	// Event listeners for state machine events
	let projectSwitchedListener: any = null;
	let contentUpdatedListener: any = null;

	// ==================== Project Switching ====================
	
	// Watch for project changes and use state machine
	$: if (selectedProject && (!$currentProject || $currentProject.id !== selectedProject.id)) {
		handleProjectSwitch(selectedProject);
	}
	
	async function handleProjectSwitch(project: any) {
		if (!project?.id) return;
		
		console.log(`🚀 State Machine: Switching to project ${project.id}`);
		
		try {
			await projectStateMachine.switchProject(project.id, project.name);
		} catch (error) {
			console.error('❌ Project switch failed:', error);
		}
	}

	// ==================== Event Handlers ====================
	
	function handleModeChange(event: CustomEvent) {
		commsViewMode = event.detail;
	}

	function handleChannelSelect(event: CustomEvent) {
		selectedChannel = event.detail;
		// Reset thread state when switching channels
		selectedThreadMessage = null;
		isThreadsColumnOpen = false;
	}

	function handleDMAgentSelect(event: CustomEvent) {
		selectedDMAgent = event.detail;
	}

	function onMessageSelect(message: any) {
		selectedThreadMessage = message;
		isThreadsColumnOpen = true;
	}

	function closeThreadsColumn() {
		isThreadsColumnOpen = false;
		selectedThreadMessage = null;
	}

	function startReply(message: any) {
		replyingToMessage = message;
		replyContent = '';
	}

	function cancelReply() {
		replyingToMessage = null;
		replyContent = '';
	}

	// ==================== Message Sending ====================
	
	async function sendMessage() {
		if (!newMessageContent.trim() || !selectedChannel || !$currentProject) return;

		try {
			const response = await fetch('/api/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: $currentProject.id,
					authorAgentId: getHumanDirectorAgentId(),
					body: newMessageContent,
					channelId: selectedChannel.id
				})
			});

			if (response.ok) {
				newMessageContent = '';
				// State machine will automatically pick up the new message via polling
			} else {
				console.error('Failed to send message:', response.status);
			}
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	}

	async function sendDMMessage() {
		if (!newDMContent.trim() || !selectedDMAgent || !$currentProject) return;

		try {
			const response = await fetch('/api/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: $currentProject.id,
					authorAgentId: getHumanDirectorAgentId(),
					body: newDMContent,
					channelId: null, // This makes it a DM
					assignTo: [{
						type: 'agent',
						target: selectedDMAgent.id
					}]
				})
			});

			if (response.ok) {
				newDMContent = '';
				// State machine will automatically pick up the new message
			} else {
				console.error('Failed to send DM:', response.status);
			}
		} catch (error) {
			console.error('Failed to send DM:', error);
		}
	}

	async function sendReply() {
		const messageId = selectedThreadMessage?.id || replyingToMessage?.id;
		const message = selectedThreadMessage || replyingToMessage;
		
		if (!replyContent.trim() || !messageId || !$currentProject) return;

		try {
			const response = await fetch('/api/replies', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: $currentProject.id,
					authorAgentId: getHumanDirectorAgentId(),
					body: replyContent,
					parentContentId: messageId,
					assignTo: message?.authorAgentId && !isMessageFromHumanDirector(message) ? [{
						type: 'agent',
						target: message.authorAgentId
					}] : []
				})
			});

			if (response.ok) {
				replyContent = '';
				if (selectedThreadMessage) {
					// Thread reply sent
				} else if (replyingToMessage) {
					cancelReply();
				}
			} else {
				console.error('Failed to send reply:', response.status);
			}
		} catch (error) {
			console.error('Failed to send reply:', error);
		}
	}

	// ==================== Dialog Handlers ====================
	
	function handleDMSendMessage() {
		showSendMessageDialog = true;
	}

	function handleSendMessageDialogSend(event: any) {
		const { newMessage, assignTo } = event.detail;
		sendMessageFromDialog(newMessage, assignTo);
	}

	function handleSendMessageDialogClose() {
		showSendMessageDialog = false;
	}

	async function sendMessageFromDialog(newMessage: any, assignTo: any[]) {
		if (!newMessage.body.trim() || !$currentProject) return;

		try {
			const response = await fetch('/api/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: $currentProject.id,
					authorAgentId: getHumanDirectorAgentId(),
					title: newMessage.title || null,
					body: newMessage.body,
					channelId: newMessage.channelId || null,
					assignTo: assignTo.length > 0 ? assignTo : undefined
				})
			});

			if (!response.ok) {
				console.error('Failed to create message:', response.status);
				return;
			}

			showSendMessageDialog = false;
			
			// If a DM agent was selected, set as selected
			const firstAssignment = assignTo[0];
			if (firstAssignment?.type === 'agent') {
				const targetAgent = storeAgents.find(agent => agent.id === firstAssignment.target);
				if (targetAgent) {
					selectedDMAgent = targetAgent;
				}
			}
		} catch (error) {
			console.error('Failed to send message:', error);
		}
	}

	// ==================== Lifecycle ====================
	
	onMount(() => {
		// Set up event listeners for state machine events
		projectSwitchedListener = (event: CustomEvent) => {
			console.log(`✅ Project switched to: ${event.detail.projectId}`);
		};
		
		contentUpdatedListener = (event: CustomEvent) => {
			const { count, types } = event.detail;
			console.log(`📬 Content updated: ${count} items of types: ${types.join(', ')}`);
			
			// Update thread replies if we have a selected thread message
			if (threadViewRef) {
				// The state machine has already updated the stores,
				// just notify the thread view to refresh
				threadViewRef.refreshFromStores();
			}
		};

		window.addEventListener('projectSwitched', projectSwitchedListener);
		window.addEventListener('contentUpdated', contentUpdatedListener);
	});

	onDestroy(() => {
		// Clean up event listeners
		if (projectSwitchedListener) {
			window.removeEventListener('projectSwitched', projectSwitchedListener);
		}
		if (contentUpdatedListener) {
			window.removeEventListener('contentUpdated', contentUpdatedListener);
		}
		
		// The state machine manages its own cleanup
	});
</script>

<!-- Debug info in development -->
{#if import.meta.env.DEV}
	<div class="debug-info">
		<details>
			<summary>🔧 State Machine Debug</summary>
			<pre>{JSON.stringify($machineDebugInfo, null, 2)}</pre>
		</details>
	</div>
{/if}

<div class="communications-section" class:loading={$isLoading}>
	<!-- Loading overlay for atomic transitions -->
	{#if $isLoading}
		<div class="loading-overlay">
			<div class="loading-spinner"></div>
			<p>Switching project...</p>
		</div>
	{/if}

	<!-- Error state -->
	{#if $machineError}
		<div class="error-banner">
			<span class="error-icon">⚠️</span>
			<span class="error-message">{$machineError}</span>
		</div>
	{/if}

	<!-- Navigation with centralized badge counts -->
	<CommunicationsNavigation 
		{commsViewMode}
		channelUnreadCount={$channelUnreadCount}
		dmUnreadCount={$dmUnreadCount}
		documentsUnreadCount={$documentsUnreadCount}
		ticketsUnreadCount={$ticketsUnreadCount}
		phasesUnreadCount={$phasesUnreadCount}
		on:modeChange={handleModeChange}
	/>

	<!-- Content sections -->
	<div class="comms-content">
		{#if commsViewMode === 'communications'}
			<div class="communications-layout">
				<ChannelList 
					channels={enhancedChannels}
					{selectedChannel}
					on:channelSelect={handleChannelSelect}
				/>
				
				<div class="messages-viewer">
					<ChannelMessageList 
						{selectedChannel}
						channelMessages={storeChannelMessages.filter(msg => msg.channelId === selectedChannel?.id)}
						messagesPagination={channelMessagesPagination}
						{selectedThreadMessage}
						bind:newMessageContent
						{formatMessageTime}
						{isMessageFullyRead}
						{isMessagePartiallyRead}
						{toggleReadStatusTooltip}
						on:messageSelect={(e) => onMessageSelect(e.detail)}
						on:sendMessage={sendMessage}
					/>
				</div>
				
				<ThreadView 
					bind:this={threadViewRef}
					selectedProject={$currentProject}
					{selectedThreadMessage}
					{isThreadsColumnOpen}
					bind:replyContent
					{formatMessageTime}
					{isMessageFullyRead}
					{isMessagePartiallyRead}
					{toggleReadStatusTooltip}
					on:close={closeThreadsColumn}
					on:sendReply={sendReply}
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
						dmMessages={storeDirectMessages.filter(dm => 
							dm.authorAgentId === selectedDMAgent?.id ||
							(isMessageFromHumanDirector(dm) && dm.readingAssignments?.some(assignment => 
								(assignment.assignedToType === 'agent' && assignment.assignedTo === selectedDMAgent?.id) ||
								(assignment.assignedToType === 'role' && assignment.targetAgents?.includes(selectedDMAgent?.id)) ||
								(assignment.assignedToType === 'squad' && assignment.targetAgents?.includes(selectedDMAgent?.id))
							))
						)}
						messagesPagination={dmMessagesPagination}
						{replyingToMessage}
						bind:replyContent
						bind:newDMContent
						{formatMessageTime}
						{isMessageFullyRead}
						{isMessagePartiallyRead}
						{toggleReadStatusTooltip}
						agents={storeAgents}
						on:sendReply={sendReply}
						on:cancelReply={cancelReply}
						on:sendDM={sendDMMessage}
					/>
				</div>
			</div>

		{:else if commsViewMode === 'dm-oversight'}
			<DMOversightSection selectedProject={$currentProject} />
		{:else if commsViewMode === 'documents'}
			<DocumentsSection selectedProject={$currentProject} />
		{:else if commsViewMode === 'tickets'}
			<TicketsSection selectedProject={$currentProject} />
		{:else if commsViewMode === 'phases'}
			<PhasesSection selectedProject={$currentProject} />
		{/if}
	</div>
</div>

<!-- Send Message Dialog -->
<SendMessageDialog 
	{showSendMessageDialog}
	channels={storeChannels}
	agents={storeAgents}
	roleTypes={$roleTypes}
	squads={$squads}
	on:sendMessage={handleSendMessageDialogSend}
	on:close={handleSendMessageDialogClose}
/>

<style>
	.communications-section {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 170px);
		background: white;
		border-radius: 8px;
		overflow: hidden;
		position: relative;
	}

	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(255, 255, 255, 0.9);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #f3f4f6;
		border-top: 4px solid #2563eb;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.loading-overlay p {
		margin: 0;
		color: #6b7280;
		font-weight: 500;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: #fef2f2;
		border-bottom: 1px solid #fecaca;
		color: #dc2626;
		font-size: 14px;
	}

	.error-icon {
		font-size: 16px;
	}

	.error-message {
		flex: 1;
	}

	.debug-info {
		position: fixed;
		top: 10px;
		right: 10px;
		z-index: 9999;
		background: #1f2937;
		color: #f9fafb;
		padding: 8px;
		border-radius: 4px;
		font-family: monospace;
		font-size: 12px;
		max-width: 300px;
	}

	.debug-info summary {
		cursor: pointer;
		user-select: none;
	}

	.debug-info pre {
		margin: 8px 0 0 0;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.comms-content {
		flex: 1;
		overflow: hidden;
		height: 100%;
	}

	.communications-layout {
		display: flex;
		height: 100%;
		flex: 1;
		min-height: 0;
		position: relative;
		overflow: hidden;
	}

	.messages-viewer {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: white;
		min-width: 0;
		position: relative;
		height: 100%;
		overflow: hidden;
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
</style>