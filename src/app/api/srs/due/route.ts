import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDueWords, getDueCount } from "@/services/srs";
import { getUserId } from "@/lib/auth";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ limit: searchParams.get("limit") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid limit" }, { status: 400 });
  }

  try {
    const [words, dueCount] = await Promise.all([
      getDueWords(userId, parsed.data.limit),
      getDueCount(userId),
    ]);
    return NextResponse.json({ success: true, data: { dueCount, words } });
  } catch (error) {
    console.error("[srs due] error:", error);
    return NextResponse.json({ success: false, error: "Failed to load review queue." }, { status: 500 });
  }
}
