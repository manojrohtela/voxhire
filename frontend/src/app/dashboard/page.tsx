"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCandidates, useDashboardStats } from "@/hooks/useData";
import { useAuth } from "@/lib/auth";

const BADGE: Record<string, string> = {
  "Strong Hire": "bg-emerald-500/12 text-emerald-400",
  "Hire":        "bg-primary/15 text-primary",
  "Consider":    "bg-amber-500/12 text-amber-400",
  "Reject":      "bg-red-500/12 text-red-400",
  "Pending":     "bg-ink/[0.06] text-foreground-3",
};

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-surface border border-base rounded-xl ${className}`} style={style}>
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
    <div className="bg-background min-h-screen text-foreground">

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b border-base">
        <div>
          <h1 className="text-xl font-bold text-foreground">Organization Dashboard</h1>
          <p className="text-sm mt-0.5 text-foreground-3">
            Welcome back, {user?.name?.split(" ")[0] ?? "Admin"}. Here&apos;s your recruitment overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/jobs"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary transition-all hover:bg-primary/90 shadow-sm shadow-primary/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Job
          </Link>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground-3 hover:text-foreground transition-colors border border-base bg-surface-hi">
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
              sub: "+12% this month", subClass: "text-emerald-400",
              icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
              iconWrap: "bg-primary/20 text-primary",
            },
            {
              label: "Active Interviews", value: statsLoading ? "—" : stats.interviewsDone,
              sub: `${Math.min(stats.interviewsDone, 8)} happening today`, subClass: "text-foreground-3",
              icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>,
              iconWrap: "bg-emerald-500/15 text-emerald-400",
            },
            {
              label: "Pending Reviews", value: statsLoading ? "—" : stats.pendingSchedule,
              sub: `${Math.min(stats.pendingSchedule, 1)} 24h high priority`, subClass: "text-red-400",
              icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>,
              iconWrap: "bg-red-500/12 text-red-400",
            },
            {
              label: "Shortlisted", value: statsLoading ? "—" : stats.strongCandidates,
              sub: "Ready for offer stage", subClass: "text-amber-400",
              icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
              iconWrap: "bg-amber-500/12 text-amber-400",
            },
          ].map((m) => (
            <Card key={m.label} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-foreground-3">{m.label}</p>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.iconWrap}`}>
                  {m.icon}
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground mb-1">{String(m.value)}</p>
              <p className={`text-xs ${m.subClass}`}>{m.sub}</p>
            </Card>
          ))}
        </div>

        {/* Funnel + Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Hiring Funnel */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-foreground">Hiring Funnel</h2>
              <span className="text-xs px-3 py-1 rounded-full bg-ink/[0.06] text-foreground-3">
                Last 30 Days
              </span>
            </div>
            <div className="space-y-4">
              {funnelStages.map((s) => (
                <div key={s.label} className="flex items-center gap-4">
                  <span className="w-24 text-sm shrink-0 text-right text-foreground-3">{s.label}</span>
                  <div className="flex-1 h-7 rounded-full overflow-hidden bg-ink/[0.05]">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-3 bg-primary transition-[width] duration-1000"
                      style={{
                        width: `${Math.max(s.pct, s.count > 0 ? 4 : 0)}%`,
                        minWidth: s.count > 0 ? "40px" : "0",
                      }}
                    >
                      {s.count > 0 && <span className="text-on-primary text-xs font-semibold">{s.count.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {total === 0 && !statsLoading && (
                <p className="text-center text-sm py-4 text-foreground-4">
                  Add candidates to see your hiring funnel
                </p>
              )}
            </div>
          </Card>

          {/* Upcoming Interviews */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Upcoming</h2>
              <Link href="/dashboard/schedule" className="text-xs text-primary hover:text-primary/80 transition-colors">
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
                    className="flex gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-ink/5 border border-base"
                  >
                    <div className="text-center shrink-0 w-10">
                      <p className="text-[10px] font-semibold uppercase text-primary">
                        {dt.toLocaleString("en", { month: "short" })}
                      </p>
                      <p className="text-xl font-bold text-foreground leading-tight">{dt.getDate()}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{c.applied_role || "Interview"}</p>
                      <p className="text-xs mt-0.5 truncate text-foreground-3">
                        {c.name} · {dt.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-8 text-center">
                  <svg className="w-10 h-10 mx-auto mb-3 text-foreground-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-foreground-4">No upcoming interviews</p>
                  <Link href="/dashboard/schedule" className="text-xs mt-1 hover:underline block text-primary">
                    Schedule one →
                  </Link>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-3 hover:text-foreground transition-colors border border-base">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.length === 0 && !loading && (
              <p className="text-sm text-center py-4 text-foreground-4">No activity yet</p>
            )}
            {recentActivity.map((c, i) => {
              const ss = (c as any).screening_status as string | null;
              const statusMap: Record<string, { action: string; label: string; badge: string }> = {
                interview_scheduled: { action: "interview scheduled for", label: "INTERVIEW SCHEDULED", badge: "bg-emerald-500/15 text-emerald-400" },
                completed:           { action: "screening completed for", label: "SCREENING DONE",      badge: "bg-emerald-500/15 text-emerald-400" },
                partially_completed: { action: "partial screening for",   label: "PARTIAL",             badge: "bg-amber-500/15 text-amber-400" },
                link_sent:           { action: "screening link sent for", label: "LINK SENT",           badge: "bg-primary/20 text-primary" },
                calling:             { action: "screening in progress for", label: "IN PROGRESS",       badge: "bg-blue-500/20 text-blue-400" },
                callback_requested:  { action: "callback requested for",  label: "CALLBACK",            badge: "bg-amber-500/15 text-amber-400" },
                declined:            { action: "declined screening for",  label: "DECLINED",            badge: "bg-red-500/15 text-red-400" },
                no_answer:           { action: "no answer for",           label: "NO ANSWER",           badge: "bg-ink/[0.08] text-foreground-3" },
              };
              const statusInfo = (ss && statusMap[ss]) || { action: "added as candidate for", label: "NEW", badge: "bg-primary/20 text-primary" };

              const timeAgo = (() => {
                if (!c.updated_at && !c.created_at) return "";
                const diff = Date.now() - new Date((c.updated_at || c.created_at) as string).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.floor(hrs / 24)}d ago`;
              })();

              return (
                <div
                  key={c.id}
                  className="flex items-center gap-4 py-3 cursor-pointer hover:bg-ink/5 rounded-lg px-3 -mx-3 transition-all"
                  onClick={() => router.push(`/dashboard/candidates/${c.id}`)}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: `hsl(${(i * 60 + 240) % 360}, 50%, 35%)` }}>
                    {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-foreground-3"> {statusInfo.action} </span>
                      <span className="font-medium text-primary">{c.applied_role || "a role"}</span>
                    </p>
                    <p className="text-xs mt-0.5 text-foreground-4">{timeAgo}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusInfo.badge}`}>
                    {statusInfo.label}
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
