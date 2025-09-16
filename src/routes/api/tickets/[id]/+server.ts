import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { content, agents } from '$lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

// Permission check functions
function checkTicketUpdatePermission(agent: any, ticket: any): boolean {
  // Author can update
  if (ticket.authorAgentId === agent.id) return true;
  
  // Assigned agent can update  
  if (ticket.claimedByAgent === agent.id) return true;
  
  // Lead roles can update any ticket
  if (['product-manager', 'lead-developer', 'system-architect'].includes(agent.roleType)) return true;
  
  return false;
}

function checkTicketDeletePermission(agent: any, ticket: any): boolean {
  // More restrictive for deletion - only author and product-manager can delete
  if (ticket.authorAgentId === agent.id) return true;
  if (agent.roleType === 'product-manager') return true;
  
  return false;
}

// GET - Retrieve ticket by ID
export const GET: RequestHandler = async ({ params }) => {
  try {
    const ticketId = parseInt(params.id as string);
    if (isNaN(ticketId)) {
      return json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    const ticket = await db
      .select()
      .from(content)
      .where(and(
        eq(content.id, ticketId),
        eq(content.type, 'ticket')
      ))
      .limit(1);

    if (ticket.length === 0) {
      return json({ error: 'Ticket not found' }, { status: 404 });
    }

    return json(ticket[0]);
  } catch (error: unknown) {
    console.error('Error fetching ticket:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// PUT - Update ticket
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const ticketId = parseInt(params.id as string);
    if (isNaN(ticketId)) {
      return json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    // Get agent from header
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return json({ error: 'Missing X-Agent-ID header' }, { status: 400 });
    }

    // Get agent information
    const agentResult = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agentResult.length === 0) {
      return json({ error: 'Agent not found' }, { status: 404 });
    }

    const agent = agentResult[0];

    // Get ticket
    const ticketResult = await db
      .select()
      .from(content)
      .where(and(
        eq(content.id, ticketId),
        eq(content.type, 'ticket')
      ))
      .limit(1);

    if (ticketResult.length === 0) {
      return json({ error: 'Ticket not found' }, { status: 404 });
    }

    const ticket = ticketResult[0];

    // Check permissions
    const canUpdate = checkTicketUpdatePermission(agent, ticket);
    if (!canUpdate) {
      return json({ 
        error: 'Permission denied - only ticket author, assigned agent, and leadership roles can update tickets' 
      }, { status: 403 });
    }

    // Parse request body
    const updateData = await request.json();
    const { title, body: contentBody, status, priority, assignedToRoleType, claimedByAgent } = updateData;

    if (!title && !contentBody && !status && !priority && assignedToRoleType === undefined && claimedByAgent === undefined) {
      return json({ error: 'Must provide at least one field to update' }, { status: 400 });
    }

    // Validate status values
    const validStatuses = ['open', 'in_progress', 'blocked', 'ready_for_review', 'reviewing', 'review_passed', 'needs_attention', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Validate priority values
    const validPriorities = ['low', 'medium', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      return json({ error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` }, { status: 400 });
    }

    // Build update fields
    const updateFields: any = {
      updatedAt: new Date()
    };

    if (title) updateFields.title = title;
    if (contentBody) updateFields.body = contentBody;
    if (status) updateFields.status = status;
    if (priority) updateFields.priority = priority;
    if (assignedToRoleType !== undefined) updateFields.assignedToRoleType = assignedToRoleType;
    if (claimedByAgent !== undefined) updateFields.claimedByAgent = claimedByAgent;

    // Update ticket
    const updatedTicket = await db
      .update(content)
      .set(updateFields)
      .where(eq(content.id, ticketId))
      .returning();

    return json({
      success: true,
      ticket: updatedTicket[0],
      message: 'Ticket updated successfully'
    });

  } catch (error) {
    console.error('Error updating ticket:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// DELETE - Delete ticket (soft delete by default)
export const DELETE: RequestHandler = async ({ params, request }) => {
  try {
    const ticketId = parseInt(params.id as string);
    if (isNaN(ticketId)) {
      return json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    // Get agent from header
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return json({ error: 'Missing X-Agent-ID header' }, { status: 400 });
    }

    // Get agent information
    const agentResult = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agentResult.length === 0) {
      return json({ error: 'Agent not found' }, { status: 404 });
    }

    const agent = agentResult[0];

    // Get ticket
    const ticketResult = await db
      .select()
      .from(content)
      .where(and(
        eq(content.id, ticketId),
        eq(content.type, 'ticket')
      ))
      .limit(1);

    if (ticketResult.length === 0) {
      return json({ error: 'Ticket not found' }, { status: 404 });
    }

    const ticket = ticketResult[0];

    // Check permissions
    const canDelete = checkTicketDeletePermission(agent, ticket);
    if (!canDelete) {
      return json({ 
        error: 'Permission denied - only ticket author and product manager can delete tickets' 
      }, { status: 403 });
    }

    // Check for hard delete flag
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Hard delete - completely remove from database
      await db
        .delete(content)
        .where(eq(content.id, ticketId));

      return json({
        success: true,
        message: 'Ticket permanently deleted'
      });
    } else {
      // Soft delete - mark status as closed and update title
      await db
        .update(content)
        .set({
          title: `[DELETED] ${ticket.title}`,
          body: '[This ticket has been deleted]',
          status: 'closed',
          updatedAt: new Date()
        })
        .where(eq(content.id, ticketId));

      return json({
        success: true,
        message: 'Ticket deleted (soft delete - status set to closed)'
      });
    }

  } catch (error) {
    console.error('Error deleting ticket:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};