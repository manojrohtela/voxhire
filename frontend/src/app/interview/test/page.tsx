"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useStreamingInterview } from "@/hooks/useStreamingInterview";

interface TestConfig {
  candidateName: string;
  appliedRole: string;
  skills: string;
  difficulty: string;
  aiPersonality: string;
  interviewType: string;
}

const DEFAULTS: TestConfig = {
  candidateName: "Test Candidate",
  appliedRole:   "Senior Software Engineer",
  skills:        "React, Node.js, System Design, PostgreSQL",
  difficulty:    "Medium",
  aiPersonality: "Neutral",
  interviewType: "Technical",
};

const SELECT_FIELDS: Array<{ key: keyof TestConfig; label: string; opts: string[] }> = [
  { key: "interviewType", label: "Type",       opts: ["Technical", "HR", "Leadership", "Sales"] },
  { key: "difficulty",    label: "Difficulty", opts: ["Easy", "Medium", "Hard"] },
  { key: "aiPersonality", label: "AI Style",   opts: ["Friendly", "Neutral", "Strict"] },
];

// ─── Config screen ────────────────────────────────────────────────────────────

function ConfigScreen({ onStart }: { onStart: (c: TestConfig) => void }) {
  const [cfg, setCfg] = useState<TestConfig>(DEFAULTS);
  const onChange = (key: keyof TestConfig) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setCfg((p) => ({ ...p, [key]: e.target.value }));

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded">
            Dev Mode
          </span>
        </div>
        <h1 className="text-white text-2xl font-bold mb-1">Interview Test Harness</h1>
        <p className="text-[#555] text-sm mb-8">
          Launch an interview without an invite link. Backend calls fire-and-forget.
        </p>

        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {(["candidateName", "appliedRole"] as const).map((k) => (
              <div key={k}>
                <label className="text-[#555] text-xs font-medium block mb-1.5">
                  {k === "candidateName" ? "Candidate Name" : "Applied Role"}
                </label>
                <input
                  value={cfg[k]}
                  onChange={onChange(k)}
                  className="w-full bg-[#0d0d14] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#6c63ff]"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-[#555] text-xs font-medium block mb-1.5">
              Skills to Assess <span className="text-[#333]">(comma-separated)</span>
            </label>
            <input
              value={cfg.skills}
              onChange={onChange("skills")}
              className="w-full bg-[#0d0d14] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#6c63ff]"
              placeholder="React, TypeScript, SQL"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {SELECT_FIELDS.map(({ key, label, opts }) => (
              <div key={key}>
                <label className="text-[#555] text-xs font-medium block mb-1.5">{label}</label>
                <select
                  value={cfg[key]}
                  onChange={onChange(key)}
                  className="w-full bg-[#0d0d14] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#6c63ff]"
                >
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg px-4 py-3 font-mono text-[#555] text-xs leading-5">
            {cfg.candidateName} / {cfg.appliedRole}<br />
            Skills: {cfg.skills || "none"}<br />
            {cfg.interviewType} · {cfg.difficulty} · {cfg.aiPersonality}
          </div>

          <button
            onClick={() => onStart(cfg)}
            disabled={!cfg.candidateName || !cfg.appliedRole}
            className="w-full py-3.5 bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Launch Test Interview
          </button>
        </div>

        <p className="text-center text-[#1e1e2e] text-xs mt-4">/interview/test — dev only</p>
      </div>
    </div>
  );
}

// ─── Interview screen ─────────────────────────────────────────────────────────

function InterviewScreen({ cfg, onReset }: { cfg: TestConfig; onReset: () => void }) {
  const skillsToAssess = cfg.skills.split(",").map((s) => s.trim()).filter(Boolean);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [done, setDone]       = useState(false);

  const {
    isMediaReady, mediaError,
    attachVideo, initMedia,
    transcript, isListening, isAIThinking, isAISpeaking,
    beginInterview,
  } = useStreamingInterview({
    sessionId:     "test-session",
    linkToken:     "test",
    candidateName:  cfg.candidateName,
    appliedRole:    cfg.appliedRole,
    skillsToAssess,
    difficulty:     cfg.difficulty,
    aiPersonality:  cfg.aiPersonality,
    interviewType:  cfg.interviewType,
    onComplete:     useCallback(() => setDone(true), []),
  });

  useEffect(() => { initMedia(); }, [initMedia]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const handleStart = useCallback(() => {
    setStarted(true);
    beginInterview();
  }, [beginInterview]);

  if (done) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Test Complete</h1>
          <p className="text-[#555] text-sm mb-6">
            {transcript.filter((t) => t.speaker === "ai").length} AI turns &nbsp;&middot;&nbsp;
            {transcript.filter((t) => t.speaker === "candidate").length} candidate turns
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onReset}
              className="px-5 py-2.5 bg-[#13131a] border border-[#2a2a3a] text-[#888] hover:text-white rounded-xl text-sm transition-colors"
            >
              New Config
            </button>
            <button
              onClick={() => { setDone(false); setStarted(false); }}
              className="px-5 py-2.5 bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-xl text-sm transition-colors"
            >
              Run Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#1a1a24] bg-[#0d0d14] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded">
            Test
          </span>
          <span className="text-[#444] text-sm">
            {cfg.candidateName} &nbsp;&middot;&nbsp; {cfg.appliedRole} &nbsp;&middot;&nbsp; {cfg.interviewType} &nbsp;&middot;&nbsp; {cfg.difficulty} &nbsp;&middot;&nbsp; {cfg.aiPersonality}
          </span>
        </div>
        <button onClick={onReset} className="text-[#333] hover:text-[#888] text-xs transition-colors">
          Reset
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <div className="w-72 shrink-0 border-r border-[#1a1a24] flex flex-col bg-[#0d0d14] p-4 gap-4 overflow-y-auto">

          {/* Camera */}
          <div className="relative rounded-xl overflow-hidden bg-[#13131a] border border-[#1e1e2e] aspect-video">
            <video ref={attachVideo} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            {(isAIThinking || isAISpeaking) && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-[#6c63ff]/80 backdrop-blur rounded-full px-2 py-0.5">
                <div className="flex gap-0.5 items-end h-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-0.5 bg-white rounded-full animate-pulse"
                      style={{ height: `${6 + i * 2}px`, animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
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

          {mediaError && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
              {mediaError}
            </div>
          )}

          {/* Skills */}
          {skillsToAssess.length > 0 && (
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-3">
              <p className="text-[#333] text-xs uppercase tracking-wider mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {skillsToAssess.map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-[#6c63ff]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Session details */}
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-3 text-xs space-y-1.5">
            {[["Type", cfg.interviewType], ["Difficulty", cfg.difficulty], ["AI Style", cfg.aiPersonality]].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-[#333]">{k}</span>
                <span className="text-[#666]">{v}</span>
              </div>
            ))}
          </div>

          {/* Start button */}
          {!started && (
            <button
              onClick={handleStart}
              disabled={!isMediaReady}
              className="mt-auto w-full py-3 bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {isMediaReady ? "Start Interview" : "Starting camera..."}
            </button>
          )}
        </div>

        {/* Transcript */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-2.5 border-b border-[#1a1a24] flex items-center justify-between shrink-0">
            <h2 className="text-[#444] text-sm font-medium">Live Transcript</h2>
            <span className="text-[#2a2a3a] text-xs">
              {transcript.filter((t) => t.speaker === "ai").length} AI &nbsp;/&nbsp; {transcript.filter((t) => t.speaker === "candidate").length} candidate
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {transcript.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-[#2a2a3a] text-sm">
                  {started ? "AI is preparing the opening question..." : "Click Start Interview to begin."}
                </p>
              </div>
            )}

            {transcript.map((entry) => (
              <div key={entry.id} className={`flex gap-3 ${entry.speaker === "candidate" ? "flex-row-reverse" : ""}`}>
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${
                  entry.speaker === "ai"
                    ? "bg-[#6c63ff]/20 text-[#6c63ff] border border-[#6c63ff]/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>
                  {entry.speaker === "ai" ? "AI" : "You"}
                </div>
                <div className={`max-w-[75%] flex flex-col gap-1 ${entry.speaker === "candidate" ? "items-end" : "items-start"}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    entry.speaker === "ai"
                      ? "bg-[#13131a] border border-[#1e1e2e] text-[#bbb] rounded-tl-sm"
                      : "bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-white rounded-tr-sm"
                  }`}>
                    {entry.text}
                  </div>
                  <span className="text-[#2a2a3a] text-xs px-1">
                    {entry.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>

          {/* Status bar */}
          <div className="px-5 py-2.5 border-t border-[#1a1a24] bg-[#0d0d14] flex items-center gap-2 shrink-0">
            {isAIThinking && (
              <>
                <div className="flex gap-0.5 items-end h-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-0.5 bg-[#6c63ff] rounded-full animate-pulse"
                      style={{ height: `${5 + i * 2}px`, animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
                <span className="text-[#6c63ff] text-xs">AI thinking...</span>
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
                <span className="text-[#6c63ff] text-xs">AI speaking...</span>
              </>
            )}
            {isListening && !isAIThinking && !isAISpeaking && (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-xs">Listening — speak now</span>
              </>
            )}
            {!started && !isListening && !isAIThinking && !isAISpeaking && (
              <span className="text-[#2a2a3a] text-xs">Waiting to start...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function InterviewTestPage() {
  const [config, setConfig] = useState<TestConfig | null>(null);
  if (!config) return <ConfigScreen onStart={setConfig} />;
  return <InterviewScreen cfg={config} onReset={() => setConfig(null)} />;
}
