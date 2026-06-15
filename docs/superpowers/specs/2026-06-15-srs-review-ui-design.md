# SRS Review UI — Flashcard Session & Dashboard Surfacing (Phase 7, Part 2)

> Spec · 2026-06-15
> Status: approved (design)
> Scope: the frontend only. Consumes the Part 1 backend
> (`GET /api/srs/due`, `POST /api/srs/review`) without modifying it.

## Goal

Turn the scheduled review queue into something a user can actually do: a
flashcard review session plus a dashboard surfacing that pulls them back in.
Part 1 delivered a complete backend driven entirely through two endpoints; this
spec is pure frontend on top of them. The terminal deliverable is a `/review`
session that lets a user work through their due words and a dashboard banner
that tells them when words are due.

## Core decisions

- **Direction: meaning → word (production).** The card front shows the meaning
  (Spanish translation + English definition); the user recalls the English word,
  then flips to reveal it with audio and image. Active recall is the most
  effective mode for vocabulary, and it is harder (and more valuable) than
  recognition.
- **Card layout B — translation + definition on the front, with fallback.**
  The front shows the Spanish translation and the English definition (the
  definition aids recall without giving the word away). Fallback chain when
  fields are missing (see Card UX).
- **One grade per card per session.** Each card is graded exactly once. `again`
  reschedules the word for tomorrow (the backend already sets `intervalDays = 1`)
  and removes it from the session. No in-session re-queue — that would double-post
  to `/api/srs/review` and fight the backend's scheduling. The word reappears in
  the next session.
- **Dashboard surfacing: banner CTA (appears only when due > 0).** A prominent
  call-to-action at the top of the dashboard, because the goal is to get the user
  reviewing. It disappears cleanly when nothing is due, and does not crowd the
  existing stats grid.
- **Audio via browser `speechSynthesis`, not the OpenAI TTS endpoint.** Reuses
  the exact approach already in `WordTooltip`: free, consistent, zero paid calls.
- **Initial fetch server-side.** `/review/page.tsx` reads the due words directly
  through the `srs` service (no internal HTTP round-trip), avoiding an initial
  loading state and an extra request.

## Architecture — components

A new `/review` route plus dashboard/nav surfacing. Nothing in the backend
changes.

1. **`src/app/review/page.tsx`** (RSC, thin) — checks the session
   (`getUserId()`, `redirect("/sign-in")` when absent), calls `getDueWords(userId, 50)`
   server-side, and passes the resulting `DueWord[]` to the client session
   component. No loading spinner on first paint.
2. **`src/components/review/ReviewSession.tsx`** (`"use client"`) — owns session
   state: current index, flipped/revealed flag, per-card grade submission, and
   the completion screen. Immutable state updates only.
3. **`src/components/review/Flashcard.tsx`** (`"use client"`) — presentation of a
   single card: front (meaning) / back (word + audio + image), layout B. No
   session logic; receives the card and an `onReveal` callback.
4. **`src/components/review/GradeButtons.tsx`** — the four grade buttons
   (`Again` / `Hard` / `Good` / `Easy`), each invoking `onGrade(grade)`.

This keeps each unit small and independently testable: the session owns flow,
the flashcard owns presentation, the buttons own the grade vocabulary.

## Data flow

1. `page.tsx` (server) → `getDueWords(userId, 50)` → passes `DueWord[]` to
   `ReviewSession`. (`getDueCount` is not needed here; the array length is the
   session size.)
2. `ReviewSession` walks the array in memory. Per card: front (meaning) →
   click or `Space` to flip → reveal back → four grade buttons.
3. On grade: `POST /api/srs/review` with `{ word, grade }`. Await the response,
   then advance to the next card. One grade per card.
4. When the array is exhausted → completion screen: "Reviewed N words" with a
   link back to the dashboard.

**Audio:** `window.speechSynthesis` with an `en-US` utterance of the word,
mirroring `WordTooltip` (guard on `window.speechSynthesis` existence; cancel any
in-flight utterance before speaking). **Image:** `/cache/img/${imageHash}.png`
when `imageHash` is non-null; otherwise no image.

## Card UX — layout B with fallback

- **Front (the prompt):** Spanish translation, with the English definition below
  it. Fallback chain:
  1. `translation` present → show translation (+ definition if present).
  2. `translation` null but `definition` present → show definition only.
  3. both null → show the English word on the front (degenerate recognition
     case; rare, because the save flow normally populates `words_cache`).
- **Back (the answer):** the English word, large; an audio button; the image
  when available. If the definition was *not* shown on the front (fallback case),
  it is shown on the back instead so the user always sees it once.
- **Interaction:** click anywhere on the card or press `Space` to flip; `1`–`4`
  grade the revealed card (Again/Hard/Good/Easy). Keyboard shortcuts are an
  enhancement; the buttons are always clickable and are the primary control.

## Dashboard surfacing — banner CTA (option A)

- In `src/app/dashboard/page.tsx`, fetch `getDueCount(userId)`. When `> 0`,
  render a banner at the top of the page: "**N** words due for review" with a
  "Start review →" action linking to `/review`. When `0`, render nothing.
- Add a **"Review"** link to the header nav in `src/app/layout.tsx`, alongside
  Reading and Dashboard (inside the `<Show when="signed-in">` block).

## Error handling & edge cases

- **Empty queue** (`/review` with no due words): a calm empty state — "No words
  due for review right now." — with a link to `/reading`. Reached both when the
  initial array is empty and when the session completes.
- **Grade POST failure:** show an inline error on the current card, do **not**
  advance, and let the user retry the same grade. Progress is never lost. The
  grade button shows a pending state while the request is in flight to prevent
  double-submit.
- **`404` from the grade endpoint** (word no longer in the queue): treat as
  already-handled — advance past the card rather than blocking the session.
- **Server fetch failure** in `page.tsx`: allowed to propagate to the existing
  app-level `error.tsx`; no bespoke error UI needed.

## Testing

- **Unit (Vitest, jsdom)** — mock `fetch` and `window.speechSynthesis`:
  - `ReviewSession`: advances through cards; flip reveals the back; grading
    POSTs the correct `{ word, grade }` and advances on success; grade failure
    keeps the card and surfaces an error; completion screen after the last card;
    empty-queue state when given `[]`.
  - `Flashcard`: front fallback chain (translation → definition → word); image
    renders only when `imageHash` is present; definition shown on the back in the
    fallback case.
  - `GradeButtons`: each button invokes `onGrade` with the matching grade.
- **E2E:** no new paid-service flows, so no required Playwright addition; an
  optional smoke test that `/review` renders is acceptable.

Target ≥80% coverage on the new components, concentrated in `ReviewSession`.

## Out of scope

- Any backend change (endpoints, service, schema) — Part 1 is frozen.
- New-card daily limits or session-size policy beyond the existing `limit` cap.
- Streaks / activity calendar (separate deferred roadmap item).
- Per-review history UI.

## Files touched

- `src/app/review/page.tsx` — new (RSC entry, server-side initial fetch).
- `src/components/review/ReviewSession.tsx` — new (session orchestration).
- `src/components/review/Flashcard.tsx` — new (card presentation).
- `src/components/review/GradeButtons.tsx` — new (grade controls).
- `src/app/dashboard/page.tsx` — add the due-for-review banner CTA.
- `src/app/layout.tsx` — add the "Review" nav link.
- `tests/components/review/*.test.tsx` — new unit tests.
- `docs/ROADMAP.md` — tick the two Phase 7 Part 2 items (Review UI, dashboard
  surfacing).
