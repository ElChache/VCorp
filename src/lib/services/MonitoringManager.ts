import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { db } from '$lib/db/index';
import { agents, content, readingAssignments, readingAssignmentReads, projects, scheduledReminders } from '$lib/db/schema';
import { eq, and, or, notExists } from 'drizzle-orm';
import chokidar from 'chokidar';

import { checkForwardingStatus } from '$lib/services/ForwardingService';
import { CONFIG } from '$lib/config';

interface MonitoringStats {
	totalChecks: number;
	statusUpdates: number;
	notificationsSent: number;
	gentlePokes: number;
	remindersSent: number;
	terminalLogsCaptured: number;
	filesSynced: number;
	documentsCreated: number;
	ticketsCreated: number;
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
	private fileWatcher: any | null = null;
	private _isRunning = false;
	
	private stats: MonitoringStats = {
		totalChecks: 0,
		statusUpdates: 0,
		notificationsSent: 0,
		gentlePokes: 0,
		remindersSent: 0,
		terminalLogsCaptured: 0,
		filesSynced: 0,
		documentsCreated: 0,
		ticketsCreated: 0,
		errors: 0,
		startTime: new Date(),
		lastCheck: null,
		uptime: 0
	};

	// Track file modification times to avoid sync loops
	private fileModificationTimes: Map<string, number> = new Map();

	// Track when agents went idle for gentle poking
	private agentIdleTimes: Map<string, Date> = new Map();
	
	// Track notification timing per agent for grace period and rate limiting
	private agentNotificationState: Map<string, {
		lastNotificationTime: Date;
		notificationCount: number; // Count in current minute
		lastGracePeriodStart: Date | null;
	}> = new Map();

	private readonly INTERVAL_MS = 5000; // 5 seconds
	// High Priority: Human Director Messages
	private readonly URGENT_NOTIFICATION_TEMPLATE = `[AUTO] 📥 Message from Project Director
═══════════════════════════════════════════════════════════════════════
⚠️  This is an automated system message - DO NOT REPLY ⚠️
═══════════════════════════════════════════════════════════════════════

You have {count} unread message{plural} from the project director.

📋 Please review when convenient:
vcorp inbox

Recent director messages:
{preview}

💡 The director's messages are important - please respond when you can.

═══════════════════════════════════════════════════════════════════════
🤖 VCorp Monitoring System - Director Communication
═══════════════════════════════════════════════════════════════════════`;

	// Medium Priority: Agent-to-Agent Messages
	private readonly NOTIFICATION_TEMPLATE = `[AUTO] 📬 NEW TEAM MESSAGES
═══════════════════════════════════════════════════════════════════════
⚠️  This is an automated system message - DO NOT REPLY ⚠️
═══════════════════════════════════════════════════════════════════════

You have {count} unread message{plural} from team members.

🔧 Simple function to check your messages:
inbox

Recent messages:
{preview}

Each message in your inbox will show a replyCommand like "reply 456" for easy responding.

💡 Finish your current task when convenient, then respond to team messages.

📚 Need help? Type: help

═══════════════════════════════════════════════════════════════════════
🤖 VCorp Monitoring System - Team Messages
═══════════════════════════════════════════════════════════════════════`;

	// Low Priority: Documents, Announcements, etc.
	private readonly LOW_PRIORITY_TEMPLATE = `[AUTO] 📄 PROJECT UPDATES SUMMARY
═══════════════════════════════════════════════════════════════════════
⚠️  This is an automated system message - DO NOT REPLY ⚠️
═══════════════════════════════════════════════════════════════════════

You have {count} project update{plural} and document{plural} to review.

🔧 Check when convenient:
inbox

Recent updates:
{preview}

💡 Review these when you have completed your current work priorities.

📚 Need help? Type: help

═══════════════════════════════════════════════════════════════════════
🤖 VCorp Monitoring System - Project Updates
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

📚 Need help? Type: help

═══════════════════════════════════════════════════════════════════════
🤖 VCorp Monitoring System - Automated Idle Check
═══════════════════════════════════════════════════════════════════════`;

	// Timing Configuration
	private readonly IDLE_THRESHOLD_MS = 600000; // 10 minutes
	private readonly DIRECTOR_MESSAGE_GRACE_PERIOD_MS = 120000; // 2 minutes for director messages
	private readonly GRACE_PERIOD_MS = 900000; // 15 minutes grace period for agent messages
	private readonly LOW_PRIORITY_GRACE_PERIOD_MS = 1800000; // 30 minutes for low priority
	private readonly MAX_NOTIFICATIONS_PER_MINUTE = 1;
	
	// Escalation Configuration
	private readonly HUMAN_DIRECTOR_RESPONSE_TIMEOUT_MS = 300000; // 5 minutes
	private readonly ESCALATION_REMINDER_INTERVAL_MS = 120000; // 2 minutes
	
	// Message Priority Thresholds
	private readonly LOW_PRIORITY_CONTENT_TYPES = ['document', 'announcement', 'phase'];
	
	// Track escalation state for human director messages
	private humanDirectorEscalationState: Map<string, {
		firstNotificationTime: Date;
		lastEscalationTime: Date;
		escalationCount: number;
	}> = new Map();

	// Batching system for low priority notifications
	private batchedNotifications: Map<string, {
		messages: any[];
		firstMessageTime: Date;
		lastBatchTime: Date;
	}> = new Map();
	
