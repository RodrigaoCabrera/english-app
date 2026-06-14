# Phase 6 — Progress Dashboard

**Date:** 2026-06-14  
**Status:** Approved  
**Phase:** 6 (follows Phase 5 Auth)

---

## Goal

Give users a reason to come back — make learning visible. A dedicated `/dashboard` page that surfaces readings completed, pronunciation progress over time, and vocabulary growth.

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Location | `/dashboard` — dedicated page + nav link | Clean separation; room to grow |
| Data fetching | Single `GET /api/dashboard` endpoint | One round-trip; simple to cache later |
| Chart | CSS bar chart (divs + inline height%) | No new dependencies; sufficient for a trend |
| Words stat | `saved_words` count only | Explicit user intent, not passive exposure |
| Score shown | Best `accuracyScore` per reading | More motivating than latest |
| Pronunciation metric | `accuracyScore` (from `readingAttempts.score`) | Most meaningful single-number proxy for pronunciation quality |

---

## API

### `GET /api/dashboard`

Protected by Clerk auth (`getUserId()`). Returns `401` without a session.

**Response shape:**

```ts
{
  stats: {
    readingsCount: number
    savedWordsCount: number
    avgAccuracyScore: number | null  // null when no attempts exist
  }
  pronunciationTrend: Array<{
    attemptId: number
    readingTopic: string
    accuracyScore: number
    createdAt: string  // ISO
  }>  // last 10 attempts, ordered ASC by createdAt
  recentReadings: Array<{
    id: number
    topic: string
    level: string
    createdAt: string  // ISO
    bestScore: number | null  // null = no pronunciation attempts
  }>  // last 5 readings ordered DESC by createdAt
}
```

**Queries (all scoped to `userId`):**

- `readingsCount` — `COUNT(*)` on `readings`
- `savedWordsCount` — `COUNT(*)` on `saved_words`
- `avgAccuracyScore` — average of per-reading best scores (readings with no attempts excluded)
- `pronunciationTrend` — subquery: SELECT the 10 most recent rows from `reading_attempts` (ORDER BY `created_at DESC` LIMIT 10), then ORDER that result ASC for left-to-right display. JOIN `readings` to get the topic.
- `recentReadings` — last 5 `readings` LEFT JOIN MAX(`reading_attempts.score->>'accuracyScore'`) grouped by reading

---

## File Structure

```
src/
  app/
    dashboard/
      page.tsx          ← Server Component; calls dashboard service directly (no HTTP self-call)
  services/
    dashboard.ts        ← All Drizzle queries; returns DashboardData type
  app/api/
    dashboard/
      route.ts          ← GET /api/dashboard (thin wrapper around dashboard.ts)
```

`page.tsx` imports `getDashboardData(userId)` from `services/dashboard.ts` directly — no `fetch()` to itself. The HTTP endpoint exists for potential future client-side use.

---

## Components

All rendering is server-side — no `"use client"` needed. No interactive elements on the dashboard.

### Layout (`page.tsx`)

```
<h1>Progress</h1>
<p>Your learning at a glance</p>

<StatsRow />          ← 3 stat cards (readings, words, avg accuracy)
<PronunciationChart /> ← CSS bar chart, last 10 attempts
<RecentReadings />    ← list of 5 readings with best score
```

Each section is a simple function component in `page.tsx` (no separate files — they're presentational fragments, not reusable components).

### Bar chart

Each bar is a `<div>` with `style={{ height: \`${score}%\` }}`. The container is `height: 80px` with `align-items: flex-end`. No JS, no library.

---

## Navigation

Add `Dashboard` link to the header nav in `src/app/layout.tsx`, inside the existing `<Show when="signed-in">` block, alongside the `Reading` link.

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| No readings yet | Stats show 0; recent readings shows "Generate your first reading →" (links to `/reading`) |
| No pronunciation attempts | `pronunciationTrend` section hidden; `avgAccuracyScore` is null, shown as "—"; reading rows show "—" for score |
| Reading has no attempts | `bestScore: null` → displays "—" in the list |
| `avgAccuracyScore` calculation | Only readings with ≥1 attempt contribute to the average |

---

## Tests

### Unit (Vitest) — `tests/services/dashboard.test.ts`

- Returns correct counts with mocked DB
- `bestScore` is the MAX across attempts, not the latest
- `avgAccuracyScore` is null when no attempts exist
- `pronunciationTrend` is ordered ASC and limited to 10

### E2E (Playwright) — `tests/e2e/dashboard.spec.ts`

- Smoke test: authenticated user navigates to `/dashboard`, sees the 3 stat cards
- Unauthenticated redirect: `/dashboard` redirects to `/sign-in`
