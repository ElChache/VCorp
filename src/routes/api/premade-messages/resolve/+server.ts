import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { PremadeMessagesService } from '$lib/services/premadeMessagesService.js';

const premadeMessagesService = new PremadeMessagesService();

// POST - Resolve a template with variables (preview without saving)
export const POST: RequestHandler = async ({ request }) => {
  try {
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return json({ error: 'Missing X-Agent-ID header' }, { status: 400 });
    }

    const { templateId, projectId, customVariables } = await request.json();
    
    if (!templateId || !projectId) {
      return json({ 
        error: 'Missing required fields: templateId, projectId' 
      }, { status: 400 });
    }

    const resolved = await premadeMessagesService.resolveTemplate(
      templateId,
      agentId,
      projectId,
      customVariables
    );

    return json({ 
      success: true, 
      resolvedContent: resolved.content,
      context: resolved.context,
      variables: resolved.variables
    });
  } catch (error: any) {
    console.error('Error resolving premade message template:', error);
    return json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
};