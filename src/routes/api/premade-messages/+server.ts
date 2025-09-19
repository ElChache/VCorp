import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import pg from 'pg';

const { Pool } = pg;

// GET - Get available templates for an agent
export const GET: RequestHandler = async ({ url, request }) => {
	const pool = new Pool({
		host: 'localhost',
		port: 5433,
		user: 'postgres',
		password: 'password',
		database: 'vcorp',
		ssl: false,
	});

	try {
		const agentId = request.headers.get('x-agent-id');
		const projectId = url.searchParams.get('projectId');
		const roleType = url.searchParams.get('roleType');
		
		if (!agentId || !projectId || !roleType) {
			return json({ 
				error: 'Missing required parameters: agentId (header), projectId, roleType' 
			}, { status: 400 });
		}

		console.log(`📧 Loading premade templates for project ${projectId}, role ${roleType}, agent ${agentId}`);

		// Get premade message templates
		const templatesResult = await pool.query(`
			SELECT 
				id,
				name,
				category,
				content
			FROM premade_message_templates
			WHERE is_active = true
			ORDER BY name
		`);

		const templates = templatesResult.rows.map((template: any) => ({
			id: template.id,
			name: template.name,
			category: template.category
		}));

		console.log(`✅ Found ${templates.length} premade templates`);

		return json({ templates });
	} catch (error: any) {
		console.error('Error fetching premade message templates:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	} finally {
		await pool.end();
	}
};

// POST - Create a premade message from template
export const POST: RequestHandler = async ({ request }) => {
	const pool = new Pool({
		host: 'localhost',
		port: 5433,
		user: 'postgres',
		password: 'password',
		database: 'vcorp',
		ssl: false,
	});

	try {
		const agentId = request.headers.get('x-agent-id');
		if (!agentId) {
			return json({ error: 'Missing X-Agent-ID header' }, { status: 400 });
		}

		const { templateId, projectId } = await request.json();
		
		if (!templateId || !projectId) {
			return json({ 
				error: 'Missing required fields: templateId, projectId' 
			}, { status: 400 });
		}

		console.log(`📧 Resolving template ${templateId} for project ${projectId}, agent ${agentId}`);

		// Get the template content
		const templateResult = await pool.query(`
			SELECT content
			FROM premade_message_templates
			WHERE id = $1 AND is_active = true
		`, [templateId]);

		if (templateResult.rows.length === 0) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		const content = templateResult.rows[0].content;

		console.log(`✅ Resolved template ${templateId}`);

		return json({
			success: true,
			content,
			templateId,
			projectId
		});
	} catch (error: any) {
		console.error('Error creating premade message:', error);
		return json({ 
			error: error.message || 'Internal server error' 
		}, { status: 500 });
	} finally {
		await pool.end();
	}
};