import { and, eq } from "drizzle-orm";
import { type CefrLevel } from "@/lib/cefr";
import { fetchWordImageBuffer } from "@/lib/unsplash";
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

  // Use the first definition of the first meaning (primary usage).
  // Only look at subsequent meanings/definitions for a better example.
  const firstDef = entry.meanings?.[0]?.definitions?.[0];
  if (!firstDef?.definition) throw new Error(`No definition found for "${word}"`);

  if (firstDef.example) {
    return { definition: firstDef.definition, example: firstDef.example };
  }

  // Primary definition has no example — scan remaining definitions for one
  for (const meaning of entry.meanings ?? []) {
    for (const def of meaning.definitions ?? []) {
      if (def.example) {
        return { definition: firstDef.definition, example: def.example };
      }
    }
  }

  return {
    definition: firstDef.definition,
    example: `The word "${word}" is commonly used in English.`,
  };
}

async function fetchTranslation(word: string): Promise<string | null> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|es`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const translated: string | undefined = data.responseData?.translatedText;
    if (!translated || translated.toLowerCase() === word.toLowerCase()) return null;
    return translated;
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

    if (!row.imageHash) {
      let imageUrl: string | null = null;
      try {
        const buffer = await fetchWordImageBuffer(normalized);
        if (buffer) {
          imageUrl = await saveImage(normalized, normalized, buffer);
        }
      } catch {
        // non-fatal
      }

      if (imageUrl) {
        const imageHash = sha1(normalized);
        await db
          .update(wordsCache)
          .set({ imageHash })
          .where(and(eq(wordsCache.word, normalized), eq(wordsCache.level, level)));

        return {
          word: normalized,
          definition: row.definition,
          example: row.example,
          imageUrl,
          translation: row.translation ?? null,
        };
      }
    }

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
      const buffer = await fetchWordImageBuffer(normalized);
      if (buffer) {
        imageUrl = await saveImage(normalized, normalized, buffer);
      }
    } catch {
      // Image fetch is non-fatal
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
