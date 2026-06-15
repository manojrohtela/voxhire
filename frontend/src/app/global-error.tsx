"use client";

/**
 * Root error boundary — catches errors in the root layout itself (where the
 * normal error.tsx can't). Must render its own <html>/<body>.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0f", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              style={{ padding: "10px 20px", background: "#6c63ff", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
