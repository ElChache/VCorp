ALTER TABLE "prompt_templates" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "role_templates" ADD COLUMN "is_assistant_to_human_director" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_assistant_to_human_director" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "squad_role_assignment_templates" ADD CONSTRAINT "squad_role_assignment_templates_squad_template_id_role_template_id_unique" UNIQUE("squad_template_id","role_template_id");