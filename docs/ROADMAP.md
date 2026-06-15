# English App — Roadmap

> Living document. Tracks the path from the delivered MVP to a full product.
> Last updated: 2026-06-15.

The MVP (phases 1–4) is complete: AI-generated **Reading** with hover
definitions/translations/images/audio, **pronunciation assessment** (Azure),
plus rate limiting, tests, and a Docker deploy setup. See `CLAUDE.md` for the
current architecture.

This roadmap covers everything *beyond* the MVP. The agreed development line is:

> **Auth → Progress/Dashboard → SRS**, then the new learning modules
> (Speaking, Listening, Writing), with platform/production hardening in parallel.

Phase numbering continues from the MVP (which was phases 1–4).

---

## Legend

- `[ ]` not started · `[~]` in progress · `[x]` done
- **Size**: S (≤1 day) · M (2–4 days) · L (1–2 weeks)

---

## Phase 5 — Auth & Accounts  ·  Size: M  ·  Status: [x] done

**Goal:** turn the single-user demo into a multi-user app. Unblocks everything below.

- [x] Choose auth approach — **Clerk** (OAuth social only: Google/GitHub)
- [x] Identity via Clerk (no local `users` table — Clerk owns it); `user_profiles` for app prefs
- [x] Sign in / sign up / sign out flows (Clerk components)
- [x] Protect API routes; scope `readings`/`reading_attempts`/`saved_words` to the user
- [x] Migrate the CEFR level from `localStorage` to `user_profiles`
- [x] Move rate limiting from per-IP to per-user
- [ ] Global daily cost cap (deferred — hook left in place, full impl later)
- [x] Restrict access via allowlist

**Data model:** `user_id text` (Clerk id) on `readings`, `reading_attempts`,
`saved_words`; new `user_profiles` (clerk_user_id PK, cefr_level). No local users table.

---

## Phase 6 — Progress & Dashboard  ·  Size: M  ·  Status: [x] done

**Goal:** give users a reason to come back — make learning visible.

- [x] Dashboard page: readings completed, pronunciation score trend over time
- [x] Per-reading attempt history (best score surfaced on the dashboard list)
- [x] "Words saved" counter
- [ ] Streaks / activity calendar (optional — deferred)

**Depends on:** Phase 5 (needs a user to attribute progress to).

---

## Phase 7 — SRS (Spaced Repetition for Vocabulary)  ·  Size: M  ·  Status: [x] done

**Goal:** the real learning engine — turn hovered words into reviewed words.

- [x] `user_words` table: word, level, ease, interval, due_date, review history
- [x] Capture words the user hovers/saves into their review queue
- [x] SM-2 (or similar) scheduling algorithm
- [x] Review UI: flashcard-style session (definition ↔ word, with audio/image)
- [x] Daily "due for review" surfacing on the dashboard

**Depends on:** Phase 5. Reuses existing `words_cache` + image/audio infra.

---

## Phase 8 — Speaking module  ·  Size: L  ·  Status: [ ]

**Goal:** conversational practice with an AI partner.

- [ ] Turn-based dialogue with the LLM, scoped to CEFR level + topic
- [ ] Speech-to-text for user turns (reuse Recorder + Azure)
- [ ] Live correction/feedback on grammar and pronunciation
- [ ] Persist conversations for review

**Reuses:** Recorder, Azure speech, Ollama/LLM, CEFR prompts.

---

## Phase 9 — Listening module  ·  Size: M  ·  Status: [ ]

**Goal:** listening comprehension.

- [ ] Generate a passage + synthesize audio (OpenAI TTS)
- [ ] Comprehension questions (LLM-generated, CEFR-scoped)
- [ ] Grade answers, store results in progress

**Reuses:** reading-generator, OpenAI TTS, dashboard.

---

## Phase 10 — Writing module  ·  Size: M  ·  Status: [ ]

**Goal:** written production with AI correction.

- [ ] Prompt → user writes → LLM corrects grammar/style with CEFR-aware feedback
- [ ] Inline diff / suggestions UI
- [ ] Track recurring mistakes per user (feeds future personalization)

**Reuses:** LLM layer, CEFR prompts, progress tracking.

---

## Cross-cutting — Platform & Production  ·  Status: [ ] (do in parallel, small)

Start small once Auth lands; grow with scale.

- [ ] **CI**: GitHub Actions running `pnpm test` + `pnpm build` on every PR
- [ ] **Deploy**: ship the Docker image to a VPS/host; document the runbook
- [ ] **Observability**: structured logging (replace `console.*`), error tracking
      (e.g. Sentry), and AI cost tracking/alerts
- [ ] **Postgres backups** + a production migration strategy
- [ ] **Multi-instance readiness** (only if scaling): move the in-memory rate
      limiter to Redis and the disk image cache to object storage (S3/R2)
- [ ] **Abuse protection**: captcha/gating on expensive routes, audio size limits, CORS

---

## Cross-cutting — UX & Content Polish  ·  Status: [ ]

- [ ] PWA / offline support + serious mobile-responsive pass (currently desktop-first)
- [ ] UI i18n (interface copy is currently English-only)
- [ ] Accessibility: keyboard + screen-reader support for the word-hover interaction
- [ ] Pre-seed a starter set of readings/words to cut on-demand latency and cost

---

## Tech debt carried from the MVP

- [ ] Retry logic on AI/provider failures (LLM, OpenAI, Azure) — currently surfaces
      the error without retrying
- [ ] Direct unit tests for `cache.ts` and `pronunciation-scorer.ts` (need DB/FS mocks)
- [ ] E2E coverage for the full record → feedback flow (needs mic + Azure mocking)
- [ ] `CLAUDE.md` intro still lists OpenAI/Azure only; image provider is Unsplash now
      (table is correct, intro line is loose)
