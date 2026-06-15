import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserId } from "@/lib/auth";
import {
  getDashboardData,
  type DashboardData,
  type TrendPoint,
  type RecentReading,
} from "@/services/dashboard";

function levelDotClass(level: string): string {
  if (level === "A1" || level === "A2") return "bg-emerald-400";
  if (level === "B1" || level === "B2") return "bg-amber-400";
  return "bg-violet-400";
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-card/60 border border-border/50 rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1.5 leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>
    </div>
  );
}

function PronunciationChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) {
    return (
      <div className="bg-card/60 border border-border/50 rounded-lg p-4">
        <p className="text-xs font-semibold">Pronunciation trend</p>
        <p className="text-xs text-muted-foreground mt-3">
          Practice pronunciation on a reading to see your trend here.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-card/60 border border-border/50 rounded-lg p-4">
      <p className="text-xs font-semibold">Pronunciation trend</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        Last {trend.length} practice attempt{trend.length === 1 ? "" : "s"} · accuracy score
      </p>
      <div className="flex items-end gap-1.5 h-20 mt-4">
        {trend.map((p) => (
          <div
            key={p.attemptId}
            className="flex-1 bg-violet-500/70 rounded-t-sm min-h-[2px]"
            style={{ height: `${p.accuracyScore}%` }}
            title={`${p.readingTopic}: ${p.accuracyScore}%`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function RecentReadings({ readings }: { readings: RecentReading[] }) {
  if (readings.length === 0) {
    return (
      <div className="bg-card/60 border border-border/50 rounded-lg p-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">No readings yet.</p>
        <Link
          href="/reading"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Generate your first reading →
        </Link>
      </div>
    );
  }
  return (
    <div className="bg-card/60 border border-border/50 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-semibold">Recent readings</p>
        <Link href="/reading" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          View all →
        </Link>
      </div>
      <ul>
        {readings.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 py-2 border-b border-border/40 last:border-b-0"
          >
            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${levelDotClass(r.level)}`} />
            <Link href={`/reading/${r.id}`} className="flex-1 min-w-0 group">
              <p className="text-sm font-medium capitalize truncate group-hover:text-foreground transition-colors">
                {r.topic}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {r.level} ·{" "}
                {new Date(r.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
              </p>
            </Link>
            <div className="text-right shrink-0">
              {r.bestScore === null ? (
                <>
                  <p className="text-sm font-semibold text-muted-foreground">—</p>
                  <p className="text-[9px] text-muted-foreground">no attempts</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-violet-400">{r.bestScore}%</p>
                  <p className="text-[9px] text-muted-foreground">best</p>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DashboardPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const data: DashboardData = await getDashboardData(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-muted-foreground text-sm mt-1">Your learning at a glance</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Readings" value={String(data.stats.readingsCount)} sub="passages" />
        <StatCard label="Words saved" value={String(data.stats.savedWordsCount)} sub="vocabulary" />
        <StatCard
          label="Avg. accuracy"
          value={data.stats.avgAccuracyScore === null ? "—" : `${data.stats.avgAccuracyScore}%`}
          sub="pronunciation"
        />
      </div>

      <PronunciationChart trend={data.pronunciationTrend} />
      <RecentReadings readings={data.recentReadings} />
    </div>
  );
}
