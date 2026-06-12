"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAntiCheat, ViolationType } from "@/hooks/useAntiCheat";
import { useVapiInterview } from "@/hooks/useVapiInterview";
import { interviewsApi } from "@/lib/api-client";

const VIOLATION_MESSAGES: Record<ViolationType, string> = {
  TAB_SWITCH:        "Tab switching detected. Please stay on this page.",
  FULLSCREEN_EXIT:   "Please remain in fullscreen mode during the interview.",
  MULTIPLE_SCREENS:  "Multiple screens detected. Please disconnect additional displays.",
  DEVTOOLS_OPEN:     "Browser developer tools detected. Please close them.",
  COPY_PASTE:        "Copy/paste is not allowed during the interview.",
  SCREEN_SHARE_STOP: "Screen sharing was interrupted.",
};

type InterviewPhase = "intro" | "permission" | "active" | "completed" | "terminated";

interface SessionInfo {
  sessionId: string;
  orgName: string;
  candidateName: string;
  appliedRole: string;
  durationMinutes: number;
  candidateSkills: string[];
  skillsToAssess: string[];
  interviewType: string;
  difficulty: string;
  aiPersonality: string;
}

const DEFAULT_SESSION: SessionInfo = {
  sessionId: "",
  orgName: "",
  candidateName: "",
  appliedRole: "",
  durationMinutes: 45,
  candidateSkills: [],
  skillsToAssess: [],
  interviewType: "Technical",
  difficulty: "Medium",
  aiPersonality: "Neutral",
};

function toStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => (typeof s === "string" ? s : (s as any)?.skill ?? (s as any)?.name ?? "")).filter(Boolean);
}

