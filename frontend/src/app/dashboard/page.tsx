"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCandidates, useDashboardStats } from "@/hooks/useData";
import { useAuth } from "@/lib/auth";

type Rating = "Strong" | "Medium" | "Weak" | "Pending" | "Scheduled";

const RATING_STYLE: Record<string, string> = {
  Strong: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Weak: "text-red-400 bg-red-500/10 border-red-500/20",
  Pending: "text-foreground-3 bg-ink/5 border-base",
  Scheduled: "text-violet-400 bg-violet-500/10 border-violet-500/20",
};

const COLOR_MAP: Record<string, { stat: string; icon: string }> = {
  violet: { stat: "text-violet-300", icon: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  blue: { stat: "text-blue-300", icon: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  emerald: { stat: "text-emerald-300", icon: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  amber: { stat: "text-amber-300", icon: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
};

export default function RecruiterDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const { candidates, total, loading } = useCandidates({
    search: search || undefined,
    rating: activeFilter !== "All" ? activeFilter : undefined,
  });

  const { stats, loading: statsLoading } = useDashboardStats();

  const STATS = [
    {
      label: "Total Candidates", value: statsLoading ? "—" : String(stats.totalCandidates),
      delta: "in your pipeline", color: "violet",
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      label: "Interviews Done", value: statsLoading ? "—" : String(stats.interviewsDone),
      delta: "completed sessions", color: "blue",
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    },
    {
      label: "Strong Candidates", value: statsLoading ? "—" : String(stats.strongCandidates),
      delta: "recommended for hire", color: "emerald",
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
    },
    {
      label: "Pending Interview", value: statsLoading ? "—" : String(stats.pendingSchedule),
      delta: "need scheduling", color: "amber",
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
  ];

  const totalInterviewed = stats.ratingBreakdown.Strong + stats.ratingBreakdown.Medium + stats.ratingBreakdown.Weak;

  return (
    <div className="min-h-full bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-20 px-7 py-4 border-b border-faint bg-background/80 backdrop-blur flex items-center justify-between">
        <div>
          <h1 className="text-foreground font-semibold text-lg tracking-tight">Dashboard</h1>
          <p className="text-foreground-4 text-xs mt-0.5">
            {user?.org?.name} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Link href="/resume" className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Candidate
        </Link>
      </div>

      <div className="px-7 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat) => {
            const c = COLOR_MAP[stat.color];
            return (
              <div key={stat.label} className="bg-surface border border-base rounded-2xl p-5 hover:border-strong transition-colors">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-4 ${c.icon}`}>{stat.icon}</div>
                <p className={`text-3xl font-bold tracking-tight ${c.stat}`}>{stat.value}</p>
                <p className="text-foreground-3 text-xs mt-1">{stat.label}</p>
                <p className="text-foreground-4 text-xs mt-2">{stat.delta}</p>
              </div>
            );
          })}
        </div>

        {/* Pipeline bar */}
        {totalInterviewed > 0 && (
          <div className="bg-surface border border-base rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-foreground-2 text-sm font-medium">Interview Pipeline</h2>
              <span className="text-foreground-4 text-xs">{totalInterviewed} evaluated</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
              <div className="bg-emerald-500 rounded-l-full" style={{ width: `${(stats.ratingBreakdown.Strong / totalInterviewed) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(stats.ratingBreakdown.Medium / totalInterviewed) * 100}%` }} />
              <div className="bg-red-500 rounded-r-full" style={{ width: `${(stats.ratingBreakdown.Weak / totalInterviewed) * 100}%` }} />
            </div>
            <div className="flex gap-5 mt-3">
              {[
                { label: "Strong", count: stats.ratingBreakdown.Strong, color: "bg-emerald-500" },
                { label: "Medium", count: stats.ratingBreakdown.Medium, color: "bg-amber-400" },
                { label: "Weak", count: stats.ratingBreakdown.Weak, color: "bg-red-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-foreground-3 text-xs">{item.label}</span>
                  <span className="text-foreground-2 text-xs font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Candidates table */}
        <div className="bg-surface border border-base rounded-2xl overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-faint flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text" placeholder="Search candidates, roles, skills..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-ink/[0.04] border border-base rounded-lg pl-9 pr-4 py-2 text-foreground-2 text-sm placeholder-foreground-5 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["All", "Strong", "Medium", "Weak", "Pending"].map((f) => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    activeFilter === f
                      ? f === "All" ? "bg-ink/10 text-foreground border-base" : RATING_STYLE[f]
                      : "text-foreground-4 border-transparent hover:text-foreground-3"
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-faint">
                  {["Candidate", "Role", "Experience", "Interview", "Rating", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-foreground-4 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/[0.03]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-ink/[0.04] rounded animate-pulse" style={{ width: j === 0 ? "120px" : j === 5 ? "60px" : "80px" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-ink/[0.04] border border-base flex items-center justify-center">
                          <svg className="w-5 h-5 text-foreground-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <p className="text-foreground-4 text-sm">No candidates yet</p>
                        <Link href="/resume" className="text-violet-400 text-xs hover:text-violet-300 transition-colors">Upload first resume →</Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => {
                    const rating = c.overall_rating || "Pending";
                    const latestSession = c.interview_sessions?.[0];
                    return (
                      <tr key={c.id} onClick={() => router.push(`/dashboard/candidates/${c.id}`)}
                        className="hover:bg-ink/[0.02] transition-colors group cursor-pointer">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-500/30 border border-violet-500/20 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0">
                              {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-foreground text-sm font-medium">{c.name}</p>
                              <p className="text-foreground-4 text-xs">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-foreground-2 text-sm">{c.applied_role || "—"}</td>
                        <td className="px-5 py-3.5 text-foreground-3 text-sm">{c.total_experience_years ? `${c.total_experience_years} yrs` : "—"}</td>
                        <td className="px-5 py-3.5">
                          {latestSession ? (
                            <div>
                              <p className="text-foreground-3 text-xs capitalize">{latestSession.status}</p>
                              {latestSession.scheduled_at && (
                                <p className="text-foreground-4 text-xs">{new Date(latestSession.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                              )}
                            </div>
                          ) : <span className="text-foreground-4 text-xs">Not scheduled</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium ${RATING_STYLE[rating] || RATING_STYLE["Pending"]}`}>
                            {rating}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="px-3 py-1.5 bg-ink/[0.05] hover:bg-ink/10 border border-base rounded-lg text-foreground-2 text-xs transition-colors">
                              View
                            </button>
                            {!latestSession && (
                              <Link href="/dashboard/schedule" onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg text-violet-400 text-xs transition-colors">
                                Schedule
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-faint flex items-center justify-between">
            <p className="text-foreground-4 text-xs">{candidates.length} of {total} candidates</p>
          </div>
        </div>
      </div>
    </div>
  );
}
