import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { content, agents } from '$lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

// Permission check functions
function checkMessageDeletePermission(agent: any, message: any): boolean {
  // Author can delete their own messages
  if (message.authorAgentId === agent.id) return true;
  
  // Leadership roles can delete any message
  if (['product-manager', 'lead-developer', 'system-architect', 'it-administrator'].includes(agent.roleType)) return true;
  
  // Human director can delete any message
  if (agent.isHumanDirector) return true;
  
  return false;
}

// GET - Retrieve message by ID
export const GET: RequestHandler = async ({ params }) => {
  try {
    const messageId = parseInt(params.id as string);
    if (isNaN(messageId)) {
      return json({ error: 'Invalid message ID' }, { status: 400 });
    }

    const [message] = await db
      .select()
      .from(content)
      .where(and(
        eq(content.id, messageId),
        eq(content.type, 'message')
      ))
      .limit(1);

    if (!message) {
      return json({ error: 'Message not found' }, { status: 404 });
    }

    return json(message);
  } catch (error: unknown) {
    console.error('Error fetching message:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// DELETE - Delete message (soft delete by default)
export const DELETE: RequestHandler = async ({ params, request }) => {
  try {
    const messageId = parseInt(params.id as string);
    if (isNaN(messageId)) {
      return json({ error: 'Invalid message ID' }, { status: 400 });
    }

    // Get agent from header
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return json({ error: 'Missing X-Agent-ID header' }, { status: 400 });
    }

    // Get agent information
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get message
    const [message] = await db
      .select()
      .from(content)
      .where(and(
        eq(content.id, messageId),
        eq(content.type, 'message')
      ))
      .limit(1);

    if (!message) {
      return json({ error: 'Message not found' }, { status: 404 });
    }

    // Check permissions
    const canDelete = checkMessageDeletePermission(agent, message);
    if (!canDelete) {
      return json({ 
        error: 'Permission denied - only message author, leadership roles, and human director can delete messages' 
      }, { status: 403 });
    }

    // Check for hard delete flag
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Hard delete - completely remove from database
      await db
        .delete(content)
        .where(eq(content.id, messageId));

      return json({
        success: true,
        message: 'Message permanently deleted'
      });
    } else {
      // Soft delete - mark as deleted but keep in database
      await db
        .update(content)
        .set({
          title: `[DELETED] ${message.title || 'Message'}`,
          body: '[This message has been deleted]',
          updatedAt: new Date()
        })
        .where(eq(content.id, messageId));

      return json({
        success: true,
        message: 'Message deleted (soft delete)'
      });
    }

  } catch (error: unknown) {
    console.error('Error deleting message:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};