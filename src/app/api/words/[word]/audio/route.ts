import { NextRequest, NextResponse } from "next/server";
import { getWordAudio } from "@/lib/tts";
import { rateLimit, clientKey, tooManyRequests } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ word: string }> }
) {
  // TTS synthesis hits OpenAI (billed) — bound it per client.
  const limit = rateLimit(clientKey(request, "word-audio"), {
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!limit.allowed) return tooManyRequests(limit);

  const { word } = await segmentData.params;
  const clean = decodeURIComponent(word).trim();

  if (!clean || clean.length > 60) {
    return NextResponse.json({ success: false, error: "Invalid word" }, { status: 400 });
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
    return NextResponse.json(
      { success: false, error: "Failed to generate audio." },
      { status: 500 }
    );
  }
}
