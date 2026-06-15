CREATE TABLE "user_words" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"word" text NOT NULL,
	"level" text NOT NULL,
	"ease_factor" integer DEFAULT 250 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp DEFAULT now() NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp,
	"last_grade" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_words_user_word_idx" ON "user_words" USING btree ("user_id","word");--> statement-breakpoint
CREATE INDEX "user_words_due_idx" ON "user_words" USING btree ("user_id","due_date");