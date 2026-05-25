"use client";

import { useState, useEffect, useCallback } from "react";
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

function cefrBadgeClass(level: string): string {
  if (level === "A1" || level === "A2")
    return "bg-emerald-900/50 text-emerald-400 border border-emerald-800/50";
  if (level === "B1" || level === "B2")
    return "bg-amber-900/40 text-amber-400 border border-amber-800/40";
  return "bg-violet-900/40 text-violet-400 border border-violet-800/40";
}

export default function ReadingPage() {
  const router = useRouter();
  const [allReadings, setAllReadings] = useState<Reading[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const filtered =
    filterLevel === "all"
      ? allReadings
      : allReadings.filter((r) => r.level === filterLevel);

  function openModal() {
    setGenerateError(null);
    setTopic("");
    setModalOpen(true);
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

  async function handleDelete(id: number) {
    setConfirmDeleteId(null);
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/readings/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAllReadings((prev) => prev.filter((r) => r.id !== id));
      } else {
        setDeleteError("Failed to delete. Please try again.");
      }
    } catch (error) {
      console.error("Failed to delete reading:", error);
      setDeleteError("Failed to delete. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Reading</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Generate passages and practice pronunciation.
          </p>
        </div>
        <button
          onClick={openModal}
          className="cursor-pointer text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Generate new
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

      {deleteError && (
        <p className="text-sm text-destructive">{deleteError}</p>
      )}

      {allReadings.length === 0 && (
        <div className="border border-border/50 rounded-lg p-14 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No readings yet.</p>
          <button
            onClick={openModal}
            className="cursor-pointer text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Generate your first reading
          </button>
        </div>
      )}

      {allReadings.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No readings at this level.</p>
      )}

      <ul className="space-y-1.5">
        {filtered.map((r) => (
          <li key={r.id} className="group flex items-center gap-2">
            <Link
              href={`/reading/${r.id}`}
              className="flex-1 flex items-center justify-between px-4 py-3 rounded-lg border border-border/60 hover:border-border hover:bg-accent/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded ${cefrBadgeClass(r.level)}`}
                >
                  {r.level}
                </span>
                <span className="capitalize text-sm">{r.topic}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(r.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
              </span>
            </Link>

            {confirmDeleteId === r.id ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="cursor-pointer text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="cursor-pointer text-xs px-2.5 py-1 rounded border border-destructive/60 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(r.id)}
                disabled={deletingId === r.id}
                className="cursor-pointer p-2 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
                aria-label="Delete reading"
              >
                {deletingId === r.id ? (
                  <span className="text-xs">…</span>
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </li>
        ))}
      </ul>

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
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
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              {generateError && (
                <p className="text-xs text-destructive">{generateError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
    </div>
  );
}
