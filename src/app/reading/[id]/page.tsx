import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { readings, readingAttempts } from "@/db/schema";
import { ReadingDetailTabs } from "./ReadingDetailTabs";
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
  if (level === "A1" || level === "A2") return "bg-green-900/50 text-green-300";
  if (level === "B1" || level === "B2") return "bg-blue-900/50 text-blue-300";
  return "bg-purple-900/50 text-purple-300";
}

export default async function ReadingDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  const [rows, attempts] = await Promise.all([
    db.select().from(readings).where(eq(readings.id, numId)).limit(1),
    db
      .select({
        id: readingAttempts.id,
        score: readingAttempts.score,
        createdAt: readingAttempts.createdAt,
      })
      .from(readingAttempts)
      .where(eq(readingAttempts.readingId, numId))
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
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/reading"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span aria-hidden>←</span>
        Back to Reading
      </Link>

      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${cefrBadgeClass(reading.level as CefrLevel)}`}
        >
          {reading.level}
        </span>
        <h1 className="text-xl font-semibold capitalize">{reading.topic}</h1>
      </div>

      <ReadingDetailTabs
        readingId={reading.id}
        level={reading.level as CefrLevel}
        bodyMd={reading.bodyMd}
        keyWords={reading.wordList}
        referenceText={plainText}
        pastAttempts={pastAttempts}
      />
    </div>
  );
}
