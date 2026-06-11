"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCandidate } from "@/hooks/useData";
import { candidatesApi } from "@/lib/api-client";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

const RATING_STYLE: Record<string, { badge: string; bar: string }> = {
  Strong: { badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", bar: "bg-emerald-500" },
  Medium: { badge: "text-amber-400 bg-amber-500/10 border-amber-500/20", bar: "bg-amber-400" },
  Weak: { badge: "text-red-400 bg-red-500/10 border-red-500/20", bar: "bg-red-500" },
  Pending: { badge: "text-foreground-3 bg-ink/5 border-base", bar: "bg-ink/20" },
};

const SCREENING_STATUS_STYLE: Record<string, { label: string; color: string }> = {
  not_contacted:       { label: "Not Contacted",      color: "text-foreground-4 bg-ink/5 border-base" },
  link_sent:           { label: "Link Sent",          color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  calling:             { label: "In Progress",        color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  completed:           { label: "Completed",          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  callback_requested:  { label: "Callback Requested", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  declined:            { label: "Declined",           color: "text-red-400 bg-red-500/10 border-red-500/20" },
  no_answer:           { label: "No Answer",          color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  call_dropped:        { label: "Call Dropped",       color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  partially_completed: { label: "Partial Info",       color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
};

const EVENT_ICON: Record<string, string> = {
  INVITATION_SENT:      "📨",
  SCREENING_INITIATED:  "📞",
  CALL_CONNECTED:       "🔗",
  SCREENING_COMPLETED:  "✅",
  INTERVIEW_SCHEDULED:  "🗓️",
  CALLBACK_REQUESTED:   "📅",
  DECLINED:             "❌",
  CALL_DROPPED:         "📵",
  NO_ANSWER:            "🔕",
  RETRY_SCHEDULED:      "🔄",
};

type Tab = "report" | "transcript" | "recording" | "screening";

interface ScreeningData {
  screening_status: string;
  screening_attempt_count: number;
  last_screening_attempt_at: string | null;
  latest_call: Record<string, any> | null;
  latest_invitation: Record<string, any> | null;
  calls: Record<string, any>[];
  invitations: Record<string, any>[];
  timeline: Record<string, any>[];
  auto_interview: { id: string; interview_link: string; status: string; created_at: string } | null;
}

async function fetchScreeningData(candidateId: string): Promise<ScreeningData | null> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_URL}/api/v1/screening/${candidateId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sendScreeningInvitation(candidateId: string, jobId?: string): Promise<any> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_URL}/api/v1/screening/${candidateId}/send-invitation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId || null, expires_in_hours: 72 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to send invitation");
  }
  return res.json();
}

async function retryScreeningCall(candidateId: string): Promise<any> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_URL}/api/v1/screening/${candidateId}/retry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to retry screening");
  }
  return res.json();
}

export default function CandidateDetailPage({ params }: { params: { candidateId: string } }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("report");
  const { candidate: c, loading, error, refetch } = useCandidate(params.candidateId);

  const [screening, setScreening] = useState<ScreeningData | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningAction, setScreeningAction] = useState<string | null>(null);
  const [screeningError, setScreeningError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadScreening = useCallback(async () => {
    if (!params.candidateId) return;
    setScreeningLoading(true);
    const data = await fetchScreeningData(params.candidateId);
    setScreening(data);
    setScreeningLoading(false);
  }, [params.candidateId]);

  useEffect(() => {
    if (activeTab === "screening") loadScreening();
  }, [activeTab, loadScreening]);

  const handleSendInvitation = async () => {
    setScreeningAction("sending");
    setScreeningError(null);
    try {
      await sendScreeningInvitation(params.candidateId);
      await loadScreening();
    } catch (e: any) {
      setScreeningError(e.message);
    } finally {
      setScreeningAction(null);
    }
  };

  const handleRetryScreening = async () => {
    setScreeningAction("retrying");
    setScreeningError(null);
    try {
      await retryScreeningCall(params.candidateId);
      await loadScreening();
    } catch (e: any) {
      setScreeningError(e.message);
    } finally {
      setScreeningAction(null);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

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
          {(["report", "transcript", "recording", "screening"] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-all border-b-2 -mb-px ${
                activeTab === tab ? "text-violet-300 border-violet-500" : "text-foreground-3 border-transparent hover:text-foreground-2"
              }`}>
              {tab === "report" ? "📊 Report" : tab === "transcript" ? "📝 Transcript" : tab === "recording" ? "🎥 Recording" : "📞 Screening"}
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

        {/* ── SCREENING ──────────────────────────────────────────── */}
        {activeTab === "screening" && (
          <div className="space-y-5">
            {screeningLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Status header + action buttons */}
                <div className="bg-surface border border-base rounded-2xl p-5 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-foreground-4 text-xs uppercase tracking-wider mb-2">Screening Status</p>
                    {screening ? (
                      <>
                        <div className="flex items-center gap-3 flex-wrap">
                          {(() => {
                            const s = screening.screening_status || "not_contacted";
                            const style = SCREENING_STATUS_STYLE[s] || SCREENING_STATUS_STYLE.not_contacted;
                            return (
                              <span className={`px-3 py-1 rounded-lg border text-sm font-semibold ${style.color}`}>
                                {style.label}
                              </span>
                            );
                          })()}
                          {screening.screening_attempt_count > 0 && (
                            <span className="text-foreground-4 text-xs">{screening.screening_attempt_count} attempt{screening.screening_attempt_count !== 1 ? "s" : ""}</span>
                          )}
                          {screening.last_screening_attempt_at && (
                            <span className="text-foreground-5 text-xs">
                              Last: {new Date(screening.last_screening_attempt_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                        {screening.screening_status === "callback_requested" && screening.latest_call && (
                          <p className="text-amber-400 text-xs mt-2">
                            Callback scheduled: {screening.latest_call.callback_date} {screening.latest_call.callback_time}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-foreground-4 text-sm">No screening data</span>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {/* Primary: Send web screening link */}
                    {(!screening || ["not_contacted", null, undefined, "declined", "completed"].indexOf(screening.screening_status) !== -1 && screening.screening_status !== "calling") && (
                      <button
                        onClick={handleSendInvitation}
                        disabled={!!screeningAction}
                        className="px-4 py-2 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {screeningAction === "sending" ? "Sending…" : "📨 Send Screening Link"}
                      </button>
                    )}
                    {/* Retry for failed/dropped/callback */}
                    {screening && ["no_answer", "call_dropped", "callback_requested", "partially_completed"].includes(screening.screening_status) && (
                      <button
                        onClick={handleRetryScreening}
                        disabled={!!screeningAction}
                        className="px-4 py-2 bg-ink/[0.06] hover:bg-ink/10 disabled:opacity-50 border border-base text-foreground-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {screeningAction === "retrying" ? "Retrying…" : "🔄 Resend Link"}
                      </button>
                    )}
                    {screening && (
                      <button onClick={loadScreening} className="px-3 py-2 border border-base rounded-lg text-foreground-4 hover:text-foreground-3 text-xs transition-colors">
                        ↻ Refresh
                      </button>
                    )}
                  </div>
                </div>

                {screeningError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                    {screeningError}
                  </div>
                )}

                {/* Active invitation link */}
                {screening?.latest_invitation && !screening.latest_invitation.is_used && (
                  <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <p className="text-violet-300 text-sm font-medium">
                        {screening.latest_invitation.email_sent ? "📧 Invitation sent via email" : "🔗 Invitation link ready to share"}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {screening.latest_invitation.started_at && (
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400">Link opened</span>
                        )}
                        {(() => {
                          const expiresAt = new Date(screening.latest_invitation.expires_at);
                          const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / 3600000);
                          return hoursLeft > 0
                            ? <span className="text-foreground-5 text-xs">Expires in {hoursLeft}h</span>
                            : <span className="text-red-400 text-xs">Expired</span>;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={screening.latest_invitation.screening_url}
                        className="flex-1 bg-ink/10 border border-base rounded-lg px-3 py-2 text-foreground-3 text-xs font-mono truncate"
                      />
                      <button
                        onClick={() => handleCopyLink(screening.latest_invitation!.screening_url)}
                        className="px-3 py-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/20 text-violet-300 rounded-lg text-xs font-medium transition-colors shrink-0"
                      >
                        {copiedLink ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Auto-scheduled interview link */}
                {screening?.auto_interview && (
                  <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🗓️</span>
                      <p className="text-emerald-300 text-sm font-semibold">Interview Auto-Scheduled</p>
                      <span className="ml-auto px-2 py-0.5 rounded border text-xs text-emerald-400 bg-emerald-500/10 border-emerald-500/20 capitalize">
                        {screening.auto_interview.status}
                      </span>
                    </div>
                    <p className="text-foreground-4 text-xs mb-3">
                      Scheduled {new Date(screening.auto_interview.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {screening.latest_call?.interview_availability && ` · Candidate available: ${screening.latest_call.interview_availability}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={screening.auto_interview.interview_link}
                        className="flex-1 bg-ink/10 border border-base rounded-lg px-3 py-2 text-foreground-3 text-xs font-mono truncate"
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(screening!.auto_interview!.interview_link)}
                        className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/20 text-emerald-300 rounded-lg text-xs font-medium transition-colors shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {/* Latest call info */}
                {screening?.latest_call && screening.latest_call.screening_completed && (
                  <div className="bg-surface border border-base rounded-2xl p-5">
                    <p className="text-foreground-2 text-sm font-medium mb-4">📋 Screening Results</p>

                    {/* Call summary */}
                    {(() => {
                      const summaryEvent = screening.timeline?.find(
                        (e: any) => e.event_type === "SCREENING_COMPLETED" && e.event_data?.callSummary
                      );
                      return summaryEvent?.event_data?.callSummary ? (
                        <div className="mb-4 pb-4 border-b border-faint">
                          <p className="text-foreground-5 text-xs mb-1.5">AI Call Summary</p>
                          <p className="text-foreground-3 text-sm leading-relaxed">{summaryEvent.event_data.callSummary}</p>
                        </div>
                      ) : null;
                    })()}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        { label: "Current Role", value: screening.latest_call.current_role },
                        { label: "Total Experience", value: screening.latest_call.total_experience },
                        { label: "Work Mode", value: screening.latest_call.work_mode },
                        { label: "Current CTC", value: screening.latest_call.current_ctc },
                        { label: "Expected CTC", value: screening.latest_call.expected_ctc },
                        { label: "Notice Period", value: screening.latest_call.notice_period },
                        { label: "Candidate Intent", value: screening.latest_call.candidate_intent },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label} className="bg-ink/[0.03] border border-faint rounded-xl px-3 py-2.5">
                          <p className="text-foreground-5 text-xs mb-0.5">{f.label}</p>
                          <p className="text-foreground-2 text-sm font-medium">{f.value}</p>
                        </div>
                      ))}
                    </div>

                    {screening.latest_call.interview_availability && (
                      <div className="mt-4 pt-4 border-t border-faint flex items-center gap-3">
                        <span className="text-lg">📅</span>
                        <div>
                          <p className="text-foreground-5 text-xs">Interview Availability</p>
                          <p className="text-foreground-2 text-sm font-medium">{screening.latest_call.interview_availability}</p>
                        </div>
                      </div>
                    )}
                    {screening.latest_call.candidate_question && (
                      <div className="mt-3 pt-3 border-t border-faint">
                        <p className="text-foreground-5 text-xs mb-1">Candidate's Question</p>
                        <p className="text-foreground-2 text-sm italic">"{screening.latest_call.candidate_question}"</p>
                      </div>
                    )}
                    {screening.latest_call.additional_notes && (
                      <div className="mt-3">
                        <p className="text-foreground-5 text-xs mb-1">Additional Notes</p>
                        <p className="text-foreground-3 text-sm">{screening.latest_call.additional_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline */}
                {screening?.timeline && screening.timeline.length > 0 && (
                  <div className="bg-surface border border-base rounded-2xl p-5">
                    <p className="text-foreground-2 text-sm font-medium mb-4">Screening Timeline</p>
                    <div className="space-y-4">
                      {screening.timeline.map((ev: any, i: number) => (
                        <div key={ev.id || i} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-ink/[0.06] border border-base flex items-center justify-center shrink-0 text-sm mt-0.5">
                            {EVENT_ICON[ev.event_type] || "•"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-foreground-2 text-sm font-medium">
                                {ev.event_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                              </span>
                              <span className="text-foreground-5 text-xs">
                                {ev.created_at ? new Date(ev.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </div>
                            {ev.event_data && Object.keys(ev.event_data).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                {Object.entries(ev.event_data).filter(([, v]) => v).map(([k, v]) => (
                                  <span key={k} className="text-foreground-4 text-xs">
                                    {k}: <span className="text-foreground-3">{String(v)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invitation history */}
                {screening?.invitations && screening.invitations.length > 0 && (
                  <div className="bg-surface border border-base rounded-2xl p-5">
                    <p className="text-foreground-2 text-sm font-medium mb-4">Invitation History</p>
                    <div className="space-y-3">
                      {screening.invitations.map((inv: any, i: number) => {
                        const isExpired = new Date(inv.expires_at) < new Date();
                        return (
                          <div key={inv.id || i} className="flex items-center gap-3 py-2 border-b border-faint last:border-0 flex-wrap">
                            <span className="text-foreground-4 text-xs w-5 text-center shrink-0">📨</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground-3 text-xs truncate">{inv.screening_url}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {inv.is_used && <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Used</span>}
                              {!inv.is_used && inv.started_at && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400">Opened</span>}
                              {!inv.is_used && !inv.started_at && isExpired && <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/10 border border-red-500/20 text-red-400">Expired</span>}
                              {!inv.is_used && !isExpired && <span className="px-1.5 py-0.5 rounded text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400">Active</span>}
                              {!inv.is_used && !isExpired && (
                                <button
                                  onClick={() => handleCopyLink(inv.screening_url)}
                                  className="text-foreground-5 hover:text-foreground-3 text-xs transition-colors"
                                >
                                  Copy
                                </button>
                              )}
                              <span className="text-foreground-5 text-xs">
                                {inv.created_at ? new Date(inv.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All call attempts */}
                {screening?.calls && screening.calls.length > 1 && (
                  <div className="bg-surface border border-base rounded-2xl p-5">
                    <p className="text-foreground-2 text-sm font-medium mb-4">All Attempts ({screening.calls.length})</p>
                    <div className="space-y-3">
                      {screening.calls.map((call: any) => {
                        const outStyle = call.call_outcome
                          ? SCREENING_STATUS_STYLE[call.call_outcome.toLowerCase()] || SCREENING_STATUS_STYLE.not_contacted
                          : SCREENING_STATUS_STYLE.not_contacted;
                        return (
                          <div key={call.id} className="flex items-center gap-3 py-2 border-b border-faint last:border-0">
                            <span className="text-foreground-4 text-xs w-6 text-center">#{call.attempt_number}</span>
                            <span className={`px-2 py-0.5 rounded border text-xs ${outStyle.color}`}>{call.call_outcome || "Pending"}</span>
                            <span className="text-foreground-4 text-xs ml-auto">
                              {call.created_at ? new Date(call.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!screening && !screeningLoading && (
                  <div className="bg-surface border border-base rounded-2xl p-10 text-center">
                    <p className="text-4xl mb-3">📨</p>
                    <p className="text-foreground-3 text-sm mb-1">No screening activity yet</p>
                    <p className="text-foreground-5 text-xs">Click "Send Screening Link" to invite the candidate to a web-based Vapi screening</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
