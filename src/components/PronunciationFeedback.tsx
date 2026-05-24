"use client";

import type { PronunciationScore, WordAssessment } from "@/services/pronunciation-scorer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function WordChip({ word }: { word: WordAssessment }) {
  const colorClass = scoreColor(word.accuracyScore);
  const hasIssue = word.errorType !== "None";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`cursor-default font-medium underline decoration-dotted underline-offset-4 ${colorClass}`}
        >
          {word.word}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs space-y-0.5 max-w-48">
        <p>Accuracy: <strong>{Math.round(word.accuracyScore)}/100</strong></p>
        {hasIssue && <p className="text-muted-foreground capitalize">{word.errorType}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

interface Props {
  score: PronunciationScore;
  onRetry: () => void;
}

export function PronunciationFeedback({ score, onRetry }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
        <ScoreBar label="Overall" value={score.pronScore} />
        <ScoreBar label="Accuracy" value={score.accuracyScore} />
        <ScoreBar label="Fluency" value={score.fluencyScore} />
        <ScoreBar label="Completeness" value={score.completenessScore} />
      </div>

      {score.words.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            Word-by-word — hover for details:
          </p>
          <p className="text-base leading-relaxed">
            {score.words.map((w, i) => (
              <span key={i}>
                <WordChip word={w} />
                {i < score.words.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
        </div>
      )}

      {score.recognizedText && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Recognized:</span> {score.recognizedText}
        </div>
      )}

      <button
        onClick={onRetry}
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
