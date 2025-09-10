import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, projects } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/roles/[roleType]/current-phase?projectId=<id> - Get current active phase for a role type
export async function GET({ params, url }) {
	try {
		const { roleType } = params;
		const projectId = url.searchParams.get('projectId');
		
		if (!roleType) {
			return json({ error: 'Role type is required' }, { status: 400 });
		}
		
		if (!projectId) {
			return json({ error: 'Project ID is required' }, { status: 400 });
		}

		console.log(`🔍 Looking for active phase for role: ${roleType} in project: ${projectId}`);

		// Find active phase assigned to this role type
		const [activePhase] = await db
			.select({
				id: content.id,
				title: content.title,
				body: content.body,
				phaseStatus: content.phaseStatus,
				requiredInputs: content.requiredInputs,
				expectedOutputs: content.expectedOutputs,
				assignedToRoleType: content.assignedToRoleType,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt
			})
			.from(content)
			.where(and(
				eq(content.projectId, parseInt(projectId)),
				eq(content.type, 'phase'),
				eq(content.phaseStatus, 'active'),
				eq(content.assignedToRoleType, roleType)
			))
			.orderBy(content.updatedAt) // Most recently updated
			.limit(1);

		if (!activePhase) {
			console.log(`📭 No active phase found for role: ${roleType}`);
			return json({
				hasActivePhase: false,
				roleType,
				projectId: parseInt(projectId),
				message: 'No active phase assigned to this role',
				instruction: 'Please remain idle and wait for phase assignments or other tasks.'
			});
		}

		// Parse JSON fields
		let requiredInputs: string[] = [];
		let expectedOutputs: string[] = [];
		
		try {
			requiredInputs = activePhase.requiredInputs ? JSON.parse(activePhase.requiredInputs) : [];
		} catch (e) {
			console.warn('Failed to parse requiredInputs JSON:', activePhase.requiredInputs);
		}
		
		try {
			expectedOutputs = activePhase.expectedOutputs ? JSON.parse(activePhase.expectedOutputs) : [];
		} catch (e) {
			console.warn('Failed to parse expectedOutputs JSON:', activePhase.expectedOutputs);
		}

		console.log(`✅ Found active phase: ${activePhase.title} (${activePhase.phaseStatus})`);

		return json({
			hasActivePhase: true,
			roleType,
			projectId: parseInt(projectId),
			phase: {
				id: activePhase.id,
				title: activePhase.title,
				description: activePhase.body,
				status: activePhase.phaseStatus,
				requiredInputs,
				expectedOutputs,
				createdAt: activePhase.createdAt,
				updatedAt: activePhase.updatedAt
			},
			instruction: `You are currently assigned to work on: "${activePhase.title}". Use the details below to continue your work.`
		});

	} catch (error) {
		console.error('Failed to get current phase for role:', error);
		return json({ error: 'Failed to get current phase' }, { status: 500 });
	}
}