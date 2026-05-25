import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getOpenAI } from "@/lib/openai";

const AUDIO_DIR = path.join(process.cwd(), "public", "cache", "audio");

export function wordAudioHash(word: string): string {
  return crypto.createHash("sha1").update(word.toLowerCase().trim()).digest("hex");
}

export async function getWordAudio(word: string): Promise<Buffer> {
  const hash = wordAudioHash(word);
  const filePath = path.join(AUDIO_DIR, `${hash}.mp3`);

  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }

  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  const openai = getOpenAI();
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: word,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return buffer;
}
