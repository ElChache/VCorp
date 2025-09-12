import { execSync, spawn } from 'child_process';
import { db } from '$lib/db/index';
import { agents, content, readingAssignments, readingAssignmentReads, projects, scheduledReminders } from '$lib/db/schema';
import { eq, and, or, notExists } from 'drizzle-orm';

import { checkForwardingStatus } from '$lib/services/ForwardingService';

interface MonitoringStats {
	totalChecks: number;
	statusUpdates: number;
	notificationsSent: number;
	gentlePokes: number;
	remindersSent: number;
	errors: number;
	startTime: Date;
	lastCheck: Date | null;
	uptime: number;
}

interface AgentStatusUpdate {
	agentId: string;
	oldStatus: string;
	newStatus: string;
	tmuxSession: string;
}

interface NotificationResult {
	agentId: string;
	unreadCount: number;
	success: boolean;
	error?: string;
}

interface GentlePokeResult {
	agentId: string;
	idleStartTime: Date;
	success: boolean;
	error?: string;
}

interface ScheduledReminderResult {
	reminderId: number;
	reminderName: string;
	targetRoleType: string;
	success: boolean;
	error?: string;
}

/**
 * Singleton MonitoringManager
 * Handles all monitoring operations every 5 seconds:
 * - Agent status updates (active/idle/offline)
 * - Unread message notifications to agents
 */
class MonitoringManager {
	private static instance: MonitoringManager | null = null;
	private intervalId: NodeJS.Timeout | null = null;
	private _isRunning = false;
	
	private stats: MonitoringStats = {
		totalChecks: 0,
		statusUpdates: 0,
		notificationsSent: 0,
		gentlePokes: 0,
		errors: 0,
		startTime: new Date(),
		lastCheck: null,
		uptime: 0
	};

	// Track when agents went idle for gentle poking
	private agentIdleTimes: Map<string, Date> = new Map();

	private readonly INTERVAL_MS = 5000; // 5 seconds
	private readonly NOTIFICATION_TEMPLATE = `[AUTO] 📬 UNREAD MESSAGES NOTIFICATION
═══════════════════════════════════════════════════════════════════════
⚠️  This is an automated system message - DO NOT REPLY ⚠️
═══════════════════════════════════════════════════════════════════════

You have {count} unread message{plural} assigned to you.

To read your messages:
curl -X GET "http://localhost:5173/api/inbox?agentId={agentId}"

Recent messages:
{preview}

Please check your inbox.

📚 Need help? Your complete guide: http://localhost:5173/api/agents/{agentId}/help

═══════════════════════════════════════════════════════════════════════
🤖 VCorp Monitoring System - Automated Message
═══════════════════════════════════════════════════════════════════════`;

	private readonly GENTLE_POKE_TEMPLATE = `[AUTO] 👋 GENTLE CHECK-IN
═══════════════════════════════════════════════════════════════════════
⚠️  This is an automated system message - DO NOT REPLY ⚠️
═══════════════════════════════════════════════════════════════════════

It was reported that you were idle, but this might not be the case - please continue your work if you're actively working on something.

To check your current phase/assignment:
curl -X GET "http://localhost:5173/api/roles/{roleType}/current-phase?projectId={projectId}"

{phaseContext}

This is just a gentle reminder - no action needed if you're already working! 🚀

📚 Need help? Your complete guide: http://localhost:5173/api/agents/{agentId}/help

═══════════════════════════════════════════════════════════════════════
🤖 VCorp Monitoring System - Automated Idle Check
═══════════════════════════════════════════════════════════════════════`;

	private readonly IDLE_THRESHOLD_MS = 300000; // 5 minutes

	private constructor() {}

