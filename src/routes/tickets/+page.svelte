<script>
	import { onMount } from 'svelte';
	
	let tickets = [];
	let groupedTickets = {};
	let loading = true;
	let error = null;

	async function loadTickets() {
		try {
			const response = await fetch('/api/content?type=ticket');
			if (!response.ok) throw new Error('Failed to load tickets');
			
			tickets = await response.json();
			
			// Group tickets by role
			groupedTickets = tickets.reduce((groups, ticket) => {
				const role = ticket.assignedToRoleType || 'Unassigned';
				if (!groups[role]) groups[role] = [];
				groups[role].push(ticket);
				return groups;
			}, {});
			
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	onMount(loadTickets);
</script>

<svelte:head>
	<title>Tickets - VCorp</title>
</svelte:head>

<main class="container mx-auto p-6">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900">Tickets</h1>
		<p class="text-gray-600 mt-2">View all project tickets grouped by role</p>
	</div>

	{#if loading}
		<div class="flex justify-center items-center h-64">
			<div class="text-gray-500">Loading tickets...</div>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
			Error: {error}
		</div>
	{:else}
		<div class="bg-white shadow rounded-lg overflow-hidden">
			<!-- Header -->
			<div class="grid grid-cols-3 bg-gray-50 border-b">
				<div class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
					Role
				</div>
				<div class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
					Title
				</div>
				<div class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
					Description
				</div>
			</div>

			<!-- Tickets grouped by role -->
			{#each Object.entries(groupedTickets) as [role, roleTickets]}
				{#each roleTickets as ticket, index}
					<div class="grid grid-cols-3 border-b border-gray-200 hover:bg-gray-50">
						<!-- Role column - only show role name for first ticket in group -->
						<div class="px-6 py-4 whitespace-nowrap">
							{#if index === 0}
								<div class="text-sm font-medium text-gray-900">
									{role}
								</div>
								<div class="text-xs text-gray-500">
									{roleTickets.length} ticket{roleTickets.length !== 1 ? 's' : ''}
								</div>
							{/if}
						</div>

						<!-- Title column -->
						<div class="px-6 py-4">
							<div class="text-sm font-medium text-gray-900">
								{ticket.title}
							</div>
							<div class="text-xs text-gray-500 mt-1">
								Status: {ticket.status || 'unknown'}
								{#if ticket.priority}
									• Priority: {ticket.priority}
								{/if}
								{#if ticket.claimedByAgent}
									• Claimed by: {ticket.claimedByAgent}
								{/if}
							</div>
						</div>

						<!-- Description column -->
						<div class="px-6 py-4">
							<div class="text-sm text-gray-900 break-words">
								{ticket.description || 'No description provided'}
							</div>
							{#if ticket.acceptanceCriteria}
								<div class="text-xs text-gray-500 mt-2">
									<strong>Acceptance Criteria:</strong> {ticket.acceptanceCriteria}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			{/each}

			{#if Object.keys(groupedTickets).length === 0}
				<div class="px-6 py-8 text-center text-gray-500">
					No tickets found
				</div>
			{/if}
		</div>

		<!-- Summary -->
		<div class="mt-6 text-sm text-gray-600">
			Total: {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} across {Object.keys(groupedTickets).length} role{Object.keys(groupedTickets).length !== 1 ? 's' : ''}
		</div>
	{/if}
</main>

<style>
	.container {
		max-width: 1200px;
	}
</style>