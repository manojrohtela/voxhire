"use client";

import { useState } from "react";
import Link from "next/link";
import { useCandidate } from "@/hooks/useData";
import { candidatesApi } from "@/lib/api-client";
import { useRouter } from "next/navigation";

const RATING_STYLE: Record<string, { badge: string; bar: string }> = {
  Strong: { badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", bar: "bg-emerald-500" },
  Medium: { badge: "text-amber-400 bg-amber-500/10 border-amber-500/20", bar: "bg-amber-400" },
  Weak: { badge: "text-red-400 bg-red-500/10 border-red-500/20", bar: "bg-red-500" },
  Pending: { badge: "text-foreground-3 bg-ink/5 border-base", bar: "bg-ink/20" },
};

type Tab = "report" | "transcript" | "recording";

export default function CandidateDetailPage({ params }: { params: { candidateId: string } }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("report");
  const { candidate: c, loading, error, refetch } = useCandidate(params.candidateId);

  const handleUpdateRating = async (rating: string) => {
    await candidatesApi.update(params.candidateId, { overall_rating: rating });
    refetch();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this candidate?")) return;
    await candidatesApi.delete(params.candidateId);
    router.push("/dashboard");
  };

  if (loading) return (
    <div className="min-h-full bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !c) return (
    <div className="min-h-full bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-foreground-3 text-sm mb-3">{error || "Candidate not found"}</p>
        <Link href="/dashboard" className="text-violet-400 text-sm hover:text-violet-300">← Back to dashboard</Link>
      </div>
    </div>
  );

  const latestSession = c.interview_sessions?.[0];
  const rating = c.overall_rating || "Pending";
  const ratingStyle = RATING_STYLE[rating] || RATING_STYLE["Pending"];
  const skills = c.skills || [];
  const violations = latestSession?.violations || [];
  const transcript = latestSession?.transcript || [];
  const skillEvals = latestSession?.skill_evaluations || [];

  return (
    <div className="min-h-full bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-20 px-7 py-4 border-b border-faint bg-background/90 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-foreground-3 hover:text-foreground-2 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <span className="text-foreground-5">/</span>
            <span className="text-foreground-3 text-sm">Candidates</span>
            <span className="text-foreground-5">/</span>
            <span className="text-foreground-2 text-sm">{c.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} className="px-3 py-1.5 border border-red-500/20 hover:border-red-500/40 text-red-400/50 hover:text-red-400 rounded-lg text-xs transition-colors">
              Delete
            </button>
            <Link href={`/dashboard/schedule?candidate=${c.id}`}
              className="px-3 py-1.5 bg-violet-500 hover:bg-violet-400 text-white rounded-lg text-xs font-medium transition-colors">
              Schedule Interview
            </Link>
          </div>
        </div>
      </div>

      <div className="px-7 py-6 max-w-6xl">
        {/* Candidate header */}
        <div className="flex items-start gap-5 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-600/30 border border-violet-500/20 flex items-center justify-center text-violet-300 text-xl font-bold shrink-0">
            {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-foreground text-xl font-semibold">{c.name}</h1>
              <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${ratingStyle.badge}`}>{rating}</span>
              {violations.length > 0 && (
                <span className="px-2.5 py-1 rounded-lg border text-xs font-medium text-amber-400 bg-amber-500/10 border-amber-500/20">
                  ⚠ {violations.reduce((s: number, v: any) => s + v.count, 0)} violations
                </span>
              )}
            </div>
            <p className="text-foreground-3 text-sm mt-1">{c.applied_role || "Role not set"} {c.total_experience_years ? `· ${c.total_experience_years} yrs` : ""}</p>
            <div className="flex gap-4 mt-2 flex-wrap">
              {c.email && <span className="text-foreground-4 text-xs">✉ {c.email}</span>}
              {c.phone && <span className="text-foreground-4 text-xs">📱 {c.phone}</span>}
              {c.location && <span className="text-foreground-4 text-xs">📍 {c.location}</span>}
              {latestSession && <span className="text-foreground-4 text-xs">🕐 {latestSession.scheduled_at ? new Date(latestSession.scheduled_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Unscheduled"}</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-faint">
          {(["report", "transcript", "recording"] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-all border-b-2 -mb-px ${
                activeTab === tab ? "text-violet-300 border-violet-500" : "text-foreground-3 border-transparent hover:text-foreground-2"
              }`}>
              {tab === "report" ? "📊 Report" : tab === "transcript" ? "📝 Transcript" : "🎥 Recording"}
            </button>
          ))}
        </div>

        {/* ── REPORT ─────────────────────────────────────────────── */}
        {activeTab === "report" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">

              {/* Summary */}
              {c.summary && (
                <div className="bg-surface border border-base rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-md bg-violet-500/20 border border-violet-500/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <h2 className="text-foreground-2 text-sm font-medium">Candidate Summary</h2>
                  </div>
                  <p className="text-foreground-2 text-sm leading-relaxed">{c.summary}</p>
                </div>
              )}

              {/* Skill evaluations */}
              {skillEvals.length > 0 ? (
                <div className="bg-surface border border-base rounded-2xl p-5">
                  <h2 className="text-foreground-2 text-sm font-medium mb-4">Skill Breakdown</h2>
                  <div className="space-y-4">
                    {skillEvals.map((s: any) => {
                      const style = RATING_STYLE[s.rating] || RATING_STYLE["Pending"];
                      return (
                        <div key={s.skill}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-3">
                              <span className="text-foreground-2 text-sm font-medium">{s.skill}</span>
                              <span className={`px-2 py-0.5 rounded border text-xs ${style.badge}`}>{s.rating}</span>
                              <span className="text-foreground-4 text-xs">{s.questions_asked} questions</span>
                            </div>
                            {s.score && <span className="text-foreground-3 text-sm font-mono">{s.score}/100</span>}
                          </div>
                          {s.score && (
                            <div className="h-1.5 bg-ink/[0.05] rounded-full overflow-hidden mb-2">
                              <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${s.score}%` }} />
                            </div>
                          )}
                          {s.ai_notes && <p className="text-foreground-4 text-xs leading-relaxed">{s.ai_notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : skills.length > 0 ? (
                <div className="bg-surface border border-base rounded-2xl p-5">
                  <h2 className="text-foreground-2 text-sm font-medium mb-4">Selected Skills for Interview</h2>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s: any) => (
                      <span key={s.skill} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                        s.category === "Primary" ? "text-violet-400 bg-violet-500/10 border-violet-500/20" :
                        s.category === "Secondary" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
                        "text-foreground-3 bg-ink/5 border-base"
                      }`}>
                        {s.skill} · {s.difficulty}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Violations */}
              {violations.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                  <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">Anti-Cheat Violations</p>
                  <div className="space-y-2">
                    {violations.map((v: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-foreground-3 text-sm">{v.type?.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-3">
                          {v.timestamp_seconds && <span className="text-foreground-4 text-xs">at {Math.floor(v.timestamp_seconds / 60)}:{String(Math.floor(v.timestamp_seconds % 60)).padStart(2, "0")}</span>}
                          <span className="text-amber-400 text-xs">{v.count}×</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No interview yet */}
              {!latestSession && (
                <div className="bg-surface border border-base rounded-2xl p-8 text-center">
                  <p className="text-foreground-4 text-sm mb-3">No interview conducted yet</p>
                  <Link href={`/dashboard/schedule?candidate=${c.id}`} className="px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/20 transition-colors">
                    Schedule Interview →
                  </Link>
                </div>
              )}
            </div>

            {/* Right col */}
            <div className="space-y-4">
              {/* Verdict */}
              <div className={`rounded-2xl p-5 border ${ratingStyle.badge}`}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-60">Overall Verdict</p>
                <p className={`text-4xl font-bold ${ratingStyle.badge.split(" ")[0]}`}>{rating}</p>
                {skillEvals.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {skillEvals.map((s: any) => (
                      <div key={s.skill} className="flex items-center gap-2">
                        <span className="text-foreground-3 text-xs w-20 shrink-0 truncate">{s.skill}</span>
                        <div className="flex-1 h-1 bg-ink/[0.05] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${(RATING_STYLE[s.rating] || RATING_STYLE["Pending"]).bar}`} style={{ width: `${s.score || 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Strengths */}
              {latestSession?.strengths?.length > 0 && (
                <div className="bg-surface border border-base rounded-2xl p-4">
                  <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">Strengths</p>
                  <ul className="space-y-2">
                    {latestSession.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-foreground-2 text-xs leading-relaxed">
                        <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weak areas */}
              {latestSession?.weak_areas?.length > 0 && (
                <div className="bg-surface border border-base rounded-2xl p-4">
                  <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-3">Weak Areas</p>
                  <ul className="space-y-2">
                    {latestSession.weak_areas.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-foreground-2 text-xs leading-relaxed">
                        <span className="text-red-400 mt-0.5 shrink-0">✗</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <button onClick={() => handleUpdateRating("Strong")}
                  className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-medium rounded-xl text-sm transition-colors">
                  ✓ Mark as Strong
                </button>
                <button onClick={() => handleUpdateRating("Weak")}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-medium rounded-xl text-sm transition-colors">
                  ✗ Mark as Weak
                </button>
                <Link href={`/dashboard/schedule?candidate=${c.id}`}
                  className="block w-full py-3 bg-ink/[0.04] hover:bg-ink/[0.07] border border-base text-foreground-3 hover:text-foreground-2 font-medium rounded-xl text-sm transition-colors text-center">
                  📅 Schedule Interview
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSCRIPT ─────────────────────────────────────────── */}
        {activeTab === "transcript" && (
          <div className="bg-surface border border-base rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-faint flex items-center justify-between">
              <h2 className="text-foreground-2 text-sm font-medium">Interview Transcript</h2>
              <span className="text-foreground-4 text-xs">{transcript.length} exchanges</span>
            </div>
            <div className="p-5 space-y-4 max-h-[600px] overflow-y-auto">
              {transcript.length === 0 ? (
                <p className="text-foreground-4 text-sm text-center py-8">No transcript available yet</p>
              ) : transcript.map((entry: any, i: number) => (
                <div key={i} className={`flex gap-4 ${entry.speaker === "candidate" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-1 border ${
                    entry.speaker === "ai" ? "bg-violet-500/20 border-violet-500/20 text-violet-300" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  }`}>
                    {entry.speaker === "ai" ? "AI" : c.name[0]}
                  </div>
                  <div className={`max-w-[75%] flex flex-col gap-1 ${entry.speaker === "candidate" ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      entry.speaker === "ai"
                        ? "bg-surface-hi border border-base text-foreground-2 rounded-tl-sm"
                        : "bg-violet-500/10 border border-violet-500/15 text-foreground rounded-tr-sm"
                    }`}>{entry.text}</div>
                    {entry.timestamp_seconds != null && (
                      <span className="text-foreground-5 text-xs px-1">
                        {Math.floor(entry.timestamp_seconds / 60)}:{String(Math.floor(entry.timestamp_seconds % 60)).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RECORDING ──────────────────────────────────────────── */}
        {activeTab === "recording" && (
          <div className="bg-surface border border-base rounded-2xl overflow-hidden">
            <div className="aspect-video bg-background flex items-center justify-center">
              {latestSession?.recording_url ? (
                <video src={latestSession.recording_url} controls className="w-full h-full" />
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-ink/[0.04] border border-base flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-foreground-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-foreground-4 text-sm">Recording not available yet</p>
                  <p className="text-foreground-5 text-xs mt-1">Available after interview is completed</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
