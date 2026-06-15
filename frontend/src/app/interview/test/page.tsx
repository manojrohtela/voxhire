"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useVapiInterview } from "@/hooks/useVapiInterview";

/**
 * Dev / shareable test harness — exercises the REAL Vapi interview flow (same
 * hook as the production interview page) against a backend "test" config, with
 * no invite link or DB session required. A setup form lets anyone run a mock
 * interview tailored to their own name, role, tech stack and level.
 */

const LEVELS = ["Easy", "Medium", "Hard"] as const;
const TYPES = ["Technical", "Behavioral", "HR", "Leadership"] as const;

export default function InterviewTestPage() {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  // Setup form state
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [skills, setSkills] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof LEVELS)[number]>("Medium");
  const [interviewType, setInterviewType] = useState<(typeof TYPES)[number]>("Technical");

  const configParams = useMemo(() => {
    const p: Record<string, string> = {
      difficulty,
      interview_type: interviewType,
    };
    if (name.trim()) p.name = name.trim();
    if (jobTitle.trim()) p.job_title = jobTitle.trim();
    if (skills.trim()) p.skills = skills.trim();
    return p;
  }, [name, jobTitle, skills, difficulty, interviewType]);

  const {
    isMediaReady, mediaError, attachVideo, initMedia, beginInterview, endInterview,
    transcript, isListening, isAIThinking, isAISpeaking, vapiError,
  } = useVapiInterview({
    sessionId: "test",
    linkToken: "test",
    configParams,
    onComplete: useCallback(() => setDone(true), []),
  });

  useEffect(() => { initMedia(); }, [initMedia]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript]);

  const handleStart = useCallback(() => {
    setStarted(true);
    beginInterview();
  }, [beginInterview]);

  const skillTags = skills.split(",").map((s) => s.trim()).filter(Boolean);
  const headerLabel = `${name.trim() || "Test Candidate"} · ${jobTitle.trim() || "Senior Python Engineer"} · ${interviewType}`;

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

  // ── Setup screen (before the interview starts) ──
  if (!started) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-[#0d0d14] border border-[#1a1a24] rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded">Live Demo</span>
          </div>
          <h1 className="text-white text-xl font-bold mt-3 mb-1">Try an AI interview</h1>
          <p className="text-[#666] text-sm mb-6">Set it up however you like — the AI will interview you in your own stack. Nothing is saved.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-[#888] text-xs font-medium mb-1.5">Your name</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex"
                className="w-full px-3 py-2.5 bg-[#13131a] border border-[#1e1e2e] rounded-xl text-white text-sm placeholder-[#3a3a4a] focus:border-[#6c63ff] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[#888] text-xs font-medium mb-1.5">Role you&apos;re interviewing for</label>
              <input
                value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer"
                className="w-full px-3 py-2.5 bg-[#13131a] border border-[#1e1e2e] rounded-xl text-white text-sm placeholder-[#3a3a4a] focus:border-[#6c63ff] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[#888] text-xs font-medium mb-1.5">Tech stack / skills <span className="text-[#444]">(comma-separated)</span></label>
              <input
                value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. React, TypeScript, Node.js, AWS"
                className="w-full px-3 py-2.5 bg-[#13131a] border border-[#1e1e2e] rounded-xl text-white text-sm placeholder-[#3a3a4a] focus:border-[#6c63ff] focus:outline-none transition-colors"
              />
              {skillTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {skillTags.map((s) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-[#6c63ff]">{s}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#888] text-xs font-medium mb-1.5">Difficulty</label>
                <div className="flex gap-1.5">
                  {LEVELS.map((l) => (
                    <button key={l} onClick={() => setDifficulty(l)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        difficulty === l ? "bg-[#6c63ff] border-[#6c63ff] text-white" : "bg-[#13131a] border-[#1e1e2e] text-[#888] hover:border-[#2a2a3a]"
                      }`}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[#888] text-xs font-medium mb-1.5">Type</label>
                <select value={interviewType} onChange={(e) => setInterviewType(e.target.value as typeof interviewType)}
                  className="w-full px-3 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-white text-xs focus:border-[#6c63ff] focus:outline-none transition-colors">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Camera preview */}
            <div className="relative rounded-xl overflow-hidden bg-[#13131a] border border-[#1e1e2e] aspect-video">
              <video ref={attachVideo} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              {!isMediaReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14]/80">
                  <div className="w-6 h-6 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {mediaError && <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">{mediaError}</div>}

            <button onClick={handleStart} disabled={!isMediaReady}
              className="w-full py-3 bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">
              {isMediaReady ? "Start interview" : "Starting camera…"}
            </button>
            <p className="text-center text-[#444] text-xs">The AI will greet you and speak first.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Live interview screen ──
  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#1a1a24] bg-[#0d0d14] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded">Live Demo</span>
          <span className="text-[#444] text-sm">{headerLabel}</span>
        </div>
        <button onClick={() => { endInterview(); setStarted(false); }} className="text-[#333] hover:text-[#888] text-xs transition-colors">End</button>
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

          {skillTags.length > 0 && (
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-3">
              <p className="text-[#333] text-xs uppercase tracking-wider mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {skillTags.map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-[#6c63ff]">{s}</span>
                ))}
              </div>
            </div>
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
                    <p className="text-[#2a2a3a] text-sm">Connecting the AI interviewer…</p>
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
