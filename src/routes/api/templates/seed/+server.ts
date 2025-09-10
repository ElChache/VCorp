import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { roleTemplates, promptTemplates, rolePromptCompositionTemplates, squadTemplates, squadPromptAssignmentTemplates, squadRoleAssignmentTemplates, phaseTemplates, phaseRoleAssignmentTemplates, channelTemplates, channelRoleAssignmentTemplates } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { CORE_ROLE_TEMPLATES, CORE_PROMPT_TEMPLATES, CORE_SQUAD_TEMPLATES, CORE_SQUAD_ROLE_ASSIGNMENTS, CORE_PHASE_TEMPLATES, CORE_PHASE_ROLE_ASSIGNMENTS, CORE_CHANNEL_TEMPLATES, CORE_CHANNEL_ROLE_ASSIGNMENTS } from '$lib/templates/core-templates';

export async function POST() {
	try {
		console.log('🌱 Starting template seeding...');
		
		// Create all role templates from core templates
		const createdRoleTemplates: Record<string, any> = {};
		for (const roleTemplate of CORE_ROLE_TEMPLATES) {
			console.log(`📝 Creating role template: ${roleTemplate.name}`);
			
			// First check if it already exists
			const [existing] = await db
				.select()
				.from(roleTemplates)
				.where(eq(roleTemplates.name, roleTemplate.name))
				.limit(1);
				
			if (existing) {
				createdRoleTemplates[roleTemplate.name] = existing;
				console.log(`♻️ Using existing role template: ${existing.name} (ID: ${existing.id})`);
			} else {
				// Create new one if it doesn't exist
				const [created] = await db
					.insert(roleTemplates)
					.values({
						name: roleTemplate.name,
						description: roleTemplate.description,
						prefix: roleTemplate.prefix
					})
					.returning();
				
				if (created) {
					createdRoleTemplates[roleTemplate.name] = created;
					console.log(`✅ Created role template: ${created.name} (ID: ${created.id})`);
				}
			}
		}

		// Create all prompt templates from core templates
		const createdPromptTemplates: Record<string, any> = {};
		for (const [key, promptTemplate] of Object.entries(CORE_PROMPT_TEMPLATES)) {
			console.log(`📄 Creating prompt template: ${promptTemplate.name}`);
			
			// First check if it already exists
			const [existing] = await db
				.select()
				.from(promptTemplates)
				.where(eq(promptTemplates.name, promptTemplate.name))
				.limit(1);
				
			if (existing) {
				createdPromptTemplates[key] = existing;
				console.log(`♻️ Using existing prompt template: ${existing.name} (ID: ${existing.id})`);
			} else {
				// Create new one if it doesn't exist
				const [created] = await db
					.insert(promptTemplates)
					.values({
						name: promptTemplate.name,
						type: promptTemplate.type,
						content: promptTemplate.content,
						premade: promptTemplate.premade,
						isGlobal: promptTemplate.isGlobal || false,
						version: 1
					})
					.returning();
				
				if (created) {
					createdPromptTemplates[key] = created;
					console.log(`✅ Created prompt template: ${created.name} (ID: ${created.id})`);
				}
			}
		}

		// Create squad templates from core templates
		console.log('🏴 Creating squad templates...');

		const createdSquadTemplates: Record<string, any> = {};
		for (const squadTemplate of CORE_SQUAD_TEMPLATES) {
			console.log(`🏴 Creating squad template: ${squadTemplate.name}`);
			
			// Try to insert, but if it exists, fetch the existing one
			const [created] = await db
				.insert(squadTemplates)
				.values(squadTemplate)
				.onConflictDoNothing()
				.returning();
			
			if (created) {
				createdSquadTemplates[squadTemplate.id] = created;
				console.log(`✅ Created squad template: ${created.name} (ID: ${created.id})`);
			} else {
				// If not created (conflict), fetch existing one
				const [existing] = await db
					.select()
					.from(squadTemplates)
					.where(eq(squadTemplates.id, squadTemplate.id))
					.limit(1);
				
				if (existing) {
					createdSquadTemplates[squadTemplate.id] = existing;
					console.log(`♻️ Using existing squad template: ${existing.name} (ID: ${existing.id})`);
				}
			}
		}

		// Create squad-prompt assignment templates 
		console.log('🔗 Creating squad-prompt assignments...');
		const squadPromptMappings = [
			// Squad-specific prompts (only using prompts that exist in templates)
			{ squad: 'visual_testers', prompts: ['visual_testing_instructions'] },
			// Executive communication only for leadership
			{ squad: 'leadership', prompts: ['executive_to_human_comms'] },
			// Core team communication restrictions
			{ squad: 'core_team', prompts: ['core_team_to_human_comms'] }
		];

		for (const mapping of squadPromptMappings) {
			const squadTemplate = createdSquadTemplates[mapping.squad];
			if (!squadTemplate) {
				console.log(`⚠️ Squad template not found: ${mapping.squad}`);
				continue;
			}

			for (let i = 0; i < mapping.prompts.length; i++) {
				const promptKey = mapping.prompts[i];
				const promptTemplate = createdPromptTemplates[promptKey];
				
				if (!promptTemplate) {
					console.log(`⚠️ Prompt template not found: ${promptKey}`);
					continue;
				}

				await db
					.insert(squadPromptAssignmentTemplates)
					.values({
						squadTemplateId: squadTemplate.id,
						promptTemplateId: promptTemplate.id,
						orderIndex: i,
					})
					.onConflictDoNothing();
				
				console.log(`✅ Linked ${mapping.squad} squad -> ${promptTemplate.name} (order: ${i})`);
			}
		}

		// Create squad-role assignment templates
		console.log('🔗 Creating squad-role assignment templates...');

		for (const assignment of CORE_SQUAD_ROLE_ASSIGNMENTS) {
			const squadTemplate = createdSquadTemplates[assignment.squadTemplateId];
			const roleTemplate = createdRoleTemplates[assignment.roleName];
			
			if (!squadTemplate) {
				console.log(`⚠️ Squad template not found: ${assignment.squadTemplateId}`);
				continue;
			}

			if (!roleTemplate) {
				console.log(`⚠️ Role template not found: ${assignment.roleName}`);
				continue;
			}

			await db
				.insert(squadRoleAssignmentTemplates)
				.values({
					squadTemplateId: assignment.squadTemplateId,
					roleTemplateId: roleTemplate.id,
				})
				.onConflictDoNothing();
			
			console.log(`✅ Linked ${assignment.squadTemplateId} squad <- ${roleTemplate.name} role`);
		}

		// Create role prompt composition templates to link roles to their prompts
		console.log('🔗 Creating role-prompt compositions...');
		
		// Define the composition mappings - now only role-specific prompts
		// Global prompts are handled via squad assignments
		const rolePromptMappings = [
			// Product Manager - Only role description
			{ role: 'Product Manager', prompts: ['product_manager_role'] },
			// Backend Developer - Only role description
			{ role: 'Backend Developer', prompts: ['backend_role'] },
			// Frontend Developer - Only role description
			{ role: 'Frontend Developer', prompts: ['frontend_role'] },
			// Lead Developer - Role description + Lead workflow
			{ role: 'Lead Developer', prompts: ['lead_developer_role', 'leads_worktree_workflow'] },
			// AI Developer - Only role description
			{ role: 'AI Developer', prompts: ['ai_developer_role'] },
			// UX Expert - Only role description
			{ role: 'UX Expert', prompts: ['ux_expert_role'] },
			// Graphic Designer - Only role description
			{ role: 'Graphic Designer', prompts: ['graphic_designer_role'] },
			// Technical QA - Only role description
			{ role: 'Technical QA', prompts: ['technical_qa_role'] },
			// Director Assistant - Role description + communication prompts + workflow prompts
			{ role: 'Director Assistant', prompts: ['director_assistant_role', 'core_team_to_human_comms', 'executive_to_human_comms', 'phase_workflow', 'ticketing_system'] },
			// System Architect - Role description + Lead workflow
			{ role: 'System Architect', prompts: ['system_architect_role', 'leads_worktree_workflow'] }
		];

		for (const mapping of rolePromptMappings) {
			const roleTemplate = createdRoleTemplates[mapping.role];
			if (!roleTemplate) {
				console.log(`⚠️ Role template not found: ${mapping.role}`);
				continue;
			}

			for (let i = 0; i < mapping.prompts.length; i++) {
				const promptKey = mapping.prompts[i];
				const promptTemplate = createdPromptTemplates[promptKey];
				
				if (!promptTemplate) {
					console.log(`⚠️ Prompt template not found: ${promptKey}`);
					continue;
				}

				await db
					.insert(rolePromptCompositionTemplates)
					.values({
						roleTemplateId: roleTemplate.id,
						promptTemplateId: promptTemplate.id,
						orderIndex: i,
					})
					.onConflictDoNothing();
				
				console.log(`✅ Linked ${mapping.role} -> ${promptTemplate.name} (order: ${i})`);
			}
		}

		// Create channel templates from core templates
		console.log('📺 Creating channel templates...');
		const createdChannelTemplates: Record<string, any> = {};
		for (const channelTemplate of CORE_CHANNEL_TEMPLATES) {
			console.log(`📺 Creating channel template: ${channelTemplate.name}`);
			
			// First check if it already exists
			const [existing] = await db
				.select()
				.from(channelTemplates)
				.where(eq(channelTemplates.id, channelTemplate.id))
				.limit(1);
				
			if (existing) {
				createdChannelTemplates[channelTemplate.id] = existing;
				console.log(`♻️ Using existing channel template: ${existing.name} (ID: ${existing.id})`);
			} else {
				// Create new one if it doesn't exist
				const [created] = await db
					.insert(channelTemplates)
					.values({
						id: channelTemplate.id,
						name: channelTemplate.name,
						description: channelTemplate.description,
						promptForAgents: channelTemplate.promptForAgents,
						isMainChannel: channelTemplate.isMainChannel,
						isForHumanDirector: channelTemplate.isForHumanDirector
					})
					.returning();
				
				if (created) {
					createdChannelTemplates[channelTemplate.id] = created;
					console.log(`✅ Created channel template: ${created.name} (ID: ${created.id})`);
				}
			}
		}

		// Create channel-role assignment templates
		console.log('🔗 Creating channel-role assignment templates...');
		for (const assignment of CORE_CHANNEL_ROLE_ASSIGNMENTS) {
			const channelTemplate = createdChannelTemplates[assignment.channelTemplateId];
			const roleTemplate = createdRoleTemplates[assignment.roleName];
			
			if (!channelTemplate) {
				console.log(`⚠️ Channel template not found: ${assignment.channelTemplateId}`);
				continue;
			}

			if (!roleTemplate) {
				console.log(`⚠️ Role template not found: ${assignment.roleName}`);
				continue;
			}

			await db
				.insert(channelRoleAssignmentTemplates)
				.values({
					channelTemplateId: assignment.channelTemplateId,
					roleTemplateId: roleTemplate.id,
				})
				.onConflictDoNothing();
			
			console.log(`✅ Linked ${assignment.channelTemplateId} channel <- ${roleTemplate.name} role`);
		}

		// Create phase templates from core templates
		console.log('📋 Creating phase templates...');
		const createdPhaseTemplates: Record<string, any> = {};
		for (const phaseTemplate of CORE_PHASE_TEMPLATES) {
			console.log(`📋 Creating phase template: ${phaseTemplate.name}`);
			const [created] = await db
				.insert(phaseTemplates)
				.values({
					name: phaseTemplate.name,
					description: phaseTemplate.description,
					workflow_description: phaseTemplate.workflow_description,
					required_inputs: JSON.stringify(phaseTemplate.required_inputs),
					expected_outputs: JSON.stringify(phaseTemplate.expected_outputs)
				})
				.onConflictDoNothing()
				.returning();
			
			if (created) {
				createdPhaseTemplates[phaseTemplate.name] = created;
				console.log(`✅ Created phase template: ${created.name} (ID: ${created.id})`);
			}
		}

		// Create phase-role assignment templates
		console.log('🔗 Creating phase-role assignment templates...');
		let phaseRoleAssignmentCount = 0;
		for (const assignment of CORE_PHASE_ROLE_ASSIGNMENTS) {
			const phaseTemplate = createdPhaseTemplates[assignment.phaseName];
			const roleTemplate = createdRoleTemplates[assignment.roleName];
			
			if (!phaseTemplate) {
				console.log(`⚠️ Phase template not found: ${assignment.phaseName}`);
				continue;
			}

			if (!roleTemplate) {
				console.log(`⚠️ Role template not found: ${assignment.roleName}`);
				continue;
			}

			await db
				.insert(phaseRoleAssignmentTemplates)
				.values({
					phaseTemplateId: phaseTemplate.id,
					roleTemplateId: roleTemplate.id,
					phaseOrder: assignment.phaseOrder
				})
				.onConflictDoNothing();
			
			phaseRoleAssignmentCount++;
			console.log(`✅ Linked ${assignment.phaseName} -> ${assignment.roleName} (order: ${assignment.phaseOrder})`);
		}

		return json({ 
			success: true, 
			message: 'All templates seeded successfully',
			summary: {
				roleTemplates: Object.keys(createdRoleTemplates).length,
				promptTemplates: Object.keys(createdPromptTemplates).length,
				squadTemplates: Object.keys(createdSquadTemplates).length,
				channelTemplates: Object.keys(createdChannelTemplates).length,
				phaseTemplates: Object.keys(createdPhaseTemplates).length,
				roleCompositions: rolePromptMappings.reduce((acc, mapping) => acc + mapping.prompts.length, 0),
				squadCompositions: squadPromptMappings.reduce((acc, mapping) => acc + mapping.prompts.length, 0),
				squadRoleAssignments: CORE_SQUAD_ROLE_ASSIGNMENTS.length,
				channelRoleAssignments: CORE_CHANNEL_ROLE_ASSIGNMENTS.length,
				phaseRoleAssignments: phaseRoleAssignmentCount
			}
		});
	} catch (error) {
		console.error('Failed to seed templates:', error);
		return json({ error: 'Failed to seed templates' }, { status: 500 });
	}
}