	static getInstance(): MonitoringManager {
		if (!MonitoringManager.instance) {
			MonitoringManager.instance = new MonitoringManager();
		}
		return MonitoringManager.instance;
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	async start(): Promise<void> {
		if (this._isRunning) {
			throw new Error('Monitoring service is already running');
		}

		console.log('🚀 Starting VCorp Monitoring Service...');
		console.log('═══════════════════════════════════════');
		console.log('📊 Agent Status Monitoring: ENABLED');
		console.log('📬 Unread Notifications: ENABLED');
		console.log(`⏱️  Check Interval: ${this.INTERVAL_MS / 1000}s`);
		console.log('═══════════════════════════════════════');

		this._isRunning = true;
		this.stats = {
			totalChecks: 0,
			statusUpdates: 0,
			notificationsSent: 0,
			gentlePokes: 0,
			remindersSent: 0,
			errors: 0,
			startTime: new Date(),
			lastCheck: null,
			uptime: 0
		};

		// Start monitoring loop
		this.intervalId = setInterval(async () => {
			await this.runMonitoringCycle();
		}, this.INTERVAL_MS);

		// Initial run
		await this.runMonitoringCycle();

		console.log('✅ Monitoring service started successfully\n');
	}

	stop(): void {
		if (!this._isRunning) {
			throw new Error('Monitoring service is not running');
		}

		this._isRunning = false;
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		this.stats.uptime = Date.now() - this.stats.startTime.getTime();
		console.log('\n🛑 Monitoring service stopped');
		this.logStats();
	}

	getStats(): MonitoringStats {
		return {
			...this.stats,
			uptime: this._isRunning ? Date.now() - this.stats.startTime.getTime() : this.stats.uptime
		};
	}

	private async runMonitoringCycle(): Promise<void> {
		try {
			this.stats.totalChecks++;
			this.stats.lastCheck = new Date();

			// Get all active projects
			const activeProjects = await db
				.select({ id: projects.id, name: projects.name })
				.from(projects)
				.where(eq(projects.status, 'active'));

			if (activeProjects.length === 0) {
				return;
			}

			// Process all projects concurrently
			const results = await Promise.allSettled(
				activeProjects.map(project => this.processProject(project.id))
			);

			// Handle results
			results.forEach((result, index) => {
				if (result.status === 'rejected') {
					this.stats.errors++;
					console.error(`❌ Error processing project ${activeProjects[index].id}:`, result.reason);
				}
			});

		} catch (error) {
			this.stats.errors++;
			console.error('❌ Monitoring cycle failed:', error);
		}
	}

	private async processProject(projectId: number): Promise<void> {
		// Run all monitoring tasks in parallel
		const [statusUpdates, notificationResults, gentlePokeResults, reminderResults, forwardingResults] = await Promise.all([
			this.updateAgentStatuses(projectId),
			this.sendUnreadNotifications(projectId),
			this.sendGentlePokes(projectId),
			this.processScheduledReminders(projectId),
			this.processAssistantForwarding(projectId)
		]);

		// Update stats
		this.stats.statusUpdates += statusUpdates.length;
		this.stats.notificationsSent += notificationResults.filter(r => r.success).length;
		this.stats.gentlePokes += gentlePokeResults.filter(r => r.success).length;
		this.stats.remindersSent += reminderResults.filter(r => r.success).length;

		// Log significant events
		if (statusUpdates.length > 0) {
			console.log(`📊 [${new Date().toLocaleTimeString()}] Project ${projectId}: ${statusUpdates.length} status updates`);
			statusUpdates.forEach(update => {
				console.log(`   └─ ${update.agentId}: ${update.oldStatus} → ${update.newStatus}`);
			});
		}

		const successfulNotifications = notificationResults.filter(r => r.success);
		if (successfulNotifications.length > 0) {
			console.log(`📬 [${new Date().toLocaleTimeString()}] Project ${projectId}: ${successfulNotifications.length} notifications sent`);
			successfulNotifications.forEach(result => {
				console.log(`   └─ ${result.agentId}: ${result.unreadCount} unread messages`);
			});
		}

		const successfulPokes = gentlePokeResults.filter(r => r.success);
		if (successfulPokes.length > 0) {
			console.log(`👋 [${new Date().toLocaleTimeString()}] Project ${projectId}: ${successfulPokes.length} gentle pokes sent`);
			successfulPokes.forEach(result => {
				console.log(`   └─ ${result.agentId}: idle for ${Math.round((Date.now() - result.idleStartTime.getTime()) / 1000)}s`);
			});
		}

		const successfulReminders = reminderResults.filter(r => r.success);
		if (successfulReminders.length > 0) {
			console.log(`⏰ [${new Date().toLocaleTimeString()}] Project ${projectId}: ${successfulReminders.length} scheduled reminders sent`);
			successfulReminders.forEach(result => {
				console.log(`   └─ "${result.reminderName}" → ${result.targetRoleType}`);
			});
		}
	}

	private async updateAgentStatuses(projectId: number): Promise<AgentStatusUpdate[]> {
		const projectAgents = await db
			.select()
			.from(agents)
			.where(eq(agents.projectId, projectId));

		const updates: AgentStatusUpdate[] = [];

		for (const agent of projectAgents) {
			try {
				const newStatus = await this.checkAgentStatus(agent);
				
				if (newStatus !== agent.status) {
					await db
						.update(agents)
						.set({ 
							status: newStatus,
							lastHeartbeat: new Date()
						})
						.where(eq(agents.id, agent.id));

					updates.push({
						agentId: agent.id,
						oldStatus: agent.status,
						newStatus,
						tmuxSession: agent.tmuxSession || 'none'
					});
				}
			} catch (error) {
				// Mark as offline on error
				if (agent.status !== 'offline') {
					await db
						.update(agents)
						.set({ 
							status: 'offline',
							lastHeartbeat: new Date()
						})
						.where(eq(agents.id, agent.id));

					updates.push({
						agentId: agent.id,
						oldStatus: agent.status,
						newStatus: 'offline',
						tmuxSession: agent.tmuxSession || 'none'
					});
				}
			}
		}

		return updates;
	}

	private async checkAgentStatus(agent: any): Promise<'active' | 'idle' | 'offline'> {
		if (!agent.tmuxSession) {
			return 'offline';
		}

		try {
			// Check if tmux session exists
			execSync(`tmux has-session -t "${agent.tmuxSession}"`, { 
				stdio: 'ignore', 
				timeout: 2000 
			});

			// Session exists - check activity level
			try {
				const output = execSync(
					`tmux capture-pane -t "${agent.tmuxSession}" -S -3 -p`,
					{ encoding: 'utf8', timeout: 2000 }
				);

				// Check for activity indicators
				const hasActivity = output.split('\n').some(line => 
					line.includes('$') || 
					line.includes('claude') || 
					line.includes('✓') || 
					line.includes('×') ||
					line.trim().length > 20 // Non-trivial content
				);

				// Check heartbeat recency
				const minutesSinceHeartbeat = (Date.now() - new Date(agent.lastHeartbeat).getTime()) / (1000 * 60);
				
				if (minutesSinceHeartbeat > 10) {
					return 'idle';
				}

				return hasActivity ? 'active' : 'idle';

			} catch (captureError) {
				return 'idle';
			}

		} catch (sessionError) {
			return 'offline';
		}
	}

	private async sendUnreadNotifications(projectId: number): Promise<NotificationResult[]> {
		// Get active and idle agents with tmux sessions (exclude only offline agents)
		const activeAgents = await db
			.select({
				id: agents.id,
				roleType: agents.roleType,
				squadId: agents.squadId,
				tmuxSession: agents.tmuxSession
			})
			.from(agents)
			.where(and(
				eq(agents.projectId, projectId),
				or(
					eq(agents.status, 'active'),
					eq(agents.status, 'idle')
				)
			));

		const results: NotificationResult[] = [];

		for (const agent of activeAgents) {
			if (!agent.tmuxSession) {
				continue; // Skip agents without tmux sessions
			}

			try {
				const unreadMessages = await this.getUnreadMessagesForAgent(agent);
				
				if (unreadMessages.length === 0) {
					continue; // No unread messages
				}

				const success = await this.sendNotificationToAgent(agent, unreadMessages);
				
				results.push({
					agentId: agent.id,
					unreadCount: unreadMessages.length,
					success
				});

				// Stagger notifications to avoid overwhelming
				await new Promise(resolve => setTimeout(resolve, Math.random() * 3000));

			} catch (error) {
				results.push({
					agentId: agent.id,
					unreadCount: 0,
					success: false,
					error: error.message
				});
			}
		}

		return results;
	}

	private async getUnreadMessagesForAgent(agent: any): Promise<any[]> {
		const assignmentConditions = [
			and(
				eq(readingAssignments.assignedToType, 'agent'),
				eq(readingAssignments.assignedTo, agent.id)
			),
			and(
				eq(readingAssignments.assignedToType, 'role'),
				eq(readingAssignments.assignedTo, agent.roleType)
			)
		];

		if (agent.squadId) {
			assignmentConditions.push(
				and(
					eq(readingAssignments.assignedToType, 'squad'),
					eq(readingAssignments.assignedTo, agent.squadId)
				)
			);
		}

		const now = new Date();
		const oneMinuteAgo = new Date(now.getTime() - 60000); // 1 minute ago

		// Get all unread messages first, then filter by notification timing
		const unreadMessages = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				parentContentId: content.parentContentId,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt,
				assignmentId: readingAssignments.id,
				lastNotifiedAt: readingAssignments.lastNotifiedAt
			})
			.from(readingAssignments)
			.innerJoin(content, eq(readingAssignments.contentId, content.id))
			.where(and(
				or(...assignmentConditions),
				notExists(
					db.select()
						.from(readingAssignmentReads)
						.where(and(
							eq(readingAssignmentReads.readingAssignmentId, readingAssignments.id),
							eq(readingAssignmentReads.agentId, agent.id)
						))
				)
			))
			.limit(20); // Get more to filter from

