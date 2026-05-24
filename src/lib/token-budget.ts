/**
 * Daily token budget tracker for DeepSeek API calls.
 *
 * Keeps an in-memory counter that resets each UTC day.
 * Configure limits via env vars:
 *   DEEPSEEK_DAILY_INPUT_LIMIT   (default: 50_000)
 *   DEEPSEEK_DAILY_OUTPUT_LIMIT  (default: 10_000)
 */

interface DayBucket {
  date: string; // "YYYY-MM-DD" UTC
  inputTokens: number;
  outputTokens: number;
}

// Module-level singleton — survives across requests in one Node process.
let bucket: DayBucket = { date: "", inputTokens: 0, outputTokens: 0 };

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLimit(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return isNaN(parsed) ? fallback : parsed;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export function recordUsage(usage: TokenUsage): void {
  const today = todayUTC();

  if (bucket.date !== today) {
    bucket = { date: today, inputTokens: 0, outputTokens: 0 };
  }

  bucket.inputTokens += usage.inputTokens;
  bucket.outputTokens += usage.outputTokens;

  const inputLimit = getLimit("DEEPSEEK_DAILY_INPUT_LIMIT", 50_000);
  const outputLimit = getLimit("DEEPSEEK_DAILY_OUTPUT_LIMIT", 10_000);

  const inputPct = Math.round((bucket.inputTokens / inputLimit) * 100);
  const outputPct = Math.round((bucket.outputTokens / outputLimit) * 100);

  console.info(
    `[token-budget] ${today} | ` +
      `input: ${bucket.inputTokens}/${inputLimit} (${inputPct}%) | ` +
      `output: ${bucket.outputTokens}/${outputLimit} (${outputPct}%)`
  );

  if (bucket.inputTokens > inputLimit) {
    throw new Error(
      `Daily input token limit reached (${bucket.inputTokens}/${inputLimit}). ` +
        `Set DEEPSEEK_DAILY_INPUT_LIMIT to increase it.`
    );
  }

  if (bucket.outputTokens > outputLimit) {
    throw new Error(
      `Daily output token limit reached (${bucket.outputTokens}/${outputLimit}). ` +
        `Set DEEPSEEK_DAILY_OUTPUT_LIMIT to increase it.`
    );
  }
}

export function getDailyUsage(): DayBucket {
  const today = todayUTC();
  if (bucket.date !== today) return { date: today, inputTokens: 0, outputTokens: 0 };
  return { ...bucket };
}
