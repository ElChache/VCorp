<script>
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let show = false;
	export let title = 'Confirm Action';
	export let message = 'Are you sure you want to continue?';
	export let confirmText = 'Confirm';
	export let cancelText = 'Cancel';
	export let confirmButtonClass = 'btn-danger';
	export let icon = '⚠️';
	export let size = 'medium'; // 'small', 'medium', 'large'

	function handleConfirm() {
		dispatch('confirm');
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleOverlayClick() {
		dispatch('cancel');
	}
</script>

{#if show}
	<div class="modal-overlay" on:click={handleOverlayClick}>
		<div class="modal-content {size}" on:click|stopPropagation>
			<div class="modal-header">
				<h3>
					{#if icon}
						<span class="header-icon">{icon}</span>
					{/if}
					{title}
				</h3>
				<button class="modal-close" on:click={handleCancel}>×</button>
			</div>

			<div class="modal-body">
				<div class="confirmation-content">
					{#if icon}
						<div class="confirmation-icon">{icon}</div>
					{/if}
					<div class="confirmation-message">
						{@html message}
					</div>
				</div>
				
				<!-- Allow custom content to be inserted -->
				<slot />
			</div>

			<div class="modal-actions">
				<button class="btn-secondary" on:click={handleCancel}>
					{cancelText}
				</button>
				<button class="{confirmButtonClass}" on:click={handleConfirm}>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
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
		backdrop-filter: blur(2px);
	}

	.modal-content {
		background: white;
		border-radius: 12px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		margin: 1rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		border: 1px solid #e5e7eb;
	}

	.modal-content.small {
		max-width: 400px;
	}

	.modal-content.medium {
		max-width: 500px;
	}

	.modal-content.large {
		max-width: 700px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 1.5rem 1rem 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header-icon {
		font-size: 1.125rem;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: #6b7280;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.modal-close:hover {
		color: #374151;
		background: #f3f4f6;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.confirmation-content {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.confirmation-icon {
		font-size: 2rem;
		flex-shrink: 0;
		line-height: 1;
	}

	.confirmation-message {
		flex: 1;
		color: #374151;
		line-height: 1.6;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem 1.5rem 1.5rem;
		border-top: 1px solid #e5e7eb;
		background: #f9fafb;
		border-radius: 0 0 12px 12px;
	}

	/* Button Styles */
	.btn-secondary, .btn-primary, .btn-danger {
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid transparent;
		transition: all 0.2s;
		font-size: 0.875rem;
		line-height: 1.25rem;
		min-width: 80px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.btn-secondary {
		background: white;
		color: #374151;
		border-color: #d1d5db;
	}

	.btn-secondary:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover {
		background: #2563eb;
	}

	.btn-danger {
		background: #dc2626;
		color: white;
	}

	.btn-danger:hover {
		background: #b91c1c;
	}

	.btn-secondary:disabled,
	.btn-primary:disabled,
	.btn-danger:disabled {
		background: #d1d5db;
		color: #9ca3af;
		cursor: not-allowed;
		border-color: #d1d5db;
	}

	/* Focus styles for accessibility */
	.btn-secondary:focus,
	.btn-primary:focus,
	.btn-danger:focus,
	.modal-close:focus {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	/* Animation */
	.modal-overlay {
		animation: fade-in 0.2s ease-out;
	}

	.modal-content {
		animation: slide-up 0.2s ease-out;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Dark mode support (optional) */
	@media (prefers-color-scheme: dark) {
		.modal-content {
			background: #1f2937;
			border-color: #374151;
		}

		.modal-header {
			border-color: #374151;
		}

		.modal-header h3 {
			color: #f9fafb;
		}

		.modal-close {
			color: #9ca3af;
		}

		.modal-close:hover {
			color: #d1d5db;
			background: #374151;
		}

		.confirmation-message {
			color: #d1d5db;
		}

		.modal-actions {
			background: #111827;
			border-color: #374151;
		}

		.btn-secondary {
			background: #374151;
			color: #d1d5db;
			border-color: #4b5563;
		}

		.btn-secondary:hover {
			background: #4b5563;
		}
	}
</style>