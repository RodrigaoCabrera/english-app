import { NextRequest, NextResponse } from "next/server";
import { defineWord } from "@/services/word-definer";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/cefr";

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ word: string }> }
) {
  const { word } = await segmentData.params;
  const level = (request.nextUrl.searchParams.get("level") ?? "B1") as CefrLevel;

  if (!(CEFR_LEVELS as readonly string[]).includes(level)) {
    return NextResponse.json({ success: false, error: "Invalid level" }, { status: 400 });
  }

  const clean = decodeURIComponent(word).trim();
  if (!clean || clean.length > 60) {
    return NextResponse.json({ success: false, error: "Invalid word" }, { status: 400 });
  }

  try {
    const definition = await defineWord(clean, level);
    return NextResponse.json({ success: true, data: definition });
  } catch (error) {
    console.error("[words] definition error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch definition." },
      { status: 500 }
    );
  }
}