	private readonly BATCH_INTERVAL_MS = 1800000; // 30 minutes - send batched summaries every 30 minutes
	private readonly BATCH_SIZE_THRESHOLD = 5; // Send batch early if 5+ messages accumulated

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
		console.log('📁 Document/Ticket File Sync: ENABLED');
		console.log(`⏱️  Check Interval: ${this.INTERVAL_MS / 1000}s`);
		console.log('═══════════════════════════════════════');

		this._isRunning = true;
		this.stats = {
			totalChecks: 0,
			statusUpdates: 0,
			notificationsSent: 0,
			gentlePokes: 0,
			remindersSent: 0,
			terminalLogsCaptured: 0,
			filesSynced: 0,
			documentsCreated: 0,
			ticketsCreated: 0,
			errors: 0,
			startTime: new Date(),
			lastCheck: null,
			uptime: 0
		};

		// Start monitoring loop
		this.intervalId = setInterval(async () => {
			await this.runMonitoringCycle();
		}, this.INTERVAL_MS);

		// Start file watcher for document/ticket sync
		await this.initializeFileWatcher();

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

		// Stop file watcher
		if (this.fileWatcher) {
			this.fileWatcher.close();
			this.fileWatcher = null;
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
		const [statusUpdates, notificationResults, gentlePokeResults, reminderResults, forwardingResults, terminalLogResults] = await Promise.all([
			this.updateAgentStatuses(projectId),
			this.sendUnreadNotifications(projectId),
			this.sendGentlePokes(projectId),
			this.processScheduledReminders(projectId),
			this.processAssistantForwarding(projectId),
			this.captureTerminalLogs(projectId),
			this.checkHumanDirectorEscalations(), // Add escalation checking
			this.processBatchedNotifications() // Add batch processing
		]);

		// Update stats
		this.stats.statusUpdates += statusUpdates.length;
		this.stats.notificationsSent += notificationResults.filter(r => r.success).length;
		this.stats.gentlePokes += gentlePokeResults.filter(r => r.success).length;
		this.stats.remindersSent += reminderResults.filter(r => r.success).length;
		this.stats.terminalLogsCaptured += terminalLogResults.filter(r => r.success).length;

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

				// Check if this agent should receive a notification based on grace period, rate limiting, and work phase
				if (!await this.shouldSendNotificationToAgent(agent.id, unreadMessages, projectId)) {
					continue; // Skip due to grace period, rate limiting, or work phase considerations
				}

				const success = await this.sendNotificationToAgent(agent, unreadMessages);
				
				// Update notification state if successful
				if (success) {
					this.updateAgentNotificationState(agent.id);
				}
				
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
					error: error instanceof Error ? error.message : 'Unknown error'
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

		// Get all unread messages with author's human director status
		const unreadMessages = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				type: content.type,
				priority: content.priority,
				parentContentId: content.parentContentId,
				authorAgentId: content.authorAgentId,
				createdAt: content.createdAt,
				assignmentId: readingAssignments.id,
				lastNotifiedAt: readingAssignments.lastNotifiedAt,
				assignedAt: readingAssignments.assignedAt,
				// Include author's human director status
				authorIsHumanDirector: agents.isHumanDirector
			})
			.from(readingAssignments)
			.innerJoin(content, eq(readingAssignments.contentId, content.id))
			.leftJoin(agents, eq(content.authorAgentId, agents.id))
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
			.limit(20);

		// For each message, if it's a reply, get the full thread context
		const messagesWithContext = await Promise.all(
			unreadMessages.map(async (message) => {
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
		// Determine message categories
		const humanDirectorMessages = messages.filter(msg => msg.authorIsHumanDirector === true);
		const lowPriorityMessages = messages.filter(msg => 
			this.LOW_PRIORITY_CONTENT_TYPES.includes(msg.type) && !msg.authorIsHumanDirector
		);
		const regularMessages = messages.filter(msg => 
			!msg.authorIsHumanDirector && !this.LOW_PRIORITY_CONTENT_TYPES.includes(msg.type)
		);

		// Choose template and messages based on priority
		let template: string;
		let messagesToShow: any[];
		let isUrgent = false;

		if (humanDirectorMessages.length > 0) {
			// URGENT: Human Director Messages
			template = this.URGENT_NOTIFICATION_TEMPLATE;
			messagesToShow = humanDirectorMessages;
			isUrgent = true;
			
			// Track escalation for human director messages
			this.trackHumanDirectorEscalation(agent.id);
		} else if (regularMessages.length > 0) {
			// MEDIUM: Agent-to-Agent Messages
			template = this.NOTIFICATION_TEMPLATE;
			messagesToShow = regularMessages;
		} else {
			// LOW: Documents, Announcements, etc. - Consider batching
			const shouldBatch = await this.shouldBatchLowPriorityMessages(agent.id, lowPriorityMessages);
			if (shouldBatch) {
				// Add to batch instead of sending immediately
				this.addToBatch(agent.id, lowPriorityMessages);
				return true; // Return success but don't send notification yet
			}
			
			template = this.LOW_PRIORITY_TEMPLATE;
			messagesToShow = lowPriorityMessages;
		}

		// Sort messages by priority (high first) for display
		const sortedMessages = messagesToShow.sort((a, b) => {
			const priorityOrder: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
			return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
		});

		const preview = this.buildNotificationPreview(sortedMessages, isUrgent);

		const notification = template
			.replace('{count}', messagesToShow.length.toString())
			.replace('{plural}', messagesToShow.length === 1 ? '' : 's')
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

	private buildNotificationPreview(messages: any[], isUrgent: boolean = false): string {
		const maxPreviewMessages = isUrgent ? 3 : 2; // Show more messages for urgent notifications
		
		return messages
			.slice(0, maxPreviewMessages)
			.map(msg => {
				const priorityIcon = msg.priority === 'high' ? '🔴 HIGH' : 
									 msg.priority === 'low' ? '🟡 LOW' : '🔵 MEDIUM';
				
				// Add special formatting for human director messages
				const authorPrefix = msg.authorIsHumanDirector ? '👑 DIRECTOR' : priorityIcon;
				
				if (msg.isReply && msg.thread && msg.thread.length > 0) {
					// This is a reply - include the thread context with character limit
					const threadContext = this.buildThreadContextWithLimit(msg.thread, isUrgent ? 400 : 300);
					return `• [${authorPrefix}] THREAD UPDATE (${msg.type}):\n${threadContext}`;
				} else {
					// Regular message with enhanced formatting for urgent messages
					const bodyPreview = isUrgent ? msg.body : (msg.body?.substring(0, 100) + (msg.body?.length > 100 ? '...' : ''));
					return `• [${authorPrefix}] ${msg.title || msg.type}: ${bodyPreview}`;
				}
			})
			.join('\n\n');
	}

	private trackHumanDirectorEscalation(agentId: string): void {
		const now = new Date();
		const state = this.humanDirectorEscalationState.get(agentId);
		
		if (!state) {
			// First human director message for this agent
			this.humanDirectorEscalationState.set(agentId, {
				firstNotificationTime: now,
				lastEscalationTime: now,
				escalationCount: 1
			});
		} else {
			// Update escalation tracking
			state.lastEscalationTime = now;
			state.escalationCount++;
		}
	}

	private async getUnreadDirectorMessagesForAgent(agentId: string, projectId: number): Promise<any[]> {
		// Get agent info for role-based assignments
		const agentInfo = await db
			.select({
				id: agents.id,
				roleType: agents.roleType,
				squadId: agents.squadId
			})
			.from(agents)
			.where(eq(agents.id, agentId))
			.limit(1);
		
		if (!agentInfo[0]) return [];
		
		const agent = agentInfo[0];
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

		// Get unread messages from human directors only
		const unreadDirectorMessages = await db
			.select({
				id: content.id,
				authorAgentId: content.authorAgentId,
				authorIsHumanDirector: agents.isHumanDirector
			})
			.from(readingAssignments)
			.innerJoin(content, eq(readingAssignments.contentId, content.id))
			.leftJoin(agents, eq(content.authorAgentId, agents.id))
			.where(and(
				eq(content.projectId, projectId),
				or(...assignmentConditions),
				eq(agents.isHumanDirector, true), // Only messages from human directors
				notExists(
					db.select()
						.from(readingAssignmentReads)
						.where(and(
							eq(readingAssignmentReads.readingAssignmentId, readingAssignments.id),
							eq(readingAssignmentReads.agentId, agentId)
						))
				)
			));

		return unreadDirectorMessages;
	}

	private async checkHumanDirectorEscalations(): Promise<void> {
		const now = new Date();
		
		for (const [agentId, state] of this.humanDirectorEscalationState.entries()) {
			// First, verify that there are actually unread director messages for this agent
			const agentData = await db
				.select({ projectId: agents.projectId })
				.from(agents)
				.where(eq(agents.id, agentId))
				.limit(1);
				
			if (!agentData[0]) {
				// Agent doesn't exist, clear escalation
				this.humanDirectorEscalationState.delete(agentId);
				continue;
			}
			
			// Check if there are actually unread director messages
			const unreadDirectorMessages = await this.getUnreadDirectorMessagesForAgent(agentId, agentData[0].projectId);
			
			if (unreadDirectorMessages.length === 0) {
				// No unread director messages, clear escalation tracking
				this.humanDirectorEscalationState.delete(agentId);
				console.log(`✅ Cleared escalation tracking for agent ${agentId} - no unread director messages`);
				continue;
			}
			
			const timeSinceFirstNotification = now.getTime() - state.firstNotificationTime.getTime();
			const timeSinceLastEscalation = now.getTime() - state.lastEscalationTime.getTime();
			
			// If 5+ minutes have passed since first notification and 2+ minutes since last escalation
			if (timeSinceFirstNotification >= this.HUMAN_DIRECTOR_RESPONSE_TIMEOUT_MS &&
				timeSinceLastEscalation >= this.ESCALATION_REMINDER_INTERVAL_MS) {
				
				await this.sendEscalationReminder(agentId, state.escalationCount);
				state.lastEscalationTime = now;
				state.escalationCount++;
			}
		}
	}

	private async sendEscalationReminder(agentId: string, escalationCount: number): Promise<void> {
		try {
			const agent = await db
				.select()
				.from(agents)
				.where(eq(agents.id, agentId))
				.limit(1);
			
			if (!agent[0] || !agent[0].tmuxSession) return;

			const escalationTemplate = `[AUTO] 📥 URGENT: Human Director Message Requires Response
═══════════════════════════════════════════════════════════════════════
⚠️  This is an automated reminder - DO NOT REPLY ⚠️
═══════════════════════════════════════════════════════════════════════

The Human Director has been waiting ${Math.floor((Date.now() - this.humanDirectorEscalationState.get(agentId)!.firstNotificationTime.getTime()) / 60000)} minutes for a response.

📋 Please check your messages when possible:
vcorp inbox

${escalationCount > 2 ? '💡 This is reminder #' + escalationCount + ' - the director may need a timely response.' : ''}

Professional response appreciated when convenient.

═══════════════════════════════════════════════════════════════════════
🤖 VCorp Monitoring System - Director Message Pending
═══════════════════════════════════════════════════════════════════════`;

			await this.sendTmuxMessage(agent[0].tmuxSession, escalationTemplate);
			console.log(`📢 Sent escalation #${escalationCount} to agent ${agentId}`);
			
		} catch (error) {
			console.error(`Failed to send escalation to agent ${agentId}:`, error);
		}
	}

	// Clear escalation tracking when agent responds to human director
	public clearHumanDirectorEscalation(agentId: string): void {
		this.humanDirectorEscalationState.delete(agentId);
		console.log(`✅ Cleared human director escalation tracking for agent ${agentId}`);
	}

	// Work Phase Awareness - Deep work phases that should have reduced interruptions
	private readonly DEEP_WORK_PHASES = [
		'Implementation',
		'Development', 
		'Coding',
		'Testing',
		'Debugging',
		'Architecture Design',
		'Technical Research'
	];

	private async isAgentInDeepWorkPhase(agentId: string, projectId: number): Promise<boolean> {
		try {
			// Get agent's role type first
			const agent = await db
				.select({ roleType: agents.roleType })
				.from(agents)
				.where(eq(agents.id, agentId))
				.limit(1);
			
			if (!agent[0]) return false;

			// Get current phase for this role
			const currentPhase = await db
				.select({
					name: content.title,
					description: content.body
				})
				.from(content)
				.where(and(
					eq(content.projectId, projectId),
					eq(content.type, 'phase'),
					eq(content.status, 'active')
				))
				.limit(1);
			
			if (!currentPhase[0]) return false;

			// Check if current phase is a deep work phase
			return this.DEEP_WORK_PHASES.some(deepPhase => 
				currentPhase[0].name?.toLowerCase().includes(deepPhase.toLowerCase()) ||
				currentPhase[0].description?.toLowerCase().includes(deepPhase.toLowerCase())
			);
		} catch (error) {
			console.error(`Error checking work phase for agent ${agentId}:`, error);
			return false; // Default to not in deep work phase if error
		}
	}

	// Batching System Methods
	private async shouldBatchLowPriorityMessages(agentId: string, messages: any[]): Promise<boolean> {
		const now = new Date();
		const batchState = this.batchedNotifications.get(agentId);
		
		// Don't batch if no messages or agent hasn't received any notifications recently
		if (!batchState && messages.length < 3) {
			return false; // Send immediately for small numbers of first-time messages
		}
		
		// Always batch documents and announcements unless urgent
		const allBatchable = messages.every(msg => 
			this.LOW_PRIORITY_CONTENT_TYPES.includes(msg.type) && 
			msg.priority !== 'high'
		);
		
		return allBatchable;
	}

	private addToBatch(agentId: string, messages: any[]): void {
		const now = new Date();
		const existingBatch = this.batchedNotifications.get(agentId);
		
		if (existingBatch) {
			// Add to existing batch
			existingBatch.messages.push(...messages);
		} else {
			// Create new batch
			this.batchedNotifications.set(agentId, {
				messages: [...messages],
				firstMessageTime: now,
				lastBatchTime: now
			});
		}
		
		console.log(`📦 Added ${messages.length} messages to batch for agent ${agentId}`);
	}

	private async processBatchedNotifications(): Promise<void> {
		const now = new Date();
		
		for (const [agentId, batchState] of this.batchedNotifications.entries()) {
			const timeSinceFirstMessage = now.getTime() - batchState.firstMessageTime.getTime();
			const timeSinceLastBatch = now.getTime() - batchState.lastBatchTime.getTime();
			const shouldSendBatch = 
				timeSinceLastBatch >= this.BATCH_INTERVAL_MS || // 30 minutes elapsed
				batchState.messages.length >= this.BATCH_SIZE_THRESHOLD; // 5+ messages accumulated
			
			if (shouldSendBatch && batchState.messages.length > 0) {
				await this.sendBatchedNotification(agentId, batchState);
				// Clear the batch after sending
				this.batchedNotifications.delete(agentId);
			}
		}
	}

	private async sendBatchedNotification(agentId: string, batchState: any): Promise<void> {
		try {
			// Get agent info
			const agent = await db
				.select()
				.from(agents)
				.where(eq(agents.id, agentId))
				.limit(1);
			
			if (!agent[0] || !agent[0].tmuxSession) return;

			// Group messages by type for better summary
			const messagesByType = batchState.messages.reduce((acc: any, msg: any) => {
				const type = msg.type || 'message';
				if (!acc[type]) acc[type] = [];
				acc[type].push(msg);
				return acc;
			}, {});

			const summary = Object.entries(messagesByType)
				.map(([type, msgs]: [string, any]) => `• ${msgs.length} ${type}${msgs.length > 1 ? 's' : ''}`)
				.join('\n');

			const batchTemplate = `[AUTO] 📦 BATCHED PROJECT UPDATES
═══════════════════════════════════════════════════════════════════════
⚠️  This is an automated batch summary - DO NOT REPLY ⚠️
═══════════════════════════════════════════════════════════════════════

You have ${batchState.messages.length} accumulated project update${batchState.messages.length > 1 ? 's' : ''}:

${summary}

🔧 Review all updates when convenient:
inbox

💡 These are non-urgent items batched to minimize interruptions during focused work.
Consider reviewing during natural break points.

📚 Need help? Type: help

═══════════════════════════════════════════════════════════════════════
🤖 VCorp Batch System - Non-Urgent Updates
═══════════════════════════════════════════════════════════════════════`;

			await this.sendTmuxMessage(agent[0].tmuxSession, batchTemplate);
			console.log(`📦 Sent batched notification to agent ${agentId} (${batchState.messages.length} messages)`);
			
		} catch (error) {
			console.error(`Failed to send batched notification to agent ${agentId}:`, error);
		}
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

	private async shouldSendNotificationToAgent(agentId: string, unreadMessages: any[], projectId: number): Promise<boolean> {
		const now = new Date();
		const state = this.agentNotificationState.get(agentId);
		
		// Initialize state if not exists
		if (!state) {
			this.agentNotificationState.set(agentId, {
				lastNotificationTime: new Date(0), // Never notified
				notificationCount: 0,
				lastGracePeriodStart: null
			});
			return true; // First notification always allowed
		}
		
		// Check for messages from human director - these have shorter grace period (2 minutes)
		const hasHumanDirectorMessages = unreadMessages.some(msg => {
			// Check if the message author is a human director
			// This requires checking if the authorAgentId has isHumanDirector = true
			return msg.authorIsHumanDirector === true;
		});
		
		// Check rate limiting: max 2 notifications per minute (only applies to non-human-director messages)
		const oneMinuteAgo = new Date(now.getTime() - 60000);
		if (state.lastNotificationTime > oneMinuteAgo) {
			// Within last minute, check count
			if (state.notificationCount >= this.MAX_NOTIFICATIONS_PER_MINUTE) {
				return false; // Rate limited
			}
		} else {
			// Reset counter for new minute
			state.notificationCount = 0;
		}
		
		// Check for high priority messages - these always bypass grace period
		const hasHighPriorityMessages = unreadMessages.some(msg => msg.priority === 'high');
		if (hasHighPriorityMessages) {
			return true; // High priority bypasses all delays
		}

		// Work Phase Awareness - reduce interruptions during deep work phases
		const isInDeepWork = await this.isAgentInDeepWorkPhase(agentId, projectId);
		if (isInDeepWork) {
			// During deep work phases, only allow human director messages and critical items
			const hasCriticalMessages = unreadMessages.some(msg => 
				msg.authorIsHumanDirector || 
				msg.priority === 'high' ||
				msg.type === 'ticket' && msg.priority === 'critical'
			);
			
			if (!hasCriticalMessages) {
				// Extend grace period for non-critical messages during deep work
				const deepWorkGracePeriod = this.GRACE_PERIOD_MS * 2; // Double the grace period
				const gracePeriodExpired = (now.getTime() - state.lastNotificationTime.getTime()) >= deepWorkGracePeriod;
				if (!gracePeriodExpired) {
					return false; // Skip notification to maintain focus
				}
			}
		}

		// Check if there are any NEW reading assignments since last grace period
		const hasNewAssignments = unreadMessages.some(msg => {
			const assignedAt = new Date(msg.assignedAt);
			return !state.lastGracePeriodStart || assignedAt > state.lastGracePeriodStart;
		});
		
		if (hasNewAssignments) {
			// New assignments arrived - immediate notification allowed
			return true;
		}
		
		// No new assignments, check appropriate grace period based on message types
		const hasLowPriorityOnly = unreadMessages.every(msg => 
			this.LOW_PRIORITY_CONTENT_TYPES.includes(msg.type) || msg.priority === 'low'
		);
		
		// Determine applicable grace period based on message priority
		let applicableGracePeriod: number;
		if (hasHumanDirectorMessages) {
			applicableGracePeriod = this.DIRECTOR_MESSAGE_GRACE_PERIOD_MS; // 2 minutes for director
		} else if (hasLowPriorityOnly) {
			applicableGracePeriod = this.LOW_PRIORITY_GRACE_PERIOD_MS; // 30 minutes for low priority
		} else {
			applicableGracePeriod = this.GRACE_PERIOD_MS; // 15 minutes for regular messages
		}
		
		const gracePeriodExpired = (now.getTime() - state.lastNotificationTime.getTime()) >= applicableGracePeriod;
		return gracePeriodExpired;
	}
	
	private updateAgentNotificationState(agentId: string): void {
		const now = new Date();
		const state = this.agentNotificationState.get(agentId);
		
		if (!state) {
			this.agentNotificationState.set(agentId, {
				lastNotificationTime: now,
				notificationCount: 1,
				lastGracePeriodStart: now
			});
			return;
		}
		
		// Check if this is within the same minute for rate limiting
		const oneMinuteAgo = new Date(now.getTime() - 60000);
		if (state.lastNotificationTime > oneMinuteAgo) {
			// Same minute, increment counter
			state.notificationCount++;
		} else {
			// New minute, reset counter
			state.notificationCount = 1;
		}
		
		state.lastNotificationTime = now;
		state.lastGracePeriodStart = now; // Reset grace period
	}
	
	// Public method to reset grace period when agent reads messages
	public resetAgentGracePeriod(agentId: string): void {
		const state = this.agentNotificationState.get(agentId);
		if (state) {
			state.lastGracePeriodStart = new Date();
		}
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
					error: error instanceof Error ? error.message : 'Unknown error'
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
					error: error instanceof Error ? error.message : 'Unknown error'
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
					assignedAt: readingAssignments.assignedAt
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
						error: error instanceof Error ? error.message : 'Unknown error'
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

	private async captureTerminalLogs(projectId: number): Promise<{agentId: string, success: boolean, error?: string}[]> {
		if (!CONFIG.TERMINAL_LOGGING.ENABLED) {
			return [];
		}

		// Get all agents with tmux sessions for this project
		const projectAgents = await db
			.select({
				id: agents.id,
				tmuxSession: agents.tmuxSession,
				status: agents.status
			})
			.from(agents)
			.where(eq(agents.projectId, projectId));

		const results: {agentId: string, success: boolean, error?: string}[] = [];

		for (const agent of projectAgents) {
			if (!agent.tmuxSession || agent.status === 'offline' || agent.isHumanDirector) {
				continue; // Skip agents without sessions, offline, or human directors
			}

			try {
				const success = await this.captureAgentTerminalLog(agent.id, agent.tmuxSession);
				results.push({
					agentId: agent.id,
					success
				});
			} catch (error) {
				results.push({
					agentId: agent.id,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return results;
	}

	private async captureAgentTerminalLog(agentId: string, tmuxSession: string): Promise<boolean> {
		try {
			// Capture the current terminal content
			const terminalOutput = execSync(
				`tmux capture-pane -t "${tmuxSession}" -p`,
				{ encoding: 'utf8', timeout: 3000 }
			);

			// Ensure log directory exists
			await this.ensureLogDirectory();

			// Generate log file path
			const logFilePath = this.getLogFilePath(agentId);

			// Append to log file with timestamp
			const timestamp = new Date().toISOString();
			const logEntry = `\n=== ${timestamp} ===\n${terminalOutput}\n`;

			await fs.appendFile(logFilePath, logEntry);

			// Check if log rotation is needed
			await this.rotateLogFileIfNeeded(logFilePath, agentId);

			return true;

		} catch (error) {
			console.error(`Failed to capture terminal log for agent ${agentId}:`, error);
			return false;
		}
	}

	private async ensureLogDirectory(): Promise<void> {
		try {
			await fs.access(CONFIG.TERMINAL_LOGGING.LOG_DIR);
		} catch {
			// Directory doesn't exist, create it
			await fs.mkdir(CONFIG.TERMINAL_LOGGING.LOG_DIR, { recursive: true });
		}
	}

	private getLogFilePath(agentId: string): string {
		const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const fileName = CONFIG.TERMINAL_LOGGING.LOG_FILE_PATTERN
			.replace('{agentId}', agentId)
			.replace('{date}', date);
		return join(CONFIG.TERMINAL_LOGGING.LOG_DIR, fileName);
	}

	private async rotateLogFileIfNeeded(logFilePath: string, agentId: string): Promise<void> {
		try {
			const stats = await fs.stat(logFilePath);
			
			if (stats.size > CONFIG.TERMINAL_LOGGING.MAX_LOG_FILE_SIZE) {
				// Create rotated filename
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				const rotatedPath = `${logFilePath}.${timestamp}`;
				
				// Move current log to rotated name
				await fs.rename(logFilePath, rotatedPath);
				
				// Clean up old rotated logs
				await this.cleanupOldLogs(agentId);
				
				console.log(`📄 Rotated log file for agent ${agentId}: ${rotatedPath}`);
			}
		} catch (error) {
			console.error(`Failed to rotate log file for agent ${agentId}:`, error);
		}
	}

	private async cleanupOldLogs(agentId: string): Promise<void> {
		try {
			const files = await fs.readdir(CONFIG.TERMINAL_LOGGING.LOG_DIR);
			
			// Find all log files for this agent
			const agentLogFiles = files
				.filter(file => file.includes(`terminal_${agentId}_`))
				.map(file => ({
					name: file,
					path: join(CONFIG.TERMINAL_LOGGING.LOG_DIR, file)
				}))
				.sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (newest first)
			
			// Remove excess files
			if (agentLogFiles.length > CONFIG.TERMINAL_LOGGING.MAX_LOG_FILES) {
				const filesToDelete = agentLogFiles.slice(CONFIG.TERMINAL_LOGGING.MAX_LOG_FILES);
				
				for (const file of filesToDelete) {
					await fs.unlink(file.path);
					console.log(`🗑️  Deleted old log file: ${file.name}`);
				}
			}
		} catch (error) {
			console.error(`Failed to cleanup old logs for agent ${agentId}:`, error);
		}
	}

	private logStats(): void {
		const { totalChecks, statusUpdates, notificationsSent, gentlePokes, terminalLogsCaptured, filesSynced, documentsCreated, ticketsCreated, errors, uptime } = this.getStats();
		const uptimeMinutes = Math.floor(uptime / 60000);
		const uptimeSeconds = Math.floor((uptime % 60000) / 1000);

		console.log('\n📊 MONITORING SERVICE STATISTICS');
		console.log('═══════════════════════════════════');
		console.log(`⏱️  Uptime: ${uptimeMinutes}m ${uptimeSeconds}s`);
		console.log(`✅ Total Checks: ${totalChecks}`);
		console.log(`🔄 Status Updates: ${statusUpdates}`);
		console.log(`📬 Notifications Sent: ${notificationsSent}`);
		console.log(`👋 Gentle Pokes: ${gentlePokes}`);
		console.log(`📄 Terminal Logs Captured: ${terminalLogsCaptured}`);
		console.log(`📁 Files Synced: ${filesSynced}`);
		console.log(`📝 Documents Created: ${documentsCreated}`);
		console.log(`🎫 Tickets Created: ${ticketsCreated}`);
		console.log(`❌ Errors: ${errors}`);
		console.log('═══════════════════════════════════');
	}

	// =============================================================================
	// FILE SYNC METHODS - Document and Ticket File Watching
	// =============================================================================

	private async initializeFileWatcher(): Promise<void> {
		try {
			console.log('🔍 DEBUG: Starting file watcher initialization...');
			
			// Watch for .md files in docs/, tickets/, and agent workspace directories
			const watchPaths = [
				'docs/',
				'tickets/', 
				'agent_workspaces/'
			];
			
			console.log('🔍 DEBUG: Watch paths:', watchPaths);
			console.log('🔍 DEBUG: Current working directory:', process.cwd());
			
			this.fileWatcher = chokidar.watch(watchPaths, {
				ignored: /(^|[\/\\])\../, // ignore dotfiles
				persistent: true,
				ignoreInitial: false, // Process existing files on startup
				usePolling: true, // Force polling mode to ensure detection
				interval: 1000, // 1-second polling interval
				binaryInterval: 3000,
				depth: 99 // Allow deep directory watching
			});

			console.log('🔍 DEBUG: Chokidar watcher created, setting up event handlers...');

			this.fileWatcher
				.on('ready', () => {
					console.log('🔍 DEBUG: File watcher is ready and watching for changes');
				})
				.on('add', (path: string) => {
					console.log('🔍 DEBUG: File ADD event:', path);
					this.handleFileAdd(path);
				})
				.on('change', (path: string) => {
					console.log('🔍 DEBUG: File CHANGE event:', path);
					this.handleFileChange(path);
				})
				.on('unlink', (path: string) => {
					console.log('🔍 DEBUG: File DELETE event:', path);
					this.handleFileDelete(path);
				})
				.on('error', (error: Error) => {
					console.error('📁 File watcher error:', error);
					this.stats.errors++;
				})
				.on('raw', (event: string, path: string, details?: any) => {
					console.log('🔍 DEBUG: Raw event:', event, 'path:', path, 'details:', details);
				});

			console.log('📁 File watcher initialized with enhanced debugging');
		} catch (error) {
			console.error('Failed to initialize file watcher:', error);
			this.stats.errors++;
		}
	}

	private async handleFileAdd(filePath: string): Promise<void> {
		try {
			console.log(`🔍 DEBUG: Entering handleFileAdd for: ${filePath}`);
			
			// Only process .md files
			if (!filePath.endsWith('.md')) {
				console.log(`🔍 DEBUG: Skipping non-markdown file: ${filePath}`);
				return;
			}
			
			const fileType = this.getFileType(filePath);
			const slug = this.getSlugFromPath(filePath);
			const authorId = this.getAuthorFromPath(filePath);
			
			console.log(`🔍 DEBUG: File details - type: ${fileType}, slug: ${slug}, author: ${authorId || 'none'}`);
			
			// Check if document/ticket already exists in DB
			console.log(`🔍 DEBUG: Checking for existing content with slug: ${slug}`);
			const existingContent = await this.findContentBySlug(slug, fileType);
			
			if (existingContent) {
				console.log(`🔍 DEBUG: Found existing content, syncing DB to file`);
				// File was created but content already exists - sync from DB to file
				await this.syncDbToFile(existingContent, filePath);
				console.log(`📁 Synced existing ${fileType} "${slug}" from DB to new file`);
			} else {
				console.log(`🔍 DEBUG: No existing content found, creating new from file`);
				// New file - create document/ticket in DB
				await this.syncFileToDb(filePath, fileType, slug);
				console.log(`📁 Created new ${fileType} "${slug}" from file`);
				
				if (fileType === 'document') this.stats.documentsCreated++;
				if (fileType === 'ticket') this.stats.ticketsCreated++;
			}
			
			this.stats.filesSynced++;
			console.log(`🔍 DEBUG: Successfully handled file add. Stats updated.`);
		} catch (error) {
			console.error(`❌ CRITICAL ERROR in handleFileAdd for ${filePath}:`, error);
			console.error('Stack trace:', error instanceof Error ? error.stack : error);
			this.stats.errors++;
		}
	}

	private async handleFileChange(filePath: string): Promise<void> {
		try {
			// Only process .md files
			if (!filePath.endsWith('.md')) {
				return;
			}
			
			// Check if this change was caused by us (to avoid sync loops)
			const stat = await fs.stat(filePath);
			const lastModTime = stat.mtime.getTime();
			const trackedModTime = this.fileModificationTimes.get(filePath);
			
			if (trackedModTime && Math.abs(lastModTime - trackedModTime) < 1000) {
				// This change was made by us within the last second, ignore
				return;
			}

			console.log(`📁 File changed: ${filePath}`);
			
			const fileType = this.getFileType(filePath);
			const slug = this.getSlugFromPath(filePath);
			
			// Sync file changes to DB
			await this.syncFileToDb(filePath, fileType, slug);
			this.stats.filesSynced++;
			
		} catch (error) {
			console.error(`Failed to handle file change: ${filePath}`, error);
			this.stats.errors++;
		}
	}

	private async handleFileDelete(filePath: string): Promise<void> {
		try {
			// Only process .md files
			if (!filePath.endsWith('.md')) {
				return;
			}
			
			console.log(`📁 File deleted: ${filePath}`);
			
			const fileType = this.getFileType(filePath);
			const slug = this.getSlugFromPath(filePath);
			
			// Soft delete the content in DB
			const existingContent = await this.findContentBySlug(slug, fileType);
			if (existingContent) {
				await db
					.update(content)
					.set({
						title: `[DELETED] ${existingContent.title}`,
						body: `[This ${fileType} file was deleted]`,
						updatedAt: new Date()
					})
					.where(eq(content.id, existingContent.id));
				
				console.log(`📁 Soft deleted ${fileType} "${slug}" in database`);
			}
			
		} catch (error) {
			console.error(`Failed to handle file delete: ${filePath}`, error);
			this.stats.errors++;
		}
	}

	private async syncFileToDb(filePath: string, fileType: 'document' | 'ticket', slug: string): Promise<void> {
		try {
			// Read file contents
			const fileContent = await fs.readFile(filePath, 'utf8');
			
			// Extract title from first line or filename
			const lines = fileContent.split('\n');
			let title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
			let body = fileContent;
			
			// If first line looks like a title (starts with #), extract it
			if (lines[0] && lines[0].startsWith('# ')) {
				title = lines[0].replace(/^# /, '');
				body = lines.slice(1).join('\n').trim();
			}

			// Find existing content or create new
			const existingContent = await this.findContentBySlug(slug, fileType);
			
			if (existingContent) {
				// Update existing content
				await db
					.update(content)
					.set({
						title,
						body,
						updatedAt: new Date()
					})
					.where(eq(content.id, existingContent.id));
				
				console.log(`📁 Updated ${fileType} "${slug}" in database`);
			} else {
				// Create new content - need to determine projectId and author
				const projectId = await this.getCurrentProjectId();
				const authorAgentId = this.getAuthorFromPath(filePath);
				
				await db
					.insert(content)
					.values({
						projectId,
						type: fileType,
						title,
						body,
						documentSlug: slug,
						authorAgentId,
						createdAt: new Date(),
						updatedAt: new Date()
					});
				
				const authorText = authorAgentId ? ` by agent ${authorAgentId}` : ' (no specific author)';
				console.log(`📁 Created new ${fileType} "${slug}" in database${authorText}`);
			}
		} catch (error) {
			console.error(`Failed to sync file to DB: ${filePath}`, error);
			throw error;
		}
	}

	private async syncDbToFile(dbContent: any, filePath: string): Promise<void> {
		try {
			// Create file content with title as first line
			const fileContent = `# ${dbContent.title}\n\n${dbContent.body}`;
			
			// Track this modification to avoid sync loops
			await fs.writeFile(filePath, fileContent);
			const stat = await fs.stat(filePath);
			this.fileModificationTimes.set(filePath, stat.mtime.getTime());
			
			console.log(`📁 Synced DB content to file: ${filePath}`);
		} catch (error) {
			console.error(`Failed to sync DB to file: ${filePath}`, error);
			throw error;
		}
	}

	private getFileType(filePath: string): 'document' | 'ticket' {
		return filePath.includes('/tickets/') ? 'ticket' : 'document';
	}

	private getSlugFromPath(filePath: string): string {
		const fileName = basename(filePath, extname(filePath));
		const baseSlug = fileName.toLowerCase().replace(/\s+/g, '-');
		
		// Public documents (root /docs, /tickets) use simple slugs for phase integration
		if (this.isPublicDocument(filePath)) {
			return baseSlug;
		}
		
		// Private documents (agent workspaces) use namespaced slugs to avoid collisions
		const authorId = this.getAuthorFromPath(filePath);
		if (authorId) {
			return `${authorId}-${baseSlug}`;
		}
		
		// Fallback to simple slug
		return baseSlug;
	}

	private getAuthorFromPath(filePath: string): string | null {
		// Check if file is in agent workspace: agent_workspaces/AGENT_ID/docs/...
		const workspaceMatch = filePath.match(/agent_workspaces\/([^\/]+)\//);
		if (workspaceMatch) {
			return workspaceMatch[1]; // Return the agent ID
		}
		
		// Files in root docs/ or tickets/ have no specific author
		return null;
	}

	private isPublicDocument(filePath: string): boolean {
		// Public documents are in root /docs or /tickets folders
		// These need well-known slugs for phase integration
		return filePath.startsWith('docs/') || filePath.startsWith('tickets/');
	}

	private isPrivateDocument(filePath: string): boolean {
		// Private documents are in agent workspaces
		// Collisions are acceptable since they're private to the agent
		return filePath.includes('agent_workspaces/');
	}

	private async findContentBySlug(slug: string, type: 'document' | 'ticket'): Promise<any> {
		const results = await db
			.select()
			.from(content)
			.where(and(
				eq(content.documentSlug, slug),
				eq(content.type, type)
			))
			.limit(1);
			
		return results[0] || null;
	}

	private async getCurrentProjectId(): Promise<number> {
		// For now, use the first active project
		const activeProjects = await db
			.select({ id: projects.id })
			.from(projects)
			.where(eq(projects.status, 'active'))
			.limit(1);
		
		if (activeProjects.length === 0) {
			throw new Error('No active projects found');
		}
		
		return activeProjects[0].id;
	}
}

export default MonitoringManager;