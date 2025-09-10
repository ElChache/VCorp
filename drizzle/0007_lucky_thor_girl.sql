ALTER TABLE "agents" ALTER COLUMN "role_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "status" SET DEFAULT 'launching';--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "role_type" text NOT NULL;