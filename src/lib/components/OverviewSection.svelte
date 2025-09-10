<script lang="ts">
	export let selectedProject: any;
	export let monitoringStatus: any = { isRunning: false, stats: null };

	// Monitoring Service Functions
	async function refreshMonitoringStatus() {
		try {
			const response = await fetch('/api/monitoring/status');
			if (response.ok) {
				monitoringStatus = await response.json();
			} else {
				console.error('Failed to fetch monitoring status');
			}
		} catch (error) {
			console.error('Error fetching monitoring status:', error);
		}
	}

	async function startMonitoring() {
		try {
			const response = await fetch('/api/monitoring/start', { method: 'POST' });
			if (response.ok) {
				await refreshMonitoringStatus();
				console.log('Monitoring service started successfully');
			} else {
				const error = await response.json();
				console.error('Failed to start monitoring:', error.error);
				alert(`Failed to start monitoring: ${error.error}`);
			}
		} catch (error) {
			console.error('Error starting monitoring:', error);
			alert('Failed to start monitoring service');
		}
	}

	async function stopMonitoring() {
		try {
			const response = await fetch('/api/monitoring/stop', { method: 'POST' });
			if (response.ok) {
				const result = await response.json();
				await refreshMonitoringStatus();
				console.log('Monitoring service stopped:', result.finalStats);
			} else {
				const error = await response.json();
				console.error('Failed to stop monitoring:', error.error);
				alert(`Failed to stop monitoring: ${error.error}`);
			}
		} catch (error) {
			console.error('Error stopping monitoring:', error);
			alert('Failed to stop monitoring service');
		}
	}
</script>

<h2>{selectedProject.name}</h2>
<p>{selectedProject.description || 'No description provided'}</p>

<!-- Monitoring Service Controls -->
<div class="monitoring-section">
	<h3>🔍 Monitoring Service</h3>
	<div class="monitoring-controls">
		<div class="monitoring-status">
			<span class="status-indicator" class:active={monitoringStatus?.isRunning}></span>
			<span>{monitoringStatus?.isRunning ? 'Active' : 'Stopped'}</span>
		</div>
		
		<div class="monitoring-actions">
			{#if monitoringStatus?.isRunning}
				<button class="btn-stop" on:click={stopMonitoring}>Stop Monitoring</button>
			{:else}
				<button class="btn-start" on:click={startMonitoring}>Start Monitoring</button>
			{/if}
			<button class="btn-refresh" on:click={refreshMonitoringStatus}>Refresh</button>
		</div>
	</div>
	
	{#if monitoringStatus?.stats}
		<div class="monitoring-stats">
			<div class="stat-item">
				<span class="stat-label">Total Checks:</span>
				<span class="stat-value">{monitoringStatus.stats.totalChecks}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">Status Updates:</span>
				<span class="stat-value">{monitoringStatus.stats.statusUpdates}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">Notifications Sent:</span>
				<span class="stat-value">{monitoringStatus.stats.notificationsSent}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">Gentle Pokes:</span>
				<span class="stat-value">{monitoringStatus.stats.gentlePokes || 0}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">Errors:</span>
				<span class="stat-value">{monitoringStatus.stats.errors}</span>
			</div>
			{#if monitoringStatus.stats.lastCheck}
				<div class="stat-item">
					<span class="stat-label">Last Check:</span>
					<span class="stat-value">{new Date(monitoringStatus.stats.lastCheck).toLocaleTimeString()}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Monitoring Service Styles */
	.monitoring-section {
		margin: 24px 0;
		padding: 20px;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		background: #f9f9ff;
	}

	.monitoring-section h3 {
		margin: 0 0 16px 0;
		color: #333;
	}

	.monitoring-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.monitoring-status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
	}

	.status-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #dc3545;
		transition: background 0.3s ease;
	}

	.status-indicator.active {
		background: #28a745;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.monitoring-actions {
		display: flex;
		gap: 8px;
	}

	.btn-start {
		padding: 6px 12px;
		background: #28a745;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn-start:hover {
		background: #218838;
	}

	.btn-stop {
		padding: 6px 12px;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn-stop:hover {
		background: #c82333;
	}

	.btn-refresh {
		padding: 6px 12px;
		background: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn-refresh:hover {
		background: #545b62;
	}

	.monitoring-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		padding: 16px;
		background: white;
		border-radius: 6px;
		border: 1px solid #e0e0e0;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.stat-label {
		font-size: 12px;
		color: #666;
		font-weight: 500;
	}

	.stat-value {
		font-size: 16px;
		font-weight: bold;
		color: #333;
	}
</style>