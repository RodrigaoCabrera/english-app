import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[65vh] flex flex-col justify-center">
      <div className="max-w-xl space-y-8">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-medium">
            AI · Language · Learning
          </p>
          <h1 className="font-serif text-5xl font-semibold leading-tight text-foreground">
            Read, hover,<br />speak fluently.
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
            Generate passages at your CEFR level. Hover key words for
            translation and definition. Record and get pronunciation feedback.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/reading"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            Start reading
            <span aria-hidden>→</span>
          </Link>
          <span className="text-xs text-muted-foreground">A1 → C2 levels</span>
        </div>

        <div className="flex gap-2 pt-2">
          {["A1", "A2", "B1", "B2", "C1", "C2"].map((lvl) => (
            <span
              key={lvl}
              className="text-[10px] font-medium px-2 py-0.5 rounded border border-border text-muted-foreground"
            >
              {lvl}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
