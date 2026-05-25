import { NextRequest, NextResponse } from "next/server";
import { getWordAudio } from "@/lib/tts";

export async function GET(
  _request: NextRequest,
  segmentData: { params: Promise<{ word: string }> }
) {
  const { word } = await segmentData.params;
  const clean = decodeURIComponent(word).trim();

  if (!clean || clean.length > 60) {
    return new NextResponse("Invalid word", { status: 400 });
  }

  try {
    const buffer = await getWordAudio(clean);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Failed to generate audio", { status: 500 });
  }
}
