"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/cefr";

interface Reading {
  id: number;
  level: string;
  topic: string;
  createdAt: string;
}

const LEVEL_KEY = "english-app:level";
const UNDO_DURATION = 4000;

type LevelColor = { dot: string; badge: string; border: string; glow: string };

function cefrColor(level: string): LevelColor {
  if (level === "A1" || level === "A2")
    return {
      dot: "bg-emerald-400",
      badge: "text-emerald-400",
      border: "border-l-emerald-500/60",
      glow: "hover:border-l-emerald-400",
    };
  if (level === "B1" || level === "B2")
    return {
      dot: "bg-amber-400",
      badge: "text-amber-400",
      border: "border-l-amber-500/60",
      glow: "hover:border-l-amber-400",
    };
  return {
    dot: "bg-violet-400",
    badge: "text-violet-400",
    border: "border-l-violet-500/60",
    glow: "hover:border-l-violet-400",
  };
}

export default function ReadingPage() {
  const router = useRouter();
  const [allReadings, setAllReadings] = useState<Reading[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [deleteModalId, setDeleteModalId] = useState<number | null>(null);
  const [undoReading, setUndoReading] = useState<Reading | null>(null);
  const [undoProgress, setUndoProgress] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadReadings = useCallback(async () => {
    try {
      const res = await fetch("/api/readings");
      const json = await res.json();
      if (json.success) setAllReadings(json.data);
    } catch (error) {
      console.error("Failed to load readings:", error);
    }
  }, []);

  useEffect(() => {
    loadReadings();
    const stored = localStorage.getItem(LEVEL_KEY) as CefrLevel | null;
    if (stored && (CEFR_LEVELS as readonly string[]).includes(stored)) {
      setLevel(stored);
    }
  }, [loadReadings]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    };
  }, []);

  const filtered =
    filterLevel === "all"
      ? allReadings
      : allReadings.filter((r) => r.level === filterLevel);

  function openGenerateModal() {
    setGenerateError(null);
    setTopic("");
    setGenerateModalOpen(true);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, topic: topic.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        localStorage.setItem(LEVEL_KEY, level);
        router.push(`/reading/${json.data.id}`);
      } else {
        setGenerateError(json.error ?? "Generation failed");
      }
    } catch {
      setGenerateError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function confirmDelete() {
    if (deleteModalId === null) return;
    const reading = allReadings.find((r) => r.id === deleteModalId);
    if (!reading) return;
    const id = deleteModalId;
    setDeleteModalId(null);

    setAllReadings((prev) => prev.filter((r) => r.id !== id));
    setUndoReading(reading);
    setUndoProgress(0);

    const start = Date.now();
    undoIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setUndoProgress(Math.min(elapsed / UNDO_DURATION, 1));
    }, 50);

    undoTimerRef.current = setTimeout(async () => {
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
      setUndoReading(null);
      setUndoProgress(0);
      await fetch(`/api/readings/${id}`, { method: "DELETE" });
    }, UNDO_DURATION);
  }

  function handleUndo() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    if (undoReading) {
      setAllReadings((prev) =>
        [...prev, undoReading].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
    }
    setUndoReading(null);
    setUndoProgress(0);
  }

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Reading</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {allReadings.length > 0
              ? `${allReadings.length} passage${allReadings.length === 1 ? "" : "s"} · hover to translate`
              : "Generate a passage to get started"}
          </p>
        </div>
        <button
          onClick={openGenerateModal}
          className="cursor-pointer shrink-0 text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Generate
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", ...CEFR_LEVELS] as const).map((l) => (
          <button
            key={l}
            onClick={() => setFilterLevel(l)}
            className={`cursor-pointer text-xs px-3 py-1 rounded-full border transition-colors ${
              filterLevel === l
                ? "bg-primary/15 text-primary border-primary/40"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            {l === "all" ? "All" : l}
          </button>
        ))}
      </div>

      {allReadings.length === 0 && (
        <div className="border border-border/50 rounded-lg p-14 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No readings yet.</p>
          <button
            onClick={openGenerateModal}
            className="cursor-pointer text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Generate your first reading
          </button>
        </div>
      )}

      {allReadings.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No readings at this level.</p>
      )}

      <ul className="space-y-2">
        {filtered.map((r) => {
          const c = cefrColor(r.level);
          return (
            <li key={r.id} className="flex items-stretch gap-0">
              <Link
                href={`/reading/${r.id}`}
                className={`flex-1 flex items-center justify-between px-5 py-4 rounded-l-lg border border-r-0 border-border/50 border-l-2 bg-card/60 hover:bg-card transition-all ${c.border} ${c.glow}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 w-2 h-2 rounded-full ${c.dot}`} />
                  <div className="min-w-0">
                    <p className="capitalize text-sm font-medium leading-snug truncate">
                      {r.topic}
                    </p>
                    <p className={`text-xs mt-0.5 font-semibold ${c.badge}`}>
                      {r.level}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-4">
                  {new Date(r.createdAt).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>

              <button
                onClick={() => setDeleteModalId(r.id)}
                aria-label="Delete reading"
                className="cursor-pointer flex items-center px-3 rounded-r-lg border border-l-0 border-border/50 bg-card/60 hover:bg-card text-muted-foreground/30 hover:text-destructive transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Delete confirmation modal */}
      {deleteModalId !== null && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteModalId(null);
          }}
        >
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="space-y-1">
              <h2 className="font-serif text-lg font-semibold">Delete reading?</h2>
              <p className="text-sm text-muted-foreground">
                <span className="capitalize text-foreground/80">
                  {allReadings.find((r) => r.id === deleteModalId)?.topic}
                </span>{" "}
                will be removed. You can undo this right after.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModalId(null)}
                className="cursor-pointer flex-1 h-9 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="cursor-pointer flex-1 h-9 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate modal */}
      {generateModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGenerateModalOpen(false);
          }}
        >
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
            <div>
              <h2 className="font-serif text-lg font-semibold">Generate new reading</h2>
              <p className="text-xs text-muted-foreground mt-1">
                AI will write a passage tailored to your level.
              </p>
            </div>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Topic
                </label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="travel, technology, food..."
                  disabled={generating}
                  autoFocus
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  CEFR Level
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as CefrLevel)}
                  disabled={generating}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  {CEFR_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              {generateError && (
                <p className="text-xs text-destructive">{generateError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setGenerateModalOpen(false)}
                  disabled={generating}
                  className="cursor-pointer flex-1 h-9 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating || !topic.trim()}
                  className="cursor-pointer flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {generating ? "Generating…" : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Undo toast */}
      {undoReading && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 shadow-2xl min-w-64">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground/80 truncate">
              <span className="capitalize">{undoReading.topic}</span> deleted
            </p>
            <div className="mt-1.5 h-0.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-none rounded-full"
                style={{ width: `${(1 - undoProgress) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={handleUndo}
            className="cursor-pointer text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
