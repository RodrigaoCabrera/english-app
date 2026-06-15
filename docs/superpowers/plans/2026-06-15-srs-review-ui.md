# SRS Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/review` flashcard session and the dashboard "due for review" banner on top of the existing SRS backend.

**Architecture:** A new `/review` route (RSC entry that fetches due words server-side via the `srs` service) drives three client components — `ReviewSession` (flow), `Flashcard` (presentation), `GradeButtons` (grade controls). The dashboard gets a banner CTA fed by `getDueCount`, and the header nav gets a "Review" link. No backend changes: it consumes `GET`-equivalent `getDueWords` server-side and `POST /api/srs/review` from the client.

**Tech Stack:** Next.js 16 (App Router, RSC + client components), React 19, Tailwind v4, Vitest + jsdom + `@testing-library/react`, browser `speechSynthesis` for audio.

---

## Background for the implementer

The backend (Phase 7 Part 1) is done and **frozen**. You consume:

- **`getDueWords(userId, limit?, now?)`** in `src/services/srs.ts` → returns `DueWord[]`:
  ```ts
  export interface DueWord {
    word: string;
    level: string;
    dueDate: Date;
    definition: string | null;
    translation: string | null;
    imageHash: string | null;
  }
  ```
- **`getDueCount(userId, now?)`** in `src/services/srs.ts` → `Promise<number>`.
- **`POST /api/srs/review`** with JSON body `{ word: string, grade: Grade }` where
  `Grade = "again" | "hard" | "good" | "easy"` (exported from `src/lib/sm2.ts`).
  Returns `200 { success: true }`, `404` when the word is no longer in the queue,
  `401` unauthenticated, `400` on bad input.

Conventions to follow (read these files before starting):
- `src/components/WordTooltip.tsx` — the audio pattern (`window.speechSynthesis`),
  fetch + error handling, raw `<button>`/`<img>` with Tailwind classes.
- `src/app/dashboard/page.tsx` — RSC page style, `StatCard` look, `getUserId` + redirect.
- `src/app/layout.tsx` — header nav with `<Show when="signed-in">`.
- `tests/api/srs-review.test.ts` — `vi.hoisted` / `vi.mock` patterns.

Test runner: `pnpm exec vitest run <path>` runs a single file. `pnpm test` runs all.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/components/review/GradeButtons.tsx` (new) | The four grade buttons; pure presentational, calls `onGrade(grade)`. |
| `src/components/review/Flashcard.tsx` (new) | One card: front (meaning) / back (word + audio + image). No session logic. |
| `src/components/review/ReviewSession.tsx` (new) | Session flow: index, reveal, grade POST, error, empty + completion states, keyboard. |
| `src/app/review/page.tsx` (new) | RSC entry: auth, server-side `getDueWords`, renders `ReviewSession`. |
| `src/app/dashboard/page.tsx` (modify) | Add the due-for-review banner CTA via `getDueCount`. |
| `src/app/layout.tsx` (modify) | Add the "Review" nav link. |
| `tests/components/review/GradeButtons.test.tsx` (new) | Unit tests. |
| `tests/components/review/Flashcard.test.tsx` (new) | Unit tests. |
| `tests/components/review/ReviewSession.test.tsx` (new) | Unit tests. |
| `docs/ROADMAP.md` (modify) | Tick the two Part 2 items. |

---

## Task 1: GradeButtons component

**Files:**
- Create: `src/components/review/GradeButtons.tsx`
- Test: `tests/components/review/GradeButtons.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/review/GradeButtons.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GradeButtons } from "@/components/review/GradeButtons";

