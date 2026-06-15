import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gradeWord } from "@/services/srs";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getUserId } from "@/lib/auth";

const BodySchema = z.object({
  word: z.string().min(1).max(60),
  grade: z.enum(["again", "hard", "good", "easy"]),
});

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Generous: a review session clicks through many cards quickly.
  const limit = rateLimit(`srs-review:${userId}`, { limit: 120, windowMs: 60 * 1000 });
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

  const word = parsed.data.word.trim().toLowerCase();
  const { grade } = parsed.data;

  try {
    const ok = await gradeWord(userId, word, grade);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Word not in your review queue." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[srs review] error:", error);
    return NextResponse.json({ success: false, error: "Failed to record review." }, { status: 500 });
  }
}
