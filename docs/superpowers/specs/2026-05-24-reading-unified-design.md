# Reading Module — Unified Design Spec
**Date:** 2026-05-24  
**Status:** Approved

## Problem

The app currently has two disconnected modules: `/vocabulary` (generate readings with hover vocab) and `/reading` (pronunciation practice on saved readings). This split creates friction — the user generates content in one place and practices in another. The UI has no way to translate words, and the pronunciation tab has no score history.

## Goal

Collapse both modules into a single unified **Reading** section. Every saved reading exposes vocabulary hover (with Spanish translation, definition, image, and TTS) and pronunciation practice in the same page via tabs.

---

## Navigation & Routes

| Route | Before | After |
|---|---|---|
| `/` | Two cards: Vocabulary + Reading | One card: Reading |
| `/vocabulary` | Generation form + hoverable text | **Removed** (redirect to `/reading`) |
| `/reading` | List of saved readings | List + "Generate New" button + level filter |
| `/reading/[id]` | Text + pronunciation | Tabs: Read (hover vocab) / Practice (pronunciation) |

---

## Page Designs

### `/reading` — Reading List

- **Header**: title "Reading" + "Generate New" button (right-aligned)
- **Level filter**: row of buttons (All / A1 / A2 / B1 / B2 / C1 / C2) to filter the list client-side
- **List items**: level badge (colored by CEFR level) + topic + date + delete icon (trash, with confirmation)
- **Empty state**: message + "Generate your first reading" button
- **Generate New modal**:
  - Topic input
  - Level selector (CEFR A1–C2, defaults to value stored in localStorage)
  - Cancel / Generate buttons
  - On success: redirect to `/reading/[id]` of the new reading

### `/reading/[id]` — Unified Detail

- **Breadcrumb**: "← Reading" link
- **Header**: CEFR level badge + topic title
- **Tabs**: "Read" | "Practice"

#### Read Tab
- Renders the reading body via `HoverableText` — key words are highlighted and hoverable
- Each highlighted word opens a `WordTooltip` popover with:
  - Word title
  - TTS button (plays audio pronunciation of the word)
  - Spanish translation (visually emphasized — purple/violet tint)
  - English definition (secondary, smaller)
  - Generated image (cached per word)
  - "Save word" button — adds to `saved_words` table
- Non-key words are plain text

#### Practice Tab
- Reference text shown in a muted box (the full passage in plain text, for the user to read aloud)
- Recorder component (start/stop, waveform)
- **Score history**: last 5 attempts shown as a compact list (date + overall score percentage), collapsed by default, expandable
- After recording: pronunciation feedback with per-word color coding (green / yellow / red) and overall score

---

## Data Model Changes

### New table: `saved_words`

```ts
saved_words (
  id          serial PK,
  word        text NOT NULL,
  level       cefr_level NOT NULL,
  translation text,          -- Spanish translation
  definition  text,
  image_hash  text,          -- FK to images_cache
  created_at  timestamp DEFAULT now()
)
```

No deduplication enforced in MVP — saving the same word twice is fine.

### Existing tables: no structural changes

`reading_attempts` already stores per-attempt scores. The score history UI just queries the last 5 rows filtered by `reading_id`.

---

## API Changes

### `GET /api/words/[word]?level=B1`
Add `translation` field to the response. The `word-definer` service extends its GPT call to also return a short Spanish translation (1–3 words).

Response shape:
```json
{
  "success": true,
  "data": {
    "word": "journey",
    "level": "B1",
    "translation": "viaje, trayecto",
    "definition": "A long trip from one place to another.",
    "example": "...",
    "imageUrl": "/cache/img/<hash>.png"
  }
}
```

### `POST /api/words/[word]/save`
New endpoint. Persists word to `saved_words`. Body: `{ word, level }`. Fetches cached definition/translation/image from `words_cache` (must exist — the tooltip already loaded it). Returns `{ success: true }`.

### `GET /api/words/[word]/audio`
New endpoint. Returns audio/mpeg. Calls OpenAI TTS-1 with the word text, caches the MP3 to disk (`public/cache/audio/<hash>.mp3`). On repeat calls, streams from disk.

### `GET /api/readings?level=B1`
Add optional `level` query param to the existing readings fetch. Filters the list server-side (or client-side — client-side is simpler given the 50-item limit).

### `DELETE /api/readings/[id]`
New endpoint. Deletes a reading by ID. Does not cascade to `reading_attempts` in MVP (keep history).

---

## Component Changes

| Component | Change |
|---|---|
| `WordTooltip.tsx` | Add `translation` prop, TTS button (fetch `/api/words/[word]/audio`), Save button |
| `HoverableText.tsx` | Pass `translation` through from word fetch response |
| `ReadingPractice.tsx` | Add score history section (query last 5 `reading_attempts` by `readingId`) |
| `src/app/reading/page.tsx` | Add Generate modal, level filter buttons, delete action |
| `src/app/reading/[id]/page.tsx` | Add tabs, use `HoverableText` in Read tab, pass `keyWords` from DB |
| `src/app/page.tsx` | Remove Vocabulary card |
| `src/app/vocabulary/page.tsx` | Add redirect to `/reading` |

---

## Service Changes

### `word-definer.ts`
Extend the GPT-4o-mini prompt to return `translation` (Spanish, 1–3 words) alongside `definition` and `example`. Store `translation` in `words_cache` (requires a new column).

### New: `src/lib/tts.ts`
Singleton wrapper around `openai.audio.speech.create`. Takes a word string, returns a Buffer. Caches to `public/cache/audio/` using SHA-1 of the word as filename.

---

## DB Migration Required

- Add `translation text` column to `words_cache`
- Add `saved_words` table
- Add `audio_hash text` column to `words_cache` (optional — can derive from word SHA-1)

---

## UI Rules

- No emojis anywhere (icons, labels, empty states, buttons)
- CEFR level badges: colored background per level
  - A1/A2: green tones
  - B1/B2: blue tones
  - C1/C2: purple tones
- Tab labels: plain text ("Read" / "Practice")
- Translation in tooltip: visually distinct (violet/purple tint background) to contrast with the English definition

---

## Out of Scope (Post-MVP)

- Saved words review screen (flashcard/quiz mode)
- Spaced repetition on saved vocabulary
- Auth + per-user saved words
- Offline / PWA
- Export vocabulary to Anki/CSV
