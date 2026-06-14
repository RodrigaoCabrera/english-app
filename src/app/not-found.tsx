import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center text-center space-y-5">
      <p className="font-serif text-6xl font-semibold text-primary/40">404</p>
      <div className="space-y-1.5">
        <h1 className="font-serif text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
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
