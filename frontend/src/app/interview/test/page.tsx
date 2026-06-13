"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useVapiInterview } from "@/hooks/useVapiInterview";

/**
 * Dev test harness — exercises the REAL Vapi interview flow (same hook as the
 * production interview page) against a backend "test" config, with no invite
 * link or DB session required. Use it to verify the Vapi assistant connects.
 */
export default function InterviewTestPage() {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  const {
    isMediaReady, mediaError, attachVideo, initMedia, beginInterview, endInterview,
    transcript, isListening, isAIThinking, isAISpeaking, vapiError,
  } = useVapiInterview({
    sessionId: "test",
    linkToken: "test",
    onComplete: useCallback(() => setDone(true), []),
  });

  useEffect(() => { initMedia(); }, [initMedia]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript]);

  const handleStart = useCallback(() => {
    setStarted(true);
    beginInterview();
  }, [beginInterview]);

  if (done) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Test Complete</h1>
          <p className="text-[#555] text-sm mb-6">
            {transcript.filter((t) => t.speaker === "ai").length} AI turns · {transcript.filter((t) => t.speaker === "candidate").length} candidate turns
          </p>
          <button onClick={() => { setDone(false); setStarted(false); }}
            className="px-5 py-2.5 bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-xl text-sm transition-colors">
            Run Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#1a1a24] bg-[#0d0d14] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded">Vapi Test</span>
          <span className="text-[#444] text-sm">Test Candidate · Senior Python Engineer · Technical</span>
        </div>
        {started && (
          <button onClick={() => { endInterview(); setStarted(false); }} className="text-[#333] hover:text-[#888] text-xs transition-colors">End</button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-72 shrink-0 border-r border-[#1a1a24] flex flex-col bg-[#0d0d14] p-4 gap-4 overflow-y-auto">
          <div className="relative rounded-xl overflow-hidden bg-[#13131a] border border-[#1e1e2e] aspect-video">
            <video ref={attachVideo} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            {(isAIThinking || isAISpeaking) && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-[#6c63ff]/80 backdrop-blur rounded-full px-2 py-0.5">
                <span className="text-white text-xs">{isAIThinking ? "Thinking" : "Speaking"}</span>
              </div>
            )}
            {isListening && !isAIThinking && !isAISpeaking && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-green-500/70 backdrop-blur rounded-full px-2 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs">Listening</span>
              </div>
            )}
            {!isMediaReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14]/80">
                <div className="w-6 h-6 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {mediaError && <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">{mediaError}</div>}

          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-3">
            <p className="text-[#333] text-xs uppercase tracking-wider mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {["Python", "FastAPI", "System Design", "PostgreSQL"].map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-[#6c63ff]">{s}</span>
              ))}
            </div>
          </div>

          {!started && (
            <button onClick={handleStart} disabled={!isMediaReady}
              className="mt-auto w-full py-3 bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">
              {isMediaReady ? "Start Vapi Test" : "Starting camera…"}
            </button>
          )}
        </div>

        {/* Transcript */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-2.5 border-b border-[#1a1a24] shrink-0">
            <h2 className="text-[#444] text-sm font-medium">Live Transcript</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {transcript.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-sm">
                  {vapiError ? (
                    <>
                      <p className="text-red-400 text-sm font-medium mb-1">Couldn&apos;t connect the AI interviewer</p>
                      <p className="text-[#666] text-xs">{vapiError}</p>
                    </>
                  ) : (
                    <p className="text-[#2a2a3a] text-sm">{started ? "Connecting the AI interviewer…" : "Click Start Vapi Test to begin."}</p>
                  )}
                </div>
              </div>
            )}
            {transcript.map((entry) => (
              <div key={entry.id} className={`flex gap-3 ${entry.speaker === "candidate" ? "flex-row-reverse" : ""}`}>
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${
                  entry.speaker === "ai" ? "bg-[#6c63ff]/20 text-[#6c63ff] border border-[#6c63ff]/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>{entry.speaker === "ai" ? "AI" : "You"}</div>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  entry.speaker === "ai" ? "bg-[#13131a] border border-[#1e1e2e] text-[#bbb] rounded-tl-sm" : "bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-white rounded-tr-sm"
                }`}>{entry.text}</div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
