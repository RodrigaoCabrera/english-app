import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { readings } from "@/db/schema";
import { generateReading } from "@/services/reading-generator";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/cefr";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({ id: readings.id, level: readings.level, topic: readings.topic, createdAt: readings.createdAt })
    .from(readings)
    .where(eq(readings.userId, userId))
    .orderBy(desc(readings.createdAt))
    .limit(50);

  return NextResponse.json({ success: true, data: rows });
}

const BodySchema = z.object({ level: z.enum(CEFR_LEVELS), topic: z.string().min(1).max(100) });

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`readings:${userId}`, { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { level, topic } = parsed.data;

  try {
    const generated = await generateReading(level as CefrLevel, topic);
    const [inserted] = await db
      .insert(readings)
      .values({ userId, level, topic, bodyMd: generated.markdown, wordList: generated.keyWords })
      .returning();

    return NextResponse.json({
      success: true,
      data: { id: inserted.id, level: inserted.level, topic: inserted.topic, bodyMd: inserted.bodyMd, keyWords: inserted.wordList },
    });
  } catch (error) {
    console.error("[readings] generation error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate reading. Please try again." }, { status: 500 });
  }
}
