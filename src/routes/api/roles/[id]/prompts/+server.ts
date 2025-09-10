import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { rolePromptCompositions, prompts, roles, squadRoleAssignments, squadPromptAssignments, rolePromptOrders, squads } from '$lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { generatePremadeContent } from '$lib/premade-prompts';

export async function GET({ params }) {
	try {
		const roleId = parseInt(params.id);
		
		if (isNaN(roleId)) {
			return json({ error: 'Invalid role ID' }, { status: 400 });
		}

		// Get role information first
		const [role] = await db
			.select({
				id: roles.id,
				name: roles.name,
				projectId: roles.projectId
			})
			.from(roles)
			.where(eq(roles.id, roleId))
			.limit(1);

		if (!role) {
			return json({ error: 'Role not found' }, { status: 404 });
		}

		// Get all prompts for this role: role-specific, squad-based, and global
		const allPrompts = new Map(); // Use Map to deduplicate by prompt ID
		
		// 1. Get role-specific prompts (highest priority - role descriptions)
		const rolePrompts = await db
			.select({
				id: prompts.id,
				name: prompts.name,
				type: prompts.type,
				content: prompts.content,
				premade: prompts.premade,
				orderIndex: rolePromptCompositions.orderIndex
			})
			.from(rolePromptCompositions)
			.leftJoin(prompts, eq(rolePromptCompositions.promptId, prompts.id))
			.where(eq(rolePromptCompositions.roleId, roleId))
			.orderBy(rolePromptCompositions.orderIndex);

		// Add role prompts to map
		rolePrompts.forEach(prompt => {
			if (prompt.id && !allPrompts.has(prompt.id)) {
				allPrompts.set(prompt.id, { ...prompt, source: 'role' });
			}
		});

		// 2. Get squad-based prompts
		const squadIds = await db
			.select({ squadId: squadRoleAssignments.squadId })
			.from(squadRoleAssignments)
			.where(eq(squadRoleAssignments.roleId, roleId));

		if (squadIds.length > 0) {
			const squadPrompts = await db
				.select({
					id: prompts.id,
					name: prompts.name,
					type: prompts.type,
					content: prompts.content,
					premade: prompts.premade,
					orderIndex: squadPromptAssignments.orderIndex,
					squadId: squadPromptAssignments.squadId,
					squadName: squads.name
				})
				.from(squadPromptAssignments)
				.leftJoin(prompts, eq(squadPromptAssignments.promptId, prompts.id))
				.leftJoin(squads, eq(squadPromptAssignments.squadId, squads.id))
				.where(inArray(squadPromptAssignments.squadId, squadIds.map(s => s.squadId)))
				.orderBy(squadPromptAssignments.orderIndex);

			// Add squad prompts to map (only if not already present)
			squadPrompts.forEach(prompt => {
				if (prompt.id && !allPrompts.has(prompt.id)) {
					allPrompts.set(prompt.id, { ...prompt, source: 'squad', squadName: prompt.squadName });
				}
			});
		}

		// 3. Get global prompts (available to everyone based on isGlobal flag)
		const globalPrompts = await db
			.select({
				id: prompts.id,
				name: prompts.name,
				type: prompts.type,
				content: prompts.content,
				premade: prompts.premade,
				orderIndex: prompts.orderIndex
			})
			.from(prompts)
			.where(and(
				eq(prompts.projectId, role.projectId),
				eq(prompts.isGlobal, true)
			));

		// Add global prompts to map (global prompts are always included, regardless of other assignments)
		globalPrompts.forEach(prompt => {
			if (prompt.id) {
				allPrompts.set(prompt.id, { ...prompt, source: 'global' });
			}
		});

		// Check if there's a custom ordering for this role
		const customOrdering = await db
			.select({
				promptId: rolePromptOrders.promptId,
				orderIndex: rolePromptOrders.orderIndex
			})
			.from(rolePromptOrders)
			.where(eq(rolePromptOrders.roleId, roleId));

		let finalPromptsList;
		if (customOrdering.length > 0) {
			// Use custom ordering
			const orderMap = new Map(customOrdering.map(o => [o.promptId, o.orderIndex]));
			finalPromptsList = Array.from(allPrompts.values()).sort((a, b) => {
				const aOrder = orderMap.get(a.id) ?? 999; // Put unordered items at the end
				const bOrder = orderMap.get(b.id) ?? 999;
				return aOrder - bOrder;
			});
		} else {
			// Use default template ordering
			finalPromptsList = Array.from(allPrompts.values()).sort((a, b) => {
				// Sort by source priority: role > squad > global
				const sourcePriority = { role: 1, squad: 2, global: 3 };
				if (sourcePriority[a.source] !== sourcePriority[b.source]) {
					return sourcePriority[a.source] - sourcePriority[b.source];
				}
				// Within same source, sort by orderIndex
				return (a.orderIndex || 0) - (b.orderIndex || 0);
			});
		}

		// Process prompts and generate dynamic content for premade prompts
		const processedPrompts = await Promise.all(
			finalPromptsList.map(async (prompt) => {
				if (prompt.premade) {
					try {
						const dynamicContent = await generatePremadeContent(prompt.premade, {
							projectId: role.projectId,
							roleId: role.id,
							roleName: role.name
						});
						return {
							...prompt,
							content: dynamicContent,
							isPremade: true
						};
					} catch (error) {
						console.error(`Failed to generate premade content for ${prompt.premade}:`, error);
						return {
							...prompt,
							content: `[Error generating dynamic content: ${error.message}]`,
							isPremade: true
						};
					}
				}
				return {
					...prompt,
					isPremade: false
				};
			})
		);

		return json(processedPrompts);
	} catch (error) {
		console.error('Failed to fetch role prompts:', error);
		return json({ error: 'Failed to fetch role prompts' }, { status: 500 });
	}
}

