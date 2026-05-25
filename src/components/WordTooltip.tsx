"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CefrLevel } from "@/lib/cefr";

interface WordData {
  definition: string;
  example: string;
  imageUrl: string | null;
  translation: string | null;
}

interface Props {
  word: string;
  displayWord: string;
  level: CefrLevel;
}

export function WordTooltip({ word, displayWord, level }: Props) {
  const [data, setData] = useState<WordData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function handleOpenChange(open: boolean) {
    if (!open || data !== null || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(
        `/api/words/${encodeURIComponent(word)}?level=${level}`
      );
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function handlePlayAudio() {
    if (audioPlaying) return;
    setAudioPlaying(true);
    try {
      const res = await fetch(`/api/words/${encodeURIComponent(word)}/audio`);
      if (!res.ok) {
        setAudioPlaying(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const cleanup = () => URL.revokeObjectURL(url);
      audio.onended = () => {
        setAudioPlaying(false);
        cleanup();
      };
      audio.onerror = () => {
        setAudioPlaying(false);
        cleanup();
      };
      try {
        audio.play();
      } catch {
        setAudioPlaying(false);
        cleanup();
      }
    } catch {
      setAudioPlaying(false);
    }
  }

  async function handleSave() {
    setSaveError(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/words/${encodeURIComponent(word)}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      if (!res.ok) {
        setSaveError(true);
        return;
      }
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
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
        {data && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm capitalize">{word}</p>
              <button
                onClick={handlePlayAudio}
                disabled={audioPlaying}
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border disabled:opacity-40"
                aria-label="Play pronunciation"
              >
                {audioPlaying ? "Playing…" : "Play"}
              </button>
            </div>
            {data.translation && (
              <p className="text-sm bg-violet-500/10 text-violet-300 rounded px-2 py-1 font-medium">
                {data.translation}
              </p>
            )}
            <p className="text-sm leading-snug">{data.definition}</p>
            <p className="text-xs italic text-muted-foreground">
              &ldquo;{data.example}&rdquo;
            </p>
            {data.imageUrl && (
              <img
                src={data.imageUrl}
                alt={word}
                className="w-full rounded-md object-cover mt-1"
                style={{ maxHeight: 150 }}
              />
            )}
            {saveError && (
              <p className="text-xs text-destructive">Failed to save word.</p>
            )}
            <button
              onClick={handleSave}
              disabled={saved || saving}
              aria-label="Save this word to your vocabulary"
              className="cursor-pointer w-full text-xs border border-border rounded px-2 py-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Saved" : "Save word"}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
