"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: 24,
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            background: "white",
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Vittoria failed to load</h1>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
            {error.message}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 14px",
              border: "1px solid #d4d4d4",
              borderRadius: 6,
              background: "#171717",
              color: "white",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
