"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { interviewsApi } from "@/lib/api-client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SkillEval {
  skill: string;
  rating: "Strong" | "Medium" | "Weak";
  score: number;
  questions_asked: number;
  ai_notes: string;
  confidence_level?: "High" | "Medium" | "Low";
}

interface ResumeClaim {
  claim: string;
  interview_evidence: string;
  verdict: "Verified" | "Partially Verified" | "Not Verified";
}

interface TimelineItem {
  stage: string;
  summary: string;
}

interface TranscriptEntry {
  sequence: number;
  speaker: "ai" | "candidate";
  text: string;
  timestamp_seconds?: number;
}

interface InterviewReport {
  id: string;
  candidate_id: string;
  status: string;
  evaluation_status: string;
  overall_rating: string | null;
  ai_summary: string | null;
  executive_summary: string | null;
  strengths: string[];
  weak_areas: string[];
  communication_score: number | null;
  confidence_score: number | null;
  clarity_score: number | null;
  topics_covered: string[];
  topics_missing: string[];
  topics_needs_evaluation: string[];
  resume_claim_verification: ResumeClaim[];
  candidate_questions: string[];
  interview_timeline: TimelineItem[];
  skill_evaluations: SkillEval[];
  transcript: TranscriptEntry[];
  actual_duration_minutes: number | null;
  duration_minutes: number;
  difficulty: string | null;
  interview_type: string | null;
  started_at: string | null;
  ended_at: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RATING_CONFIG = {
  "Strong Hire": { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  "Hire":        { color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    dot: "bg-blue-400"    },
  "Consider":    { color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   dot: "bg-amber-400"   },
  "Reject":      { color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30",     dot: "bg-red-400"     },
};

function getRatingConfig(rating: string | null) {
  return RATING_CONFIG[rating as keyof typeof RATING_CONFIG] ?? RATING_CONFIG["Consider"];
}

function ScoreRing({ score, label, color }: { score: number | null; label: string; color: string }) {
  const val = score ?? 0;
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (val / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="#1e1e2e" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={radius} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
          {score !== null ? score : "—"}
        </span>
      </div>
      <span className="text-[#888] text-xs font-medium">{label}</span>
    </div>
  );
}

function SkillBar({ skill, score, rating, aiNotes }: { skill: string; score: number; rating: string; aiNotes: string }) {
  const color = rating === "Strong" ? "#10b981" : rating === "Medium" ? "#6c63ff" : "#f59e0b";
  const ratingColor = rating === "Strong" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : rating === "Medium" ? "text-[#6c63ff] bg-[#6c63ff]/10 border-[#6c63ff]/20"
    : "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return (
    <div className="p-4 bg-[#13131a] border border-[#1e1e2e] rounded-xl hover:border-[#2a2a3a] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-sm font-semibold">{skill}</span>
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-bold">{score}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ratingColor}`}>{rating}</span>
        </div>
      </div>
      <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      {aiNotes && <p className="text-[#666] text-xs leading-relaxed mt-1">{aiNotes}</p>}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const cfg = {
    "Verified": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    "Partially Verified": "text-amber-400 bg-amber-500/10 border-amber-500/20",
    "Not Verified": "text-red-400 bg-red-500/10 border-red-500/20",
  }[verdict] ?? "text-[#888] bg-[#1e1e2e] border-[#2a2a3a]";
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${cfg}`}>
      {verdict}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InterviewReportPage({ params }: { params: { interviewId: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [pollingCount, setPollingCount] = useState(0);

  const fetchReport = useCallback(async () => {
    try {
      const data = await interviewsApi.get(params.interviewId);
      setReport(data as InterviewReport);
      setError(null);
      return data;
    } catch (e: any) {
      setError(e?.message || "Failed to load report");
      return null;
    }
  }, [params.interviewId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/auth/login"); return; }
    fetchReport().finally(() => setLoading(false));
  }, [authLoading, user, fetchReport, router]);

  // Poll while evaluation is processing
  useEffect(() => {
    if (!report || report.evaluation_status === "complete" || report.evaluation_status === "failed") return;
    if (pollingCount > 30) return; // stop after 5 minutes
    const timer = setTimeout(() => {
      fetchReport();
      setPollingCount((n) => n + 1);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [report, pollingCount, fetchReport]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-4">{error || "Report not found"}</p>
          <button onClick={() => router.back()} className="text-[#6c63ff] text-sm underline">Go back</button>
        </div>
      </div>
    );
  }

  const ratingCfg = getRatingConfig(report.overall_rating);
  const executiveBullets = report.executive_summary
    ? report.executive_summary.split("\n").filter(Boolean)
    : [];
  const interviewDate = report.started_at
    ? new Date(report.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  const isProcessing = report.evaluation_status === "processing";
  const hasEval = report.evaluation_status === "complete";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Top nav */}
      <div className="border-b border-[#1a1a24] bg-[#0d0d14] px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => router.back()} className="text-[#555] hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="w-px h-4 bg-[#1e1e2e]" />
        <span className="text-[#555] text-sm">Interview Report</span>
        <div className="ml-auto flex items-center gap-2">
          {isProcessing && (
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
              Evaluation in progress...
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Hero header ── */}
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[#555] text-xs uppercase tracking-wider font-medium">
                  {report.interview_type || "Technical"} Interview · {report.difficulty || "Medium"}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-[#333] text-sm">{interviewDate}</div>
                {report.actual_duration_minutes && (
                  <div className="text-[#333] text-sm">{report.actual_duration_minutes} min</div>
                )}
              </div>

              {/* Recommendation badge */}
              {hasEval && report.overall_rating && (
                <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border ${ratingCfg.bg} ${ratingCfg.border}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${ratingCfg.dot}`} />
                  <span className={`font-bold text-lg ${ratingCfg.color}`}>{report.overall_rating}</span>
                </div>
              )}
              {isProcessing && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2a2a3a] bg-[#13131a]">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-400 font-medium">Evaluating...</span>
                </div>
              )}
            </div>

            {/* Communication scores */}
            {hasEval && (
              <div className="flex gap-6 shrink-0">
                <ScoreRing score={report.communication_score} label="Communication" color="#6c63ff" />
                <ScoreRing score={report.confidence_score} label="Confidence" color="#10b981" />
                <ScoreRing score={report.clarity_score} label="Clarity" color="#f59e0b" />
              </div>
            )}
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* Left column: Executive Summary + Strengths + Weaknesses */}
          <div className="md:col-span-2 space-y-5">

            {/* Executive summary */}
            {hasEval && executiveBullets.length > 0 && (
              <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#6c63ff] rounded-full" />
                  Executive Summary
                </h2>
                <ul className="space-y-2.5">
                  {executiveBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[#aaa] text-sm leading-relaxed">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] mt-1.5 shrink-0" />
                      {bullet.replace(/^[-•]\s*/, "")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary narrative */}
            {hasEval && report.ai_summary && (
              <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#6c63ff] rounded-full" />
                  Interview Summary
                </h2>
                <p className="text-[#aaa] text-sm leading-relaxed">{report.ai_summary}</p>
              </div>
            )}

            {/* Strengths & Weaknesses */}
            {hasEval && (report.strengths?.length > 0 || report.weak_areas?.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0d0d14] border border-emerald-500/15 rounded-2xl p-5">
                  <h3 className="text-emerald-400 font-semibold text-sm mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Strengths
                  </h3>
                  <ul className="space-y-2">
                    {(report.strengths || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[#aaa] text-xs leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#0d0d14] border border-red-500/15 rounded-2xl p-5">
                  <h3 className="text-red-400 font-semibold text-sm mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    Areas to Improve
                  </h3>
                  <ul className="space-y-2">
                    {(report.weak_areas || []).map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-[#aaa] text-xs leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Skill evaluations */}
            {hasEval && report.skill_evaluations?.length > 0 && (
              <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#6c63ff] rounded-full" />
                  Skill Assessment
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {report.skill_evaluations.map((se) => (
                    <SkillBar
                      key={se.skill}
                      skill={se.skill}
                      score={se.score}
                      rating={se.rating}
                      aiNotes={se.ai_notes}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Resume claim verification */}
            {hasEval && report.resume_claim_verification?.length > 0 && (
              <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#6c63ff] rounded-full" />
                  Resume Claim Verification
                </h2>
                <div className="space-y-3">
                  {report.resume_claim_verification.map((c, i) => (
                    <div key={i} className="p-4 bg-[#13131a] border border-[#1e1e2e] rounded-xl">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-white text-xs font-medium">{c.claim}</p>
                        <VerdictBadge verdict={c.verdict} />
                      </div>
                      {c.interview_evidence && (
                        <p className="text-[#666] text-xs leading-relaxed">{c.interview_evidence}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transcript toggle */}
            <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#13131a] transition-colors"
              >
                <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#333] rounded-full" />
                  Full Transcript
                  {report.transcript?.length > 0 && (
                    <span className="text-[#555] text-xs font-normal">({report.transcript.length} messages)</span>
                  )}
                </h2>
                <svg className={`w-4 h-4 text-[#555] transition-transform ${showTranscript ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showTranscript && (
                <div className="border-t border-[#1e1e2e] px-5 py-4 max-h-96 overflow-y-auto space-y-3">
                  {report.transcript?.length === 0 && (
                    <p className="text-[#444] text-sm text-center py-4">No transcript available</p>
                  )}
                  {report.transcript?.map((entry) => (
                    <div key={entry.sequence} className={`flex gap-2.5 ${entry.speaker === "candidate" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                        entry.speaker === "ai" ? "bg-[#6c63ff]/20 text-[#6c63ff]" : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {entry.speaker === "ai" ? "AI" : "C"}
                      </div>
                      <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                        entry.speaker === "ai"
                          ? "bg-[#13131a] border border-[#1e1e2e] text-[#bbb]"
                          : "bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-white"
                      }`}>
                        {entry.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: sidebar */}
          <div className="space-y-5">

            {/* Interview timeline */}
            {hasEval && report.interview_timeline?.length > 0 && (
              <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#6c63ff] rounded-full" />
                  Interview Timeline
                </h2>
                <div className="relative">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-[#1e1e2e]" />
                  <div className="space-y-4 pl-8">
                    {report.interview_timeline.map((item, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-5 top-1 w-2 h-2 rounded-full bg-[#6c63ff] border border-[#0d0d14]" />
                        <p className="text-white text-xs font-semibold mb-0.5">{item.stage}</p>
                        {item.summary && <p className="text-[#666] text-xs leading-relaxed">{item.summary}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Topics */}
            {hasEval && (
              <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-5 space-y-4">
                <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#6c63ff] rounded-full" />
                  Topics Analysis
                </h2>
                {report.topics_covered?.length > 0 && (
                  <div>
                    <p className="text-[#555] text-xs uppercase tracking-wider font-medium mb-2">Covered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {report.topics_covered.map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {report.topics_missing?.length > 0 && (
                  <div>
                    <p className="text-[#555] text-xs uppercase tracking-wider font-medium mb-2">Not Covered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {report.topics_missing.map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {report.topics_needs_evaluation?.length > 0 && (
                  <div>
                    <p className="text-[#555] text-xs uppercase tracking-wider font-medium mb-2">Needs Further Eval</p>
                    <div className="flex flex-wrap gap-1.5">
                      {report.topics_needs_evaluation.map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Candidate questions */}
            {hasEval && report.candidate_questions?.length > 0 && (
              <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#6c63ff] rounded-full" />
                  Candidate Questions
                </h2>
                <ul className="space-y-2">
                  {report.candidate_questions.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-[#888] text-xs leading-relaxed">
                      <span className="text-[#555] shrink-0">{i + 1}.</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Processing placeholder */}
            {isProcessing && (
              <div className="bg-[#0d0d14] border border-amber-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <h2 className="text-amber-400 font-semibold text-sm">Evaluation in Progress</h2>
                </div>
                <p className="text-[#666] text-xs leading-relaxed">
                  Our AI is analyzing the interview transcript. The full report will appear shortly — this page refreshes automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
