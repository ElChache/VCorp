<script>
	import { createEventDispatcher } from 'svelte';
	import ConfirmationDialog from './ConfirmationDialog.svelte';
	import { getDocumentFileDisplayPath } from '$lib/utils/documentTypes.js';

	const dispatch = createEventDispatcher();

	export let show = false;
	export let document = null;

	$: displayPath = document ? getDocumentFileDisplayPath(document) : '';
	
	$: confirmationMessage = document ? `
		<div class="delete-document-details">
			<h4>Are you sure you want to delete this document?</h4>
			<div class="document-title">"${document.title}"</div>
			<div class="warning-text">
				This action will permanently remove the document file and cannot be undone.
				The document will be automatically removed from the database through file synchronization.
			</div>
			<div class="file-info">
				📁 File: <code>${displayPath}</code>
			</div>
		</div>
	` : '';

	function handleConfirm() {
		dispatch('confirm', { document });
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<ConfirmationDialog
	{show}
	title="🗑️ Delete Document"
	message={confirmationMessage}
	confirmText="🗑️ Delete Document"
	cancelText="Cancel"
	confirmButtonClass="btn-danger"
	icon=""
	size="medium"
	on:confirm={handleConfirm}
	on:cancel={handleCancel}
/>

<style>
	:global(.delete-document-details h4) {
		margin: 0 0 1rem 0;
		color: #dc2626;
		font-weight: 600;
		font-size: 1.125rem;
	}

	:global(.delete-document-details .document-title) {
		font-weight: 600;
		color: #374151;
		margin: 0.75rem 0;
		padding: 0.75rem;
		background: #f3f4f6;
		border-radius: 6px;
		border-left: 4px solid #dc2626;
		font-size: 1rem;
	}

	:global(.delete-document-details .warning-text) {
		color: #6b7280;
		margin: 1rem 0;
		line-height: 1.6;
		font-size: 0.9rem;
	}

	:global(.delete-document-details .file-info) {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 1rem 0 0 0;
		padding: 0.5rem;
		background: #f9fafb;
		border-radius: 4px;
		border: 1px solid #e5e7eb;
	}

	:global(.delete-document-details .file-info code) {
		background: #f3f4f6;
		padding: 0.125em 0.375em;
		border-radius: 3px;
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace;
		font-size: 0.85em;
		color: #374151;
		font-weight: 500;
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		:global(.delete-document-details h4) {
			color: #ef4444;
		}

		:global(.delete-document-details .document-title) {
			color: #f3f4f6;
			background: #374151;
			border-left-color: #ef4444;
		}

		:global(.delete-document-details .warning-text) {
			color: #d1d5db;
		}

		:global(.delete-document-details .file-info) {
			color: #d1d5db;
			background: #1f2937;
			border-color: #374151;
		}

		:global(.delete-document-details .file-info code) {
			background: #374151;
			color: #f3f4f6;
		}
	}
</style>