/**
 * In-process fixed-window rate limiter.
 *
 * Keeps per-key counters in memory (survives across requests in one Node
 * process, resets on restart). Suitable for a single-instance deployment;
 * swap for Redis/Upstash if running multiple instances.
 */

import { NextResponse, type NextRequest } from "next/server";

interface WindowEntry {
  count: number;
  resetAt: number; // epoch ms when the window expires
}

const store = new Map<string, WindowEntry>();

// Opportunistic cleanup so the Map doesn't grow unbounded.
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
  /** Seconds until reset, for the Retry-After header. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, retryAfter: 0 };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const allowed = entry.count <= limit;

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Best-effort client identifier from proxy headers, falling back to a
 * shared bucket when no IP is available (e.g. local dev).
 */
export function clientKey(request: NextRequest, scope: string): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip =
    fwd?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

/** Standard 429 response with a Retry-After header. */
export function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "Too many requests. Please slow down and try again shortly.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfter) },
    }
  );
}
