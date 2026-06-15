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
          Go to reading and save new words →
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
