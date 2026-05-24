import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { readings } from "@/db/schema";
import { ReadingPractice } from "./ReadingPractice";

interface Props {
  params: Promise<{ id: string }>;
}

function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")  // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")  // bold
    .replace(/\*(.+?)\*/g, "$1")  // italic
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")  // links
    .replace(/\n{2,}/g, " ")  // paragraph breaks → space
    .replace(/\n/g, " ")
    .trim();
}

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split("\n");
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const sizes: Record<number, string> = {
        1: "text-xl font-bold mt-6 mb-2",
        2: "text-lg font-bold mt-5 mb-2",
        3: "text-base font-semibold mt-4 mb-1",
      };
      nodes.push(<Tag key={key++} className={sizes[level] ?? "font-semibold mt-3 mb-1"}>{headingMatch[2]}</Tag>);
    } else if (line.trim() === "") {
      nodes.push(<div key={key++} className="h-3" />);
    } else {
      nodes.push(
        <p key={key++} className="text-base leading-relaxed">
          {line.replace(/\*\*(.+?)\*\*/g, "").replace(/\*(.+?)\*/g, "$1")}
        </p>
      );
    }
  }

  return nodes;
}

export default async function ReadingDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  const rows = await db
    .select()
    .from(readings)
    .where(eq(readings.id, numId))
    .limit(1);

  if (rows.length === 0) notFound();

  const reading = rows[0];
  const plainText = markdownToPlainText(reading.bodyMd);

  return (
    <div className="space-y-10 max-w-2xl">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide text-xs">{reading.level}</span>
          <span>·</span>
          <span className="capitalize">{reading.topic}</span>
        </div>
      </div>

      <div className="border rounded-lg p-6">
        {renderMarkdown(reading.bodyMd)}
      </div>

      <div className="border rounded-lg p-6">
        <ReadingPractice readingId={reading.id} referenceText={plainText} />
      </div>
    </div>
  );
}
