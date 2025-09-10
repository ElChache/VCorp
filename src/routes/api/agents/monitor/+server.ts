import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { db } from '$lib/db/index';
import { agents, scheduledReminders, content, readingAssignments } from '$lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';

let isMonitoring = false;
let monitoringInterval: NodeJS.Timeout | null = null;

// Start/stop monitoring
export async function POST({ request }) {
	try {
		const { action } = await request.json();

		if (action === 'start') {
			if (isMonitoring) {
				return json({ message: 'Monitoring already running' });
			}

			startMonitoring();
			return json({ success: true, message: 'Agent monitoring started' });

		} else if (action === 'stop') {
			stopMonitoring();
			return json({ success: true, message: 'Agent monitoring stopped' });

		} else {
			return json({ error: 'Invalid action. Use "start" or "stop"' }, { status: 400 });
		}

	} catch (error) {
		console.error('Failed to control monitoring:', error);
		return json({ error: 'Failed to control monitoring' }, { status: 500 });
	}
}

// Get monitoring status
export async function GET() {
	return json({
		isMonitoring,
		intervalMs: 5000, // 5 seconds
		lastCheck: new Date().toISOString()
	});
}

function startMonitoring() {
	if (isMonitoring) return;

	console.log('🔍 Starting agent monitoring (every 5 seconds)');
	isMonitoring = true;

	monitoringInterval = setInterval(async () => {
		try {
			await monitorAllAgents();
			await processScheduledReminders();
		} catch (error) {
			console.error('Error in monitoring cycle:', error);
		}
	}, 5000); // 5 seconds
}

function stopMonitoring() {
	if (!isMonitoring) return;

	console.log('🛑 Stopping agent monitoring');
	isMonitoring = false;

	if (monitoringInterval) {
		clearInterval(monitoringInterval);
		monitoringInterval = null;
	}
}

async function monitorAllAgents() {
	try {
		const allAgents = await db.select().from(agents);

		for (const agent of allAgents) {
			const newStatus = await checkAgentStatus(agent);
			
			if (newStatus !== agent.status) {
				await db
					.update(agents)
					.set({ 
						status: newStatus,
						lastHeartbeat: new Date()
					})
					.where(eq(agents.id, agent.id));

				console.log(`📊 Agent ${agent.id} status: ${agent.status} → ${newStatus}`);
			}
		}

	} catch (error) {
		console.error('Error monitoring agents:', error);
	}
}

async function checkAgentStatus(agent: any): Promise<'active' | 'idle' | 'offline'> {
	try {
		// Check if tmux session exists
		execSync(`tmux has-session -t "${agent.tmuxSession}"`, { 
			stdio: 'ignore', 
			timeout: 2000 
		});

		// Simple status determination:
		// If session exists and was updated recently = active
		// If session exists but stale = idle
		const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
		const now = Date.now();
		const minutesSinceUpdate = (now - lastHeartbeat) / (1000 * 60);

		return minutesSinceUpdate > 10 ? 'idle' : 'active';

	} catch (error) {
		// Session doesn't exist
		return 'offline';
	}
}

async function processScheduledReminders() {
	try {
		const now = new Date();
		
		// Get all active scheduled reminders
		const activeReminders = await db
			.select()
			.from(scheduledReminders)
			.where(eq(scheduledReminders.isActive, true));

		for (const reminder of activeReminders) {
			// Check if it's time to send this reminder
			if (shouldSendReminder(reminder, now)) {
				await sendScheduledReminder(reminder);
				
				// Update lastSentAt
				await db
					.update(scheduledReminders)
					.set({ lastSentAt: now })
					.where(eq(scheduledReminders.id, reminder.id));
				
				console.log(`⏰ Sent scheduled reminder: ${reminder.name} to ${reminder.targetRoleType}`);
			}
		}

	} catch (error) {
		console.error('Error processing scheduled reminders:', error);
	}
}

function shouldSendReminder(reminder: any, now: Date): boolean {
	if (!reminder.lastSentAt) {
		// Never sent before, send it now
		return true;
	}
	
	const lastSent = new Date(reminder.lastSentAt);
	const minutesSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60);
	
	return minutesSinceLastSent >= reminder.frequencyMinutes;
}

async function sendScheduledReminder(reminder: any) {
	try {
		// Create a message in the content table
		const [reminderMessage] = await db
			.insert(content)
			.values({
				projectId: reminder.projectId,
				type: 'message',
				title: `⏰ ${reminder.name}`,
				body: reminder.message,
				authorAgentId: null, // System message
			})
			.returning();

		// Create reading assignment for the target role type
		await db
			.insert(readingAssignments)
			.values({
				contentId: reminderMessage.id,
				assignedToType: 'role',
				assignedTo: reminder.targetRoleType
			});

	} catch (error) {
		console.error(`Failed to send scheduled reminder ${reminder.name}:`, error);
	}
}

// Auto-start monitoring when server starts
if (typeof process !== 'undefined' && !isMonitoring) {
	// Small delay to let server fully start
	setTimeout(() => {
		startMonitoring();
	}, 3000);
}