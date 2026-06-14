"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiWithAuth } from "@/lib/auth";

interface Sub {
  has_subscription: boolean;
  plan: { name: string } | null;
  usage: {
    interviews_used: number;
    interviews_limit: number | null;
    interviews_over_limit: boolean;
  };
}

/**
 * Org plan + interview-usage strip. Soft enforcement: warns near/over limit,
 * never blocks. Renders nothing for grandfathered orgs (no subscription).
 */
export function UsageBanner() {
  const [sub, setSub] = useState<Sub | null>(null);

  useEffect(() => {
    apiWithAuth("/api/v1/billing/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSub)
      .catch(() => {});
  }, []);

  if (!sub || !sub.has_subscription || !sub.plan) return null;

  const { interviews_used, interviews_limit, interviews_over_limit } = sub.usage;
  const pct = interviews_limit ? Math.min(100, Math.round((interviews_used / interviews_limit) * 100)) : 0;
  const near = interviews_limit != null && !interviews_over_limit && pct >= 80;

  const tone = interviews_over_limit
    ? "border-red-500/30 bg-red-500/10"
    : near
    ? "border-amber-500/30 bg-amber-500/10"
    : "border-base bg-surface";
  const bar = interviews_over_limit ? "bg-red-400" : near ? "bg-amber-400" : "bg-primary";

  return (
    <div className={`rounded-xl border ${tone} px-4 py-3 flex items-center gap-4`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-foreground-2">
            <span className="font-semibold text-foreground">{sub.plan.name}</span> plan ·{" "}
            {interviews_used}
            {interviews_limit != null ? ` / ${interviews_limit}` : ""} interviews this month
          </span>
          {(interviews_over_limit || near) && (
            <Link href="/dashboard/billing" className="text-primary text-xs font-medium hover:underline shrink-0">
              {interviews_over_limit ? "Upgrade plan →" : "View plan →"}
            </Link>
          )}
        </div>
        {interviews_limit != null && (
          <div className="h-1.5 bg-ink/[0.06] rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${bar} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
          </div>
        )}
        {interviews_over_limit && (
          <p className="text-red-400 text-xs mt-1.5">You&apos;ve passed your monthly interview limit. Interviews still work — consider upgrading.</p>
        )}
      </div>
    </div>
  );
}
