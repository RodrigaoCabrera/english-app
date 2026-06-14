# English app
This is the codebase for the English learning app. It includes a Next.js frontend, a Node.js API backend, and integrations with Ollama, OpenAI, and Azure Cognitive Services for AI-powered content generation and pronunciation assessment.

@AGENTS.md

## Architecture

### Stack

- **Next.js 16** (App Router) — this version has breaking changes vs older Next.js; read `node_modules/next/dist/docs/` before touching routing or caching APIs
- **Drizzle ORM** + **PostgreSQL 16** (Docker) — schema in `src/db/schema.ts`, client in `src/db/index.ts`
- **Tailwind CSS v4** + **shadcn/ui** — component library in `src/components/ui/`
- **Zod v4** — used for request validation in every API route

### AI / External Service Layer

External services, each wrapped in a lazy singleton or helper in `src/lib/`:

| File | Service | Purpose |
|------|---------|---------|
| `src/lib/ollama.ts` | Ollama (cloud or local) | Reading passage generation |
| `src/lib/openai.ts` + `src/lib/tts.ts` | OpenAI | Word pronunciation audio (TTS) |
| `src/lib/unsplash.ts` | Unsplash | Word illustrations (optional; degrades to no image) |
| `src/lib/azure-speech.ts` | Azure Cognitive Services | Pronunciation assessment |

Word definitions and translations use free public APIs (no key): `dictionaryapi.dev`
for definitions and `mymemory.translated.net` for en→es translation.

Ollama configuration: if `OLLAMA_API_KEY` is set it connects to `https://ollama.com` (cloud models); otherwise falls back to `OLLAMA_HOST` (default `http://localhost:11434`). Model is controlled by `OLLAMA_MODEL` (default `llama3.2`).

Token usage for Ollama calls is tracked in-process by `src/lib/token-budget.ts` (daily rolling counter keyed by UTC date, throws when limits are exceeded).

### Features & Data Flow

**Reading generation** (`POST /api/readings`):
1. Validates `{ level: CefrLevel, topic: string }` via Zod
2. Calls `src/services/reading-generator.ts` → Ollama → returns `{ markdown, keyWords }`
3. Persists to `readings` table; `keyWords` stored as `jsonb`

**Word definitions** (`GET /api/words/[word]`):
1. Checks `words_cache` table first
2. Fetches definition from `dictionaryapi.dev` and translation from `mymemory.translated.net`
3. Fetches an illustration from Unsplash and caches it to disk (`src/lib/cache.ts`, served from `/cache/img/`); non-fatal if it fails
4. Writes result back to `words_cache`

**Word audio** (`GET /api/words/[word]/audio`): synthesizes pronunciation via OpenAI TTS (`src/lib/tts.ts`), returned as `audio/mpeg`.

**Pronunciation assessment** (`POST /api/speech/assess`):
1. Accepts `multipart/form-data` with `audio` (WAV blob), `referenceText`, `readingId`
2. Sends WAV buffer to Azure Speech REST API with Pronunciation Assessment config
3. Returns per-word accuracy scores and error types

### Rate limiting

`src/lib/rate-limit.ts` is an in-process, per-IP fixed-window limiter applied to all
routes that call paid services: `POST /api/readings`, `GET /api/words/[word]`,
`GET /api/words/[word]/audio`, and `POST /api/speech/assess`. It is single-instance
(in-memory); use Redis/Upstash for multi-instance deployments.

### Testing

- **Unit** (Vitest, jsdom): `tests/**/*.test.ts` — run with `pnpm test`. External
  services are mocked; no network or DB needed.
- **E2E** (Playwright): `tests/e2e/*.spec.ts` — run with `pnpm test:e2e`. The config
  boots `pnpm dev` automatically. Smoke tests only; they do not trigger paid AI calls.

### Deployment

`next.config.ts` uses `output: "standalone"`. A multi-stage `Dockerfile` and the `app`
service in `docker-compose.yml` (profile `app`) build a production image with a
persistent `imgcache` volume for `/app/public/cache`. The disk image cache means this
is intended for Docker/VPS, not serverless (ephemeral FS).

### CEFR Levels

All content is scoped to `CefrLevel` (`A1`–`C2`), defined in `src/lib/cefr.ts`. Word counts and system prompts per level are centralized there.

### Required Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
DATABASE_URL          # PostgreSQL connection string (required)
OLLAMA_API_KEY        # Set to use Ollama cloud; omit for local Ollama
OLLAMA_HOST           # Local Ollama host (default: http://localhost:11434)
OLLAMA_MODEL          # Model name (default: llama3.2)
OPENAI_API_KEY        # For word pronunciation audio (TTS)
UNSPLASH_ACCESS_KEY   # For word illustrations (optional; degrades to no image)
AZURE_SPEECH_KEY      # Azure Cognitive Services key
AZURE_SPEECH_REGION   # e.g. eastus
```
