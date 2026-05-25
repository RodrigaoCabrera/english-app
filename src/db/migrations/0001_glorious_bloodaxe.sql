CREATE TABLE "saved_words" (
	"id" serial PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"level" text NOT NULL,
	"translation" text,
	"definition" text,
	"image_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "words_cache" ADD COLUMN "translation" text;