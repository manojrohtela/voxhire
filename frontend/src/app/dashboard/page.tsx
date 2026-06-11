"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCandidates, useDashboardStats } from "@/hooks/useData";
import { useAuth } from "@/lib/auth";

const BADGE: Record<string, { bg: string; color: string }> = {
  "Strong Hire": { bg: "rgba(52,211,153,0.12)", color: "#34d399" },
  "Hire":        { bg: "rgba(109,86,186,0.15)", color: "#a78bfa" },
  "Consider":    { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
  "Reject":      { bg: "rgba(239,68,68,0.12)",   color: "#f87171" },
  "Pending":     { bg: "rgba(255,255,255,0.06)",  color: "#6b7280" },
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, ...style }}>
      {children}
    </div>
  );
}

export default function OrgDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch]         = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const { candidates, total, loading } = useCandidates({
    search: search || undefined,
    rating: activeFilter !== "All" ? activeFilter : undefined,
  });
  const { stats, loading: statsLoading } = useDashboardStats();

  const totalInterviewed = stats.ratingBreakdown.Strong + stats.ratingBreakdown.Medium + stats.ratingBreakdown.Weak;

  const funnelStages = [
    { label: "Applied",     count: total,                  pct: 100 },
    { label: "Screened",    count: Math.round(total * 0.5), pct: 50 },
    { label: "Interviewed", count: totalInterviewed,        pct: total > 0 ? Math.round((totalInterviewed / total) * 100) : 0 },
    { label: "Offered",     count: Math.round(totalInterviewed * 0.11), pct: total > 0 ? Math.round((totalInterviewed * 0.11 / total) * 100) : 0 },
    { label: "Hired",       count: stats.strongCandidates, pct: total > 0 ? Math.round((stats.strongCandidates / total) * 100) : 0 },
  ];

  const upcomingCandidates = candidates.filter((c) => c.interview_sessions?.[0]?.scheduled_at).slice(0, 3);
  const recentActivity = [...candidates].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()).slice(0, 5);

  return (
    <div style={{ background: "#0f0e14", minHeight: "100vh", color: "#e2e0ea" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 sticky top-0 z-10"
        style={{ background: "rgba(15,14,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <h1 className="text-xl font-bold text-white">Organization Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
            Welcome back, {user?.name?.split(" ")[0] ?? "Admin"}. Here&apos;s your recruitment overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/jobs"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6d56ba,#4f378a)", boxShadow: "0 4px 12px rgba(79,55,138,0.3)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Job
          </Link>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Candidates", value: statsLoading ? "—" : stats.totalCandidates,
              sub: "+12% this month", subColor: "#34d399",
              icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
              iconBg: "rgba(109,86,186,0.2)", iconColor: "#a78bfa",
            },
            {
              label: "Active Interviews", value: statsLoading ? "—" : stats.interviewsDone,
              sub: `${Math.min(stats.interviewsDone, 8)} happening today`, subColor: "#6b7280",
              icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>,
              iconBg: "rgba(52,211,153,0.15)", iconColor: "#34d399",
            },
            {
              label: "Pending Reviews", value: statsLoading ? "—" : stats.pendingSchedule,
              sub: `${Math.min(stats.pendingSchedule, 1)} 24h high priority`, subColor: "#f87171",
              icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>,
              iconBg: "rgba(239,68,68,0.12)", iconColor: "#f87171",
            },
            {
              label: "Shortlisted", value: statsLoading ? "—" : stats.strongCandidates,
              sub: "Ready for offer stage", subColor: "#fbbf24",
              icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
              iconBg: "rgba(251,191,36,0.12)", iconColor: "#fbbf24",
            },
          ].map((m) => (
            <Card key={m.label} style={{ padding: "20px" }}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm" style={{ color: "#6b7280" }}>{m.label}</p>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: m.iconBg, color: m.iconColor }}>
                  {m.icon}
                </div>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{String(m.value)}</p>
              <p className="text-xs" style={{ color: m.subColor }}>{m.sub}</p>
            </Card>
          ))}
        </div>

        {/* Funnel + Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Hiring Funnel */}
          <Card style={{ padding: "24px", gridColumn: "span 2" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-white">Hiring Funnel</h2>
              <span className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>
                Last 30 Days
              </span>
            </div>
            <div className="space-y-4">
              {funnelStages.map((s) => (
                <div key={s.label} className="flex items-center gap-4">
                  <span className="w-24 text-sm shrink-0 text-right" style={{ color: "#9ca3af" }}>{s.label}</span>
                  <div className="flex-1 h-7 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-3"
                      style={{
                        width: `${Math.max(s.pct, s.count > 0 ? 4 : 0)}%`,
                        background: "linear-gradient(90deg, #6d56ba, #8b5cf6)",
                        transition: "width 1s ease",
                        minWidth: s.count > 0 ? "40px" : "0",
                      }}
                    >
                      {s.count > 0 && <span className="text-white text-xs font-semibold">{s.count.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {total === 0 && !statsLoading && (
                <p className="text-center text-sm py-4" style={{ color: "#4b5563" }}>
                  Add candidates to see your hiring funnel
                </p>
              )}
            </div>
          </Card>

          {/* Upcoming Interviews */}
          <Card style={{ padding: "24px" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Upcoming</h2>
              <Link href="/dashboard/schedule" className="text-xs hover:text-white transition-colors" style={{ color: "#6d56ba" }}>
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingCandidates.length > 0 ? upcomingCandidates.map((c) => {
                const dt = new Date(c.interview_sessions![0].scheduled_at!);
                return (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/dashboard/candidates/${c.id}`)}
                    className="flex gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-white/5"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-center shrink-0 w-10">
                      <p className="text-[10px] font-semibold uppercase" style={{ color: "#6d56ba" }}>
                        {dt.toLocaleString("en", { month: "short" })}
                      </p>
                      <p className="text-xl font-bold text-white leading-tight">{dt.getDate()}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{c.applied_role || "Interview"}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "#6b7280" }}>
                        {c.name} · {dt.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-8 text-center">
                  <svg className="w-10 h-10 mx-auto mb-3" style={{ color: "#374151" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm" style={{ color: "#4b5563" }}>No upcoming interviews</p>
                  <Link href="/dashboard/schedule" className="text-xs mt-1 hover:underline block" style={{ color: "#6d56ba" }}>
                    Schedule one →
                  </Link>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card style={{ padding: "24px" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Recent Activity</h2>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.length === 0 && !loading && (
              <p className="text-sm text-center py-4" style={{ color: "#4b5563" }}>No activity yet</p>
            )}
            {recentActivity.map((c, i) => {
              const actions = ["applied for", "was shortlisted for", "completed interview for", "was reviewed for", "submitted resume for"];
              const action = actions[i % actions.length];
              const badges: { label: string; bg: string; color: string }[] = [
                { label: "AI SCORE: " + (75 + i * 4), bg: "rgba(109,86,186,0.2)", color: "#a78bfa" },
                { label: "ON HOLD", bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
                { label: "SHORTLISTED", bg: "rgba(52,211,153,0.15)", color: "#34d399" },
                { label: "REVIEWED", bg: "rgba(255,255,255,0.06)", color: "#6b7280" },
                { label: "NEW", bg: "rgba(109,86,186,0.2)", color: "#a78bfa" },
              ];
              const badge = badges[i % badges.length];
              const timeAgo = ["2 hours ago", "6 hours ago", "Yesterday", "2 days ago", "3 days ago"][i];
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-4 py-3 cursor-pointer hover:bg-white/5 rounded-lg px-3 -mx-3 transition-all"
                  onClick={() => router.push(`/dashboard/candidates/${c.id}`)}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: `hsl(${(i * 60 + 240) % 360}, 50%, 35%)` }}>
                    {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-medium">{c.name}</span>
                      <span style={{ color: "#6b7280" }}> {action} </span>
                      <span className="font-medium" style={{ color: "#a78bfa" }}>{c.applied_role || "a role"}</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#4b5563" }}>{timeAgo}</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
