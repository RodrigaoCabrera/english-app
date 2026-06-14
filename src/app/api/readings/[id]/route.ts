import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { readings, readingAttempts } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await segmentData.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
  }

  const owned = await db
    .select({ id: readings.id })
    .from(readings)
    .where(and(eq(readings.id, numId), eq(readings.userId, userId)))
    .limit(1);
  if (owned.length === 0) {
    return NextResponse.json({ success: false, error: "Reading not found" }, { status: 404 });
  }

  try {
    await db.delete(readingAttempts).where(eq(readingAttempts.readingId, numId));
    await db.delete(readings).where(eq(readings.id, numId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[readings/delete] failed to delete reading:", numId, error);
    return NextResponse.json({ success: false, error: "Failed to delete reading" }, { status: 500 });
  }
}
