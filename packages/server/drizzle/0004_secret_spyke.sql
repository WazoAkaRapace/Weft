ALTER TABLE "journals" ADD COLUMN "dominant_emotion" text;--> statement-breakpoint
ALTER TABLE "journals" ADD COLUMN "emotion_timeline" jsonb;--> statement-breakpoint
ALTER TABLE "journals" ADD COLUMN "emotion_scores" jsonb;--> statement-breakpoint
CREATE INDEX "journals_dominant_emotion_idx" ON "journals" USING btree ("dominant_emotion");