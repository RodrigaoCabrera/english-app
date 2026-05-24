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

  // Fall back to first definition without example
  const firstDef = entry.meanings?.[0]?.definitions?.[0];
  if (firstDef?.definition) {
    return {
      definition: firstDef.definition,
      example: `The word "${word}" is commonly used in English.`,
    };
  }

  throw new Error(`No definition found for "${word}"`);
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
    };
  }

  const { definition, example } = await fetchDefinition(normalized);

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
    })
    .onConflictDoNothing();

  return { word: normalized, definition, example, imageUrl };
}
