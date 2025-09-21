ALTER TABLE "agents" ADD COLUMN "context_message_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "context_percentage" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "context_status" text DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "context_has_warning" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "context_last_checked" timestamp;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "context_session_file" text;