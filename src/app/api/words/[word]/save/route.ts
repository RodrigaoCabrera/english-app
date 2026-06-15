import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { wordsCache, savedWords } from "@/db/schema";
import { CEFR_LEVELS } from "@/lib/cefr";
import { getUserId } from "@/lib/auth";
import { enqueueWord } from "@/services/srs";

const BodySchema = z.object({
  level: z.enum(CEFR_LEVELS),
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ word: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

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

  try {
    await db.insert(savedWords).values({
      userId,
      word: clean,
      level,
      translation: row?.translation ?? null,
      definition: row?.definition ?? null,
      imageHash: row?.imageHash ?? null,
    });
    // Best-effort: add to the SRS review queue. Saving is the primary action;
    // queueing is secondary and must never fail the save.
    try {
      await enqueueWord(userId, clean, level);
    } catch (enqueueError) {
      console.error("[words save] enqueue error:", enqueueError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[words save] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save word." },
      { status: 500 }
    );
  }
}
