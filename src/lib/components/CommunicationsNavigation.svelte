<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let commsViewMode: 'communications' | 'direct-messages' | 'dm-oversight' | 'documents' | 'tickets' | 'phases' = 'communications';
	export let channelUnreadCount: number = 0;
	export let dmUnreadCount: number = 0;
	export let documentsUnreadCount: number = 0;
	export let ticketsUnreadCount: number = 0;
	export let phasesUnreadCount: number = 0;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	function handleModeChange(mode: 'communications' | 'direct-messages' | 'dm-oversight' | 'documents' | 'tickets' | 'phases') {
		dispatch('modeChange', mode);
	}
</script>

<div class="comms-nav">
	<button 
		class="comms-nav-btn" 
		class:active={commsViewMode === 'communications'}
		on:click={() => handleModeChange('communications')}
	>
		<span class="nav-btn-content">
			📺 Channels
			{#if channelUnreadCount > 0}
				<span class="unread-badge nav-badge">{channelUnreadCount}</span>
			{/if}
		</span>
	</button>
	<button 
		class="comms-nav-btn" 
		class:active={commsViewMode === 'direct-messages'}
		on:click={() => handleModeChange('direct-messages')}
	>
		<span class="nav-btn-content">
			📩 Direct Messages
			{#if dmUnreadCount > 0}
				<span class="unread-badge nav-badge">{dmUnreadCount}</span>
			{/if}
		</span>
	</button>
	<button 
		class="comms-nav-btn" 
		class:active={commsViewMode === 'dm-oversight'}
		on:click={() => handleModeChange('dm-oversight')}
	>
		<span class="nav-btn-content">
			🔍 DM Oversight
		</span>
	</button>
	<button 
		class="comms-nav-btn" 
		class:active={commsViewMode === 'documents'}
		on:click={() => handleModeChange('documents')}
	>
		<span class="nav-btn-content">
			📄 Documents
			{#if documentsUnreadCount > 0}
				<span class="unread-badge nav-badge">{documentsUnreadCount}</span>
			{/if}
		</span>
	</button>
	<button 
		class="comms-nav-btn" 
		class:active={commsViewMode === 'tickets'}
		on:click={() => handleModeChange('tickets')}
	>
		<span class="nav-btn-content">
			🎫 Tickets
			{#if ticketsUnreadCount > 0}
				<span class="unread-badge nav-badge">{ticketsUnreadCount}</span>
			{/if}
		</span>
	</button>
	<button 
		class="comms-nav-btn" 
		class:active={commsViewMode === 'phases'}
		on:click={() => handleModeChange('phases')}
	>
		<span class="nav-btn-content">
			📋 Phases
			{#if phasesUnreadCount > 0}
				<span class="unread-badge nav-badge">{phasesUnreadCount}</span>
			{/if}
		</span>
	</button>
</div>

<style>
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
	
	/* Badge styles - exact copy from parent */
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
		line-height: 1;
	}
	.nav-badge {
		margin-left: 6px;
	}
</style>