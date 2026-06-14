import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Build a unique scope per test so the module-level store doesn't leak state.
let counter = 0;
function freshKey() {
  return `test-${counter++}`;
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const key = freshKey();
    const opts = { limit: 3, windowMs: 1000 };
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    const third = rateLimit(key, opts);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    const key = freshKey();
    const opts = { limit: 2, windowMs: 1000 };
    rateLimit(key, opts);
    rateLimit(key, opts);
    const blocked = rateLimit(key, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = freshKey();
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(rateLimit(key, opts).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const a = freshKey();
    const b = freshKey();
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit(a, opts).allowed).toBe(true);
    expect(rateLimit(b, opts).allowed).toBe(true);
    expect(rateLimit(a, opts).allowed).toBe(false);
  });
});

describe("tooManyRequests", () => {
  it("returns a 429 with a Retry-After header", async () => {
    const res = tooManyRequests({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 5000,
      retryAfter: 5,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
