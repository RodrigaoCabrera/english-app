"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HoverableText } from "@/components/HoverableText";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/cefr";

const LEVEL_KEY = "english-app:level";

interface Reading {
  id: number;
  level: CefrLevel;
  topic: string;
  bodyMd: string;
  keyWords: string[];
}

export default function VocabularyPage() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LEVEL_KEY) as CefrLevel | null;
    if (stored && (CEFR_LEVELS as readonly string[]).includes(stored)) {
      setLevel(stored);
    }
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setReading(null);

    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, topic: topic.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setReading(json.data as Reading);
      } else {
        setError(json.error ?? "Generation failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Vocabulary</h1>
        <p className="text-muted-foreground mt-1">
          Generate a reading passage. Hover the highlighted words to see
          definitions and images.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="text-sm font-medium block mb-1.5">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. travel, climate change, technology…"
            disabled={loading}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Level</label>
          <Select
            value={level}
            onValueChange={(v) => setLevel(v as CefrLevel)}
            disabled={loading}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CEFR_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading || !topic.trim()}>
          {loading ? "Generating…" : "Generate"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Generating your reading passage… this may take a few seconds.
        </div>
      )}

      {reading && (
        <div className="border rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground uppercase tracking-wide text-xs">
              {reading.level}
            </span>
            <span>·</span>
            <span className="capitalize">{reading.topic}</span>
          </div>

          <HoverableText
            markdown={reading.bodyMd}
            keyWords={reading.keyWords}
            level={reading.level}
          />

          {reading.keyWords.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Key vocabulary — hover to explore:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {reading.keyWords.map((w) => (
                  <span
                    key={w}
                    className="text-xs px-2 py-0.5 bg-muted rounded-full"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