describe("GradeButtons", () => {
  it("renders the four grades", () => {
    render(<GradeButtons onGrade={() => {}} />);
    for (const label of ["Again", "Hard", "Good", "Easy"]) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });

  it("calls onGrade with the matching grade", () => {
    const onGrade = vi.fn();
    render(<GradeButtons onGrade={onGrade} />);
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(onGrade).toHaveBeenCalledWith("good");
  });

  it("disables the buttons when disabled", () => {
    const onGrade = vi.fn();
    render(<GradeButtons onGrade={onGrade} disabled />);
    fireEvent.click(screen.getByRole("button", { name: /easy/i }));
    expect(onGrade).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/review/GradeButtons.test.tsx`
Expected: FAIL — cannot resolve `@/components/review/GradeButtons`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/review/GradeButtons.tsx`:

```tsx
"use client";

import type { Grade } from "@/lib/sm2";

interface Props {
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: "again", label: "Again", hint: "1" },
  { grade: "hard", label: "Hard", hint: "2" },
  { grade: "good", label: "Good", hint: "3" },
  { grade: "easy", label: "Easy", hint: "4" },
];

export function GradeButtons({ onGrade, disabled = false }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {GRADES.map(({ grade, label, hint }) => (
        <button
          key={grade}
          onClick={() => onGrade(grade)}
          disabled={disabled}
          className="cursor-pointer rounded-md border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {label}
          <span className="ml-1 text-[10px] text-muted-foreground/60">{hint}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/components/review/GradeButtons.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/review/GradeButtons.tsx tests/components/review/GradeButtons.test.tsx
git commit -m "feat(srs): add GradeButtons component for review session"
```

---

## Task 2: Flashcard component

The card front shows the **meaning**; the back shows the **word + audio + image**.
Front fallback chain: `translation` → else `definition` → else `word`. When
`translation` is present and `definition` is present, the definition is shown on
the front as a secondary hint (layout B). Audio uses `window.speechSynthesis`
exactly like `WordTooltip`.

**Files:**
- Create: `src/components/review/Flashcard.tsx`
- Test: `tests/components/review/Flashcard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/review/Flashcard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Flashcard } from "@/components/review/Flashcard";
import type { DueWord } from "@/services/srs";

function card(overrides: Partial<DueWord> = {}): DueWord {
  return {
    word: "resilient",
    level: "B2",
    dueDate: new Date(),
    definition: "able to recover quickly from difficulties",
    translation: "resiliente",
    imageHash: "abc123",
    ...overrides,
  };
}

const speak = vi.fn();

beforeEach(() => {
  speak.mockReset();
  vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      lang = "";
      constructor(public text: string) {}
    }
  );
});

describe("Flashcard", () => {
  it("shows the translation on the front and hides the word before reveal", () => {
    render(<Flashcard card={card()} revealed={false} onReveal={() => {}} />);
    expect(screen.getByText("resiliente")).toBeInTheDocument();
    expect(screen.getByText(/able to recover quickly/i)).toBeInTheDocument();
    expect(screen.queryByText("resilient")).not.toBeInTheDocument();
  });

  it("falls back to the definition on the front when translation is null", () => {
    render(<Flashcard card={card({ translation: null })} revealed={false} onReveal={() => {}} />);
    expect(screen.getByText(/able to recover quickly/i)).toBeInTheDocument();
    expect(screen.queryByText("resilient")).not.toBeInTheDocument();
  });

  it("falls back to the word on the front when translation and definition are null", () => {
    render(
      <Flashcard
        card={card({ translation: null, definition: null })}
        revealed={false}
        onReveal={() => {}}
      />
    );
    expect(screen.getByText("resilient")).toBeInTheDocument();
  });

  it("reveals the word and the image when revealed", () => {
    render(<Flashcard card={card()} revealed onReveal={() => {}} />);
    expect(screen.getByText("resilient")).toBeInTheDocument();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/cache/img/abc123.png");
  });

  it("renders no image when imageHash is null", () => {
    render(<Flashcard card={card({ imageHash: null })} revealed onReveal={() => {}} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("plays audio via speechSynthesis when the audio button is clicked", () => {
    render(<Flashcard card={card()} revealed onReveal={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("calls onReveal when the front is clicked", () => {
    const onReveal = vi.fn();
    render(<Flashcard card={card()} revealed={false} onReveal={onReveal} />);
    fireEvent.click(screen.getByText("resiliente"));
    expect(onReveal).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/review/Flashcard.test.tsx`
Expected: FAIL — cannot resolve `@/components/review/Flashcard`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/review/Flashcard.tsx`:

```tsx
"use client";

import type { DueWord } from "@/services/srs";

interface Props {
  card: DueWord;
  revealed: boolean;
  onReveal: () => void;
}

export function Flashcard({ card, revealed, onReveal }: Props) {
  // Front fallback chain: translation -> definition -> word.
  const meaning = card.translation ?? card.definition ?? card.word;
  // Definition shows as a secondary hint on the front only when the translation
  // is the primary prompt (layout B). Otherwise it is already the primary.
  const hint = card.translation ? card.definition : null;

  function playAudio() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={onReveal}
        aria-label="Reveal the word"
        className="w-full cursor-pointer rounded-lg border border-border/60 bg-card/60 p-8 text-center transition-colors hover:border-foreground/30"
      >
        <p className="font-serif text-2xl italic text-primary/90">{meaning}</p>
        {hint && (
          <p className="mt-3 text-sm text-muted-foreground">&ldquo;{hint}&rdquo;</p>
        )}
        <p className="mt-6 text-[11px] uppercase tracking-widest text-muted-foreground/60">
          Click or press Space to reveal
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-8 text-center">
      <div className="flex items-center justify-center gap-3">
        <p className="text-3xl font-semibold capitalize">{card.word}</p>
        <button
          onClick={playAudio}
          aria-label="Play pronunciation"
          className="cursor-pointer rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ▶ Play
        </button>
      </div>
      {card.translation && (
        <p className="mt-3 font-serif italic text-primary/80">{card.translation}</p>
      )}
      {card.definition && (
        <p className="mt-2 text-sm leading-snug text-muted-foreground">{card.definition}</p>
      )}
      {card.imageHash && (
        <img
          src={`/cache/img/${card.imageHash}.png`}
          alt={card.word}
          className="mx-auto mt-4 rounded-md object-cover"
          style={{ maxHeight: 160 }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/components/review/Flashcard.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/review/Flashcard.tsx tests/components/review/Flashcard.test.tsx
git commit -m "feat(srs): add Flashcard component with front/back and audio"
```

---

## Task 3: ReviewSession component

Owns the session: walks the `initialWords` array, reveal-then-grade, POSTs each
grade, advances on success or `404`, surfaces an error and stays put on other
failures, and renders the empty-queue and completion states. Keyboard: `Space`
reveals, `1`–`4` grade.

**Files:**
- Create: `src/components/review/ReviewSession.tsx`
- Test: `tests/components/review/ReviewSession.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/review/ReviewSession.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewSession } from "@/components/review/ReviewSession";
import type { DueWord } from "@/services/srs";

function card(word: string): DueWord {
  return {
    word,
    level: "B2",
    dueDate: new Date(),
    definition: `${word} definition`,
    translation: `${word}-es`,
    imageHash: null,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak: vi.fn() });
  vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; constructor(public text: string) {} });
});

describe("ReviewSession", () => {
  it("shows the empty state when there are no due words", () => {
    render(<ReviewSession initialWords={[]} />);
    expect(screen.getByText(/no words due/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reading/i })).toHaveAttribute("href", "/reading");
  });

  it("shows progress and reveals the answer, then the grade buttons", () => {
    render(<ReviewSession initialWords={[card("alpha"), card("beta")]} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /good/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    expect(screen.getByRole("button", { name: /good/i })).toBeInTheDocument();
  });

  it("POSTs the grade and advances to the next card", async () => {
    render(<ReviewSession initialWords={[card("alpha"), card("beta")]} />);
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/srs/review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ word: "alpha", grade: "good" }),
      })
    );
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
  });

  it("shows the completion screen after the last card", async () => {
    render(<ReviewSession initialWords={[card("alpha")]} />);
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(await screen.findByText(/reviewed 1 word/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
  });

  it("keeps the card and shows an error when the POST fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ success: false }) });
    render(<ReviewSession initialWords={[card("alpha"), card("beta")]} />);
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("advances on a 404 (word already out of the queue)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ success: false }) });
    render(<ReviewSession initialWords={[card("alpha"), card("beta")]} />);
    fireEvent.click(screen.getByRole("button", { name: /show answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/review/ReviewSession.test.tsx`
Expected: FAIL — cannot resolve `@/components/review/ReviewSession`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/review/ReviewSession.tsx`:

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import type { DueWord } from "@/services/srs";
import type { Grade } from "@/lib/sm2";
import { Flashcard } from "./Flashcard";
import { GradeButtons } from "./GradeButtons";

interface Props {
  initialWords: DueWord[];
}

const KEY_TO_GRADE: Record<string, Grade> = {
  Digit1: "again",
  Digit2: "hard",
  Digit3: "good",
  Digit4: "easy",
};

export function ReviewSession({ initialWords }: Props) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = initialWords.length;
  const current = initialWords[index];

  const reveal = useCallback(() => setRevealed(true), []);

  const handleGrade = useCallback(
    async (grade: Grade) => {
      if (!current || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/srs/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: current.word, grade }),
        });
        // 404 = the word is no longer in the queue; treat as handled and move on.
        if (!res.ok && res.status !== 404) {
          setError("Could not save your review. Try again.");
          return;
        }
        setIndex((i) => i + 1);
        setRevealed(false);
      } catch {
        setError("Could not save your review. Try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [current, submitting]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      if (!revealed && e.code === "Space") {
        e.preventDefault();
        reveal();
        return;
      }
      if (revealed && !submitting) {
        const grade = KEY_TO_GRADE[e.code];
        if (grade) {
          e.preventDefault();
          void handleGrade(grade);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, submitting, reveal, handleGrade]);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/60 p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">No words due for review right now.</p>
        <Link
          href="/reading"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Read something and save new words →
        </Link>
      </div>
    );
  }

  if (index >= total) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/60 p-8 text-center space-y-3">
        <p className="text-lg font-semibold">
          Reviewed {total} word{total === 1 ? "" : "s"} 🎉
        </p>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Back to dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        {index + 1} / {total}
      </p>
      <Flashcard card={current} revealed={revealed} onReveal={reveal} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {revealed ? (
        <GradeButtons onGrade={handleGrade} disabled={submitting} />
      ) : (
        <button
          onClick={reveal}
          className="cursor-pointer w-full rounded-md border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Show answer
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/components/review/ReviewSession.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/review/ReviewSession.tsx tests/components/review/ReviewSession.test.tsx
git commit -m "feat(srs): add ReviewSession orchestration component"
```

---

## Task 4: Review page route

RSC entry. No unit test (matches the repo convention of not unit-testing RSC
pages that call Clerk/redirect); verified by the build in Task 7.

**Files:**
- Create: `src/app/review/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/review/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { getDueWords } from "@/services/srs";
import { ReviewSession } from "@/components/review/ReviewSession";

export default async function ReviewPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const words = await getDueWords(userId, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Review</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Spaced repetition for your saved words
        </p>
      </div>
      <ReviewSession initialWords={words} />
    </div>
  );
}
```

- [ ] **Step 2: Verify the full suite still passes**

Run: `pnpm test`
Expected: PASS (all existing + the three new component test files).

- [ ] **Step 3: Commit**

```bash
git add src/app/review/page.tsx
git commit -m "feat(srs): add /review page wiring the review session"
```

---

## Task 5: Dashboard due-for-review banner

Add a banner CTA to the dashboard, shown only when `getDueCount(userId) > 0`.

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add the import**

In `src/app/dashboard/page.tsx`, add `getDueCount` to the imports near the top
(after the existing imports):

```tsx
import { getDueCount } from "@/services/srs";
```

- [ ] **Step 2: Add the banner component**

Add this component above `DashboardPage` (next to the other small components like `StatCard`):

```tsx
function DueReviewBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Link
      href="/review"
      className="flex items-center gap-4 rounded-lg border border-violet-500/40 bg-violet-500/10 p-4 transition-colors hover:border-violet-400/60"
    >
      <span className="text-2xl font-bold text-violet-300 leading-none">{count}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">
          Word{count === 1 ? "" : "s"} due for review
        </span>
        <span className="block text-[11px] text-muted-foreground mt-0.5">
          Keep your vocabulary fresh
        </span>
      </span>
      <span className="text-sm font-semibold text-violet-300">Start review →</span>
    </Link>
  );
}
```

- [ ] **Step 3: Fetch the count and render the banner**

In `DashboardPage`, fetch the count alongside the dashboard data and render the
banner at the top of the returned layout. Replace the data-loading line:

```tsx
  const data: DashboardData = await getDashboardData(userId);
```

with:

```tsx
  const [data, dueCount] = await Promise.all([
    getDashboardData(userId),
    getDueCount(userId),
  ]);
```

Then, inside the returned JSX, add the banner immediately after the heading
`<div>` block (before the stats grid):

```tsx
      <DueReviewBanner count={dueCount} />
```

- [ ] **Step 4: Verify the full suite still passes**

Run: `pnpm test`
Expected: PASS (no dashboard test asserts on the banner; nothing breaks).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(srs): surface due-for-review banner on the dashboard"
```

---

## Task 6: Add the "Review" nav link

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add the link**

In `src/app/layout.tsx`, inside the `<Show when="signed-in">` block in the nav,
add a "Review" link after the existing "Reading" link and before "Dashboard":

```tsx
                    <Link href="/review" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Review
                    </Link>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(srs): add Review link to the header nav"
```

---

## Task 7: Roadmap update + final verification

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Tick the Part 2 items**

In `docs/ROADMAP.md`, in the Phase 7 section, change these two lines from `[ ]` to `[x]`:

```markdown
- [x] Review UI: flashcard-style session (definition ↔ word, with audio/image)
- [x] Daily "due for review" surfacing on the dashboard
```

Also update the Phase 7 status line from `[~] in progress` to `[x] done` and the
header date note (`> Last updated:`) to `2026-06-15`.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all suites green.

- [ ] **Step 3: Run the production build (type-check + route compile)**

Run: `pnpm build`
Expected: build succeeds; `/review` appears in the route list; no type errors.

- [ ] **Step 4: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(srs): mark Phase 7 Review UI items complete"
```

---

## Self-Review notes

- **Spec coverage:** direction meaning→word (Flashcard front = meaning, Task 2);
  layout B + fallback (Task 2 front chain + tests); one grade per card (Task 3
  `handleGrade` advances once); banner CTA option A (Task 5); browser audio
  (Task 2 `playAudio`); server-side initial fetch (Task 4 page); empty +
  completion states (Task 3); grade-failure / 404 handling (Task 3 tests); nav
  link (Task 6); roadmap tick (Task 7). All covered.
- **Reconciliation with spec:** the spec mentioned showing the definition on the
  *back* in a fallback case. With the chosen front chain the definition is always
  on the front whenever it exists (cases 1 and 2), so there is no reachable
  back-only case — the back simply re-shows translation/definition for reference.
  No dead branch is implemented.
- **Type consistency:** `Grade` imported from `@/lib/sm2`; `DueWord` from
  `@/services/srs`; `onGrade(grade: Grade)`, `onReveal()`, `initialWords:
  DueWord[]` are consistent across Tasks 1–4.
```
