-- Remove foreign key constraint on author_agent_id to allow 'human-director' as special identifier
ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "content_author_agent_id_agents_id_fk";