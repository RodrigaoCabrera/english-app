import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { readings } from "@/db/schema";
import { BookOpen } from "lucide-react";

export const revalidate = 0;

export default async function ReadingPage() {
  const rows = await db
    .select({
      id: readings.id,
      level: readings.level,
      topic: readings.topic,
      createdAt: readings.createdAt,
    })
    .from(readings)
    .orderBy(desc(readings.createdAt))
    .limit(50);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reading Practice</h1>
        <p className="text-muted-foreground mt-1">
          Read a passage aloud and get instant AI pronunciation feedback word by word.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No readings yet.</p>
          <Link
            href="/vocabulary"
            className="text-sm underline underline-offset-4 hover:text-foreground transition-colors text-muted-foreground"
          >
            Generate one in Vocabulary →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/reading/${r.id}`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-8 shrink-0">
                    {r.level}
                  </span>
                  <span className="capitalize text-sm font-medium group-hover:text-foreground">
                    {r.topic}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
