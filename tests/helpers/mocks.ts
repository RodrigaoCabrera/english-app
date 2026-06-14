import { vi } from "vitest";

/** Chainable Drizzle query-builder stub. Override terminal calls per test. */
export function makeDbMock() {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "limit", "orderBy", "values", "insert", "update", "set", "delete", "onConflictDoUpdate", "returning"]) {
    chain[m] = vi.fn(() => chain);
  }
  return chain as Record<string, ReturnType<typeof vi.fn>>;
}

/** Mock for @clerk/nextjs/server auth() returning a fixed userId (or null). */
export function makeAuthMock(userId: string | null) {
  return vi.fn().mockResolvedValue({ userId });
}
