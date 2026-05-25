"use client";

import { useState } from "react";
import { HoverableText } from "@/components/HoverableText";
import { ReadingPractice, type PastAttempt } from "./ReadingPractice";
import type { CefrLevel } from "@/lib/cefr";

interface Props {
  readingId: number;
  level: CefrLevel;
  bodyMd: string;
  keyWords: string[];
  referenceText: string;
  pastAttempts: PastAttempt[];
}

export function ReadingDetailTabs({
  readingId,
  level,
  bodyMd,
  keyWords,
  referenceText,
  pastAttempts,
}: Props) {
  const [tab, setTab] = useState<"read" | "practice">("read");

  return (
    <div>
      <div className="flex border-b border-border mb-6" role="tablist">
        <button
          onClick={() => setTab("read")}
          role="tab"
          aria-selected={tab === "read"}
          className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "read"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Read
        </button>
        <button
          onClick={() => setTab("practice")}
          role="tab"
          aria-selected={tab === "practice"}
          className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "practice"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Practice
        </button>
      </div>

      <div role="tabpanel">
        {tab === "read" && (
          <HoverableText markdown={bodyMd} keyWords={keyWords} level={level} />
        )}

        {tab === "practice" && (
          <ReadingPractice
            readingId={readingId}
            referenceText={referenceText}
            pastAttempts={pastAttempts}
          />
        )}
      </div>
    </div>
  );
}
