ALTER TABLE "role_templates" ADD COLUMN "permissions" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "permissions" text;