export default function InterviewPage({ params }: { params: { sessionId: string } }) {
  const linkToken = params.sessionId;

  const [phase, setPhase]                 = useState<InterviewPhase>("intro");
  const [session, setSession]             = useState<SessionInfo>(DEFAULT_SESSION);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeWarning, setActiveWarning]   = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const warningTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const mediaInitRef     = useRef(false);

  // Permission-phase check animations
  const [permChecks, setPermChecks] = useState({ camera: false, mic: false, speaker: false, internet: false });
  const [micLevel, setMicLevel]     = useState(30);
  const allChecksPassed = Object.values(permChecks).every(Boolean);

  useEffect(() => {
    interviewsApi
      .join(linkToken)
      .then((data: any) => {
        setSession({
          sessionId:       data?.session_id ?? "",
          orgName:         data?.org_name ?? "",
          candidateName:   data?.candidate_name ?? "Candidate",
          appliedRole:     data?.applied_role ?? "",
          durationMinutes: data?.duration_minutes ?? 45,
          candidateSkills: toStringArray(data?.candidate_skills),
          skillsToAssess:  toStringArray(data?.skills_to_assess),
          interviewType:   data?.interview_type ?? "Technical",
          difficulty:      data?.difficulty ?? "Medium",
          aiPersonality:   data?.ai_personality ?? "Neutral",
        });
      })
      .catch(() => {})
      .finally(() => setSessionLoading(false));
  }, [linkToken]);

  const showWarning = useCallback((message: string) => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setActiveWarning(message);
    warningTimerRef.current = setTimeout(() => setActiveWarning(null), 4000);
  }, []);

  const handleComplete = useCallback(() => { setPhase("completed"); }, []);

  const {
    isMediaReady, mediaError, attachVideo,
    initMedia, beginInterview,
    transcript, isListening, isCandidateThinking, isAIThinking, isAISpeaking,
  } = useVapiInterview({
    sessionId:  session.sessionId,
    linkToken,
    onComplete: handleComplete,
  });

  const { isFullscreen, isTerminated, totalViolations, requestFullscreen } = useAntiCheat({
    sessionId:     session.sessionId,
    linkToken,
    maxViolations: 5,
    onViolation:   (v) => showWarning(VIOLATION_MESSAGES[v.type]),
    onTerminate:   () => setPhase("terminated"),
  });

  // Start media preview immediately when permission phase is entered
  useEffect(() => {
    if (phase !== "permission" || mediaInitRef.current) return;
    mediaInitRef.current = true;
    initMedia();
  }, [phase, initMedia]);

  // Sequential system checks animation
  useEffect(() => {
    if (phase !== "permission") return;
    setPermChecks({ camera: false, mic: false, speaker: false, internet: false });
    const timers = [
      setTimeout(() => setPermChecks((p) => ({ ...p, camera: true })), 900),
      setTimeout(() => setPermChecks((p) => ({ ...p, mic: true })), 1600),
      setTimeout(() => setPermChecks((p) => ({ ...p, speaker: true })), 2300),
      setTimeout(() => setPermChecks((p) => ({ ...p, internet: true })), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // Mic level animation during permission phase
  useEffect(() => {
    if (phase !== "permission") return;
    const id = setInterval(() => setMicLevel(Math.floor(Math.random() * 60) + 10), 150);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (isTerminated) setPhase("terminated");
  }, [isTerminated]);

  const handleStart = useCallback(async () => {
    if (!mediaInitRef.current) await initMedia();
    await requestFullscreen();
    setPhase("active");
    beginInterview();
  }, [initMedia, requestFullscreen, beginInterview]);

  const handleReenterFullscreen = useCallback(async () => {
    await requestFullscreen();
    setActiveWarning(null);
  }, [requestFullscreen]);

  // ─── Intro ────────────────────────────────────────────────────────
  if (phase === "intro") {
    const matchedSkills = session.skillsToAssess.filter((s) =>
      session.candidateSkills.some((cs) => cs.toLowerCase() === s.toLowerCase())
    );

    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="w-full max-w-xl">

          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-lg bg-[#6c63ff] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
              </svg>
            </div>
            <span className="text-white font-semibold tracking-tight">VoxHire</span>
          </div>

          {sessionLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                {session.orgName ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-[#6c63ff]/15 border border-[#6c63ff]/25 flex items-center justify-center mx-auto mb-4">
                      <span className="text-[#6c63ff] text-xl font-bold">
                        {session.orgName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[#888] text-sm mb-1">You've been invited by</p>
                    <h1 className="text-white text-2xl font-bold">{session.orgName}</h1>
                  </>
                ) : (
                  <h1 className="text-white text-2xl font-bold">Interview Invitation</h1>
                )}

                {session.appliedRole && (
                  <div className="inline-flex items-center gap-2 mt-3 bg-[#13131a] border border-[#1e1e2e] rounded-full px-4 py-1.5">
                    <svg className="w-3.5 h-3.5 text-[#6c63ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-white text-sm font-medium">{session.appliedRole}</span>
                  </div>
                )}

                <div className="flex items-center justify-center gap-4 mt-4">
                  <div className="flex items-center gap-1.5 text-[#666] text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {session.durationMinutes} minutes
                  </div>
                  <div className="flex items-center gap-1.5 text-[#666] text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    {session.interviewType} interview
                  </div>
                  <div className="flex items-center gap-1.5 text-[#666] text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {session.difficulty}
                  </div>
                </div>
              </div>

              {(session.candidateSkills.length > 0 || session.skillsToAssess.length > 0) && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-4">
                    <p className="text-[#555] text-xs font-medium uppercase tracking-wider mb-3">Your skills</p>
                    {session.candidateSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {session.candidateSkills.slice(0, 8).map((skill) => {
                          const matched = session.skillsToAssess.some(
                            (s) => s.toLowerCase() === skill.toLowerCase()
                          );
                          return (
                            <span key={skill} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              matched
                                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                                : "bg-[#1e1e2e] border-[#2a2a3a] text-[#888]"
                            }`}>
                              {matched && "✓ "}{skill}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[#444] text-xs">Not provided</p>
                    )}
                  </div>

                  <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-4">
                    <p className="text-[#555] text-xs font-medium uppercase tracking-wider mb-3">Being assessed</p>
                    {session.skillsToAssess.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {session.skillsToAssess.slice(0, 8).map((skill) => {
                          const hasIt = session.candidateSkills.some(
                            (s) => s.toLowerCase() === skill.toLowerCase()
                          );
                          return (
                            <span key={skill} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              hasIt
                                ? "bg-[#6c63ff]/10 border-[#6c63ff]/25 text-[#6c63ff]"
                                : "bg-[#1e1e2e] border-[#2a2a3a] text-[#888]"
                            }`}>
                              {skill}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[#444] text-xs">Not specified</p>
                    )}
                  </div>
                </div>
              )}

              {matchedSkills.length > 0 && (
                <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3 mb-6">
                  <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-emerald-400 text-xs">
                    You match <span className="font-semibold">{matchedSkills.length} of {session.skillsToAssess.length}</span> required skills — {matchedSkills.join(", ")}
                  </p>
                </div>
              )}

              <button
                onClick={() => setPhase("permission")}
                className="w-full py-3.5 bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Continue to pre-checks →
              </button>
              <p className="text-center text-[#444] text-xs mt-4">
                Make sure you're in a quiet, well-lit space before continuing.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Permission / System Pre-check ───────────────────────────────
  if (phase === "permission") {
    const CHECKS = [
      { key: "camera",   icon: "videocam",  label: "Camera",     sub: "Face detected & clear" },
      { key: "mic",      icon: "mic",       label: "Microphone", sub: "Audio signal detected" },
      { key: "speaker",  icon: "volume_up", label: "Speaker",    sub: "System output ready" },
      { key: "internet", icon: "wifi",      label: "Internet",   sub: "Stable connection" },
    ] as const;

    return (
      <div className="min-h-screen bg-surface-dim dark:bg-[#14121a] text-on-surface flex flex-col items-center justify-center p-6 font-sans">

        {/* Header */}
        <header className="fixed top-0 z-40 flex justify-between items-center px-6 py-3 w-full bg-white/80 dark:bg-[#1a1823]/80 backdrop-blur-md border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6c63ff] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <span className="font-bold text-on-surface">VoxHire</span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant text-sm font-medium">
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>help</span>
            <span className="hidden md:inline">Support</span>
          </div>
        </header>

        {/* Content */}
        <main className="relative z-10 w-full max-w-4xl pt-20 pb-10 flex flex-col items-center">

          <div className="w-full text-center mb-8">
            <h1 className="text-3xl font-bold text-on-surface mb-2">Ready for your interview?</h1>
            <p className="text-on-surface-variant max-w-md mx-auto text-sm">
              Let's ensure your hardware is configured correctly so you can focus on performing your best.
            </p>
          </div>

          {/* 2-col card */}
          <div className="w-full grid md:grid-cols-2 gap-6 bg-white dark:bg-[#1e1c26] p-6 rounded-xl border border-outline-variant shadow-sm overflow-hidden">

            {/* Left: Camera Preview */}
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-outline-variant shadow-inner">
                <video
                  ref={attachVideo}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* LIVE label overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
                  <div className="flex items-center justify-between text-white text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      LIVE PREVIEW
                    </div>
                    <span className="opacity-70">1080p · 30fps</span>
                  </div>
                </div>

                {/* Loading overlay while camera starts */}
                {!isMediaReady && (
                  <div className="absolute inset-0 bg-[#13131a]/90 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-[#6c63ff]/20 border-t-[#6c63ff] rounded-full animate-spin" />
                      <span className="text-xs text-[#666]">Connecting camera…</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mic meter */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-32 bg-surface-container-high dark:bg-[#2a2836] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#6c63ff] rounded-full transition-all duration-75"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium">Mic Sensitivity</span>
                </div>
                <button className="flex items-center gap-1 text-xs text-[#6c63ff] hover:underline transition-all">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>settings</span>
                  Device settings
                </button>
              </div>

              {mediaError && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {mediaError}
                </div>
              )}
            </div>

            {/* Right: System Checks */}
            <div className="flex flex-col justify-between py-1">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-on-surface border-b border-outline-variant pb-3 mb-4">System Checks</h3>

                {CHECKS.map(({ key, icon, label, sub }) => {
                  const passed = permChecks[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-4 bg-surface-container-low dark:bg-[#252330] rounded-lg border transition-all duration-200 ${
                        passed ? "border-primary/20" : "border-transparent hover:border-primary/10"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#6c63ff]/10 flex items-center justify-center text-[#6c63ff]">
                          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>{icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-on-surface">{label}</p>
                          <p className="text-xs text-on-surface-variant">{sub}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {passed ? (
                          <span
                            className="material-symbols-outlined text-emerald-500 transition-all duration-300"
                            style={{ fontVariationSettings: "'FILL' 1", fontSize: "22px" }}
                          >
                            check_circle
                          </span>
                        ) : (
                          <span
                            className="material-symbols-outlined text-amber-400 animate-pulse"
                            style={{ fontSize: "22px" }}
                          >
                            pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                <button
                  onClick={handleStart}
                  disabled={!allChecksPassed}
                  className={`w-full py-4 px-6 bg-[#6c63ff] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md ${
                    allChecksPassed
                      ? "hover:bg-[#5a52e0] opacity-100"
                      : "opacity-30 cursor-not-allowed"
                  }`}
                >
                  <span>Start Interview</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_forward</span>
                </button>
                <p className="text-[11px] text-center text-on-surface-variant mt-2">
                  By clicking 'Start', you agree to our{" "}
                  <a className="underline" href="#">Privacy Policy</a>{" "}
                  regarding video recording.
                </p>
              </div>
            </div>
          </div>

          {/* Tips footer */}
          <div className="mt-8 w-full max-w-2xl grid grid-cols-3 gap-4">
            {[
              { icon: "lightbulb", label: "Good Lighting" },
              { icon: "headset",   label: "Use Headphones" },
              { icon: "timer",     label: `${session.durationMinutes} Min. Session` },
            ].map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center p-2">
                <span className="material-symbols-outlined text-[#6c63ff] mb-1" style={{ fontSize: "24px" }}>{icon}</span>
                <p className="text-xs font-medium text-on-surface-variant">{label}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ─── Completed ────────────────────────────────────────────────────
  if (phase === "completed") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Interview Complete</h1>
          <p className="text-[#888] text-sm mb-8">
            Thank you{session.candidateName ? `, ${session.candidateName}` : ""}! Your interview has been submitted successfully.
            The recruiter will review your responses and get back to you.
          </p>
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl px-5 py-4 text-left space-y-3">
            {session.orgName && (
              <div className="flex items-center justify-between">
                <span className="text-[#555] text-xs">Company</span>
                <span className="text-[#aaa] text-sm font-medium">{session.orgName}</span>
              </div>
            )}
            {session.appliedRole && (
              <div className="flex items-center justify-between">
                <span className="text-[#555] text-xs">Role</span>
                <span className="text-[#aaa] text-sm font-medium">{session.appliedRole}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[#555] text-xs">Status</span>
              <span className="text-emerald-400 text-sm font-medium">Submitted</span>
            </div>
          </div>
          <p className="text-[#333] text-xs mt-6">You may close this window.</p>
        </div>
      </div>
    );
  }

  // ─── Terminated ───────────────────────────────────────────────────
  if (phase === "terminated") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Interview Terminated</h1>
          <p className="text-[#888] text-sm mb-6">
            Your session was terminated due to multiple policy violations. The recruiter has been notified.
          </p>
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl px-5 py-4 text-left">
            <p className="text-[#666] text-xs font-medium uppercase tracking-wider mb-2">Violations Recorded</p>
            <p className="text-red-400 text-sm">{totalViolations} violation{totalViolations !== 1 ? "s" : ""} detected</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Interview ─────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden select-none">

      {activeWarning && (
        <div className="absolute top-0 left-0 right-0 z-50 animate-slide-down">
          <div className="mx-auto max-w-2xl mt-4 px-5 py-3 bg-amber-500/90 backdrop-blur rounded-xl flex items-center justify-between gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <p className="text-black font-medium text-sm">{activeWarning}</p>
            </div>
            {!isFullscreen && (
              <button onClick={handleReenterFullscreen}
                className="shrink-0 bg-black/20 hover:bg-black/30 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                Return to Fullscreen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a24] bg-[#0d0d14]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-[#6c63ff] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <span className="text-[#888] text-sm font-medium">
            {session.orgName ? `${session.orgName} — VoxHire Interview` : "VoxHire Interview"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-medium">Recording</span>
          </div>
        </div>

        <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border ${
          totalViolations === 0 ? "text-[#555] border-[#1e1e2e]"
          : totalViolations <= 2 ? "text-amber-400 border-amber-500/20 bg-amber-500/5"
          : "text-red-400 border-red-500/20 bg-red-500/5"
        }`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {totalViolations}/5 violations
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Camera */}
        <div className="w-80 shrink-0 border-r border-[#1a1a24] flex flex-col bg-[#0d0d14]">
          <div className="p-4 flex-1 flex flex-col">
            <div className="relative rounded-xl overflow-hidden bg-[#13131a] border border-[#1e1e2e] aspect-video mb-4">
              <video ref={attachVideo} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />

              {isAIThinking && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#6c63ff]/80 backdrop-blur rounded-full px-2.5 py-1">
                  <div className="flex gap-0.5 items-end h-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-0.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-white text-xs font-medium">AI thinking</span>
                </div>
              )}
              {isAISpeaking && !isAIThinking && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#6c63ff]/80 backdrop-blur rounded-full px-2.5 py-1">
                  <div className="flex gap-0.5 items-end h-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-0.5 bg-white rounded-full animate-pulse" style={{ height: `${8 + i * 3}px`, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-white text-xs font-medium">AI speaking</span>
                </div>
              )}
              {isCandidateThinking && !isAIThinking && !isAISpeaking && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-amber-500/70 backdrop-blur rounded-full px-2.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-medium">Taking a moment…</span>
                </div>
              )}
              {isListening && !isCandidateThinking && !isAIThinking && !isAISpeaking && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-green-500/70 backdrop-blur rounded-full px-2.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-medium">Listening</span>
                </div>
              )}

              {!isMediaReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-[#666] text-xs">Starting camera...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[#888] text-xs">{session.candidateName || "Candidate"}</span>
            </div>

            <div className="mt-auto space-y-2">
              {session.appliedRole && (
                <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-3 py-2.5">
                  <p className="text-[#555] text-xs mb-1">Role</p>
                  <p className="text-[#888] text-xs truncate">{session.appliedRole}</p>
                </div>
              )}
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-3 py-2.5">
                <p className="text-[#555] text-xs mb-1">Interview type</p>
                <p className="text-[#888] text-xs">{session.interviewType} · {session.difficulty}</p>
              </div>
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-3 py-2.5">
                <p className="text-[#555] text-xs mb-1">Status</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-green-400 text-xs font-medium">In progress</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Transcript */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-[#1a1a24] flex items-center justify-between">
            <h2 className="text-[#888] text-sm font-medium">Live Transcript</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] animate-pulse" />
              <span className="text-[#555] text-xs">Live</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {transcript.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-[#13131a] border border-[#1e1e2e] flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-[#444] text-sm">AI interviewer is preparing...</p>
                </div>
              </div>
            )}

            {transcript.map((entry) => (
              <div key={entry.id} className={`flex gap-3 ${entry.speaker === "candidate" ? "flex-row-reverse" : ""}`}>
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${
                  entry.speaker === "ai"
                    ? "bg-[#6c63ff]/20 text-[#6c63ff] border border-[#6c63ff]/20"
                    : "bg-[#1e2a1e] text-green-400 border border-green-500/20"
                }`}>
                  {entry.speaker === "ai" ? "AI" : "You"}
                </div>
                <div className={`max-w-[75%] flex flex-col gap-1 ${entry.speaker === "candidate" ? "items-end" : "items-start"}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    entry.speaker === "ai"
                      ? "bg-[#13131a] border border-[#1e1e2e] text-[#ccc] rounded-tl-sm"
                      : "bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-white rounded-tr-sm"
                  }`}>
                    {entry.text}
                  </div>
                  <span className="text-[#333] text-xs px-1">
                    {entry.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>

          {/* Status Bar */}
          <div className="px-6 py-3 border-t border-[#1a1a24] bg-[#0d0d14] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isAIThinking && (
                <>
                  <div className="flex gap-0.5 items-end h-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-0.5 bg-[#6c63ff] rounded-full animate-pulse"
                        style={{ height: `${5 + i * 2}px`, animationDelay: `${i * 0.12}s` }} />
                    ))}
                  </div>
                  <span className="text-[#6c63ff] text-xs font-medium">AI is thinking...</span>
                </>
              )}
              {isAISpeaking && !isAIThinking && (
                <>
                  <div className="flex gap-0.5 items-end h-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-0.5 bg-[#6c63ff] rounded-full animate-pulse"
                        style={{ height: `${6 + i * 2}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                  <span className="text-[#6c63ff] text-xs font-medium">AI speaking...</span>
                </>
              )}
              {isCandidateThinking && !isAIThinking && !isAISpeaking && (
                <>
                  <div className="flex gap-0.5 items-end h-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-0.5 bg-amber-400 rounded-full animate-pulse"
                        style={{ height: `${4 + i * 2}px`, animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                  <span className="text-amber-400 text-xs font-medium">Take your time...</span>
                </>
              )}
              {isListening && !isCandidateThinking && !isAIThinking && !isAISpeaking && (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Listening — speak now</span>
                </>
              )}
              {!isListening && !isAIThinking && !isAISpeaking && (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />
                  <span className="text-[#444] text-xs">Waiting...</span>
                </>
              )}
            </div>
            <p className="text-[#333] text-xs">
              {transcript.filter((t) => t.speaker === "ai").length} AI responses
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down { animation: slide-down 0.25s ease-out forwards; }
        * { user-select: none; }
      `}</style>
    </div>
  );
}
