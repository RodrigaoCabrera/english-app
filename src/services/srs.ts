import { and, count, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { userWords, wordsCache } from "@/db/schema";
import { schedule, type Grade } from "@/lib/sm2";

// definition/translation/imageHash are null when the word is not yet in
// words_cache (the leftJoin produced no row) — not a schema violation.
export interface DueWord {
  word: string;
  level: string;
  dueDate: Date;
  definition: string | null;
  translation: string | null;
  imageHash: string | null;
}

const DEFAULT_DUE_LIMIT = 50;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** Idempotently add a word to the user's review queue. Re-saving never resets scheduling. */
export async function enqueueWord(userId: string, word: string, level: string): Promise<void> {
  await db
    .insert(userWords)
    .values({ userId, word, level })
    .onConflictDoNothing({ target: [userWords.userId, userWords.word] });
}

/**
 * Apply a grade to a queued word. Returns false when the word is not in the
 * user's queue (ownership / not found), true on success.
 */
export async function gradeWord(userId: string, word: string, grade: Grade): Promise<boolean> {
  // Transaction + row lock: a concurrent grade of the same word (double-submit
  // or network retry) blocks on the locked row instead of losing the update.
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(userWords)
      .where(and(eq(userWords.userId, userId), eq(userWords.word, word)))
      .for("update")
      .limit(1);

    const row = rows[0];
    if (!row) return false;

    const next = schedule(
      { easeFactor: row.easeFactor, intervalDays: row.intervalDays, repetitions: row.repetitions },
      grade
    );
    const dueDate = addDays(startOfUtcDay(new Date()), next.intervalDays);

    await tx
      .update(userWords)
      .set({
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        dueDate,
        reviewCount: row.reviewCount + 1,
        lastReviewedAt: new Date(),
        lastGrade: grade,
      })
      .where(eq(userWords.id, row.id));

    return true;
  });
}

/** Words due now (dueDate <= now), oldest-due first, joined to words_cache content. */
export async function getDueWords(userId: string, limit = DEFAULT_DUE_LIMIT): Promise<DueWord[]> {
  return db
    .select({
      word: userWords.word,
      level: userWords.level,
      dueDate: userWords.dueDate,
      definition: wordsCache.definition,
      translation: wordsCache.translation,
      imageHash: wordsCache.imageHash,
    })
    .from(userWords)
    .leftJoin(wordsCache, eq(userWords.word, wordsCache.word))
    .where(and(eq(userWords.userId, userId), lte(userWords.dueDate, new Date())))
    .orderBy(userWords.dueDate)
    .limit(limit);
}

/** Count of words due now, for the dashboard badge (Part 2). */
export async function getDueCount(userId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(userWords)
    .where(and(eq(userWords.userId, userId), lte(userWords.dueDate, new Date())));
  return Number(rows[0]?.value ?? 0);
}
