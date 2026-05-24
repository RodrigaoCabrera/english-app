import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scoreReading } from "@/services/pronunciation-scorer";

const FieldsSchema = z.object({
  referenceText: z.string().min(1).max(2000),
  readingId: z.coerce.number().int().positive(),
});

export async function POST(request: NextRequest) {
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
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const audioFile = formData.get("audio");
  if (!(audioFile instanceof File) || audioFile.size === 0) {
    return NextResponse.json({ success: false, error: "Audio file is required" }, { status: 400 });
  }

  const { referenceText, readingId } = parsed.data;

  try {
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const score = await scoreReading(audioBuffer, referenceText, readingId);
    return NextResponse.json({ success: true, data: score });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment failed";
    console.error("[speech/assess] error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
