import { json } from '@sveltejs/kit';
import { db } from '$lib/db/index.js';
import { readingAssignments, readingAssignmentReads, agents } from '$lib/db/schema.js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types.js';

// GET - Retrieve reading assignment by ID
export const GET: RequestHandler = async ({ params }) => {
  try {
    const assignmentId = parseInt(params.id as string);
    if (isNaN(assignmentId)) {
      return json({ error: 'Invalid reading assignment ID' }, { status: 400 });
    }

    const [assignment] = await db
      .select()
      .from(readingAssignments)
      .where(eq(readingAssignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return json({ error: 'Reading assignment not found' }, { status: 404 });
    }

    // Get reads for this assignment
    const reads = await db
      .select()
      .from(readingAssignmentReads)
      .where(eq(readingAssignmentReads.readingAssignmentId, assignmentId));

    return json({
      ...assignment,
      reads
    });
  } catch (error: unknown) {
    console.error('Error fetching reading assignment:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

// DELETE - Delete reading assignment
export const DELETE: RequestHandler = async ({ params, request }) => {
  try {
    const assignmentId = parseInt(params.id as string);
    if (isNaN(assignmentId)) {
      return json({ error: 'Invalid reading assignment ID' }, { status: 400 });
    }

    // Get agent from header for permission check
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

    // Get the reading assignment
    const [assignment] = await db
      .select()
      .from(readingAssignments)
      .where(eq(readingAssignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return json({ error: 'Reading assignment not found' }, { status: 404 });
    }

    // Check permissions - only leadership roles and human director can delete reading assignments
    const canDelete = 
      ['product-manager', 'lead-developer', 'system-architect', 'it-administrator'].includes(agent.roleType) ||
      agent.isHumanDirector;

    if (!canDelete) {
      return json({ 
        error: 'Permission denied - only leadership roles and human director can delete reading assignments' 
      }, { status: 403 });
    }

    // Delete related reads first
    await db
      .delete(readingAssignmentReads)
      .where(eq(readingAssignmentReads.readingAssignmentId, assignmentId));

    // Delete the reading assignment
    await db
      .delete(readingAssignments)
      .where(eq(readingAssignments.id, assignmentId));

    return json({
      success: true,
      message: 'Reading assignment deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting reading assignment:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};