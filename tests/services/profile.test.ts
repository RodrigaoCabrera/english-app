import { describe, it, expect, vi, beforeEach } from "vitest";

// Build the chainable Drizzle stub inside vi.hoisted so the (hoisted) vi.mock
// factory can reference it without hitting the temporal dead zone. Mirrors
// makeDbMock() from ../helpers/mocks (can't import it: the helper module isn't
// initialized yet when the hoisted block runs).
const { dbMock } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of [
    "select",
    "from",
    "where",
    "limit",
    "orderBy",
    "values",
    "insert",
    "update",
    "set",
    "delete",
    "onConflictDoUpdate",
    "returning",
  ]) {
    chain[m] = vi.fn(() => chain);
  }
  return { dbMock: chain };
});
vi.mock("@/db", () => ({ db: dbMock }));

import { getOrCreateProfile, updateLevel } from "@/services/profile";

describe("profile service", () => {
  beforeEach(() => {
    for (const fn of Object.values(dbMock)) fn.mockClear?.();
  });

  it("returns the existing level when a profile exists", async () => {
    dbMock.limit.mockResolvedValueOnce([{ clerkUserId: "u1", cefrLevel: "C1" }]);
    const profile = await getOrCreateProfile("u1");
    expect(profile.cefrLevel).toBe("C1");
  });

  it("creates a B1 profile when none exists", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    dbMock.returning.mockResolvedValueOnce([{ clerkUserId: "u1", cefrLevel: "B1" }]);
    const profile = await getOrCreateProfile("u1");
    expect(profile.cefrLevel).toBe("B1");
  });

  it("updates the level", async () => {
    dbMock.returning.mockResolvedValueOnce([{ clerkUserId: "u1", cefrLevel: "A2" }]);
    const profile = await updateLevel("u1", "A2");
    expect(profile.cefrLevel).toBe("A2");
  });
});
