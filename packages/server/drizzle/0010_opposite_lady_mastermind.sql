ALTER TABLE "daily_moods" DROP CONSTRAINT "daily_moods_user_date_unique";--> statement-breakpoint
ALTER TABLE "daily_moods" ADD COLUMN "time_of_day" text NOT NULL DEFAULT 'morning';--> statement-breakpoint
CREATE INDEX "daily_moods_user_date_time_idx" ON "daily_moods" USING btree ("user_id","date","time_of_day");--> statement-breakpoint
ALTER TABLE "daily_moods" ADD CONSTRAINT "daily_moods_user_date_time_unique" UNIQUE("user_id","date","time_of_day");