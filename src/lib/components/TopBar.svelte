<script>
	export let projects = [];
	export let selectedProject = null;
	export let onProjectChange = () => {};
	export let showCreateDialog = false;
</script>

<div class="top-bar">
	<div class="project-controls">
		<select bind:value={selectedProject} on:change={onProjectChange} class="project-selector">
			{#if projects.length === 0}
				<option value={null}>No projects</option>
			{:else}
				{#each projects as project}
					<option value={project}>{project.name}</option>
				{/each}
			{/if}
		</select>
		<button 
			class="btn-primary" 
			on:click={() => showCreateDialog = true}
		>
			+ New Project
		</button>
	</div>
</div>

<style>
	.top-bar {
		background: #1f2937;
		color: white;
		padding: 12px 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #374151;
	}

	.project-controls {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.project-selector {
		background: #374151;
		color: white;
		border: 1px solid #4b5563;
		padding: 8px 12px;
		border-radius: 4px;
		min-width: 200px;
	}

	.project-selector:focus {
		outline: none;
		border-color: #3b82f6;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.btn-primary:hover {
		background: #2563eb;
	}
</style>