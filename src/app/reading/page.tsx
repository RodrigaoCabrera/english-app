"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/cefr";

interface Reading {
  id: number;
  level: string;
  topic: string;
  createdAt: string;
}

const LEVEL_KEY = "english-app:level";

function cefrBadgeClass(level: string): string {
  if (level === "A1" || level === "A2") return "bg-green-900/50 text-green-300";
  if (level === "B1" || level === "B2") return "bg-blue-900/50 text-blue-300";
  return "bg-purple-900/50 text-purple-300";
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

  const loadReadings = useCallback(async () => {
    try {
      const res = await fetch("/api/readings");
      const json = await res.json();
      if (json.success) setAllReadings(json.data);
    } catch {
      // Silently fail — empty list is safe
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
    if (!confirm("Delete this reading?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/readings/${id}`, { method: "DELETE" });
      setAllReadings((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reading</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Generate passages and practice pronunciation.
          </p>
        </div>
        <Button onClick={openModal}>Generate new</Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", ...CEFR_LEVELS] as const).map((l) => (
          <button
            key={l}
            onClick={() => setFilterLevel(l)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterLevel === l
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {l === "all" ? "All" : l}
          </button>
        ))}
      </div>

      {allReadings.length === 0 && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="text-muted-foreground text-sm">No readings yet.</p>
          <Button variant="outline" onClick={openModal}>
            Generate your first reading
          </Button>
        </div>
      )}

      {allReadings.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No readings at this level.</p>
      )}

      <ul className="space-y-2">
        {filtered.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <Link
              href={`/reading/${r.id}`}
              className="flex-1 flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cefrBadgeClass(r.level)}`}
                >
                  {r.level}
                </span>
                <span className="capitalize text-sm font-medium">{r.topic}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </Link>
            <button
              onClick={() => handleDelete(r.id)}
              disabled={deletingId === r.id}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
              aria-label="Delete reading"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div>
              <h2 className="text-base font-semibold">Generate new reading</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI will write a passage tailored to your level.
              </p>
            </div>
            <form onSubmit={handleGenerate} className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1.5">Topic</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. travel, technology, food..."
                  disabled={generating}
                  autoFocus
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">CEFR Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as CefrLevel)}
                  disabled={generating}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={generating}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={generating || !topic.trim()}
                  className="flex-1"
                >
                  {generating ? "Generating..." : "Generate"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