		// Filter messages that need notification (never notified OR > 1 minute since last notification)
		const messagesToNotify = unreadMessages.filter(message => {
			if (!message.lastNotifiedAt) {
				return true; // Never been notified
			}
			
			const lastNotified = new Date(message.lastNotifiedAt);
			return lastNotified < oneMinuteAgo; // More than 1 minute ago
		}).slice(0, 5); // Limit to 5 for notification

		// For each message, if it's a reply, get the full thread context
		const messagesWithContext = await Promise.all(
			messagesToNotify.map(async (message) => {
				if (message.parentContentId) {
					// This is a reply - get the full thread
					const thread = await this.getMessageThread(message.parentContentId);
					return {
						...message,
						isReply: true,
						thread: thread
					};
				}
				return {
					...message,
					isReply: false,
					thread: null
				};
			})
		);

		return messagesWithContext;
	}

	private async getMessageThread(parentContentId: number): Promise<any[]> {
		// Get the original parent message
		const parentMessage = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt
			})
			.from(content)
			.where(eq(content.id, parentContentId))
			.limit(1);

		if (parentMessage.length === 0) {
			return [];
		}

		// Get all replies to this parent message
		const replies = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt
			})
			.from(content)
			.where(eq(content.parentContentId, parentContentId))
			.orderBy(content.createdAt);

		// Return the thread: parent message first, then replies in chronological order
		return [parentMessage[0], ...replies];
	}

	private buildThreadContextWithLimit(thread: any[], characterLimit: number): string {
		let totalCharacters = 0;
		const threadMessages = [];
		
		for (let i = 0; i < thread.length; i++) {
			const threadMsg = thread[i];
			const author = threadMsg.authorAgentId || 'System';
			const prefix = i === 0 ? '📝 Original' : '↳ Reply';
			const messageText = `  ${prefix} (${author}): ${threadMsg.body}`;
			
			// Check if adding this message would exceed the limit
			if (totalCharacters + messageText.length + 1 > characterLimit && threadMessages.length > 0) {
				// Add truncation indicator
				const remainingMessages = thread.length - i;
				threadMessages.push(`  ... (${remainingMessages} more message${remainingMessages === 1 ? '' : 's'} truncated)`);
				break;
			}
			
			threadMessages.push(messageText);
			totalCharacters += messageText.length + 1; // +1 for newline
		}
		
		return threadMessages.join('\n');
	}

	private async sendNotificationToAgent(agent: any, messages: any[]): Promise<boolean> {
		const preview = messages
			.slice(0, 2)
			.map(msg => {
				if (msg.isReply && msg.thread && msg.thread.length > 0) {
					// This is a reply - include the thread context with character limit
					const threadContext = this.buildThreadContextWithLimit(msg.thread, 3000);
					return `• THREAD UPDATE (${msg.type}):\n${threadContext}`;
				} else {
					// Regular message
					return `• ${msg.title || msg.type}: ${msg.body}`;
				}
			})
			.join('\n\n');

		const notification = this.NOTIFICATION_TEMPLATE
			.replace('{count}', messages.length.toString())
			.replace('{plural}', messages.length === 1 ? '' : 's')
			.replace(/\{agentId\}/g, agent.id)
			.replace('{preview}', preview || 'No preview available');

		const success = await this.sendTmuxMessage(agent.tmuxSession, notification);
		
		if (success) {
			// Update lastNotifiedAt timestamp for all notified messages
			const now = new Date();
			const assignmentIds = messages.map(msg => msg.assignmentId).filter(id => id);
			
			if (assignmentIds.length > 0) {
				try {
					await Promise.all(
						assignmentIds.map(assignmentId =>
							db.update(readingAssignments)
								.set({ lastNotifiedAt: now })
								.where(eq(readingAssignments.id, assignmentId))
						)
					);
				} catch (error) {
					console.error('Failed to update notification timestamps:', error);
					// Don't fail the whole notification just because we couldn't update timestamps
				}
			}
		}
		
		return success;
	}

	private async sendTmuxMessage(tmuxSession: string, message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const sendMessage = spawn('tmux', ['send-keys', '-t', tmuxSession, message], {
				detached: true,
				stdio: 'ignore'
			});

			sendMessage.on('error', () => resolve(false));
			sendMessage.on('close', (code) => {
				if (code !== 0) {
					resolve(false);
					return;
				}

				// Send Enter key after delay
				setTimeout(() => {
					const sendEnter = spawn('tmux', ['send-keys', '-t', tmuxSession, 'Enter'], {
						detached: true,
						stdio: 'ignore'
					});

					sendEnter.on('error', () => resolve(false));
					sendEnter.on('close', (enterCode) => resolve(enterCode === 0));
				}, 500);
			});
		});
	}

	private async sendGentlePokes(projectId: number): Promise<GentlePokeResult[]> {
		// Get all idle agents that need gentle pokes
		const idleAgents = await db
			.select({
				id: agents.id,
				roleType: agents.roleType,
				tmuxSession: agents.tmuxSession,
				status: agents.status,
				lastHeartbeat: agents.lastHeartbeat
			})
			.from(agents)
			.where(and(
				eq(agents.projectId, projectId),
				eq(agents.status, 'idle')
			));

		const results: GentlePokeResult[] = [];
		const now = new Date();

		for (const agent of idleAgents) {
			if (!agent.tmuxSession) {
				continue; // Skip agents without tmux sessions
			}

			// Track when this agent went idle
			if (!this.agentIdleTimes.has(agent.id)) {
				this.agentIdleTimes.set(agent.id, now);
				continue; // Just started being idle, don't poke yet
			}

			const idleStartTime = this.agentIdleTimes.get(agent.id)!;
			const idleDuration = now.getTime() - idleStartTime.getTime();

			// Only poke if idle for more than 30 seconds
			if (idleDuration < this.IDLE_THRESHOLD_MS) {
				continue;
			}

			try {
				// Get current phase context for this agent's role
				const phaseContext = await this.getPhaseContextForRole(agent.roleType, projectId);
				
				// Send gentle poke
				const success = await this.sendGentlePokeToAgent(agent, projectId, phaseContext);
				
				results.push({
					agentId: agent.id,
					idleStartTime,
					success
				});

				// Reset idle time to avoid spamming (poke once per idle period)
				this.agentIdleTimes.set(agent.id, new Date());

			} catch (error) {
				results.push({
					agentId: agent.id,
					idleStartTime,
					success: false,
					error: error.message
				});
			}
		}

		// Clean up idle times for agents that are no longer idle
		const currentIdleAgentIds = new Set(idleAgents.map(a => a.id));
		for (const [agentId] of this.agentIdleTimes) {
			if (!currentIdleAgentIds.has(agentId)) {
				this.agentIdleTimes.delete(agentId);
			}
		}

		return results;
	}

	private async processScheduledReminders(projectId: number): Promise<ScheduledReminderResult[]> {
		// Get all active scheduled reminders for this project
		const activeReminders = await db
			.select()
			.from(scheduledReminders)
			.where(and(
				eq(scheduledReminders.projectId, projectId),
				eq(scheduledReminders.isActive, true)
			));

		const results: ScheduledReminderResult[] = [];
		const now = new Date();

		for (const reminder of activeReminders) {
			try {
				// Check if it's time to send this reminder
				const shouldSend = this.shouldSendReminder(reminder, now);
				
				if (!shouldSend) {
					continue;
				}

				// Send the reminder message to the target role
				const success = await this.sendReminderMessage(reminder, projectId);
				
				if (success) {
					// Update the lastSentAt timestamp
					await db
						.update(scheduledReminders)
						.set({ 
							lastSentAt: now,
							updatedAt: now
						})
						.where(eq(scheduledReminders.id, reminder.id));
				}

				results.push({
					reminderId: reminder.id,
					reminderName: reminder.name,
					targetRoleType: reminder.targetRoleType,
					success
				});

			} catch (error) {
				results.push({
					reminderId: reminder.id,
					reminderName: reminder.name,
					targetRoleType: reminder.targetRoleType,
					success: false,
					error: error.message
				});
			}
		}

		return results;
	}

	private shouldSendReminder(reminder: any, now: Date): boolean {
		// If never sent before, send now
		if (!reminder.lastSentAt) {
			return true;
		}

		// Check if enough time has passed since last send
		const lastSent = new Date(reminder.lastSentAt);
		const timeSinceLastSent = now.getTime() - lastSent.getTime();
		const intervalMs = reminder.frequencyMinutes * 60 * 1000;

		return timeSinceLastSent >= intervalMs;
	}

	private async sendReminderMessage(reminder: any, projectId: number): Promise<boolean> {
		try {
			// Create a reminder message in the content table
			await db
				.insert(content)
				.values({
					projectId,
					type: 'message',
					title: `⏰ Scheduled Reminder: ${reminder.name}`,
					body: reminder.message,
					assignedToRoleType: reminder.targetRoleType,
					createdAt: new Date(),
					updatedAt: new Date()
				});

			// Create a reading assignment for the target role
			const [newContent] = await db
				.select({ id: content.id })
				.from(content)
				.where(and(
					eq(content.projectId, projectId),
					eq(content.type, 'message'),
					eq(content.title, `⏰ Scheduled Reminder: ${reminder.name}`)
				))
				.orderBy(content.createdAt)
				.limit(1);

			if (newContent) {
				await db
					.insert(readingAssignments)
					.values({
						contentId: newContent.id,
						assignedToType: 'role',
						assignedTo: reminder.targetRoleType,
						assignedAt: new Date()
					});
			}

			return true;
		} catch (error) {
			console.error(`Failed to send reminder "${reminder.name}":`, error);
			return false;
		}
	}

	private async getPhaseContextForRole(roleType: string, projectId: number): Promise<string> {
		try {
			// Use internal API call to get phase context
			const response = await fetch(`http://localhost:5173/api/roles/${encodeURIComponent(roleType)}/current-phase?projectId=${projectId}`);
			
			if (!response.ok) {
				return 'Unable to fetch current phase information.';
			}

			const data = await response.json();
			
			if (!data.hasActivePhase) {
				return `Current Status: ${data.message}`;
			}

			const { phase } = data;
			return `Current Phase: "${phase.title}"
Description: ${phase.description}
Expected Outputs: ${phase.expectedOutputs?.join(', ') || 'None specified'}
Status: ${phase.status}`;

		} catch (error) {
			return 'Unable to fetch current phase information due to error.';
		}
	}

	private async sendGentlePokeToAgent(agent: any, projectId: number, phaseContext: string): Promise<boolean> {
		const gentlePoke = this.GENTLE_POKE_TEMPLATE
			.replace('{roleType}', encodeURIComponent(agent.roleType))
			.replace('{projectId}', projectId.toString())
			.replace('{phaseContext}', phaseContext);

		return await this.sendTmuxMessage(agent.tmuxSession, gentlePoke);
	}

	private async processAssistantForwarding(projectId: number): Promise<any[]> {
		// Check if forwarding is enabled for this project
		const forwardingEnabled = await checkForwardingStatus(projectId);
		if (!forwardingEnabled) {
			return [];
		}

		try {
			// Find unforwarded human-director reading assignments
			const humanDirectorAssignments = await db
				.select({
					id: readingAssignments.id,
					contentId: readingAssignments.contentId,
					assignedTo: readingAssignments.assignedTo,
					assignedToType: readingAssignments.assignedToType,
					createdAt: readingAssignments.createdAt
				})
				.from(readingAssignments)
				.innerJoin(content, eq(readingAssignments.contentId, content.id))
				.where(and(
					eq(content.projectId, projectId),
					eq(readingAssignments.assignedToType, 'role'),
					eq(readingAssignments.assignedTo, 'human-director')
				))
				.limit(50); // Process up to 50 per cycle

			const results = [];

			for (const assignment of humanDirectorAssignments) {
				try {
					// Check if we already forwarded this to the assistant
					const existingForwarding = await db
						.select()
						.from(readingAssignments)
						.where(and(
							eq(readingAssignments.contentId, assignment.contentId),
							eq(readingAssignments.assignedToType, 'role'),
							eq(readingAssignments.assignedTo, 'Director Assistant')
						))
						.limit(1);

					if (existingForwarding.length > 0) {
						continue; // Already forwarded
					}

					// Create a new reading assignment for the Director Assistant
					await db
						.insert(readingAssignments)
						.values({
							contentId: assignment.contentId,
							assignedToType: 'role',
							assignedTo: 'Director Assistant'
						});

					results.push({
						contentId: assignment.contentId,
						originalAssignment: assignment.id,
						success: true
					});

					console.log(`📬 [${new Date().toLocaleTimeString()}] Forwarded message to Director Assistant: content ${assignment.contentId}`);

				} catch (error) {
					results.push({
						contentId: assignment.contentId,
						originalAssignment: assignment.id,
						success: false,
						error: error.message
					});
					console.error(`❌ Failed to forward content ${assignment.contentId} to assistant:`, error);
				}
			}

			return results;

		} catch (error) {
			console.error(`❌ Failed to process assistant forwarding for project ${projectId}:`, error);
			return [];
		}
	}

	private logStats(): void {
		const { totalChecks, statusUpdates, notificationsSent, gentlePokes, errors, uptime } = this.getStats();
		const uptimeMinutes = Math.floor(uptime / 60000);
		const uptimeSeconds = Math.floor((uptime % 60000) / 1000);

		console.log('\n📊 MONITORING SERVICE STATISTICS');
		console.log('═══════════════════════════════════');
		console.log(`⏱️  Uptime: ${uptimeMinutes}m ${uptimeSeconds}s`);
		console.log(`✅ Total Checks: ${totalChecks}`);
		console.log(`🔄 Status Updates: ${statusUpdates}`);
		console.log(`📬 Notifications Sent: ${notificationsSent}`);
		console.log(`👋 Gentle Pokes: ${gentlePokes}`);
		console.log(`❌ Errors: ${errors}`);
		console.log('═══════════════════════════════════');
	}
}

export default MonitoringManager;