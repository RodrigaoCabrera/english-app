"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CefrLevel } from "@/lib/cefr";

interface WordDefinition {
  definition: string;
  example: string;
  imageUrl: string | null;
}

interface Props {
  word: string;
  displayWord: string;
  level: CefrLevel;
}

export function WordTooltip({ word, displayWord, level }: Props) {
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleOpenChange(open: boolean) {
    if (!open || definition !== null || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(
        `/api/words/${encodeURIComponent(word)}?level=${level}`
      );
      const json = await res.json();
      if (json.success) {
        setDefinition(json.data);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span className="cursor-pointer underline decoration-dotted decoration-primary/50 hover:decoration-primary text-primary/80 hover:text-primary transition-colors">
          {displayWord}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Loading…
          </p>
        )}
        {failed && (
          <p className="text-sm text-destructive">Could not load definition.</p>
        )}
        {definition && (
          <div className="space-y-2">
            <p className="font-semibold text-sm capitalize">{word}</p>
            <p className="text-sm leading-snug">{definition.definition}</p>
            <p className="text-xs italic text-muted-foreground">
              &ldquo;{definition.example}&rdquo;
            </p>
            {definition.imageUrl && (
              <img
                src={definition.imageUrl}
                alt={word}
                className="w-full rounded-md object-cover mt-1"
                style={{ maxHeight: 150 }}
              />
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
