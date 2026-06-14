import { auth, currentUser } from "@clerk/nextjs/server";

/** Comma-separated lowercased allowlist from env (empty = allow all). */
function allowlist(): string[] {
  return (process.env.ALLOWLIST_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns the current Clerk userId or null when signed out. */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * Returns true if the signed-in user's primary email is allowed.
 * When ALLOWLIST_EMAILS is empty, the dashboard allowlist (if any) is the
 * only gate and this returns true.
 */
export async function isAllowed(): Promise<boolean> {
  const list = allowlist();
  if (list.length === 0) return true;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  return !!email && list.includes(email);
}
