import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { getOrCreateProfile, updateLevel } from "@/services/profile";
import { CEFR_LEVELS } from "@/lib/cefr";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const profile = await getOrCreateProfile(userId);
  return NextResponse.json({ success: true, data: { level: profile.cefrLevel } });
}

const PatchSchema = z.object({ level: z.enum(CEFR_LEVELS) });

export async function PATCH(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid level" }, { status: 400 });
  }
  const profile = await updateLevel(userId, parsed.data.level);
  return NextResponse.json({ success: true, data: { level: profile.cefrLevel } });
}
