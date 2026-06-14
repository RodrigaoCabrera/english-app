import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { readings, savedWords, readingAttempts } from "@/db/schema";

const TREND_LIMIT = 10;
const RECENT_LIMIT = 5;

export interface DashboardStats {
  readingsCount: number;
  savedWordsCount: number;
  avgAccuracyScore: number | null;
}

export interface TrendPoint {
  attemptId: number;
  readingTopic: string;
  accuracyScore: number;
  createdAt: string;
}

export interface RecentReading {
  id: number;
  topic: string;
  level: string;
  createdAt: string;
  bestScore: number | null;
}

export interface DashboardData {
  stats: DashboardStats;
  pronunciationTrend: TrendPoint[];
  recentReadings: RecentReading[];
}

// accuracyScore lives inside the `score` jsonb column; extract it as a float.
const accuracyExpr = sql<number>`(${readingAttempts.score} ->> 'accuracyScore')::float`;

export async function getDashboardData(userId: string): Promise<DashboardData> {
  // IMPORTANT: query order is load-bearing for the unit test's chainable mock.
  // See tests/services/dashboard.test.ts. Do not reorder.
  const [readingsCountRows, savedWordsCountRows, recentRows, trendRows, bestRows] =
    await Promise.all([
      db.select({ value: count() }).from(readings).where(eq(readings.userId, userId)),
      db.select({ value: count() }).from(savedWords).where(eq(savedWords.userId, userId)),
      db
        .select({
          id: readings.id,
          topic: readings.topic,
          level: readings.level,
          createdAt: readings.createdAt,
        })
        .from(readings)
        .where(eq(readings.userId, userId))
        .orderBy(desc(readings.createdAt))
        .limit(RECENT_LIMIT),
      db
        .select({
          attemptId: readingAttempts.id,
          readingTopic: readings.topic,
          accuracyScore: accuracyExpr,
          createdAt: readingAttempts.createdAt,
        })
        .from(readingAttempts)
        .innerJoin(readings, eq(readingAttempts.readingId, readings.id))
        .where(and(eq(readingAttempts.userId, userId), isNotNull(readingAttempts.score)))
        .orderBy(desc(readingAttempts.createdAt))
        .limit(TREND_LIMIT),
      db
        .select({
          readingId: readingAttempts.readingId,
          best: sql<number>`max((${readingAttempts.score} ->> 'accuracyScore')::float)`,
        })
        .from(readingAttempts)
        .where(and(eq(readingAttempts.userId, userId), isNotNull(readingAttempts.score)))
        .groupBy(readingAttempts.readingId),
    ]);

  // best score per reading id (only readings that have at least one attempt)
  const bestByReading = new Map<number, number>();
  for (const row of bestRows) bestByReading.set(row.readingId, Number(row.best));

  const bestValues = Array.from(bestByReading.values());
  const avgAccuracyScore =
    bestValues.length === 0
      ? null
      : Math.round(bestValues.reduce((a, b) => a + b, 0) / bestValues.length);

  return {
    stats: {
      readingsCount: Number(readingsCountRows[0]?.value ?? 0),
      savedWordsCount: Number(savedWordsCountRows[0]?.value ?? 0),
      avgAccuracyScore,
    },
    // DB returns newest-first; reverse to oldest-first so the chart reads left→right.
    pronunciationTrend: trendRows
      .map((r) => ({
        attemptId: r.attemptId,
        readingTopic: r.readingTopic,
        accuracyScore: Math.round(Number(r.accuracyScore)),
        createdAt: r.createdAt.toISOString(),
      }))
      .reverse(),
    recentReadings: recentRows.map((r) => ({
      id: r.id,
      topic: r.topic,
      level: r.level,
      createdAt: r.createdAt.toISOString(),
      bestScore: bestByReading.has(r.id) ? Math.round(bestByReading.get(r.id)!) : null,
    })),
  };
}
