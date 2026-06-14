import { describe, it, expect, vi, beforeEach } from "vitest";

// Build the chainable Drizzle stub and the Clerk auth mock inside vi.hoisted so
// the (hoisted) vi.mock factories can reference them without hitting the
// temporal dead zone. Mirrors makeDbMock()/makeAuthMock() from ../helpers/mocks
// (can't import them: those modules aren't initialized yet when this runs).
const { dbMock, authMock } = vi.hoisted(() => {
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
  return { dbMock: chain, authMock: vi.fn() };
});
vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

import { GET } from "@/app/api/readings/route";

describe("GET /api/readings", () => {
  beforeEach(() => {
    for (const fn of Object.values(dbMock)) fn.mockClear?.();
    authMock.mockReset();
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValue({ userId: null });

    const res = await GET();

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns the user's readings (scoped) when signed in", async () => {
    authMock.mockResolvedValue({ userId: "u1" });
    dbMock.limit.mockResolvedValueOnce([
      { id: 1, level: "B1", topic: "t", createdAt: new Date() },
    ]);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    // Query must be scoped to the current user.
    expect(dbMock.where).toHaveBeenCalled();
  });
});
