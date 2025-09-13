<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}

<style>
	/* Global tooltip styles for ReadStatusTooltip */
	:global(.read-status-tooltip) {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		padding: 12px;
		font-size: 14px;
		max-width: 300px;
		z-index: 1000;
	}

	:global(.tooltip-header) {
		font-weight: 600;
		color: #374151;
		margin-bottom: 8px;
		padding-bottom: 6px;
		border-bottom: 1px solid #f3f4f6;
	}

	:global(.assignments-list) {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(.assignment-status) {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 6px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	:global(.assignment-status.assignment-read) {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
	}

	:global(.assignment-status.assignment-unread) {
		background: #fef2f2;
		border: 1px solid #fecaca;
	}

	:global(.assignment-icon) {
		font-size: 12px;
		flex-shrink: 0;
	}

	:global(.assignment-target) {
		font-weight: 500;
		color: #374151;
		flex: 1;
		min-width: 0;
	}

	:global(.assignment-status-text) {
		font-size: 12px;
		color: #6b7280;
		white-space: nowrap;
	}

	:global(.assignment-status.assignment-read .assignment-status-text) {
		color: #059669;
	}

	:global(.assignment-status.assignment-unread .assignment-status-text) {
		color: #dc2626;
	}
</style>
