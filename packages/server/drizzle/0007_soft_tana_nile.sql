ALTER TABLE "journals" ADD COLUMN "hls_manifest_path" text;--> statement-breakpoint
ALTER TABLE "journals" ADD COLUMN "hls_status" text;--> statement-breakpoint
ALTER TABLE "journals" ADD COLUMN "hls_error" text;--> statement-breakpoint
ALTER TABLE "journals" ADD COLUMN "hls_created_at" timestamp;