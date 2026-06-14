import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/cefr";

export interface Profile {
  clerkUserId: string;
  cefrLevel: CefrLevel;
}

export async function getOrCreateProfile(userId: string): Promise<Profile> {
  // Insert-first avoids a check-then-act race when a new user's first requests
  // arrive in parallel. onConflictDoNothing returns [] if the row already exists.
  const [created] = await db
    .insert(userProfiles)
    .values({ clerkUserId: userId })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return { clerkUserId: userId, cefrLevel: created.cefrLevel as CefrLevel };
  }

  const [existing] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);
  return { clerkUserId: userId, cefrLevel: existing.cefrLevel as CefrLevel };
}

export async function updateLevel(userId: string, level: CefrLevel): Promise<Profile> {
  if (!(CEFR_LEVELS as readonly string[]).includes(level)) {
    throw new Error("Invalid level");
  }
  const [updated] = await db
    .insert(userProfiles)
    .values({ clerkUserId: userId, cefrLevel: level, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userProfiles.clerkUserId,
      set: { cefrLevel: level, updatedAt: new Date() },
    })
    .returning();
  return { clerkUserId: userId, cefrLevel: updated.cefrLevel as CefrLevel };
}
