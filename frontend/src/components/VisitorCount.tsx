"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live visitor counter for the landing page. Uses a free, CORS-enabled hosted
 * hit counter (no backend) — increments once per new browser, read-only for
 * returning visitors. Displays the CUBE of the real count (n³) as a vanity
 * figure, same as the AgentHive hub.
 */

const COUNTER_BASE = "https://abacus.jasoncameron.dev";
const NS = "voxhire";
const KEY = "landing-visits";
const COUNTED_FLAG = "voxhire.visitor.counted.v1";
const CACHE_KEY = "voxhire.visitorCount.v1";

const cube = (n: number) => n ** 3;

export default function VisitorCount() {
  const [real, setReal] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const c = localStorage.getItem(CACHE_KEY);
    return c ? Number(c) || null : null;
  });
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Fetch / increment the real count.
  useEffect(() => {
    let alreadyCounted = false;
    try { alreadyCounted = !!localStorage.getItem(COUNTED_FLAG); } catch { /* private mode */ }
    const verb = alreadyCounted ? "get" : "hit";
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);

    fetch(`${COUNTER_BASE}/${verb}/${NS}/${KEY}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const v = data && typeof data.value === "number" ? data.value : null;
        if (v != null) {
          setReal(v);
          try {
            localStorage.setItem(CACHE_KEY, String(v));
            if (!alreadyCounted) localStorage.setItem(COUNTED_FLAG, "1");
          } catch { /* ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(t));

    return () => { clearTimeout(t); ctrl.abort(); };
  }, []);

  // Count-up animation to the cubed target whenever the real count resolves.
  useEffect(() => {
    if (real == null) return;
    const target = cube(real);
    const start = performance.now();
    const from = display;
    const dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(from + (target - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real]);

  if (real == null) return null;

  return (
    <div className="group relative inline-flex items-center gap-2.5 px-4 py-2 rounded-full
                    bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-indigo-500/10
                    border border-indigo-300/40 dark:border-indigo-500/30
                    shadow-[0_0_24px_-6px_rgba(99,102,241,0.5)]">
      {/* animated glow */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r
                       from-transparent via-indigo-400/10 to-transparent
                       opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
      </span>
      <span className="text-sm">
        <span className="font-extrabold tabular-nums bg-gradient-to-r from-indigo-600 to-violet-500
                         dark:from-indigo-300 dark:to-violet-300 bg-clip-text text-transparent">
          {display.toLocaleString("en-IN")}+
        </span>{" "}
        <span className="text-gray-600 dark:text-gray-400">curious minds have peeked at VoxHire</span>{" "}
        <span aria-hidden>👀</span>
      </span>
    </div>
  );
}
