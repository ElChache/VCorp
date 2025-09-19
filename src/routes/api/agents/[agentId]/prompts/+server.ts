import { json, type RequestHandler } from '@sveltejs/kit';
import pg from 'pg';

const { Pool } = pg;

// GET /api/agents/[agentId]/prompts - Get all prompts for this agent
export const GET: RequestHandler = async ({ params }) => {
	const pool = new Pool({
		host: 'localhost',
		port: 5433,
		user: 'postgres',
		password: 'password',
		database: 'vcorp',
		ssl: false,
	});

	try {
		const agentId = params.agentId;

		// Get agent with role and squad information
		const agentResult = await pool.query(`
			SELECT 
				id, 
				role_id as "roleId", 
				squad_id as "squadId", 
				project_id as "projectId", 
				role_type as "roleType"
			FROM agents 
			WHERE id = $1
		`, [agentId]);

		const agent = agentResult.rows[0];

		if (!agent) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		console.log(`📋 Loading prompts for agent ${agentId} (role: ${agent.roleType}, squad: ${agent.squadId})`);

		// Get all prompts for this agent based on role prompt orders
		let agentPrompts = [];
		
		if (agent.roleId) {
			console.log('Getting role-specific prompts for roleId:', agent.roleId);
			// Get role-specific prompts in order
			const promptsResult = await pool.query(`
				SELECT 
					p.id,
					p.name,
					p.type,
					p.content,
					rpo.order_index as "orderIndex",
					rpo.source,
					p.is_global as "isGlobal"
				FROM role_prompt_orders rpo
				INNER JOIN prompts p ON rpo.prompt_id = p.id
				WHERE rpo.role_id = $1
				ORDER BY rpo.order_index
			`, [agent.roleId]);
			
			agentPrompts = promptsResult.rows;
		}

		// If no role-specific prompts, get role prompt for this agent's role type
		if (agentPrompts.length === 0) {
			console.log('No role-specific prompt orders, getting role prompts for:', agent.roleType);
			const promptsResult = await pool.query(`
				SELECT 
					id,
					name,
					type,
					content,
					order_index as "orderIndex",
					'role' as source,
					is_global as "isGlobal",
					is_role_prompt as "isRolePrompt"
				FROM prompts
				WHERE project_id = $1 
				AND is_role_prompt = true
				AND type = 'role_description'
				AND LOWER(name) LIKE '%' || REPLACE($2, '-', ' ') || '%'
				ORDER BY order_index
			`, [agent.projectId, agent.roleType]);
			
			agentPrompts = promptsResult.rows;
			
			console.log(`✅ Found ${agentPrompts.length} role prompts for ${agent.roleType}`);
			if (agentPrompts.length > 0) {
				console.log('Using role prompt:', agentPrompts[0].name);
			}
		}

		console.log(`✅ Loaded ${agentPrompts.length} prompts for agent ${agentId}`);

		return json({
			agentId,
			roleType: agent.roleType,
			squadId: agent.squadId,
			prompts: agentPrompts,
			summary: {
				total: agentPrompts.length,
				bySource: agentPrompts.reduce((acc, p) => {
					acc[p.source] = (acc[p.source] || 0) + 1;
					return acc;
				}, {}),
				byType: agentPrompts.reduce((acc, p) => {
					acc[p.type] = (acc[p.type] || 0) + 1;
					return acc;
				}, {})
			}
		});

	} catch (error: unknown) {
		console.error('Failed to load agent prompts:', error);
		console.error('Error stack:', (error as Error).stack);
		console.error('Error details:', JSON.stringify(error, null, 2));
		return json({ 
			error: 'Failed to load agent prompts',
			details: (error as Error).message,
			stack: (error as Error).stack
		}, { status: 500 });
	} finally {
		await pool.end();
	}
}