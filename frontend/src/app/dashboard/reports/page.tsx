"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { interviewsApi } from "@/lib/api-client";

const RATING_CONFIG: Record<string, { bg: string; color: string; border: string }> = {
  "Strong Hire": { bg: "rgba(16,185,129,0.12)", color: "#34d399", border: "rgba(52,211,153,0.3)" },
  "Hire":        { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(96,165,250,0.3)" },
  "Consider":    { bg: "rgba(234,179,8,0.12)",  color: "#facc15", border: "rgba(250,204,21,0.3)" },
  "Reject":      { bg: "rgba(239,68,68,0.12)",  color: "#f87171", border: "rgba(248,113,113,0.3)" },
  "Pending":     { bg: "rgba(100,100,120,0.15)", color: "#9ca3af", border: "rgba(156,163,175,0.2)" },
};

const EVAL_LABEL: Record<string, { text: string; color: string }> = {
  complete:   { text: "Ready",       color: "#34d399" },
  processing: { text: "Scoring…",    color: "#facc15" },
  failed:     { text: "Failed",      color: "#f87171" },
  pending:    { text: "Not started", color: "#9ca3af" },
};

function initials(name?: string) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

export default function ReportsPage() {
  const router = useRouter();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await interviewsApi.list();
      // Newest first; surface ones that actually have / are building a report.
      setInterviews(Array.isArray(data) ? data : []);
    } catch {
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const withReports = interviews.filter(
    (i) => i.status === "completed" || (i.evaluation_status && i.evaluation_status !== "pending")
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f0e14", color: "#e2e0ea" }}>
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Reports</h1>
          <p className="text-gray-500 text-sm mt-1">AI-scored interview reports across your candidates.</p>
        </div>
      </div>

      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-7 h-7 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : withReports.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(109,86,186,0.12)", border: "1px solid rgba(109,86,186,0.25)" }}>
              <svg className="w-6 h-6 text-[#a78bfa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold mb-1">No reports yet</h2>
            <p className="text-gray-500 text-sm">Once a candidate finishes an interview, their AI-scored report appears here.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Candidate", "Interview", "Recommendation", "Scores", "Status", "Date"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-gray-500 text-xs font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withReports.map((iv, idx) => {
                  const rc = RATING_CONFIG[iv.overall_rating] ?? RATING_CONFIG.Pending;
                  const ev = EVAL_LABEL[iv.evaluation_status as string] ?? EVAL_LABEL.pending;
                  const scores = [iv.communication_score, iv.confidence_score, iv.clarity_score].filter((s) => s != null);
                  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                  return (
                    <tr key={iv.id}
                      style={{ borderBottom: idx < withReports.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      onClick={() => router.push(`/dashboard/interviews/${iv.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                            {initials(iv.candidate_name)}
                          </div>
                          <span className="text-white text-sm font-medium">{iv.candidate_name || "Candidate"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="text-gray-400 text-sm">{iv.interview_type || "Technical"} · {iv.difficulty || "Medium"}</span></td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: rc.color }} />
                          {iv.overall_rating || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4"><span className="text-gray-300 text-sm font-medium">{avg != null ? `${avg}/100` : "—"}</span></td>
                      <td className="px-6 py-4"><span className="text-xs font-medium" style={{ color: ev.color }}>{ev.text}</span></td>
                      <td className="px-6 py-4">
                        <span className="text-gray-500 text-xs">
                          {iv.ended_at || iv.created_at ? new Date(iv.ended_at || iv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
