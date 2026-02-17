CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"importance" integer DEFAULT 5 NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_conversation_id" text,
	"last_accessed_at" timestamp DEFAULT now(),
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memories_user_id_idx" ON "memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memories_category_idx" ON "memories" USING btree ("category");--> statement-breakpoint
CREATE INDEX "memories_importance_idx" ON "memories" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "memories_created_at_idx" ON "memories" USING btree ("created_at");