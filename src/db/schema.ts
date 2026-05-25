import { pgTable, text, jsonb, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  level: text("level").notNull(),
  topic: text("topic").notNull(),
  bodyMd: text("body_md").notNull(),
  wordList: jsonb("word_list").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wordsCache = pgTable("words_cache", {
  word: text("word").primaryKey(),
  level: text("level").notNull(),
  definition: text("definition").notNull(),
  example: text("example").notNull(),
  imageHash: text("image_hash"),
  translation: text("translation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const imagesCache = pgTable("images_cache", {
  hash: text("hash").primaryKey(),
  prompt: text("prompt").notNull(),
  filePath: text("file_path").notNull(),
  mime: text("mime").notNull().default("image/png"),
  bytes: integer("bytes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const readingAttempts = pgTable("reading_attempts", {
  id: serial("id").primaryKey(),
  readingId: integer("reading_id")
    .notNull()
    .references(() => readings.id),
  audioPath: text("audio_path"),
  transcript: text("transcript"),
  score: jsonb("score").$type<{
    accuracyScore: number;
    fluencyScore: number;
    completenessScore: number;
    words: Array<{ word: string; accuracyScore: number; errorType: string }>;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedWords = pgTable("saved_words", {
  id: serial("id").primaryKey(),
  word: text("word").notNull(),
  level: text("level").notNull(),
  translation: text("translation"),
  definition: text("definition"),
  imageHash: text("image_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
