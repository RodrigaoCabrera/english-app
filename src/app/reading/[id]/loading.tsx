export default function Loading() {
  return (
    <article className="max-w-2xl space-y-8 animate-pulse">
      <div className="h-4 w-20 rounded bg-muted/40" />

      <header className="space-y-3">
        <div className="h-4 w-12 rounded bg-muted/40" />
        <div className="h-7 w-2/3 rounded bg-muted/40" />
      </header>

      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded bg-muted/30"
            style={{ width: `${85 - (i % 3) * 12}%` }}
          />
        ))}
      </div>

      <div className="border-t border-border pt-8 space-y-3">
        <div className="h-3 w-20 rounded bg-muted/40" />
        <div className="h-10 w-40 rounded-md bg-muted/30" />
      </div>
    </article>
  );
}
