# Progress Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/dashboard` page that shows a signed-in user their readings count, saved-words count, average pronunciation accuracy, a pronunciation trend chart, and a list of recent readings with their best score.

**Architecture:** A single service function (`getDashboardData`) runs all DB aggregation in one `Promise.all`. A Server Component page calls it directly (no HTTP self-call); a thin `GET /api/dashboard` route exposes the same data for future client use. The trend chart is plain HTML/CSS divs — no charting dependency.

**Tech Stack:** Next.js 16 (App Router, Server Components), Drizzle ORM + PostgreSQL, Clerk auth, Tailwind v4, Vitest, Playwright.

---

## File Structure

- **Create** `src/services/dashboard.ts` — types + `getDashboardData(userId)`; all Drizzle queries + JS aggregation. One responsibility: produce `DashboardData`.
- **Create** `tests/services/dashboard.test.ts` — unit tests for the service (mocked DB).
- **Create** `src/app/api/dashboard/route.ts` — `GET` handler, thin wrapper around the service.
- **Create** `tests/api/dashboard.test.ts` — unit tests for the route (mocked auth + service).
- **Create** `src/app/dashboard/page.tsx` — Server Component page + presentational section components.
- **Create** `tests/e2e/dashboard.spec.ts` — signed-out redirect smoke test.
- **Modify** `src/app/layout.tsx` — add `Dashboard` nav link inside the existing `<Show when="signed-in">` block.

---

## Task 1: Dashboard service

**Files:**
- Create: `src/services/dashboard.ts`
- Test: `tests/services/dashboard.test.ts`

### Background for the implementer

The unit test uses the repo's established **chainable Drizzle mock** (see `tests/services/profile.test.ts` and `tests/api/readings.test.ts`). Every db method returns the same `chain` object; you make a query "resolve" by queueing a value on its **terminal** method with `mockResolvedValueOnce`.

This only works cleanly when each query's terminal method is distinct *in call order*. The service below is deliberately ordered so:
- The two `count()` queries terminate at `.where()` (queued first → consumed first).
- The two list queries terminate at `.limit()`.
- The grouped query terminates at `.groupBy()`.

Queries run inside one `Promise.all`, and JS evaluates the array left-to-right, building each query's chain synchronously before the next. So by the time the list/grouped queries call `.where()` as an *intermediate* step, the `.where()` Once-queue is already empty and they fall through to the default `chain`. **Do not reorder the queries** or the mock setup breaks.

- [ ] **Step 1: Write the failing test**

Create `tests/services/dashboard.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- dashboard.test.ts`
Expected: FAIL — `Cannot find module '@/services/dashboard'` (the service does not exist yet).

- [ ] **Step 3: Write the service**

Create `src/services/dashboard.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- dashboard.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/dashboard.ts tests/services/dashboard.test.ts
git commit -m "feat(dashboard): add getDashboardData service with unit tests"
```

---

## Task 2: API route `GET /api/dashboard`

**Files:**
- Create: `src/app/api/dashboard/route.ts`
- Test: `tests/api/dashboard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/dashboard.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock, serviceMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  serviceMock: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/services/dashboard", () => ({ getDashboardData: serviceMock }));

import { GET } from "@/app/api/dashboard/route";

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    authMock.mockReset();
    serviceMock.mockReset();
  });

  it("returns 401 when signed out", async () => {
    authMock.mockResolvedValue({ userId: null });

    const res = await GET();

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(serviceMock).not.toHaveBeenCalled();
  });

  it("returns the dashboard data for the signed-in user", async () => {
    authMock.mockResolvedValue({ userId: "u1" });
    const fakeData = {
      stats: { readingsCount: 3, savedWordsCount: 10, avgAccuracyScore: 80 },
      pronunciationTrend: [],
      recentReadings: [],
    };
    serviceMock.mockResolvedValue(fakeData);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual(fakeData);
    expect(serviceMock).toHaveBeenCalledWith("u1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- dashboard.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/dashboard/route'`.

- [ ] **Step 3: Write the route**

Create `src/app/api/dashboard/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDashboardData } from "@/services/dashboard";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const data = await getDashboardData(userId);
  return NextResponse.json({ success: true, data });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- dashboard.test.ts`
Expected: PASS — both route tests green (and the Task 1 service tests still pass, since the glob matches both files).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dashboard/route.ts tests/api/dashboard.test.ts
git commit -m "feat(dashboard): add GET /api/dashboard route with unit tests"
```

---

## Task 3: Dashboard page (Server Component)

**Files:**
- Create: `src/app/dashboard/page.tsx`

This task has no unit test (presentational Server Component). It is covered by the Task 5 E2E redirect test and verified manually. Follow the data-fetch + `redirect("/sign-in")` pattern from `src/app/reading/[id]/page.tsx`.

- [ ] **Step 1: Write the page**

Create `src/app/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserId } from "@/lib/auth";
import {
  getDashboardData,
  type DashboardData,
  type TrendPoint,
  type RecentReading,
} from "@/services/dashboard";

function levelDotClass(level: string): string {
  if (level === "A1" || level === "A2") return "bg-emerald-400";
  if (level === "B1" || level === "B2") return "bg-amber-400";
  return "bg-violet-400";
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-card/60 border border-border/50 rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1.5 leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>
    </div>
  );
}

function PronunciationChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) {
    return (
      <div className="bg-card/60 border border-border/50 rounded-lg p-4">
        <p className="text-xs font-semibold">Pronunciation trend</p>
        <p className="text-xs text-muted-foreground mt-3">
          Practice pronunciation on a reading to see your trend here.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-card/60 border border-border/50 rounded-lg p-4">
      <p className="text-xs font-semibold">Pronunciation trend</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        Last {trend.length} practice attempt{trend.length === 1 ? "" : "s"} · accuracy score
      </p>
      <div className="flex items-end gap-1.5 h-20 mt-4">
        {trend.map((p) => (
          <div
            key={p.attemptId}
            className="flex-1 bg-violet-500/70 rounded-t-sm min-h-[2px]"
            style={{ height: `${p.accuracyScore}%` }}
            title={`${p.readingTopic}: ${p.accuracyScore}%`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function RecentReadings({ readings }: { readings: RecentReading[] }) {
  if (readings.length === 0) {
    return (
      <div className="bg-card/60 border border-border/50 rounded-lg p-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">No readings yet.</p>
        <Link
          href="/reading"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Generate your first reading →
        </Link>
      </div>
    );
  }
  return (
    <div className="bg-card/60 border border-border/50 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-semibold">Recent readings</p>
        <Link href="/reading" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          View all →
        </Link>
      </div>
      <ul>
        {readings.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 py-2 border-b border-border/40 last:border-b-0"
          >
            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${levelDotClass(r.level)}`} />
            <Link href={`/reading/${r.id}`} className="flex-1 min-w-0 group">
              <p className="text-sm font-medium capitalize truncate group-hover:text-foreground transition-colors">
                {r.topic}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {r.level} ·{" "}
                {new Date(r.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
              </p>
            </Link>
            <div className="text-right shrink-0">
              {r.bestScore === null ? (
                <>
                  <p className="text-sm font-semibold text-muted-foreground">—</p>
                  <p className="text-[9px] text-muted-foreground">no attempts</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-violet-400">{r.bestScore}%</p>
                  <p className="text-[9px] text-muted-foreground">best</p>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DashboardPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const data: DashboardData = await getDashboardData(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-muted-foreground text-sm mt-1">Your learning at a glance</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Readings" value={String(data.stats.readingsCount)} sub="passages" />
        <StatCard label="Words saved" value={String(data.stats.savedWordsCount)} sub="vocabulary" />
        <StatCard
          label="Avg. accuracy"
          value={data.stats.avgAccuracyScore === null ? "—" : `${data.stats.avgAccuracyScore}%`}
          sub="pronunciation"
        />
      </div>

      <PronunciationChart trend={data.pronunciationTrend} />
      <RecentReadings readings={data.recentReadings} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks and builds**

Run: `pnpm build`
Expected: build succeeds, `/dashboard` listed in the route output. (If a type error appears, fix it before continuing — do not proceed with a red build.)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): add /dashboard progress page"
```

---

## Task 4: Add the Dashboard nav link

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add the link**

In `src/app/layout.tsx`, find the existing signed-in nav block:

```tsx
                  <Show when="signed-in">
                    <Link href="/reading" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Reading
                    </Link>
                  </Show>
```

Replace it with (adds the Dashboard link inside the same `Show`):

```tsx
                  <Show when="signed-in">
                    <Link href="/reading" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Reading
                    </Link>
                    <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Dashboard
                    </Link>
                  </Show>
```

- [ ] **Step 2: Verify the build still passes**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(dashboard): add Dashboard link to the nav"
```

---

## Task 5: E2E redirect smoke test

**Files:**
- Create: `tests/e2e/dashboard.spec.ts`

The middleware (`src/proxy.ts`) protects `/dashboard`, so a signed-out visit redirects to sign-in. This mirrors the existing `/reading` test in `tests/e2e/smoke.spec.ts`. (An authenticated view test is intentionally out of scope: the E2E suite has no Clerk signed-in fixture, and the data shape is already covered by the Task 1 unit tests.)

- [ ] **Step 1: Write the test**

Create `tests/e2e/dashboard.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("visiting /dashboard while signed out redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in|accounts\.|clerk/i);
});
```

- [ ] **Step 2: Run the E2E test**

Run: `pnpm test:e2e -- dashboard.spec.ts`
Expected: PASS — the page redirects away from `/dashboard` to a sign-in URL.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/dashboard.spec.ts
git commit -m "test(dashboard): add signed-out redirect e2e smoke test"
```

---

## Task 6: Final verification & roadmap update

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Run the full unit suite**

Run: `pnpm test`
Expected: all tests pass, including the new dashboard service + route tests.

- [ ] **Step 2: Tick Phase 6 in the roadmap**

In `docs/ROADMAP.md`, update the Phase 6 header and check off the delivered items:

```markdown
## Phase 6 — Progress & Dashboard  ·  Size: M  ·  Status: [x] done
```

```markdown
- [x] Dashboard page: readings completed, pronunciation score trend over time
- [x] Per-reading attempt history (best score surfaced on the dashboard list)
- [x] "Words saved" counter
- [ ] Streaks / activity calendar (optional — deferred)
```

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: tick Phase 6 (dashboard) in the roadmap"
```

---

## Self-Review Notes

- **Spec coverage:** `/dashboard` page + nav (Task 3/4), single `GET /api/dashboard` endpoint (Task 2), CSS bar chart (Task 3), saved-words-only count (Task 1 `savedWordsCount`), best-score-per-reading (Task 1 `bestByReading`), all edge cases (empty readings / no attempts / per-reading "—" / avg excludes no-attempt readings — Task 1 tests + Task 3 empty states). E2E: signed-out redirect (Task 5); authenticated-cards E2E intentionally descoped (no Clerk fixture) and noted.
- **Trend ordering:** DB fetches newest-first (`desc` + `limit`), service `.reverse()`s to oldest-first for left→right display — asserted in Task 1 test.
- **Type consistency:** `DashboardData`/`TrendPoint`/`RecentReading` defined in Task 1 are imported unchanged in Tasks 2 and 3.
