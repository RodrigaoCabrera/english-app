import { assessPronunciation, type PronunciationScore, type WordAssessment } from "@/lib/azure-speech";
import { db } from "@/db";
import { readingAttempts } from "@/db/schema";

export type { PronunciationScore, WordAssessment };

export async function scoreReading(
  audioBuffer: Buffer,
  referenceText: string,
  readingId: number
): Promise<PronunciationScore> {
  const score = await assessPronunciation(audioBuffer, referenceText);

  await db.insert(readingAttempts).values({
    readingId,
    transcript: score.recognizedText,
    score: {
      accuracyScore: score.accuracyScore,
      fluencyScore: score.fluencyScore,
      completenessScore: score.completenessScore,
      words: score.words,
    },
  });

  return score;
}
