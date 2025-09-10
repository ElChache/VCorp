import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// PUT /api/phases/[id]/status - Update phase status with notifications
export async function PUT({ params, request }) {
	try {
		const phaseId = parseInt(params.id);
		const { newStatus } = await request.json();
		
		if (isNaN(phaseId)) {
			return json({ error: 'Invalid phase ID' }, { status: 400 });
		}

		if (!newStatus) {
			return json({ error: 'New status is required' }, { status: 400 });
		}

		// Get the current phase
		const [currentPhase] = await db
			.select()
			.from(content)
			.where(eq(content.id, phaseId))
			.limit(1);

		if (!currentPhase || currentPhase.type !== 'phase') {
			return json({ error: 'Phase not found' }, { status: 404 });
		}

		const oldStatus = currentPhase.phaseStatus;
		
		// Update the phase status
		const [updatedPhase] = await db
			.update(content)
			.set({
				phaseStatus: newStatus,
				updatedAt: new Date()
			})
			.where(eq(content.id, phaseId))
			.returning();

		// Send notifications for the status change
		await sendStatusChangeNotifications(updatedPhase, oldStatus, newStatus);

		return json({
			success: true,
			phase: updatedPhase,
			oldStatus,
			newStatus,
			message: `Phase status updated from ${oldStatus} to ${newStatus}`
		});

	} catch (error) {
		console.error('Failed to update phase status:', error);
		return json({ error: 'Failed to update phase status' }, { status: 500 });
	}
}

async function sendStatusChangeNotifications(phase: any, oldStatus: string, newStatus: string) {
	try {
		// Create reading assignment for the role responsible for this phase
		await db
			.insert(readingAssignments)
			.values({
				contentId: phase.id,
				assignedToType: 'role',
				assignedTo: phase.assignedToRoleType,
				assignedAt: new Date()
			});

		console.log(`📖 Created reading assignment for phase "${phase.title}" status change to ${phase.assignedToRoleType}`);

		// Generate status-specific message
		const statusMessage = generateStatusMessage(phase, oldStatus, newStatus);
		
		// Create notification message
		await db
			.insert(content)
			.values({
				projectId: phase.projectId,
				type: 'message',
				title: `Phase Status Change: ${phase.title}`,
				body: statusMessage,
				assignedToRoleType: phase.assignedToRoleType,
				createdAt: new Date(),
				updatedAt: new Date()
			});

		console.log(`💬 Sent status change message to ${phase.assignedToRoleType}: ${statusMessage}`);

	} catch (error) {
		console.error('Failed to send status change notifications:', error);
	}
}

function generateStatusMessage(phase: any, oldStatus: string, newStatus: string): string {
	const phaseTitle = phase.title;
	const roleType = phase.assignedToRoleType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
	
	switch (newStatus) {
		case 'draft':
			return `📝 Phase "${phaseTitle}" is now in DRAFT status. This phase is being planned and defined. No action required yet - the phase needs approval before work can begin.`;
		
		case 'approved':
			return `✅ Phase "${phaseTitle}" has been APPROVED and is ready to begin! This phase is now eligible for activation once dependencies are met and no other phases are active for your role.`;
		
		case 'active':
			return `🚀 Phase "${phaseTitle}" is now ACTIVE! This is your current work priority. Focus on completing this phase according to its requirements and deliverables. Only one phase can be active per role at a time.`;
		
		case 'completed':
			return `🎉 Phase "${phaseTitle}" has been COMPLETED! Great work! This phase's deliverables are now available as inputs for dependent phases. The system will automatically check if any waiting phases can now begin.`;
		
		case 'blocked':
			return `⚠️ Phase "${phaseTitle}" is now BLOCKED. This phase cannot proceed due to dependencies, issues, or external factors. Please review the blockers and coordinate with your team to resolve them.`;
		
		default:
			return `🔄 Phase "${phaseTitle}" status changed from ${oldStatus || 'unknown'} to ${newStatus}. Please check the phase details for next steps.`;
	}
}