# English app
This is the codebase for the English learning app. It includes a Next.js frontend, a Node.js API backend, and integrations with Ollama, OpenAI, and Azure Cognitive Services for AI-powered content generation and pronunciation assessment.

@AGENTS.md

## Architecture

### Stack

- **Next.js 16** (App Router) — this version has breaking changes vs older Next.js; read `node_modules/next/dist/docs/` before touching routing or caching APIs
- **Drizzle ORM** + **PostgreSQL 16** (Docker) — schema in `src/db/schema.ts`, client in `src/db/index.ts`
- **Tailwind CSS v4** + **shadcn/ui** — component library in `src/components/ui/`
- **Zod v4** — used for request validation in every API route

### AI Provider Layer

Three external AI services, each wrapped in a lazy singleton in `src/lib/`:

| File | Service | Purpose |
|------|---------|---------|
| `src/lib/ollama.ts` | Ollama (cloud or local) | Reading passage generation |
| `src/lib/anthropic.ts` | DeepSeek via Anthropic SDK compat | (currently unused, was for reading gen) |
| `src/lib/openai.ts` | OpenAI (`gpt-image-1`) | Word illustration generation |
| `src/lib/azure-speech.ts` | Azure Cognitive Services | Pronunciation assessment |

Ollama configuration: if `OLLAMA_API_KEY` is set it connects to `https://ollama.com` (cloud models); otherwise falls back to `OLLAMA_HOST` (default `http://localhost:11434`). Model is controlled by `OLLAMA_MODEL` (default `llama3.2`).

Token usage for Ollama calls is tracked in-process by `src/lib/token-budget.ts` (daily rolling counter keyed by UTC date, throws when limits are exceeded).

### Features & Data Flow

**Reading generation** (`POST /api/readings`):
1. Validates `{ level: CefrLevel, topic: string }` via Zod
2. Calls `src/services/reading-generator.ts` → Ollama → returns `{ markdown, keyWords }`
3. Persists to `readings` table; `keyWords` stored as `jsonb`

**Word definitions** (`GET /api/words/[word]`):
1. Checks `words_cache` table first
2. Fetches from `dictionaryapi.dev` free API
3. Generates an illustration via OpenAI images and caches it to disk (`src/lib/cache.ts`, served from `/cache/img/`)
4. Writes result back to `words_cache`

**Pronunciation assessment** (`POST /api/speech/assess`):
1. Accepts `multipart/form-data` with `audio` (WAV blob), `referenceText`, `readingId`
2. Sends WAV buffer to Azure Speech REST API with Pronunciation Assessment config
3. Returns per-word accuracy scores and error types

### CEFR Levels

All content is scoped to `CefrLevel` (`A1`–`C2`), defined in `src/lib/cefr.ts`. Word counts and system prompts per level are centralized there.

### Required Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
DATABASE_URL          # PostgreSQL connection string
OLLAMA_API_KEY        # Set to use Ollama cloud; omit for local Ollama
OLLAMA_HOST           # Local Ollama host (default: http://localhost:11434)
OLLAMA_MODEL          # Model name (default: llama3.2)
OPENAI_API_KEY        # For word image generation
AZURE_SPEECH_KEY      # Azure Cognitive Services key
AZURE_SPEECH_REGION   # e.g. eastus
```
