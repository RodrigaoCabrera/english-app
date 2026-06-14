# Spec: Auth & Accounts (Phase 5)

> Status: approved design, ready for implementation planning.
> Date: 2026-06-14. Roadmap: `docs/ROADMAP.md` (Phase 5).

## Goal

Turn the single-user demo into a multi-user app using **Clerk** for authentication
(OAuth social only), with **all user data private per user** and **access
restricted to an allowlist**. This unblocks Progress/Dashboard (Phase 6) and
SRS (Phase 7).

## Decisions (locked)

- **Auth provider:** Clerk (`@clerk/nextjs`). Chosen for DX and speed; accepted
  trade-offs are external user data (PII lives in Clerk) and some vendor lock-in,
  both minor for a personal/allowlisted app.
- **Sign-in methods:** OAuth social only — **Google + GitHub**. Email/password
  disabled in the Clerk dashboard.
- **Data ownership:** everything private per user. Each user only sees and
  generates their own readings and attempts.
- **Existing data:** wiped (dev data). Migration truncates `readings` and
  `reading_attempts` before adding `NOT NULL` owner columns.
- **Access:** restricted to an allowlist (the developer + invited emails).
- **CEFR level:** moves from `localStorage` to a local `user_profiles` table.

## Risks to validate during implementation

1. Whether Clerk's native **allowlist (Restrictions)** is on the free tier. If
   not, enforce it ourselves in `clerkMiddleware` / a `signIn`-style check against
   an `ALLOWLIST_EMAILS` env var. Either way it must be enforced.
2. Compatibility of `clerkMiddleware()` with this project's modified **Next.js 16**
   (see `AGENTS.md`). Read `node_modules/next/dist/docs/` before touching
   middleware/routing.

## Architecture & auth flow

- `@clerk/nextjs` added; `<ClerkProvider>` wraps the root layout.
- `src/middleware.ts` uses `clerkMiddleware()` with a matcher that leaves public:
  the landing `/`, Clerk routes (`/sign-in`, `/sign-up`), and static assets.
  Everything under `/reading*` and `/api/*` (except cache routes that still
  require a session) is protected.
- Auth pages `/sign-in` and `/sign-up` mount Clerk's components. Clerk dashboard
  enables only Google + GitHub.
- Header: `<UserButton/>` when signed in; a "Sign in" link when signed out.
- Server-side identity via `auth()` from `@clerk/nextjs/server` in route handlers
  and server components.
- Allowlist: prefer Clerk Restrictions; fallback to an `ALLOWLIST_EMAILS` check in
  middleware.

## Data model

**Modified tables:**
- `readings`: add `user_id text NOT NULL` (Clerk user id) + index on `user_id`.
- `reading_attempts`: add `user_id text NOT NULL` (denormalized for dashboard
  queries; avoids a join through `reading_id`).

**New table:**
- `user_profiles`: `clerk_user_id text PRIMARY KEY`, `cefr_level text NOT NULL
  DEFAULT 'B1'`, `created_at`, `updated_at`. Created/upserted on first sign-in.

**Unchanged (intentionally global caches):**
- `words_cache` and `images_cache` stay global, **no `user_id`**. They cache
  definitions/translations/images shared across all users and levels; adding a
  user scope would break the cost-saving cache.

**Migration:** `TRUNCATE readings, reading_attempts;` then add the `NOT NULL`
columns; generate with `drizzle-kit generate`. Cache tables keep their rows.

## Route & data-flow changes

Each API route resolves `const { userId } = await auth()`; missing session → `401`.

- `GET /api/readings` → filter `where userId = current`.
- `POST /api/readings` → insert with `userId`.
- `GET` / `DELETE /api/readings/[id]` → verify ownership; `404` if not the user's.
- `POST /api/speech/assess` → verify the `readingId` belongs to the user; insert
  the attempt with `userId`.
- `GET /api/words/[word]`, `/audio`, `/save` → global cache; require a session but
  do not filter by user.

Server components: `reading/[id]/page.tsx` fetches the reading scoped to `userId`;
`notFound()` if it is not the user's.

**CEFR level migration:**
- `GET /api/profile` → returns the user's `cefr_level`, creating the profile with
  default `B1` if absent.
- `PATCH /api/profile` → updates the level.
- The level selector on `/reading` reads/writes via these endpoints instead of
  `localStorage`.
- Optional one-time seed: on first sign-in, if a legacy `localStorage` level
  exists, push it to the profile once.

**Rate limiting:** `clientKey` switches from IP to `userId`; per-route limits keep
their current values; leave a hook for a future global daily cost cap.

## Error handling

- No session → API `401`; middleware redirects protected pages to `/sign-in`.
- Email not in allowlist → clear "access restricted" state (Clerk Restrictions or
  our check).
- Access to another user's data → `404`.
- Missing Clerk env vars → fail-fast at startup (same pattern as `DATABASE_URL`).

## Testing

- **Unit:** mock `auth()` from `@clerk/nextjs/server` to return a fake `userId`.
  Verify (a) no session → `401` and (b) queries are scoped to the user (DB mocked).
  Extend the existing rate-limit tests for the per-user key.
- **E2E:** the current smoke tests navigate to `/reading`, which now redirects to
  `/sign-in` — those will break and must be adjusted. Keep home + 404 smoke as-is;
  the authenticated flow becomes a follow-up using Clerk testing tokens.

## New environment variables

Add to `.env.example` and document in `CLAUDE.md`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (and after-auth
  redirect URLs as needed)
- `ALLOWLIST_EMAILS` (only if the allowlist is enforced by us rather than Clerk)

## Out of scope (this phase)

- Progress dashboard, SRS, and the new learning modules (later phases).
- Organizations/teams, roles/permissions beyond the allowlist.
- Authenticated E2E coverage (follow-up).
- Per-user/global daily cost cap implementation (hook only; full impl later).
