# SRS Engine — Capture & Scheduling (Phase 7, Part 1)

> Spec · 2026-06-14
> Status: approved (design)
> Scope: the backend engine only. The Review UI (flashcard session) and
> dashboard surfacing are a **separate** spec (Phase 7, Part 2).

## Goal

Turn explicitly-saved vocabulary into a scheduled review queue. When a user
saves a word, it enters a per-user spaced-repetition queue backed by the SM-2
algorithm. This spec delivers a complete, independently-testable backend:
data model, the scheduling algorithm, the capture hook, the service layer, and
the HTTP endpoints the future Review UI will consume.

This spec deliberately excludes any UI. The terminal deliverable is a backend
that a frontend can drive entirely through `POST /api/srs/review` and
`GET /api/srs/due`.

## Core decisions

- **New separate table `user_words`** — `saved_words` stays as-is (a flat
  save log feeding the dashboard counter). `user_words` is the review queue
  with its own SM-2 state. Clean separation of responsibilities; nothing in the
  existing save flow or dashboard breaks.
- **Capture on explicit save only** — the existing "save" button is the single
  capture signal. Clear intent ("I want to remember this word"), no noise, no
  uncontrolled queue growth. No hover-based capture.
- **Anki-style 4-grade scale** — `again | hard | good | easy`, mapped
  internally to the classic SM-2 quality 0–5. Familiar flashcard UX; simpler
  than exposing 0–5.
- **Counters in-row, no review-log table** — `reviewCount`, `lastReviewedAt`,
  `lastGrade` live on the `user_words` row. Sufficient for SM-2 and "last
  reviewed". A full per-review history table is YAGNI until a feature consumes
  it.

## Architecture — three isolated layers

1. **`src/lib/sm2.ts`** — pure function, no DB, no side effects. All SM-2 math
   lives here. Trivially unit-testable with table-driven cases.
2. **`src/services/srs.ts`** — DB orchestration: `enqueueWord`, `gradeWord`,
   `getDueWords`, `getDueCount`. Calls `sm2.ts` and persists.
3. **Glue** — capture hook in the existing save route, plus
   `POST /api/srs/review` and `GET /api/srs/due` for the Review UI to consume.

This keeps Part 1 a complete, end-to-end-testable backend, and leaves Part 2 as
pure frontend consuming these endpoints. Clean boundary.

## Data model — `user_words` (in `src/db/schema.ts`)

```ts
export const userWords = pgTable(
  "user_words",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    word: text("word").notNull(),
    level: text("level").notNull(),

    // SM-2 state
    easeFactor: integer("ease_factor").notNull().default(250), // EF×100 (2.50)
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    dueDate: timestamp("due_date").notNull().defaultNow(), // new words due immediately

    // counters / history-lite
    reviewCount: integer("review_count").notNull().default(0),
    lastReviewedAt: timestamp("last_reviewed_at"),
    lastGrade: text("last_grade"), // 'again' | 'hard' | 'good' | 'easy'

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("user_words_user_word_idx").on(t.userId, t.word),
    index("user_words_due_idx").on(t.userId, t.dueDate),
  ]
);
```

Rationale:

- **`easeFactor` as integer (EF×100)** — avoids float drift in Postgres; the
  lib divides by 100. Default `250` = EF 2.50 (SM-2 standard starting ease).
- **Unique `(userId, word)`** — one card per word per user. Capture upserts with
  `onConflictDoNothing`; re-saving never resets scheduling.
- **`dueDate` defaults to now** — a new word is immediately due and enters the
  next review session.
- **Index `(userId, dueDate)`** — fast "due today" queries for `getDueWords` /
  `getDueCount`.
- **No definition/translation/image stored here** — read from `words_cache` by
  `word` when the Review UI needs them. DRY; no duplication.

A Drizzle migration is generated for the new table (`pnpm drizzle-kit generate`),
following the existing migration workflow.

## SM-2 algorithm — `src/lib/sm2.ts` (pure)

```ts
export type Grade = "again" | "hard" | "good" | "easy";
export interface Sm2State {
  easeFactor: number;  // ×100 integer
  intervalDays: number;
  repetitions: number;
}

const Q: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };
const MIN_EF = 130; // 1.30 ×100

export function schedule(state: Sm2State, grade: Grade): Sm2State {
  const q = Q[grade];
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const easeFactor = Math.max(MIN_EF, Math.round(state.easeFactor + efDelta * 100));

  if (q < 3) {
    // lapse: reset progress, review again tomorrow
    return { easeFactor, intervalDays: 1, repetitions: 0 };
  }

  const repetitions = state.repetitions + 1;
  let intervalDays: number;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 6;
  else intervalDays = Math.round(state.intervalDays * (easeFactor / 100));

  return { easeFactor, intervalDays, repetitions };
}
```

