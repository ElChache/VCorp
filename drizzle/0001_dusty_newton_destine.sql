ALTER TABLE "agents" ADD COLUMN "can_create_phases" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "role_templates" ADD COLUMN "can_create_phases" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "can_create_phases" boolean DEFAULT false NOT NULL;