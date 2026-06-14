import { auth } from "@clerk/nextjs/server";

/** Returns the current Clerk userId or null when signed out. */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}
