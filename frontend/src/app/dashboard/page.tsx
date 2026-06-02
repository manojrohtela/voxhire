"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── Mock Data ─────────────────────────────────────────────────
const STATS = [
  {
    label: "Total Candidates",
    value: "148",
    delta: "+12 this week",
    positive: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: "violet",
  },
  {
    label: "Interviews Done",
    value: "93",
    delta: "+8 this week",
    positive: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    color: "blue",
  },
  {
    label: "Strong Candidates",
    value: "31",
    delta: "21% pass rate",
    positive: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    color: "emerald",
  },
  {
    label: "Avg. Interview Time",
    value: "38m",
    delta: "-4m vs last month",
    positive: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "amber",
  },
];

const COLOR_MAP: Record<string, { stat: string; icon: string; glow: string }> = {
  violet: { stat: "text-violet-300", icon: "text-violet-400 bg-violet-500/10 border-violet-500/20", glow: "shadow-violet-500/10" },
  blue: { stat: "text-blue-300", icon: "text-blue-400 bg-blue-500/10 border-blue-500/20", glow: "shadow-blue-500/10" },
  emerald: { stat: "text-emerald-300", icon: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", glow: "shadow-emerald-500/10" },
  amber: { stat: "text-amber-300", icon: "text-amber-400 bg-amber-500/10 border-amber-500/20", glow: "shadow-amber-500/10" },
};

type Rating = "Strong" | "Medium" | "Weak" | "Pending" | "Scheduled";

const RATING_STYLE: Record<Rating, string> = {
  Strong: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Weak: "text-red-400 bg-red-500/10 border-red-500/20",
  Pending: "text-white/30 bg-white/5 border-white/10",
  Scheduled: "text-violet-400 bg-violet-500/10 border-violet-500/20",
};

interface Candidate {
  id: string;
  name: string;
  role: string;
  experience: string;
  skills: string[];
  rating: Rating;
  interviewDate: string;
  interviewer: string;
}

const CANDIDATES: Candidate[] = [
  { id: "1", name: "Arjun Mehta", role: "Senior iOS Developer", experience: "5.5 yrs", skills: ["Swift", "MVVM", "Combine"], rating: "Strong", interviewDate: "Today, 2:30 PM", interviewer: "AI" },
  { id: "2", name: "Priya Sharma", role: "Full Stack Engineer", experience: "3 yrs", skills: ["React", "Node.js", "PostgreSQL"], rating: "Medium", interviewDate: "Today, 4:00 PM", interviewer: "AI" },
  { id: "3", name: "Rohan Gupta", role: "ML Engineer", experience: "4 yrs", skills: ["PyTorch", "Python", "MLOps"], rating: "Strong", interviewDate: "Yesterday", interviewer: "AI" },
  { id: "4", name: "Sneha Patel", role: "Android Developer", experience: "2.5 yrs", skills: ["Kotlin", "Jetpack Compose", "Room"], rating: "Weak", interviewDate: "Jun 1", interviewer: "AI" },
  { id: "5", name: "Vikram Nair", role: "DevOps Engineer", experience: "6 yrs", skills: ["AWS", "Kubernetes", "Terraform"], rating: "Scheduled", interviewDate: "Tomorrow, 11 AM", interviewer: "AI" },
  { id: "6", name: "Ananya Reddy", role: "Frontend Developer", experience: "2 yrs", skills: ["Vue.js", "TypeScript", "Tailwind"], rating: "Pending", interviewDate: "Not scheduled", interviewer: "—" },
  { id: "7", name: "Karan Singh", role: "Backend Engineer", experience: "4.5 yrs", skills: ["Go", "gRPC", "Redis"], rating: "Strong", interviewDate: "May 31", interviewer: "AI" },
  { id: "8", name: "Divya Krishnan", role: "Data Engineer", experience: "3.5 yrs", skills: ["Spark", "Airflow", "dbt"], rating: "Medium", interviewDate: "May 30", interviewer: "AI" },
];

const FILTERS: Rating[] = ["Strong", "Medium", "Weak", "Scheduled", "Pending"];

export default function RecruiterDashboard() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<Rating | "All">("All");
  const [sortBy, setSortBy] = useState<"name" | "date" | "rating">("date");

  const router = useRouter();
  const filtered = CANDIDATES.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase()) ||
      c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = activeFilter === "All" || c.rating === activeFilter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="min-h-full bg-[#07070d]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 px-7 py-4 border-b border-white/[0.05] bg-[#07070d]/80 backdrop-blur flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-lg tracking-tight">Recruiter Dashboard</h1>
          <p className="text-white/25 text-xs mt-0.5">Tuesday, June 2, 2026</p>
        </div>
        <Link
          href="/resume"
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Candidate
        </Link>
      </div>

      <div className="px-7 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat) => {
            const c = COLOR_MAP[stat.color];
            return (
              <div
                key={stat.label}
                className={`bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-5 shadow-lg ${c.glow} hover:border-white/10 transition-colors`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${c.icon}`}>
                    {stat.icon}
                  </div>
                </div>
                <p className={`text-3xl font-bold tracking-tight ${c.stat}`}>{stat.value}</p>
                <p className="text-white/40 text-xs mt-1">{stat.label}</p>
                <p className="text-white/25 text-xs mt-2 flex items-center gap-1">
                  <span className={stat.positive ? "text-emerald-400" : "text-red-400"}>
                    {stat.positive ? "↑" : "↓"}
                  </span>
                  {stat.delta}
                </p>
              </div>
            );
          })}
        </div>

        {/* Pipeline bar */}
        <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white/70 text-sm font-medium">Interview Pipeline</h2>
            <span className="text-white/25 text-xs">93 total interviews</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            <div className="bg-emerald-500 rounded-l-full" style={{ width: "33%" }} title="Strong: 31" />
            <div className="bg-amber-400" style={{ width: "39%" }} title="Medium: 36" />
            <div className="bg-red-500" style={{ width: "28%" }} title="Weak: 26" />
          </div>
          <div className="flex gap-5 mt-3">
            {[
              { label: "Strong", count: 31, color: "bg-emerald-500" },
              { label: "Medium", count: 36, color: "bg-amber-400" },
              { label: "Weak", count: 26, color: "bg-red-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-white/40 text-xs">{item.label}</span>
                <span className="text-white/60 text-xs font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Candidates table */}
        <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Table toolbar */}
          <div className="px-5 py-4 border-b border-white/[0.05] flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search candidates, roles, skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg pl-9 pr-4 py-2 text-white/70 text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveFilter("All")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeFilter === "All" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"
                }`}
              >
                All ({CANDIDATES.length})
              </button>
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    activeFilter === f ? RATING_STYLE[f] : "text-white/25 border-transparent hover:text-white/40"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Candidate", "Role", "Skills", "Interview", "Rating", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-white/20 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => router.push(`/dashboard/candidates/${c.id}`)} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                    {/* Candidate */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-500/30 border border-violet-500/20 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0">
                          {c.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-white/80 text-sm font-medium">{c.name}</p>
                          <p className="text-white/25 text-xs">{c.experience}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <p className="text-white/50 text-sm">{c.role}</p>
                    </td>

                    {/* Skills */}
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5 flex-wrap">
                        {c.skills.slice(0, 3).map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded text-white/40 text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Interview date */}
                    <td className="px-5 py-3.5">
                      <p className="text-white/40 text-xs">{c.interviewDate}</p>
                      <p className="text-white/20 text-xs mt-0.5">by {c.interviewer}</p>
                    </td>

                    {/* Rating */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium ${RATING_STYLE[c.rating]}`}>
                        {c.rating}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/[0.07] rounded-lg text-white/50 text-xs transition-colors">
                          View Report
                        </button>
                        {(c.rating === "Pending" || c.rating === "Scheduled") && (
                          <button className="px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg text-violet-400 text-xs transition-colors">
                            Schedule
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <p className="text-white/20 text-sm">No candidates match your search</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between">
            <p className="text-white/20 text-xs">{filtered.length} of {CANDIDATES.length} candidates</p>
            <div className="flex gap-1">
              {[1, 2, 3].map((p) => (
                <button key={p} className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  p === 1 ? "bg-violet-500/20 text-violet-300 border border-violet-500/20" : "text-white/20 hover:text-white/40"
                }`}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
