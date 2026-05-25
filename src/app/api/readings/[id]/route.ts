import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { readings, readingAttempts } from "@/db/schema";

export async function DELETE(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { id } = await segmentData.params;
  const numId = parseInt(id, 10);

  if (isNaN(numId)) {
    return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
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
