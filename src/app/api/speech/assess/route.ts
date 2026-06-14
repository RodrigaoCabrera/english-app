import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { readings } from "@/db/schema";
import { scoreReading } from "@/services/pronunciation-scorer";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getUserId } from "@/lib/auth";

const FieldsSchema = z.object({
  referenceText: z.string().min(1).max(2000),
  readingId: z.coerce.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`speech-assess:${userId}`, { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return tooManyRequests(limit);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const parsed = FieldsSchema.safeParse({
    referenceText: formData.get("referenceText"),
    readingId: formData.get("readingId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const audioFile = formData.get("audio");
  if (!(audioFile instanceof File) || audioFile.size === 0) {
    return NextResponse.json({ success: false, error: "Audio file is required" }, { status: 400 });
  }

  const { referenceText, readingId } = parsed.data;

  // Ownership check: the reading must belong to this user.
  const owned = await db
    .select({ id: readings.id })
    .from(readings)
    .where(and(eq(readings.id, readingId), eq(readings.userId, userId)))
    .limit(1);
  if (owned.length === 0) {
    return NextResponse.json({ success: false, error: "Reading not found" }, { status: 404 });
  }

  try {
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const score = await scoreReading(audioBuffer, referenceText, readingId, userId);
    return NextResponse.json({ success: true, data: score });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment failed";
    console.error("[speech/assess] error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
