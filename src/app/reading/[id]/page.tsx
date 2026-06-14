import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { readings, readingAttempts } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { HoverableText } from "@/components/HoverableText";
import { ReadingPractice } from "./ReadingPractice";
import type { CefrLevel } from "@/lib/cefr";

interface Props {
  params: Promise<{ id: string }>;
}

function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

function cefrBadgeClass(level: CefrLevel): string {
  if (level === "A1" || level === "A2")
    return "bg-emerald-900/50 text-emerald-400 border border-emerald-800/50";
  if (level === "B1" || level === "B2")
    return "bg-amber-900/40 text-amber-400 border border-amber-800/40";
  return "bg-violet-900/40 text-violet-400 border border-violet-800/40";
}

export default async function ReadingDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  const userId = await getUserId();
  if (!userId) notFound();

  const [rows, attempts] = await Promise.all([
    db.select().from(readings).where(and(eq(readings.id, numId), eq(readings.userId, userId))).limit(1),
    db
      .select({
        id: readingAttempts.id,
        score: readingAttempts.score,
        createdAt: readingAttempts.createdAt,
      })
      .from(readingAttempts)
      .where(and(eq(readingAttempts.readingId, numId), eq(readingAttempts.userId, userId)))
      .orderBy(desc(readingAttempts.createdAt))
      .limit(5),
  ]);

  if (rows.length === 0) notFound();

  const reading = rows[0];
  const plainText = markdownToPlainText(reading.bodyMd);

  const pastAttempts = attempts.map((a) => ({
    id: a.id,
    score: a.score
      ? {
          accuracyScore: a.score.accuracyScore,
          fluencyScore: a.score.fluencyScore,
          completenessScore: a.score.completenessScore,
        }
      : null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <article className="max-w-2xl space-y-8">
      <Link
        href="/reading"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span aria-hidden>←</span>
        Reading
      </Link>

      <header className="space-y-2">
        <span
          className={`inline-block text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded ${cefrBadgeClass(reading.level as CefrLevel)}`}
        >
          {reading.level}
        </span>
        <h1 className="font-serif text-2xl font-semibold capitalize leading-snug">
          {reading.topic}
        </h1>
      </header>

      <div className="font-serif text-[1.05rem] leading-[1.85] text-foreground/90">
        <HoverableText
          markdown={reading.bodyMd}
          keyWords={reading.wordList}
          level={reading.level as CefrLevel}
        />
      </div>

      <div className="border-t border-border pt-8 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Practice
        </h2>
        <ReadingPractice
          readingId={reading.id}
          referenceText={plainText}
          pastAttempts={pastAttempts}
        />
      </div>
    </article>
  );
}
