"use client";

import { useEffect } from "react";

// global-error replaces the root layout when an error is thrown there,
// so it must render its own <html> and <body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "0.875rem", opacity: 0.7, maxWidth: "24rem" }}>
          A critical error occurred while loading the app.
        </p>
        <button
          onClick={reset}
          style={{
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "0.625rem 1.25rem",
            borderRadius: "0.375rem",
            border: "none",
            background: "#fafafa",
            color: "#0a0a0a",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
