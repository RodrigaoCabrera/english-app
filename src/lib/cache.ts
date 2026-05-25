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
  imageBuffer: Buffer
): Promise<string> {
  const hash = sha1(word);

  if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
  }

  const filePath = path.join(IMG_DIR, `${hash}.png`);

  fs.writeFileSync(filePath, imageBuffer);

  const relativePath = `/cache/img/${hash}.png`;
  await db
    .insert(imagesCache)
    .values({ hash, prompt, filePath: relativePath, mime: "image/png", bytes: imageBuffer.length })
    .onConflictDoNothing();

  return relativePath;
}
