"use client";

import { useState } from "react";

const PLATFORM_STATS = [
  { label: "Total Interviews", value: "1,284", delta: "+94 this month", color: "violet" },
  { label: "Active Recruiters", value: "23", delta: "across 8 companies", color: "blue" },
  { label: "Avg. AI Accuracy", value: "91%", delta: "+2.3% vs last month", color: "emerald" },
  { label: "Latency P95", value: "1.1s", delta: "within target <1.2s", color: "amber" },
];

const RECRUITER_DATA = [
  { name: "Meera Iyer", company: "TechCorp India", interviews: 48, strong: 12, plan: "Pro", status: "Active", joined: "Jan 2026" },
  { name: "Sameer Khan", company: "Finova Solutions", interviews: 35, strong: 8, plan: "Pro", status: "Active", joined: "Feb 2026" },
  { name: "Ritika Joshi", company: "HireWave", interviews: 67, strong: 19, plan: "Enterprise", status: "Active", joined: "Dec 2025" },
  { name: "Akhil Verma", company: "StartupX", interviews: 21, strong: 4, plan: "Starter", status: "Active", joined: "Mar 2026" },
  { name: "Pooja Menon", company: "GlobalTech", interviews: 93, strong: 28, plan: "Enterprise", status: "Active", joined: "Nov 2025" },
  { name: "Dev Rastogi", company: "CodingCo", interviews: 12, strong: 2, plan: "Starter", status: "Trial", joined: "May 2026" },
];

const MONTHLY_DATA = [
  { month: "Jan", interviews: 68 },
  { month: "Feb", interviews: 95 },
  { month: "Mar", interviews: 112 },
  { month: "Apr", interviews: 134 },
  { month: "May", interviews: 189 },
  { month: "Jun", interviews: 94 },
];

const PLAN_STYLE: Record<string, string> = {
  Enterprise: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Pro: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Starter: "text-foreground-3 bg-ink/5 border-base",
};

const STATUS_STYLE: Record<string, string> = {
  Active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Trial: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const COLOR_MAP: Record<string, { val: string; icon: string }> = {
  violet: { val: "text-violet-300", icon: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  blue: { val: "text-blue-300", icon: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  emerald: { val: "text-emerald-300", icon: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  amber: { val: "text-amber-300", icon: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
};

const maxInterviews = Math.max(...MONTHLY_DATA.map((d) => d.interviews));

export default function AdminDashboard() {
  const [search, setSearch] = useState("");

  const filtered = RECRUITER_DATA.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-full bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-20 px-7 py-4 border-b border-faint bg-background/80 backdrop-blur flex items-center justify-between">
        <div>
          <h1 className="text-foreground font-semibold text-lg tracking-tight">Admin — Platform Overview</h1>
          <p className="text-foreground-4 text-xs mt-0.5">All data across all recruiters and companies</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-medium">Platform Healthy</span>
        </div>
      </div>

      <div className="px-7 py-6 space-y-6">
        {/* Platform stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PLATFORM_STATS.map((stat) => {
            const c = COLOR_MAP[stat.color];
            return (
              <div key={stat.label} className="bg-surface border border-base rounded-2xl p-5 hover:border-strong transition-colors">
                <p className={`text-3xl font-bold tracking-tight ${c.val}`}>{stat.value}</p>
                <p className="text-foreground-3 text-xs mt-1">{stat.label}</p>
                <p className="text-foreground-4 text-xs mt-2">{stat.delta}</p>
              </div>
            );
          })}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Monthly interviews bar chart */}
          <div className="lg:col-span-2 bg-surface border border-base rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-foreground-2 text-sm font-medium">Monthly Interviews</h2>
              <span className="text-foreground-4 text-xs">2026</span>
            </div>
            <div className="flex items-end gap-3 h-32">
              {MONTHLY_DATA.map((d) => {
                const pct = (d.interviews / maxInterviews) * 100;
                const isCurrentMonth = d.month === "Jun";
                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-foreground-3 text-xs">{d.interviews}</span>
                    <div className="w-full flex items-end" style={{ height: "80px" }}>
                      <div
                        className={`w-full rounded-t-lg transition-all ${
                          isCurrentMonth
                            ? "bg-violet-500/60 border border-violet-500/30"
                            : "bg-ink/[0.07] hover:bg-ink/[0.12]"
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs ${isCurrentMonth ? "text-violet-400" : "text-foreground-4"}`}>{d.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan distribution */}
          <div className="bg-surface border border-base rounded-2xl p-5">
            <h2 className="text-foreground-2 text-sm font-medium mb-5">Plan Distribution</h2>
            <div className="space-y-4">
              {[
                { plan: "Enterprise", count: 2, total: 23, color: "bg-violet-500" },
                { plan: "Pro", count: 11, total: 23, color: "bg-blue-500" },
                { plan: "Starter", count: 10, total: 23, color: "bg-ink/20" },
              ].map((item) => {
                const pct = Math.round((item.count / item.total) * 100);
                return (
                  <div key={item.plan}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-foreground-3 text-xs">{item.plan}</span>
                      <span className="text-foreground-4 text-xs">{item.count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-ink/[0.05] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Module health */}
            <div className="mt-6 pt-5 border-t border-faint">
              <p className="text-foreground-4 text-xs uppercase tracking-wider mb-3">Module Health</p>
              <div className="space-y-2">
                {[
                  { label: "Voice Runtime", status: "Operational" },
                  { label: "Resume Parser", status: "Operational" },
                  { label: "Evaluation Engine", status: "Building" },
                  { label: "Scheduling", status: "Building" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="text-foreground-3 text-xs">{m.label}</span>
                    <span className={`text-xs ${m.status === "Operational" ? "text-emerald-400" : "text-amber-400"}`}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recruiters table */}
        <div className="bg-surface border border-base rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-faint flex items-center justify-between gap-4">
            <h2 className="text-foreground-2 text-sm font-medium shrink-0">All Recruiters</h2>
            <div className="relative max-w-xs w-full">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search recruiters..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-ink/[0.04] border border-base rounded-lg pl-8 pr-4 py-2 text-foreground-2 text-xs placeholder-foreground-4 focus:outline-none focus:border-violet-500/40 transition-colors"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-faint">
                  {["Recruiter", "Company", "Interviews", "Strong Rate", "Plan", "Status", "Joined"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-foreground-4 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/[0.03]">
                {filtered.map((r) => {
                  const strongRate = Math.round((r.strong / r.interviews) * 100);
                  return (
                    <tr key={r.name} className="hover:bg-ink/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">
                            {r.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span className="text-foreground-2 text-sm">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-foreground-3 text-sm">{r.company}</td>
                      <td className="px-5 py-3.5 text-foreground-2 text-sm font-medium">{r.interviews}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-ink/[0.05] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${strongRate}%` }} />
                          </div>
                          <span className="text-foreground-3 text-xs">{strongRate}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded border text-xs font-medium ${PLAN_STYLE[r.plan]}`}>
                          {r.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`flex items-center gap-1.5 text-xs w-fit ${STATUS_STYLE[r.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === "Active" ? "bg-emerald-400" : "bg-amber-400"}`} />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-foreground-4 text-xs">{r.joined}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-faint">
            <p className="text-foreground-4 text-xs">{filtered.length} recruiters · {RECRUITER_DATA.reduce((s, r) => s + r.interviews, 0)} total interviews conducted</p>
          </div>
        </div>
      </div>
    </div>
  );
}
