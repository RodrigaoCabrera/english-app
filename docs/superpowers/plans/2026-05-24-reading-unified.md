# Reading Module — Unified Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse `/vocabulary` and `/reading` into a single unified Reading module where every saved reading offers vocabulary hover (Spanish translation + definition + image + TTS + save) and pronunciation practice in tabbed layout.

**Architecture:** The reading list page (`/reading`) becomes a client component with a generation modal, level filter, and delete. The detail page (`/reading/[id]`) uses a new `ReadingDetailTabs` client component with two tabs: Read (HoverableText) and Practice (Recorder + score history). Three new API routes handle audio TTS, saving words, and deleting readings. Two DB columns are added and one new table.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + PostgreSQL, OpenAI SDK (TTS-1 + GPT-4o-mini), Tailwind CSS v4, Zod, Lucide icons.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/db/schema.ts` |
| Run migration | `npm run db:generate && npm run db:migrate` |
| Modify | `src/services/word-definer.ts` |
| Create | `src/lib/tts.ts` |
| Create | `public/cache/audio/.gitkeep` |
| Create | `src/app/api/words/[word]/audio/route.ts` |
| Create | `src/app/api/words/[word]/save/route.ts` |
| Create | `src/app/api/readings/[id]/route.ts` |
| Modify | `src/components/WordTooltip.tsx` |
| Create | `src/app/reading/[id]/ReadingDetailTabs.tsx` |
| Modify | `src/app/reading/[id]/ReadingPractice.tsx` |
| Modify | `src/app/reading/[id]/page.tsx` |
| Rewrite | `src/app/reading/page.tsx` |
| Modify | `src/app/page.tsx` |
| Replace | `src/app/vocabulary/page.tsx` |

---

## Task 1: DB Schema — add `translation` to `words_cache` and new `saved_words` table

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `translation` column to `wordsCache` and add `savedWords` table**

Replace the `wordsCache` and add `savedWords` in `src/db/schema.ts`:

```typescript
import { pgTable, text, jsonb, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  level: text("level").notNull(),
  topic: text("topic").notNull(),
  bodyMd: text("body_md").notNull(),
  wordList: jsonb("word_list").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wordsCache = pgTable("words_cache", {
  word: text("word").primaryKey(),
  level: text("level").notNull(),
  definition: text("definition").notNull(),
  example: text("example").notNull(),
  imageHash: text("image_hash"),
  translation: text("translation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const imagesCache = pgTable("images_cache", {
  hash: text("hash").primaryKey(),
  prompt: text("prompt").notNull(),
  filePath: text("file_path").notNull(),
  mime: text("mime").notNull().default("image/png"),
  bytes: integer("bytes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const readingAttempts = pgTable("reading_attempts", {
  id: serial("id").primaryKey(),
  readingId: integer("reading_id")
    .notNull()
    .references(() => readings.id),
  audioPath: text("audio_path"),
  transcript: text("transcript"),
  score: jsonb("score").$type<{
    accuracyScore: number;
    fluencyScore: number;
    completenessScore: number;
    words: Array<{ word: string; accuracyScore: number; errorType: string }>;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedWords = pgTable("saved_words", {
  id: serial("id").primaryKey(),
  word: text("word").notNull(),
  level: text("level").notNull(),
  translation: text("translation"),
  definition: text("definition"),
  imageHash: text("image_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Generate and apply migration**

```powershell
npm run db:generate
npm run db:migrate
```

Expected: new migration file created in `src/db/migrations/`, applied to DB. No errors.

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```powershell
git add src/db/schema.ts src/db/migrations/
git commit -m "feat: add translation column to words_cache and saved_words table"
```

---

## Task 2: Add Spanish translation to `word-definer` service

**Files:**
- Modify: `src/services/word-definer.ts`

- [ ] **Step 1: Update `WordDefinition` interface and add `fetchTranslation` function**

Replace the full contents of `src/services/word-definer.ts`:

```typescript
import { and, eq } from "drizzle-orm";
import { getOpenAI } from "@/lib/openai";
import { type CefrLevel } from "@/lib/cefr";
import { db } from "@/db";
import { wordsCache } from "@/db/schema";
import { sha1, findImageByWord, saveImage } from "@/lib/cache";

export interface WordDefinition {
  word: string;
  definition: string;
  example: string;
  imageUrl: string | null;
  translation: string | null;
}

interface DictEntry {
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{
      definition?: string;
      example?: string;
    }>;
  }>;
}

async function fetchDefinition(word: string): Promise<{ definition: string; example: string }> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);

  if (!res.ok) {
    throw new Error(`Word "${word}" not found in dictionary`);
  }

  const data: DictEntry[] = await res.json();
  const entry = data[0];

  for (const meaning of entry.meanings ?? []) {
    for (const def of meaning.definitions ?? []) {
      if (def.definition && def.example) {
        return { definition: def.definition, example: def.example };
      }
    }
  }

  const firstDef = entry.meanings?.[0]?.definitions?.[0];
  if (firstDef?.definition) {
    return {
      definition: firstDef.definition,
      example: `The word "${word}" is commonly used in English.`,
    };
  }

  throw new Error(`No definition found for "${word}"`);
}

async function fetchTranslation(word: string): Promise<string | null> {
  try {
    const openai = getOpenAI();
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Translate the English word "${word}" to Spanish. Reply with only 1-3 Spanish words, no punctuation, no explanation.`,
        },
      ],
      max_tokens: 20,
    });
    return res.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function defineWord(
  word: string,
  level: CefrLevel
): Promise<WordDefinition> {
  const normalized = word.toLowerCase().trim();

  const cached = await db
    .select()
    .from(wordsCache)
    .where(and(eq(wordsCache.word, normalized), eq(wordsCache.level, level)))
    .limit(1);

  if (cached.length > 0) {
    const row = cached[0];
    return {
      word: normalized,
      definition: row.definition,
      example: row.example,
      imageUrl: row.imageHash ? `/cache/img/${row.imageHash}.png` : null,
      translation: row.translation ?? null,
    };
  }

  const [{ definition, example }, translation] = await Promise.all([
    fetchDefinition(normalized),
    fetchTranslation(normalized),
  ]);

  const imageHash = sha1(normalized);
  let imageUrl = await findImageByWord(normalized);

  if (!imageUrl) {
    try {
      const openai = getOpenAI();
      const imgPrompt = `Minimalist illustration of "${normalized}" on a white background, suitable for a language learning app, simple and clear.`;
      const imgResponse = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imgPrompt,
        size: "1024x1024",
        n: 1,
      });

      const b64 = imgResponse.data?.[0]?.b64_json;
      if (b64) {
        imageUrl = await saveImage(normalized, imgPrompt, b64);
      }
    } catch {
      // Image generation is non-fatal
    }
  }

  await db
    .insert(wordsCache)
    .values({
      word: normalized,
      level,
      definition,
      example,
      imageHash: imageUrl ? imageHash : null,
      translation,
    })
    .onConflictDoNothing();

  return { word: normalized, definition, example, imageUrl, translation };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/services/word-definer.ts
git commit -m "feat: add Spanish translation to word-definer service"
```

---

## Task 3: TTS library + audio cache directory

**Files:**
- Create: `src/lib/tts.ts`
- Create: `public/cache/audio/.gitkeep`

- [ ] **Step 1: Create `public/cache/audio/.gitkeep`**

Create an empty file at `public/cache/audio/.gitkeep` (ensures directory is tracked by git).

- [ ] **Step 2: Create `src/lib/tts.ts`**

```typescript
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getOpenAI } from "@/lib/openai";

const AUDIO_DIR = path.join(process.cwd(), "public", "cache", "audio");

export function wordAudioHash(word: string): string {
  return crypto.createHash("sha1").update(word.toLowerCase().trim()).digest("hex");
}

export async function getWordAudio(word: string): Promise<Buffer> {
  const hash = wordAudioHash(word);
  const filePath = path.join(AUDIO_DIR, `${hash}.mp3`);

  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }

  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  const openai = getOpenAI();
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: word,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return buffer;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add src/lib/tts.ts public/cache/audio/.gitkeep
git commit -m "feat: add TTS library with disk cache"
```

---

## Task 4: Audio API endpoint (`GET /api/words/[word]/audio`)

**Files:**
- Create: `src/app/api/words/[word]/audio/route.ts`

- [ ] **Step 1: Create the audio route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getWordAudio } from "@/lib/tts";

export async function GET(
  _request: NextRequest,
  segmentData: { params: Promise<{ word: string }> }
) {
  const { word } = await segmentData.params;
  const clean = decodeURIComponent(word).trim();

  if (!clean || clean.length > 60) {
    return new NextResponse("Invalid word", { status: 400 });
  }

  try {
    const buffer = await getWordAudio(clean);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Failed to generate audio", { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/api/words/
git commit -m "feat: add TTS audio endpoint GET /api/words/[word]/audio"
```

---

## Task 5: Save word API endpoint (`POST /api/words/[word]/save`)

**Files:**
- Create: `src/app/api/words/[word]/save/route.ts`

- [ ] **Step 1: Create the save route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { wordsCache, savedWords } from "@/db/schema";
import { CEFR_LEVELS } from "@/lib/cefr";

const BodySchema = z.object({
  level: z.enum(CEFR_LEVELS),
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ word: string }> }
) {
  const { word } = await segmentData.params;
  const clean = decodeURIComponent(word).trim().toLowerCase();

  if (!clean || clean.length > 60) {
    return NextResponse.json({ success: false, error: "Invalid word" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid level" }, { status: 400 });
  }

  const { level } = parsed.data;

  const cached = await db
    .select()
    .from(wordsCache)
    .where(and(eq(wordsCache.word, clean), eq(wordsCache.level, level)))
    .limit(1);

  const row = cached[0];

  await db.insert(savedWords).values({
    word: clean,
    level,
    translation: row?.translation ?? null,
    definition: row?.definition ?? null,
    imageHash: row?.imageHash ?? null,
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/api/words/
git commit -m "feat: add save word endpoint POST /api/words/[word]/save"
```

---

## Task 6: Delete reading API endpoint (`DELETE /api/readings/[id]`)

**Files:**
- Create: `src/app/api/readings/[id]/route.ts`

- [ ] **Step 1: Create the delete route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { readings } from "@/db/schema";

export async function DELETE(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { id } = await segmentData.params;
  const numId = parseInt(id, 10);

  if (isNaN(numId)) {
    return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
  }

  await db.delete(readings).where(eq(readings.id, numId));
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/api/readings/
git commit -m "feat: add delete reading endpoint DELETE /api/readings/[id]"
```

---

## Task 7: Update `WordTooltip` — translation + TTS button + Save button

**Files:**
- Modify: `src/components/WordTooltip.tsx`

- [ ] **Step 1: Replace `WordTooltip.tsx`**

```typescript
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
  const [audioPlaying, setAudioPlaying] = useState(false);

  async function handleOpenChange(open: boolean) {
    if (!open || data !== null || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(
        `/api/words/${encodeURIComponent(word)}?level=${level}`
      );
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
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setAudioPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => setAudioPlaying(false);
      audio.play();
    } catch {
      setAudioPlaying(false);
    }
  }

  async function handleSave() {
    try {
      await fetch(`/api/words/${encodeURIComponent(word)}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      setSaved(true);
    } catch {
      // Non-fatal
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
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border disabled:opacity-40"
                aria-label="Play pronunciation"
              >
                {audioPlaying ? "..." : "Play"}
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
            <button
              onClick={handleSave}
              disabled={saved}
              className="w-full text-xs border border-border rounded px-2 py-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {saved ? "Saved" : "Save word"}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/WordTooltip.tsx
git commit -m "feat: add translation, TTS, and save to WordTooltip"
```

---

## Task 8: Update `ReadingPractice` — add `pastAttempts` prop and score history

**Files:**
- Modify: `src/app/reading/[id]/ReadingPractice.tsx`

- [ ] **Step 1: Replace `ReadingPractice.tsx`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/reading/[id]/ReadingPractice.tsx
git commit -m "feat: add score history to ReadingPractice"
```

---

## Task 9: Create `ReadingDetailTabs` client component

**Files:**
- Create: `src/app/reading/[id]/ReadingDetailTabs.tsx`

- [ ] **Step 1: Create `ReadingDetailTabs.tsx`**

```typescript
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
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setTab("read")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "read"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Read
        </button>
        <button
          onClick={() => setTab("practice")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "practice"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Practice
        </button>
      </div>

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
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/reading/[id]/ReadingDetailTabs.tsx
git commit -m "feat: add ReadingDetailTabs with Read/Practice tabs"
```

---

## Task 10: Rewrite `/reading/[id]/page.tsx` — use tabs, fetch attempts

**Files:**
- Modify: `src/app/reading/[id]/page.tsx`

- [ ] **Step 1: Replace `page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { readings, readingAttempts } from "@/db/schema";
import { ReadingDetailTabs } from "./ReadingDetailTabs";
import type { CefrLevel } from "@/lib/cefr";

interface Props {
  params: Promise<{ id: string }>;
}

function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

function cefrBadgeClass(level: CefrLevel): string {
  if (level === "A1" || level === "A2") return "bg-green-900/50 text-green-300";
  if (level === "B1" || level === "B2") return "bg-blue-900/50 text-blue-300";
  return "bg-purple-900/50 text-purple-300";
}

export default async function ReadingDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  const [rows, attempts] = await Promise.all([
    db.select().from(readings).where(eq(readings.id, numId)).limit(1),
    db
      .select({
        id: readingAttempts.id,
        score: readingAttempts.score,
        createdAt: readingAttempts.createdAt,
      })
      .from(readingAttempts)
      .where(eq(readingAttempts.readingId, numId))
      .orderBy(desc(readingAttempts.createdAt))
      .limit(5),
  ]);

  if (rows.length === 0) notFound();

  const reading = rows[0];
  const plainText = markdownToPlainText(reading.bodyMd);

  const pastAttempts = attempts.map((a) => ({
    id: a.id,
    score: a.score
      ? {
          accuracyScore: a.score.accuracyScore,
          fluencyScore: a.score.fluencyScore,
          completenessScore: a.score.completenessScore,
        }
      : null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/reading" className="hover:text-foreground transition-colors">
          Reading
        </Link>
        <span>/</span>
        <span className="text-foreground capitalize">{reading.topic}</span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${cefrBadgeClass(reading.level as CefrLevel)}`}
        >
          {reading.level}
        </span>
        <h1 className="text-xl font-semibold capitalize">{reading.topic}</h1>
      </div>

      <ReadingDetailTabs
        readingId={reading.id}
        level={reading.level as CefrLevel}
        bodyMd={reading.bodyMd}
        keyWords={reading.wordList}
        referenceText={plainText}
        pastAttempts={pastAttempts}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/reading/[id]/page.tsx
git commit -m "feat: unify reading detail with tabs, HoverableText, and score history"
```

---

## Task 11: Rewrite `/reading/page.tsx` — modal + level filter + delete

**Files:**
- Modify: `src/app/reading/page.tsx`

- [ ] **Step 1: Replace `reading/page.tsx`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/reading/page.tsx
git commit -m "feat: rewrite reading list with modal, level filter, and delete"
```

---

## Task 12: Cleanup — home page + vocabulary redirect

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/vocabulary/page.tsx`

- [ ] **Step 1: Update `src/app/page.tsx` — single Reading card**

```typescript
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Learn English with AI</h1>
        <p className="text-muted-foreground">
          Improve your reading, vocabulary, and pronunciation through AI-generated content tailored to your CEFR level.
        </p>
      </div>
      <div className="max-w-sm">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Reading</CardTitle>
            <CardDescription>
              Generate AI passages, explore vocabulary with hover translations, and practice pronunciation word by word.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/reading">Start</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/vocabulary/page.tsx` with a redirect**

```typescript
import { redirect } from "next/navigation";

export default function VocabularyPage() {
  redirect("/reading");
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Full build check**

```powershell
npm run build
```

Expected: build succeeds with no TypeScript or Next.js errors.

- [ ] **Step 5: Commit**

```powershell
git add src/app/page.tsx src/app/vocabulary/page.tsx
git commit -m "feat: remove Vocabulary card from home, add redirect from /vocabulary"
```

---

## Final Manual Verification

After all tasks complete, run the app and verify:

```powershell
npm run dev
```

1. Open `http://localhost:3000` — single "Reading" card visible, no "Vocabulary" card.
2. Navigate to `/vocabulary` — redirects to `/reading`.
3. On `/reading` — list is empty, click "Generate new", fill topic + level, click Generate. Should redirect to `/reading/[id]`.
4. On `/reading/[id]` — two tabs visible: "Read" and "Practice". Read tab shows text with highlighted words.
5. Hover a highlighted word — popover shows translation (violet), definition, image, Play button, Save word button.
6. Click "Play" — audio plays.
7. Click "Save word" — button changes to "Saved".
8. Switch to Practice tab — reference text visible, Record button present.
9. Go back to `/reading` — generated reading appears in list with level badge and date.
10. Click filter button (e.g., "B1") — list filters correctly.
11. Click trash icon next to a reading — confirm dialog appears, on confirm the reading disappears.