Grade → quality mapping:

| Grade  | quality | Effect                                              |
|--------|---------|-----------------------------------------------------|
| `again`| 1       | lapse (q<3): repetitions→0, interval→1 day          |
| `hard` | 3       | passes, EF decreases                                |
| `good` | 4       | passes, EF ~stable                                  |
| `easy` | 5       | passes, EF increases                                |

Design notes:

- The lapse path sets `intervalDays: 1` (tomorrow), not 0, so a failed word does
  not loop within the same session. Standard SM-2 behavior.
- `easeFactor` is floored at `130` (EF 1.30) per the SM-2 spec.
- The function is total and deterministic — no clock, no DB. `dueDate` is
  computed by the service, not here.

## Service layer — `src/services/srs.ts`

- **`enqueueWord(userId, word, level)`** — idempotent upsert:

  ```ts
  await db.insert(userWords)
    .values({ userId, word, level }) // defaults: EF 250, interval 0, due now
    .onConflictDoNothing({ target: [userWords.userId, userWords.word] });
  ```

  Re-saving an already-queued word does nothing (no reset).

- **`gradeWord(userId, word, grade)`** — loads the row, calls `schedule()`,
  computes `dueDate = startOfDay(now) + intervalDays`, persists the new SM-2
  state plus `reviewCount++`, `lastReviewedAt = now`, `lastGrade = grade`.
  Returns a not-found signal when the word is not in the user's queue
  (ownership → 404 at the route).

- **`getDueWords(userId, limit?)`** — words with `dueDate <= now`, ordered by
  `dueDate` ascending. Left-joins `words_cache` on `word` to include
  `definition`, `translation`, `imageHash` for the Review UI.

- **`getDueCount(userId)`** — count of due words, for the dashboard badge
  (consumed in Part 2).

`startOfDay` normalizes due dates to day granularity (UTC), consistent with the
in-process date handling already used by `token-budget.ts`.

## Endpoints

- **`POST /api/srs/review`** — body `{ word: string, grade: Grade }`, validated
  with Zod (`grade` is a `z.enum`). Calls `gradeWord`. `401` without a session,
  `404` on ownership violation, `400` on invalid body. Rate-limited per-user via
  the existing `src/lib/rate-limit.ts` (protects writes; does not call paid
  services).

- **`GET /api/srs/due`** — optional `?limit` query (validated, sane cap).
  Returns `{ dueCount, words }`. `401` without a session.

Both use the consistent `{ success, data?, error? }` envelope.

## Error handling

- Zod validation at every route boundary; fail fast with clear messages.
- Ownership violations return `404` (consistent with `readings` /
  `reading_attempts`).
- **Capture is secondary to save**: the `enqueueWord` call in the save route is
  wrapped in try/catch and logged; an enqueue failure never fails the primary
  save. Saving the word is the user-facing action; queueing is best-effort.

## Testing

- **Unit — `tests/lib/sm2.test.ts`** (the core; high coverage here):
  - grade sequences produce expected interval progression (1 → 6 → ×EF);
  - `again` lapses (repetitions→0, interval→1);
  - EF floored at 1.30 after repeated `again`/`hard`;
  - `easy` raises EF, `hard` lowers it;
  - determinism (same input → same output).
- **Unit — `tests/services/srs.test.ts`** (chainable DB mock, same pattern as
  `tests/services/dashboard.test.ts`):
  - `enqueueWord` is idempotent (`onConflictDoNothing`);
  - `gradeWord` persists new state + counters and computes `dueDate`;
  - `gradeWord` returns not-found for a word the user does not own;
  - `getDueWords` filters by `dueDate <= now` and orders ascending.
- **Integration — `tests/api/srs.test.ts`** (service mocked):
  - `401` without auth on both routes;
  - `400` on invalid body / grade;
  - `404` on ownership violation;
  - happy path for review and due.

Target ≥80% coverage, concentrated in `sm2.ts` and `srs.ts`.

## Out of scope (Part 2)

- Flashcard review session UI (definition ↔ word, audio/image).
- Dashboard "due for review" surfacing / badge.
- New-card daily limits, review session sizing, or queue ordering policy beyond
  `dueDate` ascending.

## Files touched

- `src/db/schema.ts` — add `userWords` table (+ generated migration).
- `src/lib/sm2.ts` — new, pure scheduler.
- `src/services/srs.ts` — new, DB orchestration.
- `src/app/api/words/[word]/save/route.ts` — add best-effort `enqueueWord`.
- `src/app/api/srs/review/route.ts` — new.
- `src/app/api/srs/due/route.ts` — new.
- `tests/lib/sm2.test.ts`, `tests/services/srs.test.ts`, `tests/api/srs.test.ts`
  — new.
- `docs/ROADMAP.md` — tick the Phase 7 engine items.
