import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { projects, roleTemplates, promptTemplates, rolePromptCompositionTemplates, roles, prompts, rolePromptCompositions, channelTemplates, channels, channelRoleAssignmentTemplates, channelRoleAssignments, squadTemplates, squads, squadRoleAssignmentTemplates, squadRoleAssignments, squadPromptAssignmentTemplates, squadPromptAssignments, phaseTemplates, phaseRoleAssignmentTemplates, content, agents } from '$lib/db/schema';
import { desc, eq, and } from 'drizzle-orm';

export async function GET() {
	try {
		const allProjects = await db
			.select()
			.from(projects)
			.orderBy(desc(projects.createdAt));

		return json(allProjects);
	} catch (error) {
		console.error('Failed to fetch projects:', error);
		return json({ error: 'Failed to fetch projects' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { name, description, path } = body;

		if (!name?.trim()) {
			return json({ error: 'Project name is required' }, { status: 400 });
		}

		if (!path?.trim()) {
			return json({ error: 'Project path is required' }, { status: 400 });
		}

		// Create project
		const [newProject] = await db
			.insert(projects)
			.values({
				name: name.trim(),
				description: description?.trim() || null,
				path: path.trim(),
			})
			.returning();

		// Get role templates to create project roles from
		const allRoleTemplates = await db.select().from(roleTemplates);
		
		// Get all prompt templates to create project prompts
		const allPromptTemplates = await db.select().from(promptTemplates);
		
		// Get all role prompt composition templates to know which prompts belong to each role
		const allRolePromptCompositionTemplates = await db
			.select({
				roleTemplateId: rolePromptCompositionTemplates.roleTemplateId,
				promptTemplateId: rolePromptCompositionTemplates.promptTemplateId,
				orderIndex: rolePromptCompositionTemplates.orderIndex,
				promptTemplate: promptTemplates
			})
			.from(rolePromptCompositionTemplates)
			.leftJoin(promptTemplates, eq(rolePromptCompositionTemplates.promptTemplateId, promptTemplates.id));

		// Create ALL project prompts from templates first
		const createdPrompts = {};
		for (const promptTemplate of allPromptTemplates) {
			const [newPrompt] = await db
				.insert(prompts)
				.values({
					projectId: newProject.id,
					templateId: promptTemplate.id,
					name: promptTemplate.name,
					type: promptTemplate.type,
					content: promptTemplate.content,
					premade: promptTemplate.premade,
					isGlobal: promptTemplate.isGlobal,
					orderIndex: 0, // Will be set per role/squad assignment
				})
				.returning();

			createdPrompts[promptTemplate.id] = newPrompt;
		}

		// Create project roles from templates
		const createdRoles = [];
		for (const roleTemplate of allRoleTemplates) {
			// Get all prompt composition templates for this role template
			const assignedPrompts = allRolePromptCompositionTemplates
				.filter(template => template.roleTemplateId === roleTemplate.id)
				.sort((a, b) => a.orderIndex - b.orderIndex);

			// Special handling for Human Director (which may not have prompt compositions)
			if (roleTemplate.name === 'Human Director') {
				// Find the Human Director role prompt template directly
				const humanDirectorPromptTemplate = allPromptTemplates.find(p => p.name === 'Human Director Role');
				
				const [newRole] = await db
					.insert(roles)
					.values({
						projectId: newProject.id,
						templateId: roleTemplate.id,
						name: roleTemplate.name,
						content: humanDirectorPromptTemplate ? humanDirectorPromptTemplate.content : 'Human Director role content',
					})
					.returning();

				createdRoles.push(newRole);
			} else if (assignedPrompts.length > 0) {
				// Use the first assigned prompt as the role content
				const primaryPrompt = assignedPrompts[0];
				
				const [newRole] = await db
					.insert(roles)
					.values({
						projectId: newProject.id,
						templateId: roleTemplate.id,
						name: roleTemplate.name,
						content: primaryPrompt.promptTemplate.content,
					})
					.returning();

				createdRoles.push(newRole);

				// Link assigned prompts to this role
				for (const template of assignedPrompts) {
					const projectPrompt = createdPrompts[template.promptTemplate.id];
					if (projectPrompt) {
						await db
							.insert(rolePromptCompositions)
							.values({
								roleId: newRole.id,
								promptId: projectPrompt.id,
								orderIndex: template.orderIndex,
							});
					}
				}
			}
		}

		// Create Human Director agent automatically (since it represents the human user)
		const humanDirectorRole = createdRoles.find(role => role.name === 'Human Director');
		if (humanDirectorRole) {
			await db
				.insert(agents)
				.values({
					id: 'human-director',
					projectId: newProject.id,
					roleId: humanDirectorRole.id,
					roleType: 'Human Director',
					status: 'online', // Human is always online
					model: 'human', // Special model type for human users
				});
		}

		// Create project channels from channel templates
		const allChannelTemplates = await db.select().from(channelTemplates);
		const createdChannels = [];
		
		for (const channelTemplate of allChannelTemplates) {
			const [newChannel] = await db
				.insert(channels)
				.values({
					projectId: newProject.id,
					name: channelTemplate.name,
					description: channelTemplate.description,
					promptForAgents: channelTemplate.promptForAgents,
					isMainChannel: channelTemplate.isMainChannel,
					isForHumanDirector: channelTemplate.isForHumanDirector,
				})
				.returning();

			createdChannels.push(newChannel);

			// Get role assignment templates for this channel template
			const roleAssignmentTemplates = await db
				.select({
					roleTemplateId: channelRoleAssignmentTemplates.roleTemplateId,
				})
				.from(channelRoleAssignmentTemplates)
				.where(eq(channelRoleAssignmentTemplates.channelTemplateId, channelTemplate.id));

			// Create channel-role assignments based on templates
			for (const assignmentTemplate of roleAssignmentTemplates) {
				// Find the corresponding role in this project
				const [projectRole] = await db
					.select()
					.from(roles)
					.where(and(
						eq(roles.templateId, assignmentTemplate.roleTemplateId),
						eq(roles.projectId, newProject.id)
					))
					.limit(1);

				if (projectRole) {
					await db
						.insert(channelRoleAssignments)
						.values({
							channelId: newChannel.id,
							roleId: projectRole.id,
						});
				}
			}

			// Create channel-specific instruction prompt for this channel
			if (!channelTemplate.isForHumanDirector) { // Don't create instructions for director-only channels
				const [channelInstructionPrompt] = await db
					.insert(prompts)
					.values({
						projectId: newProject.id,
						templateId: null, // This is a generated prompt, not from template
						name: `${channelTemplate.name} Channel Instructions`,
						type: "channel_instructions",
						content: `Instructions for the ${channelTemplate.name} channel will be generated dynamically.`,
						premade: "channel-specific-instructions",
						orderIndex: 10,
					})
					.returning();
			}
		}

		// Create project squads from squad templates
		const allSquadTemplates = await db.select().from(squadTemplates);
		const createdSquads = [];

		for (const squadTemplate of allSquadTemplates) {
			const [newSquad] = await db
				.insert(squads)
				.values({
					id: `${squadTemplate.id}-${newProject.id}`, // Make squad ID unique per project
					projectId: newProject.id,
					templateId: squadTemplate.id,
					name: squadTemplate.name,
				})
				.returning();

			createdSquads.push(newSquad);

			// Get squad role assignment templates for this squad template
			const squadRoleAssignmentTemplateList = await db
				.select({
					roleTemplateId: squadRoleAssignmentTemplates.roleTemplateId,
				})
				.from(squadRoleAssignmentTemplates)
				.where(eq(squadRoleAssignmentTemplates.squadTemplateId, squadTemplate.id));

			// Create squad-role assignments based on templates
			for (const assignmentTemplate of squadRoleAssignmentTemplateList) {
				// Find the corresponding role in this project
				const [projectRole] = await db
					.select()
					.from(roles)
					.where(and(
						eq(roles.templateId, assignmentTemplate.roleTemplateId),
						eq(roles.projectId, newProject.id)
					))
					.limit(1);

				if (projectRole) {
					await db
						.insert(squadRoleAssignments)
						.values({
							squadId: newSquad.id,
							roleId: projectRole.id,
						});
				}
			}

			// Get squad prompt assignment templates for this squad template
			const squadPromptAssignmentTemplateList = await db
				.select({
					promptTemplateId: squadPromptAssignmentTemplates.promptTemplateId,
					orderIndex: squadPromptAssignmentTemplates.orderIndex,
				})
				.from(squadPromptAssignmentTemplates)
				.where(eq(squadPromptAssignmentTemplates.squadTemplateId, squadTemplate.id));

			// Create squad-prompt assignments based on templates
			for (const assignmentTemplate of squadPromptAssignmentTemplateList) {
				const projectPrompt = createdPrompts[assignmentTemplate.promptTemplateId];
				if (projectPrompt) {
					await db
						.insert(squadPromptAssignments)
						.values({
							squadId: newSquad.id,
							promptId: projectPrompt.id,
							orderIndex: assignmentTemplate.orderIndex,
						});
				}
			}
		}

		// Create project phases as content entries from phase templates
		console.log('📋 Creating project phases as content...');
		const allPhaseTemplates = await db.select().from(phaseTemplates);
		
		const createdPhases = [];
		// Create each unique phase template only once
		for (const phaseTemplate of allPhaseTemplates) {
			// Get all role assignments for this phase template to determine primary role
			const roleAssignments = await db
				.select({
					roleTemplateId: phaseRoleAssignmentTemplates.roleTemplateId,
					phaseOrder: phaseRoleAssignmentTemplates.phaseOrder,
				})
				.from(phaseRoleAssignmentTemplates)
				.where(eq(phaseRoleAssignmentTemplates.phaseTemplateId, phaseTemplate.id))
				.orderBy(phaseRoleAssignmentTemplates.phaseOrder);

			if (roleAssignments.length > 0) {
				// Use the first role assignment as the primary assignee
				const primaryRoleAssignment = roleAssignments[0];
				
				// Find the corresponding role in this project
				const [projectRole] = await db
					.select()
					.from(roles)
					.where(and(
						eq(roles.templateId, primaryRoleAssignment.roleTemplateId),
						eq(roles.projectId, newProject.id)
					))
					.limit(1);

				if (projectRole) {
					const [newPhaseContent] = await db
						.insert(content)
						.values({
							projectId: newProject.id,
							type: 'phase',
							title: phaseTemplate.name,
							body: phaseTemplate.workflow_description,
							assignedToRoleType: projectRole.name,
							phaseStatus: 'draft',
							requiredInputs: phaseTemplate.required_inputs,
							expectedOutputs: phaseTemplate.expected_outputs,
							createdAt: new Date(),
							updatedAt: new Date()
						})
						.returning();

					if (newPhaseContent) {
						createdPhases.push(newPhaseContent);
						console.log(`✅ Created phase: ${phaseTemplate.name} assigned to ${projectRole.name}`);
					}
				}
			}
		}

		return json({ 
			...newProject, 
			rolesCreated: createdRoles.length,
			channelsCreated: createdChannels.length,
			squadsCreated: createdSquads.length,
			phasesCreated: createdPhases.length
		}, { status: 201 });
	} catch (error) {
		console.error('Failed to create project:', error);
		console.error('Error message:', error.message);
		return json({ error: 'Failed to create project: ' + error.message }, { status: 500 });
	}
}