export async function PUT({ params, request }) {
	try {
		const roleId = parseInt(params.id);
		const { prompts: reorderedPrompts } = await request.json();
		
		if (isNaN(roleId)) {
			return json({ error: 'Invalid role ID' }, { status: 400 });
		}

		// Clear existing custom ordering for this role
		await db
			.delete(rolePromptOrders)
			.where(eq(rolePromptOrders.roleId, roleId));

		// Save new custom ordering for all prompts
		for (let i = 0; i < reorderedPrompts.length; i++) {
			const prompt = reorderedPrompts[i];
			await db
				.insert(rolePromptOrders)
				.values({
					roleId: roleId,
					promptId: prompt.id,
					orderIndex: i,
					source: prompt.source
				});
		}

		// Get role information for premade prompt generation
		const [role] = await db
			.select({
				id: roles.id,
				name: roles.name,
				projectId: roles.projectId
			})
			.from(roles)
			.where(eq(roles.id, roleId))
			.limit(1);

		if (!role) {
			return json({ error: 'Role not found' }, { status: 404 });
		}

		// Get the reordered prompts with their IDs and content for role content generation
		const orderedPromptsData = await db
			.select({
				promptId: rolePromptOrders.promptId,
				orderIndex: rolePromptOrders.orderIndex,
				content: prompts.content,
				premade: prompts.premade
			})
			.from(rolePromptOrders)
			.leftJoin(prompts, eq(rolePromptOrders.promptId, prompts.id))
			.where(eq(rolePromptOrders.roleId, roleId))
			.orderBy(rolePromptOrders.orderIndex);

		// Create map of ordered prompt IDs for easy lookup
		const orderedPromptIds = new Set(orderedPromptsData.map(p => p.promptId));

		// Use only the prompts that have been explicitly ordered
		// The UI should include all prompts (role, squad, global) in the desired order
		const allPrompts = orderedPromptsData.map(p => ({ content: p.content, premade: p.premade }));

		// Process prompts and generate dynamic content for premade prompts
		const processedContents = await Promise.all(
			allPrompts.map(async (prompt) => {
				if (prompt.premade) {
					try {
						return await generatePremadeContent(prompt.premade, {
							projectId: role.projectId,
							roleId: role.id,
							roleName: role.name
						});
					} catch (error) {
						console.error(`Failed to generate premade content for ${prompt.premade}:`, error);
						return `[Error generating dynamic content: ${error.message}]`;
					}
				}
				return prompt.content;
			})
		);

		// Combine all prompt contents
		const combinedContent = processedContents.join('\n\n');

		// Update the role's content
		await db
			.update(roles)
			.set({ content: combinedContent })
			.where(eq(roles.id, roleId));

		return json({ success: true });
	} catch (error) {
		console.error('Failed to update prompt order:', error);
		return json({ error: 'Failed to update prompt order' }, { status: 500 });
	}
}