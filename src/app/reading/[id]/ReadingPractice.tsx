"use client";

import { useState } from "react";
import { Recorder } from "@/components/Recorder";
import { PronunciationFeedback } from "@/components/PronunciationFeedback";
import type { PronunciationScore } from "@/services/pronunciation-scorer";

export interface PastAttempt {
  id: number;
  score: {
    accuracyScore: number;
    fluencyScore: number;
    completenessScore: number;
  } | null;
  createdAt: string;
}

interface Props {
  readingId: number;
  referenceText: string;
  pastAttempts: PastAttempt[];
}

export function ReadingPractice({ readingId, referenceText, pastAttempts }: Props) {
  const [score, setScore] = useState<PronunciationScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

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
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
          Read aloud
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">{referenceText}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!score && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Record yourself reading the passage above, then click Stop.
          </p>
          <Recorder
            referenceText={referenceText}
            readingId={readingId}
            onResult={handleResult}
            onError={handleError}
          />
        </div>
      )}

      {score && <PronunciationFeedback score={score} onRetry={handleRetry} />}

      {pastAttempts.length > 0 && (
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {historyOpen ? "Hide" : "Show"} history ({pastAttempts.length} attempt
            {pastAttempts.length !== 1 ? "s" : ""})
          </button>
          {historyOpen && (
            <ul className="mt-3 space-y-1.5">
              {pastAttempts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  <span>
                    {a.score
                      ? `${Math.round(a.score.accuracyScore)}% accuracy`
                      : "No score"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
