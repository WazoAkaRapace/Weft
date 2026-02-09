CREATE TABLE "daily_moods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"mood" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_moods_user_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "daily_moods" ADD CONSTRAINT "daily_moods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_moods_user_id_idx" ON "daily_moods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_moods_date_idx" ON "daily_moods" USING btree ("date");--> statement-breakpoint
CREATE INDEX "daily_moods_user_date_idx" ON "daily_moods" USING btree ("user_id","date");