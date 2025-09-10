-- Add prefix column as nullable first
ALTER TABLE "role_templates" ADD COLUMN "prefix" text;

-- Update existing role templates with default prefixes based on their names
UPDATE "role_templates" SET "prefix" = 'be' WHERE "name" = 'Backend Developer';
UPDATE "role_templates" SET "prefix" = 'fe' WHERE "name" = 'Frontend Developer'; 
UPDATE "role_templates" SET "prefix" = 'pm' WHERE "name" = 'Product Manager';
UPDATE "role_templates" SET "prefix" = 'qa' WHERE "name" = 'QA Engineer';
UPDATE "role_templates" SET "prefix" = 'do' WHERE "name" = 'DevOps Engineer';
UPDATE "role_templates" SET "prefix" = 'ai' WHERE "name" = 'AI Developer';
UPDATE "role_templates" SET "prefix" = 'ux' WHERE "name" = 'UX Designer';

-- For any other roles not covered above, set a generic prefix
UPDATE "role_templates" SET "prefix" = 'ag' WHERE "prefix" IS NULL;

-- Now make the column NOT NULL
ALTER TABLE "role_templates" ALTER COLUMN "prefix" SET NOT NULL;