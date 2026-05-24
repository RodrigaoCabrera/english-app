import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { imagesCache } from "@/db/schema";
import { eq } from "drizzle-orm";

const IMG_DIR = path.join(process.cwd(), "public", "cache", "img");

export function sha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export async function findImageByWord(word: string): Promise<string | null> {
  const hash = sha1(word);
  const rows = await db
    .select({ filePath: imagesCache.filePath })
    .from(imagesCache)
    .where(eq(imagesCache.hash, hash))
    .limit(1);
  return rows.length > 0 ? rows[0].filePath : null;
}

export async function saveImage(
  word: string,
  prompt: string,
  b64: string
): Promise<string> {
  // Key is deterministic: SHA-1 of the normalized word.
  // Same word → same hash → same file, shared across all users and levels.
  const hash = sha1(word);

  if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
  }

  const buffer = Buffer.from(b64, "base64");
  const filePath = path.join(IMG_DIR, `${hash}.png`);

  // Overwrite is safe — content is always the same for the same word
  fs.writeFileSync(filePath, buffer);

  const relativePath = `/cache/img/${hash}.png`;
  await db
    .insert(imagesCache)
    .values({ hash, prompt, filePath: relativePath, mime: "image/png", bytes: buffer.length })
    .onConflictDoNothing();

  return relativePath;
}
