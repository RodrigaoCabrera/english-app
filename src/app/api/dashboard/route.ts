import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDashboardData } from "@/services/dashboard";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const data = await getDashboardData(userId);
  return NextResponse.json({ success: true, data });
}
