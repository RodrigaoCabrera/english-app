import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable Drizzle stub, built in vi.hoisted so the hoisted vi.mock factory can
// reference it. Mirrors the pattern in tests/services/profile.test.ts.
const { dbMock } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of [
    "select",
    "from",
    "where",
    "innerJoin",
    "orderBy",
    "limit",
    "groupBy",
    "values",
    "insert",
    "update",
    "set",
    "delete",
    "returning",
  ]) {
    chain[m] = vi.fn(() => chain);
  }
  return { dbMock: chain };
});
vi.mock("@/db", () => ({ db: dbMock }));

import { getDashboardData } from "@/services/dashboard";

interface SetupArgs {
  readingsCount: number;
  savedWordsCount: number;
  recent: Array<{ id: number; topic: string; level: string; createdAt: Date }>;
  trend: Array<{ attemptId: number; readingTopic: string; accuracyScore: number; createdAt: Date }>;
  best: Array<{ readingId: number; best: number }>;
}

// Queue results on each query's terminal method, in the order getDashboardData
// issues them: readingsCount(.where), savedWordsCount(.where), recent(.limit),
// trend(.limit), best(.groupBy).
function setup(a: SetupArgs) {
  dbMock.where
    .mockResolvedValueOnce([{ value: a.readingsCount }])
    .mockResolvedValueOnce([{ value: a.savedWordsCount }]);
  dbMock.limit.mockResolvedValueOnce(a.recent).mockResolvedValueOnce(a.trend);
  dbMock.groupBy.mockResolvedValueOnce(a.best);
}

describe("getDashboardData", () => {
  beforeEach(() => {
    for (const fn of Object.values(dbMock)) fn.mockClear?.();
  });

  it("returns counts and shapes the data, reversing the trend to ascending order", async () => {
    setup({
      readingsCount: 12,
      savedWordsCount: 84,
      recent: [{ id: 1, topic: "Travel", level: "B2", createdAt: new Date("2026-06-12") }],
      trend: [
        { attemptId: 2, readingTopic: "Travel", accuracyScore: 91, createdAt: new Date("2026-06-12") },
        { attemptId: 1, readingTopic: "Travel", accuracyScore: 80, createdAt: new Date("2026-06-11") },
      ],
      best: [{ readingId: 1, best: 91 }],
    });

    const data = await getDashboardData("u1");

    expect(data.stats.readingsCount).toBe(12);
    expect(data.stats.savedWordsCount).toBe(84);
    expect(data.stats.avgAccuracyScore).toBe(91);
    // DB returns newest-first; the service reverses to oldest-first for the chart.
    expect(data.pronunciationTrend.map((p) => p.attemptId)).toEqual([1, 2]);
    expect(data.recentReadings[0].bestScore).toBe(91);
    expect(data.recentReadings[0].createdAt).toBe(new Date("2026-06-12").toISOString());
  });

  it("uses best score per reading and excludes no-attempt readings from the average", async () => {
    setup({
      readingsCount: 2,
      savedWordsCount: 0,
      recent: [
        { id: 1, topic: "A", level: "B1", createdAt: new Date("2026-06-12") },
        { id: 2, topic: "B", level: "B1", createdAt: new Date("2026-06-11") },
      ],
      trend: [],
      best: [{ readingId: 1, best: 90 }], // reading 2 has no attempts
    });

    const data = await getDashboardData("u1");

    // Average is over readings WITH attempts only → reading 1's best = 90.
    expect(data.stats.avgAccuracyScore).toBe(90);
    expect(data.recentReadings.find((r) => r.id === 1)?.bestScore).toBe(90);
    expect(data.recentReadings.find((r) => r.id === 2)?.bestScore).toBeNull();
  });

  it("returns a null average and empty trend when there are no attempts", async () => {
    setup({ readingsCount: 1, savedWordsCount: 0, recent: [], trend: [], best: [] });

    const data = await getDashboardData("u1");

    expect(data.stats.avgAccuracyScore).toBeNull();
    expect(data.pronunciationTrend).toEqual([]);
  });
});
