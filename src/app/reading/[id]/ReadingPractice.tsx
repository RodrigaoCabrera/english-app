"use client";

import { useState } from "react";
import { Recorder } from "@/components/Recorder";
import { PronunciationFeedback } from "@/components/PronunciationFeedback";
import type { PronunciationScore } from "@/services/pronunciation-scorer";

interface Props {
  readingId: number;
  referenceText: string;
}

export function ReadingPractice({ readingId, referenceText }: Props) {
  const [score, setScore] = useState<PronunciationScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleResult(result: PronunciationScore) {
    setScore(result);
    setError(null);
  }

  function handleError(message: string) {
    setError(message);
    setScore(null);
  }

  function handleRetry() {
    setScore(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pronunciation Practice
        </h2>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!score && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Read the passage above aloud, then click Stop when you&apos;re done.
          </p>
          <Recorder
            referenceText={referenceText}
            readingId={readingId}
            onResult={handleResult}
            onError={handleError}
          />
        </div>
      )}

      {score && (
        <PronunciationFeedback score={score} onRetry={handleRetry} />
      )}
    </div>
  );
}
