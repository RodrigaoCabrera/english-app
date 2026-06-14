import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { readings } from "@/db/schema";
import { generateReading } from "@/services/reading-generator";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/cefr";
import { rateLimit, clientKey, tooManyRequests } from "@/lib/rate-limit";

export async function GET() {
  const rows = await db
    .select({
      id: readings.id,
      level: readings.level,
      topic: readings.topic,
      createdAt: readings.createdAt,
    })
    .from(readings)
    .orderBy(desc(readings.createdAt))
    .limit(50);

  return NextResponse.json({ success: true, data: rows });
}

const BodySchema = z.object({
  level: z.enum(CEFR_LEVELS),
  topic: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  // Reading generation hits the LLM — keep it tightly bounded per client.
  const limit = rateLimit(clientKey(request, "readings"), {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { level, topic } = parsed.data;

  try {
    const generated = await generateReading(level as CefrLevel, topic);
    const [inserted] = await db
      .insert(readings)
      .values({ level, topic, bodyMd: generated.markdown, wordList: generated.keyWords })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        id: inserted.id,
        level: inserted.level,
        topic: inserted.topic,
        bodyMd: inserted.bodyMd,
        keyWords: inserted.wordList,
      },
    });
  } catch (error) {
    console.error("[readings] generation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate reading. Please try again." },
      { status: 500 }
    );
  }
}
