"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in production.
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center text-center space-y-5">
      <p className="font-serif text-6xl font-semibold text-destructive/40">!</p>
      <div className="space-y-1.5">
        <h1 className="font-serif text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          An unexpected error occurred. You can try again or go back to the
          reading list.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="cursor-pointer inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
        <a
          href="/reading"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to Reading
        </a>
      </div>
    </div>
  );
}
