import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable Drizzle stub (same pattern as tests/services/dashboard.test.ts).
const { dbMock } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of [
    "select", "from", "where", "leftJoin", "orderBy", "limit", "for",
    "insert", "values", "onConflictDoNothing",
    "update", "set",
  ]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.transaction = vi.fn((cb: (tx: typeof chain) => unknown) => cb(chain));
  return { dbMock: chain };
});
vi.mock("@/db", () => ({ db: dbMock }));

import { enqueueWord, gradeWord, getDueWords, getDueCount } from "@/services/srs";

beforeEach(() => {
  for (const fn of Object.values(dbMock)) fn.mockClear?.();
});

describe("enqueueWord", () => {
  it("inserts with onConflictDoNothing (idempotent)", async () => {
    await enqueueWord("u1", "house", "B1");
    expect(dbMock.values).toHaveBeenCalledWith({ userId: "u1", word: "house", level: "B1" });
    expect(dbMock.onConflictDoNothing).toHaveBeenCalled();
  });
});

describe("gradeWord", () => {
  it("returns false and does not update when the word is not in the queue", async () => {
    dbMock.limit.mockResolvedValueOnce([]); // load returns no row
    const ok = await gradeWord("u1", "ghost", "good");
    expect(ok).toBe(false);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("persists the next SM-2 state and increments the review count", async () => {
    dbMock.limit.mockResolvedValueOnce([
      { id: 7, easeFactor: 250, intervalDays: 0, repetitions: 0, reviewCount: 0 },
    ]);
    const ok = await gradeWord("u1", "house", "good");
    expect(ok).toBe(true);
    const setArg = dbMock.set.mock.calls[0][0];
    expect(setArg.intervalDays).toBe(1); // first 'good'
    expect(setArg.repetitions).toBe(1);
    expect(setArg.reviewCount).toBe(1);
    expect(setArg.lastGrade).toBe("good");
    expect(setArg.dueDate).toBeInstanceOf(Date);
    expect(setArg.easeFactor).toBe(250); // 'good' (q=4) leaves EF unchanged
  });
});

describe("getDueWords / getDueCount", () => {
  it("getDueWords returns the joined due rows", async () => {
    const rows = [{ word: "house", level: "B1", definition: "a building", translation: "casa", imageHash: null, dueDate: new Date() }];
    dbMock.limit.mockResolvedValueOnce(rows);
    const result = await getDueWords("u1");
    expect(result).toEqual(rows);
    expect(dbMock.leftJoin).toHaveBeenCalled();
  });

  it("getDueCount returns the numeric count", async () => {
    dbMock.where.mockResolvedValueOnce([{ value: 4 }]);
    const n = await getDueCount("u1");
    expect(n).toBe(4);
  });
});
