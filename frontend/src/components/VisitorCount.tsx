"use client";

import { useEffect, useState } from "react";

/**
 * Live visitor counter for the landing page. Uses a free, CORS-enabled hosted
 * hit counter (no backend) — increments once per new browser, read-only for
 * returning visitors. Same approach as the AgentHive hub.
 */

const COUNTER_BASE = "https://abacus.jasoncameron.dev";
const NS = "voxhire";
const KEY = "landing-visits";
const COUNTED_FLAG = "voxhire.visitor.counted.v1";
const CACHE_KEY = "voxhire.visitorCount.v1";

export default function VisitorCount() {
  const [count, setCount] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const c = localStorage.getItem(CACHE_KEY);
    return c ? Number(c) || null : null;
  });

  useEffect(() => {
    let alreadyCounted = false;
    try {
      alreadyCounted = !!localStorage.getItem(COUNTED_FLAG);
    } catch {
      /* private mode */
    }
    const verb = alreadyCounted ? "get" : "hit";
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);

    fetch(`${COUNTER_BASE}/${verb}/${NS}/${KEY}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const v = data && typeof data.value === "number" ? data.value : null;
        if (v != null) {
          setCount(v);
          try {
            localStorage.setItem(CACHE_KEY, String(v));
            if (!alreadyCounted) localStorage.setItem(COUNTED_FLAG, "1");
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(t));

    return () => { clearTimeout(t); ctrl.abort(); };
  }, []);

  if (count == null) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
      </span>
      <span><span className="font-semibold text-gray-900 dark:text-gray-100">{count.toLocaleString("en-IN")}</span> visits and counting</span>
    </div>
  );
}
