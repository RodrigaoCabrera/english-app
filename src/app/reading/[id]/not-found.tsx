import Link from "next/link";

export default function ReadingNotFound() {
  return (
    <div className="min-h-[45vh] flex flex-col items-center justify-center text-center space-y-5">
      <div className="space-y-1.5">
        <h1 className="font-serif text-2xl font-semibold">Reading not found</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          This passage doesn&apos;t exist. It may have been deleted.
        </p>
      </div>
      <Link
        href="/reading"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
      >
        Back to Reading
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
