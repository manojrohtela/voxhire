"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Any uncaught render error shows this friendly
 * screen (with recovery) instead of a blank page — so a stray bug never leaves
 * a visitor (or a YC partner clicking around) staring at white.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaced in the console (and Sentry, once a DSN is set).
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-white text-xl font-bold mb-2">Something went wrong</h1>
        <p className="text-[#888] text-sm mb-6">
          A hiccup on our side — it&apos;s been logged. You can retry this page or head back to your dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-5 py-2.5 bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold rounded-xl text-sm transition-colors">
            Try again
          </button>
          <a href="/dashboard" className="px-5 py-2.5 border border-[#2a2a3a] text-[#aaa] hover:text-white rounded-xl text-sm transition-colors">
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
