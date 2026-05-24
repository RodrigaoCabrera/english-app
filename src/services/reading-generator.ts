import { z } from "zod";
import { getOllama, OLLAMA_MODEL } from "@/lib/ollama";
import { recordUsage } from "@/lib/token-budget";
import { cefrSystemPrompt, CEFR_WORD_COUNT, type CefrLevel } from "@/lib/cefr";

const ReadingSchema = z.object({
  markdown: z.string(),
  keyWords: z.array(z.string()),
});

export type GeneratedReading = z.infer<typeof ReadingSchema>;

export async function generateReading(
  level: CefrLevel,
  topic: string
): Promise<GeneratedReading> {
  const { min, max } = CEFR_WORD_COUNT[level];
  const ollama = getOllama();

  const userPrompt = `Write a reading passage about "${topic}" for an English learner at CEFR level ${level}.

Requirements:
- Length: ${min}–${max} words
- Use markdown: a ## heading, then 2-4 paragraphs
- After the passage, select 6–10 key vocabulary words from the text most useful for a ${level} learner
- Return ONLY valid JSON with no extra text:
{
  "markdown": "...",
  "keyWords": ["word1", "word2"]
}`;

  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    messages: [
      { role: "system", content: cefrSystemPrompt(level) },
      { role: "user", content: userPrompt },
    ],
    options: { num_predict: 2048 },
  });

  recordUsage({
    inputTokens: response.prompt_eval_count ?? 0,
    outputTokens: response.eval_count ?? 0,
  });

  const raw = response.message.content;
  if (!raw) throw new Error("Empty response from Ollama");

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return ReadingSchema.parse(JSON.parse(jsonMatch[0]));
}
