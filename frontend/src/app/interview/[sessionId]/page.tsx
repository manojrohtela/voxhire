"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAntiCheat, ViolationType } from "@/hooks/useAntiCheat";
import { useInterviewMedia } from "@/hooks/useInterviewMedia";

// ─── Violation messages ────────────────────────────────────────
const VIOLATION_MESSAGES: Record<ViolationType, string> = {
  TAB_SWITCH: "Tab switching detected. Please stay on this page.",
  FULLSCREEN_EXIT: "Please remain in fullscreen mode during the interview.",
  MULTIPLE_SCREENS: "Multiple screens detected. Please disconnect additional displays.",
  DEVTOOLS_OPEN: "Browser developer tools detected. Please close them.",
  COPY_PASTE: "Copy/paste is not allowed during the interview.",
  SCREEN_SHARE_STOP: "Screen sharing was interrupted.",
};

type InterviewPhase = "permission" | "ready" | "active" | "terminated" | "completed";

export default function InterviewPage({ params }: { params: { sessionId: string } }) {
  const [phase, setPhase] = useState<InterviewPhase>("permission");
  const [activeWarning, setActiveWarning] = useState<string | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showWarning = useCallback((message: string) => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setActiveWarning(message);
    setWarningCount((c) => c + 1);
    warningTimerRef.current = setTimeout(() => setActiveWarning(null), 4000);
  }, []);

  const { isMediaReady, mediaError, transcript, isSpeaking, initMedia, attachVideo, startTranscription } =
    useInterviewMedia();

  const { isFullscreen, isTerminated, totalViolations, requestFullscreen } = useAntiCheat({
    sessionId: params.sessionId,
    maxViolations: 5,
    onViolation: (v) => showWarning(VIOLATION_MESSAGES[v.type]),
    onTerminate: () => setPhase("terminated"),
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Start interview
  const handleStart = useCallback(async () => {
    await initMedia();
    await requestFullscreen();
    setPhase("active");
    startTranscription();
  }, [initMedia, requestFullscreen, startTranscription]);

  // Re-enter fullscreen on violation
  const handleReenterFullscreen = useCallback(async () => {
    await requestFullscreen();
    setActiveWarning(null);
  }, [requestFullscreen]);

  useEffect(() => {
    if (isTerminated) setPhase("terminated");
  }, [isTerminated]);

  // ─── Permission / Ready Screen ─────────────────────────────────
  if (phase === "permission" || phase === "ready") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#6c63ff] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
              </div>
              <span className="text-white font-semibold text-lg tracking-tight">VoxHire</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Before you begin</h1>
            <p className="text-[#888] text-sm">Make sure you're in a quiet, well-lit environment.</p>
          </div>

          {/* Requirements */}
          <div className="space-y-3 mb-8">
            {[
              { icon: "🎥", label: "Camera access required", sub: "We need to record your video" },
              { icon: "🎙️", label: "Microphone access required", sub: "For voice conversation with AI" },
              { icon: "🖥️", label: "Fullscreen mode will activate", sub: "Stay in fullscreen throughout" },
              { icon: "📵", label: "Tab switching not allowed", sub: "Violations are recorded" },
              { icon: "🖱️", label: "Single screen only", sub: "Disconnect additional monitors" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-4 bg-[#13131a] border border-[#1e1e2e] rounded-xl px-4 py-3">
                <span className="text-xl mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-white text-sm font-medium">{item.label}</p>
                  <p className="text-[#666] text-xs mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {mediaError && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {mediaError}
            </div>
          )}

          <button
            onClick={handleStart}
            className="w-full py-4 bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold rounded-xl transition-all duration-200 text-base tracking-wide"
          >
            I'm ready — Start Interview
          </button>

          <p className="text-center text-[#444] text-xs mt-4">
            Session ID: {params.sessionId}
          </p>
        </div>
      </div>
    );
  }

  // ─── Terminated Screen ─────────────────────────────────────────
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
            Your interview session has been terminated due to multiple policy violations. 
            The recruiter has been notified.
          </p>
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl px-5 py-4 text-left">
            <p className="text-[#666] text-xs font-medium uppercase tracking-wider mb-3">Violations Recorded</p>
            <p className="text-red-400 text-sm">{totalViolations} violation{totalViolations !== 1 ? "s" : ""} detected</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Interview ──────────────────────────────────────────
  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden select-none">

      {/* Violation Warning Banner */}
      {activeWarning && (
        <div className="absolute top-0 left-0 right-0 z-50 animate-slide-down">
          <div className="mx-auto max-w-2xl mt-4 px-5 py-3 bg-amber-500/90 backdrop-blur rounded-xl flex items-center justify-between gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <p className="text-black font-medium text-sm">{activeWarning}</p>
            </div>
            {!isFullscreen && (
              <button
                onClick={handleReenterFullscreen}
                className="shrink-0 bg-black/20 hover:bg-black/30 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
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
          <span className="text-[#888] text-sm font-medium">VoxHire Interview</span>
        </div>

        {/* Recording indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-medium">Recording</span>
          </div>
        </div>

        {/* Violation counter */}
        <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border ${
          totalViolations === 0
            ? "text-[#555] border-[#1e1e2e]"
            : totalViolations <= 2
            ? "text-amber-400 border-amber-500/20 bg-amber-500/5"
            : "text-red-400 border-red-500/20 bg-red-500/5"
        }`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {totalViolations}/5 violations
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Camera Feed */}
        <div className="w-80 shrink-0 border-r border-[#1a1a24] flex flex-col bg-[#0d0d14]">
          <div className="p-4 flex-1 flex flex-col">
            {/* Camera */}
            <div className="relative rounded-xl overflow-hidden bg-[#13131a] border border-[#1e1e2e] aspect-video mb-4">
              <video
                ref={attachVideo}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {/* Speaking indicator */}
              {isSpeaking && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#6c63ff]/80 backdrop-blur rounded-full px-2.5 py-1">
                  <div className="flex gap-0.5 items-end h-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-0.5 bg-white rounded-full animate-pulse"
                        style={{
                          height: `${8 + i * 3}px`,
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-white text-xs font-medium">Speaking</span>
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

            {/* Candidate label */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[#888] text-xs">You (Candidate)</span>
            </div>

            {/* Session info */}
            <div className="mt-auto space-y-2">
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-3 py-2.5">
                <p className="text-[#555] text-xs mb-1">Session</p>
                <p className="text-[#888] text-xs font-mono truncate">{params.sessionId}</p>
              </div>
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-3 py-2.5">
                <p className="text-[#555] text-xs mb-1">Status</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-green-400 text-xs font-medium">Interview in progress</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Transcript */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Transcript header */}
          <div className="px-6 py-3 border-b border-[#1a1a24] flex items-center justify-between">
            <h2 className="text-[#888] text-sm font-medium">Live Transcript</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] animate-pulse" />
              <span className="text-[#555] text-xs">Live</span>
            </div>
          </div>

          {/* Transcript scroll area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {transcript.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-[#13131a] border border-[#1e1e2e] flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-[#444] text-sm">Transcript will appear here</p>
                  <p className="text-[#333] text-xs mt-1">Waiting for the interview to begin...</p>
                </div>
              </div>
            )}

            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`flex gap-3 ${entry.speaker === "candidate" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${
                  entry.speaker === "ai"
                    ? "bg-[#6c63ff]/20 text-[#6c63ff] border border-[#6c63ff]/20"
                    : "bg-[#1e2a1e] text-green-400 border border-green-500/20"
                }`}>
                  {entry.speaker === "ai" ? "AI" : "You"}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] ${entry.speaker === "candidate" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    entry.speaker === "ai"
                      ? "bg-[#13131a] border border-[#1e1e2e] text-[#ccc] rounded-tl-sm"
                      : `border rounded-tr-sm ${
                          entry.isFinal
                            ? "bg-[#6c63ff]/10 border-[#6c63ff]/20 text-white"
                            : "bg-[#1a1a24] border-[#2a2a3a] text-[#888] italic"
                        }`
                  }`}>
                    {entry.text}
                    {!entry.isFinal && (
                      <span className="inline-flex gap-0.5 ml-2">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="w-1 h-1 rounded-full bg-[#555] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                    )}
                  </div>
                  <span className="text-[#333] text-xs px-1">
                    {entry.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>

          {/* Bottom status bar */}
          <div className="px-6 py-3 border-t border-[#1a1a24] bg-[#0d0d14] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isSpeaking ? (
                <>
                  <div className="flex gap-0.5 items-end h-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-0.5 bg-[#6c63ff] rounded-full animate-pulse"
                        style={{ height: `${6 + i * 2}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                  <span className="text-[#6c63ff] text-xs font-medium">Listening...</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />
                  <span className="text-[#444] text-xs">Waiting for speech</span>
                </>
              )}
            </div>
            <p className="text-[#333] text-xs">{transcript.filter((t) => t.isFinal).length} exchanges</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down { animation: slide-down 0.25s ease-out forwards; }
        * { user-select: none; }
      `}</style>
    </div>
  );
}
