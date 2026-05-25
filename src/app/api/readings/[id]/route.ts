import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { readings } from "@/db/schema";

export async function DELETE(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { id } = await segmentData.params;
  const numId = parseInt(id, 10);

  if (isNaN(numId)) {
    return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
  }

  await db.delete(readings).where(eq(readings.id, numId));
  return NextResponse.json({ success: true });
}
