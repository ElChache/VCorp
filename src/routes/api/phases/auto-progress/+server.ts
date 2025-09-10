import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, agents } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST({ request }) {
	try {
		const { projectId } = await request.json();
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		let progressionsMade = 0;
		let notificationsCreated = 0;
		let readingAssignmentsCreated = 0;

		// Get all phases for this project
		const phases = await db
			.select()
			.from(content)
			.where(and(
				eq(content.projectId, projectId),
				eq(content.type, 'phase')
			));

		// Group phases by role
		const phasesByRole: Record<string, any[]> = {};
		for (const phase of phases) {
			if (phase.assignedToRoleType) {
				if (!phasesByRole[phase.assignedToRoleType]) {
					phasesByRole[phase.assignedToRoleType] = [];
				}
				phasesByRole[phase.assignedToRoleType].push(phase);
			}
		}

		// For each role, check auto-progression rules
		for (const [roleType, rolePhases] of Object.entries(phasesByRole)) {
			const activePhases = rolePhases.filter(p => p.phaseStatus === 'active');
			const approvedPhases = rolePhases.filter(p => p.phaseStatus === 'approved');
			const completedPhases = rolePhases.filter(p => p.phaseStatus === 'completed');

			// Rule 1: Only one active phase per role at a time
			if (activePhases.length === 0 && approvedPhases.length > 0) {
				// No active phases, but there are approved phases - activate the first one
				const nextPhase = approvedPhases[0];
				
				// Check if required inputs are satisfied
				let canActivate = true;
				if (nextPhase.requiredInputs) {
					const requiredSlugs = JSON.parse(nextPhase.requiredInputs);
					for (const requiredSlug of requiredSlugs) {
						const requiredContent = phases.find(p => p.documentSlug === requiredSlug);
						if (!requiredContent || requiredContent.phaseStatus !== 'completed') {
							canActivate = false;
							break;
						}
					}
				}

				if (canActivate) {
					// Activate the phase
					await db
						.update(content)
						.set({
							phaseStatus: 'active',
							updatedAt: new Date()
						})
						.where(eq(content.id, nextPhase.id));

					progressionsMade++;

					// Create reading assignments for this role
					await createReadingAssignmentsForPhase(projectId, nextPhase, roleType);
					readingAssignmentsCreated++;

					// Send encouraging message
					await sendEncouragingMessage(projectId, nextPhase, roleType);
					notificationsCreated++;
				}
			}

			// Rule 2: When a phase is completed, check if dependent phases can be activated
			for (const completedPhase of completedPhases) {
				// Find phases that depend on this completed phase
				const dependentPhases = phases.filter(p => {
					if (!p.requiredInputs) return false;
					const requiredSlugs = JSON.parse(p.requiredInputs);
					return requiredSlugs.includes(completedPhase.documentSlug) && p.phaseStatus === 'approved';
				});

				for (const dependentPhase of dependentPhases) {
					// Check if this dependent phase has no active siblings in its role
					const dependentRolePhases = phasesByRole[dependentPhase.assignedToRoleType] || [];
					const activeInRole = dependentRolePhases.filter(p => p.phaseStatus === 'active');
					
					if (activeInRole.length === 0) {
						// Check if ALL required inputs are now satisfied
						let allInputsSatisfied = true;
						if (dependentPhase.requiredInputs) {
							const requiredSlugs = JSON.parse(dependentPhase.requiredInputs);
							for (const requiredSlug of requiredSlugs) {
								const requiredContent = phases.find(p => p.documentSlug === requiredSlug);
								if (!requiredContent || requiredContent.phaseStatus !== 'completed') {
									allInputsSatisfied = false;
									break;
								}
							}
						}

						if (allInputsSatisfied) {
							// Activate the dependent phase
							await db
								.update(content)
								.set({
									phaseStatus: 'active',
									updatedAt: new Date()
								})
								.where(eq(content.id, dependentPhase.id));

							progressionsMade++;

							// Notify about dependency satisfaction
							await notifyDependencyReady(projectId, dependentPhase);
							notificationsCreated++;
						}
					}
				}
			}
		}

		return json({
			success: true,
			progressionsMade,
			readingAssignmentsCreated,
			notificationsCreated,
			message: `Auto-progression complete: ${progressionsMade} phases progressed, ${readingAssignmentsCreated} reading assignments created, ${notificationsCreated} notifications sent`
		});

	} catch (error) {
		console.error('Failed to auto-progress phases:', error);
		return json({ error: 'Failed to auto-progress phases' }, { status: 500 });
	}
}

async function createReadingAssignmentsForPhase(projectId: number, phase: any, roleType: string) {
	// Create reading assignment for all agents of this role type
	const roleAgents = await db
		.select()
		.from(agents)
		.where(and(
			eq(agents.projectId, projectId),
			eq(agents.roleType, roleType),
			eq(agents.status, 'active')
		));

	// Create reading assignment for role type (generic assignment)
	await db
		.insert(readingAssignments)
		.values({
			contentId: phase.id,
			assignedToType: 'role',
			assignedTo: roleType,
			assignedAt: new Date()
		});

	console.log(`📖 Created reading assignment for phase "${phase.title}" to role ${roleType}`);
}

async function sendEncouragingMessage(projectId: number, phase: any, roleType: string) {
	// Create an encouraging message about the new active phase
	const encouragingMessages = [
		`🚀 New phase "${phase.title}" is now active for ${roleType}! Time to get started!`,
		`⭐ Great progress! Phase "${phase.title}" is ready to begin. You've got this!`,
		`🎯 Phase "${phase.title}" is now in progress. Let's make it happen!`,
		`💪 Ready to tackle "${phase.title}"? This phase is now active and waiting for you!`,
		`🔥 Phase "${phase.title}" just went live! Let's build something amazing!`
	];

	const message = encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];

	await db
		.insert(content)
		.values({
			projectId,
			type: 'message',
			title: 'Phase Activation',
			body: message,
			assignedToRoleType: roleType,
			createdAt: new Date(),
			updatedAt: new Date()
		});

	console.log(`💬 Sent encouraging message to ${roleType}: ${message}`);
}

async function notifyDependencyReady(projectId: number, phase: any) {
	// Create notification that dependencies are ready
	const message = `🎉 All dependencies for phase "${phase.title}" are now complete! This phase has been automatically activated.`;

	await db
		.insert(content)
		.values({
			projectId,
			type: 'message',
			title: 'Dependencies Ready',
			body: message,
			assignedToRoleType: phase.assignedToRoleType,
			createdAt: new Date(),
			updatedAt: new Date()
		});

	console.log(`🔗 Sent dependency notification for phase "${phase.title}" to ${phase.assignedToRoleType}`);
}