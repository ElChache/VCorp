import { json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db/index';
import { content, readingAssignments, readingAssignmentReads, agents, channels } from '$lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';

// POST /api/channels/[id]/archive - Archive first N messages from a channel to a markdown document
export async function POST({ params, request }: RequestEvent) {
	try {
		if (!params.id) {
			return json({ error: 'Channel ID is required' }, { status: 400 });
		}
		
		const channelId = parseInt(params.id || '');
		
		if (!channelId || channelId <= 0) {
			return json({ 
				error: 'Invalid channel ID: must be a positive integer to archive messages from that channel'
			}, { status: 400 });
		}

		const body = await request.json();
		const { 
			count = 50, 
			authorAgentId = 'human-director',
			projectId
		} = body;

		if (!projectId) {
			return json({ 
				error: 'Missing required field: projectId must be provided'
			}, { status: 400 });
		}

		// Validate projectId is a valid number
		const parsedProjectId = parseInt(projectId);
		if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
			return json({ 
				error: 'Invalid projectId: must be a positive integer'
			}, { status: 400 });
		}

		// Validate count
		const parsedCount = parseInt(count);
		if (isNaN(parsedCount) || parsedCount <= 0 || parsedCount > 500) {
			return json({ 
				error: 'Invalid count: must be a positive integer between 1 and 500'
			}, { status: 400 });
		}

		// Validate channel exists and belongs to project
		const [channel] = await db
			.select({ 
				id: channels.id, 
				projectId: channels.projectId,
				name: channels.name 
			})
			.from(channels)
			.where(eq(channels.id, channelId))
			.limit(1);
		
		if (!channel) {
			return json({ 
				error: `Channel with ID ${channelId} not found`
			}, { status: 404 });
		}

		if (channel.projectId !== parsedProjectId) {
			return json({ 
				error: `Channel ${channelId} does not belong to project ${parsedProjectId}`
			}, { status: 403 });
		}

		// Get the first N messages from the channel (oldest first)
		const messagesToArchive = await db
			.select({
				id: content.id,
				type: content.type,
				title: content.title,
				body: content.body,
				authorAgentId: content.authorAgentId,
				parentContentId: content.parentContentId,
				createdAt: content.createdAt,
				updatedAt: content.updatedAt,
			})
			.from(content)
			.where(eq(content.channelId, channelId))
			.orderBy(content.createdAt)
			.limit(parsedCount);

		if (messagesToArchive.length === 0) {
			return json({ 
				error: 'No messages found to archive in this channel'
			}, { status: 404 });
		}

		// Get agent names for better readability in archive
		const agentIds = [...new Set(messagesToArchive
			.map(msg => msg.authorAgentId)
			.filter(id => id && id !== 'human-director')
		)];

		const agentNames: Record<string, string> = {};
		if (agentIds.length > 0) {
			const agentsData = await db
				.select({ 
					id: agents.id, 
					roleType: agents.roleType 
				})
				.from(agents)
				.where(sql`${agents.id} IN (${sql.join(agentIds.map(id => sql`${id}`), sql`, `)})`);
			
			agentsData.forEach(agent => {
				agentNames[agent.id] = agent.roleType;
			});
		}

		// Format messages as markdown
		const formatDate = (date: string | Date) => {
			return new Date(date).toLocaleString();
		};

		const getAuthorName = (authorAgentId: string | null) => {
			if (!authorAgentId) return 'System';
			if (authorAgentId === 'human-director') return 'Human Director';
			return agentNames[authorAgentId] || authorAgentId;
		};

		const markdownContent = messagesToArchive.map((msg, index) => {
			const authorName = getAuthorName(msg.authorAgentId);
			const timestamp = formatDate(msg.createdAt);
			
			let markdown = `## Message ${index + 1}\n\n`;
			markdown += `**From:** ${authorName}\n`;
			markdown += `**Date:** ${timestamp}\n`;
			if (msg.title) {
				markdown += `**Subject:** ${msg.title}\n`;
			}
			markdown += `**Type:** ${msg.type}\n\n`;
			markdown += `${msg.body}\n\n`;
			
			if (msg.parentContentId) {
				markdown += `*Reply to message ID: ${msg.parentContentId}*\n\n`;
			}
			
			markdown += '---\n\n';
			return markdown;
		}).join('');

		const archiveTitle = `Channel Archive: ${channel.name} (${messagesToArchive.length} messages)`;
		const archiveBody = `# ${archiveTitle}

**Archive created:** ${new Date().toLocaleString()}
**Original channel:** ${channel.name} (ID: ${channelId})
**Messages archived:** ${messagesToArchive.length}
**Date range:** ${formatDate(messagesToArchive[0].createdAt)} to ${formatDate(messagesToArchive[messagesToArchive.length - 1].createdAt)}

---

${markdownContent}`;

		// Create archive document
		const [archiveDocument] = await db
			.insert(content)
			.values({
				projectId: parsedProjectId,
				channelId: null, // Documents are not posted to channels
				parentContentId: null,
				type: 'document',
				title: archiveTitle,
				body: archiveBody,
				documentSlug: `channel-${channelId}-archive-${Date.now()}`,
				authorAgentId: authorAgentId,
			})
			.returning();

		// Create reading assignment for human director
		await db
			.insert(readingAssignments)
			.values({
				contentId: archiveDocument.id,
				assignedToType: 'role',
				assignedTo: 'Human Director',
			});

		// Delete the original messages and their reading assignments
		const messageIds = messagesToArchive.map(msg => msg.id);
		
		// Delete reading assignment reads first (foreign key constraint)
		if (messageIds.length > 0) {
			const assignmentIds = await db
				.select({ id: readingAssignments.id })
				.from(readingAssignments)
				.where(sql`${readingAssignments.contentId} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`);

			if (assignmentIds.length > 0) {
				await db
					.delete(readingAssignmentReads)
					.where(sql`${readingAssignmentReads.readingAssignmentId} IN (${sql.join(assignmentIds.map(a => sql`${a.id}`), sql`, `)})`);
			}

			// Delete reading assignments
			await db
				.delete(readingAssignments)
				.where(sql`${readingAssignments.contentId} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`);

			// Delete the messages
			await db
				.delete(content)
				.where(sql`${content.id} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`);
		}

		return json({
			success: true,
			archiveDocument: {
				id: archiveDocument.id,
				title: archiveDocument.title,
				documentSlug: archiveDocument.documentSlug,
				createdAt: archiveDocument.createdAt
			},
			messagesArchived: messagesToArchive.length,
			messageIds: messageIds,
			channel: {
				id: channelId,
				name: channel.name
			}
		}, { status: 201 });

	} catch (error: unknown) {
		console.error('Failed to archive channel messages:', error);
		
		// Provide more specific error messages based on the error type
		if ((error as any).code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || (error as any).code === '23503') {
			return json({ 
				error: 'Database constraint violation: One or more referenced entities may not exist or may be invalid'
			}, { status: 400 });
		}
		
		if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE' || (error as any).code === '23505') {
			return json({ 
				error: 'Constraint violation: Archive document slug may already exist'
			}, { status: 409 });
		}
		
		return json({ 
			error: 'Internal server error occurred while archiving messages',
			details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
		}, { status: 500 });
	}
}