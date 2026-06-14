CREATE TABLE "user_profiles" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"cefr_level" text DEFAULT 'B1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_attempts" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_words" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "reading_attempts_user_id_idx" ON "reading_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "readings_user_id_idx" ON "readings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_words_user_id_idx" ON "saved_words" USING btree ("user_id");