CREATE TABLE "images_cache" (
	"hash" text PRIMARY KEY NOT NULL,
	"prompt" text NOT NULL,
	"file_path" text NOT NULL,
	"mime" text DEFAULT 'image/png' NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"reading_id" integer NOT NULL,
	"audio_path" text,
	"transcript" text,
	"score" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"topic" text NOT NULL,
	"body_md" text NOT NULL,
	"word_list" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "words_cache" (
	"word" text PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"definition" text NOT NULL,
	"example" text NOT NULL,
	"image_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_attempts" ADD CONSTRAINT "reading_attempts_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."readings"("id") ON DELETE no action ON UPDATE no action;