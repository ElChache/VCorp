import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { roles, rolePromptCompositions, prompts, squadRoleAssignments, squadPromptAssignments, rolePromptOrders } from '$lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { generatePremadeContent } from '$lib/premade-prompts';

// GET /api/roles/[roleId]/final-prompt - Get the complete final prompt for a role
export async function GET({ params }) {
	try {
		const roleId = parseInt(params.roleId);
		
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

		// Check if there's custom ordering for this role
		const customOrderedPrompts = await db
			.select({
				promptId: rolePromptOrders.promptId,
				orderIndex: rolePromptOrders.orderIndex,
				id: prompts.id,
				name: prompts.name,
				type: prompts.type,
				content: prompts.content,
				premade: prompts.premade
			})
			.from(rolePromptOrders)
			.leftJoin(prompts, eq(rolePromptOrders.promptId, prompts.id))
			.where(eq(rolePromptOrders.roleId, roleId))
			.orderBy(rolePromptOrders.orderIndex);

		let finalPromptsList;

		if (customOrderedPrompts.length > 0) {
			// Use custom ordering
			finalPromptsList = customOrderedPrompts;
		} else {
			// Fall back to default ordering logic
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
						orderIndex: squadPromptAssignments.orderIndex
					})
					.from(squadPromptAssignments)
					.leftJoin(prompts, eq(squadPromptAssignments.promptId, prompts.id))
					.where(inArray(squadPromptAssignments.squadId, squadIds.map(s => s.squadId)))
					.orderBy(squadPromptAssignments.orderIndex);

				// Add squad prompts to map (only if not already present)
				squadPrompts.forEach(prompt => {
					if (prompt.id && !allPrompts.has(prompt.id)) {
						allPrompts.set(prompt.id, { ...prompt, source: 'squad' });
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

			// Add global prompts to map (global prompts are always included)
			globalPrompts.forEach(prompt => {
				if (prompt.id) {
					allPrompts.set(prompt.id, { ...prompt, source: 'global' });
				}
			});

			// Convert map back to array and sort by source priority and order
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

		// Process each prompt and generate dynamic content for premade ones
		const processedContents = await Promise.all(
			finalPromptsList.map(async (prompt) => {
				if (prompt.premade) {
					try {
						const dynamicContent = await generatePremadeContent(prompt.premade, {
							projectId: role.projectId,
							roleId: role.id,
							roleName: role.name
						});
						return dynamicContent;
					} catch (error) {
						console.error(`Failed to generate premade content for ${prompt.premade}:`, error);
						return `[Error generating dynamic content for ${prompt.name}: ${error.message}]`;
					}
				}
				return prompt.content;
			})
		);

		// Combine all prompt contents into final prompt
		const finalPrompt = processedContents.join('\n\n---\n\n');

		return json({
			roleId: role.id,
			roleName: role.name,
			projectId: role.projectId,
			finalPrompt: finalPrompt,
			promptCount: finalPromptsList.length,
			promptSources: {
				role: finalPromptsList.filter(p => p.source === 'role').length,
				squad: finalPromptsList.filter(p => p.source === 'squad').length,
				global: finalPromptsList.filter(p => p.source === 'global').length
			},
			generatedAt: new Date().toISOString()
		});

	} catch (error) {
		console.error('Failed to generate final prompt:', error);
		return json({ error: 'Failed to generate final prompt' }, { status: 500 });
	}
}