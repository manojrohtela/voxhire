"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Vapi from "@vapi-ai/web";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type Phase = "loading" | "intro" | "active" | "completed" | "expired" | "invalid";

interface InviteInfo {
  is_expired: boolean;
  already_completed: boolean;
  candidate_name: string;
  org_name: string;
  org_logo_url: string | null;
  job_title: string | null;
  expires_at: string;
}

interface VapiConfig {
  vapi_public_key: string;
  vapi_assistant_id: string;
  screening_call_id: string;
  metadata: Record<string, string>;
}

interface TranscriptLine {
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
}

async function fetchInviteInfo(token: string): Promise<InviteInfo> {
  const res = await fetch(`${API_URL}/api/v1/screening/invite/${token}`);
  if (!res.ok) throw new Error("not_found");
  return res.json();
}

async function startScreening(token: string): Promise<VapiConfig> {
  const res = await fetch(`${API_URL}/api/v1/screening/invite/${token}/start`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "failed");
  }
  return res.json();
}

export default function ScreeningPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<"pending" | "sent" | "failed" | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const vapiRef = useRef<Vapi | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCountRef = useRef(0);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const scheduleSilencePrompt = useCallback(() => {
    clearSilenceTimer();
    if (silenceCountRef.current >= 3) return;
    silenceTimerRef.current = setTimeout(() => {
      silenceCountRef.current += 1;
      vapiRef.current?.send({
        type: "add-message",
        message: {
          role: "system",
          content: "The candidate has been silent for 10 seconds. Re-ask your last question briefly, or say something like 'Are you still there? Take your time.' to keep the conversation going.",
        },
      } as any);
    }, 10000);
  }, [clearSilenceTimer]);

  const addDebug = (msg: string) => {
    console.log("[VoxHire]", msg);
    setDebugLog(prev => [...prev.slice(-9), msg]);
  };

  // Load invitation info
  useEffect(() => {
    fetchInviteInfo(token)
      .then((data) => {
        setInfo(data);
        if (data.is_expired) {
          setPhase("expired");
        } else if (data.already_completed) {
          setPhase("completed");
        } else {
          setPhase("intro");
        }
      })
      .catch(() => setPhase("invalid"));
  }, [token]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const handleStart = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const config = await startScreening(token);

      if (!config.vapi_public_key || !config.vapi_assistant_id) {
        setStartError("Vapi is not configured on the server. Contact support.");
        setStarting(false);
        return;
      }

      addDebug(`Starting Vapi: assistant=${config.vapi_assistant_id.slice(0,8)}… key=${config.vapi_public_key.slice(0,8)}…`);

      // Pre-acquire mic with explicit audio processing constraints so Vapi/Daily
      // uses these settings instead of getUserMedia({ audio: true }) defaults.
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const audioTrack = micStream.getAudioTracks()[0];
      micTrackRef.current = audioTrack;

      const vapi = new Vapi(
        config.vapi_public_key,
        undefined,
        undefined,
        { audioSource: audioTrack },
      );
      vapiRef.current = vapi;

      // Wire Vapi events
      vapi.on("call-start", () => {
        addDebug("call-start fired ✅");
        setPhase("active");
        setStarting(false);
      });

      vapi.on("call-end", () => {
        addDebug("call-end fired");
        clearSilenceTimer();
        micTrackRef.current?.stop();
        micTrackRef.current = null;
        setPhase("completed");
      });

      vapi.on("speech-start", () => {
        setIsAISpeaking(true);
        clearSilenceTimer();
      });
      vapi.on("speech-end", () => {
        setIsAISpeaking(false);
        // Start 10s silence timer — re-prompt if candidate doesn't respond
        silenceCountRef.current = 0;
        scheduleSilencePrompt();
      });

      vapi.on("message", (msg: any) => {
        addDebug(`message: type=${msg.type}`);
        // Forward end-of-call-report using the invite token (no Vapi secret needed).
        // The server-side Vapi webhook may also fire; sc.screening_completed deduplicates.
        if (msg.type === "end-of-call-report") {
          addDebug(`end-of-call-report received — forwarding to backend…`);
          setWebhookStatus("pending");
          fetch(`${API_URL}/api/v1/screening/invite/${token}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg }),
          }).then(r => {
            addDebug(`webhook response: ${r.status}`);
            setWebhookStatus(r.ok ? "sent" : "failed");
          }).catch(err => {
            addDebug(`webhook error: ${err}`);
            setWebhookStatus("failed");
          });
          return;
        }

        if (msg.type === "transcript") {
          const role: "user" | "assistant" = msg.role === "user" ? "user" : "assistant";
          const isFinal = msg.transcriptType === "final";

          // Candidate spoke — cancel silence re-prompt timer
          if (role === "user") clearSilenceTimer();

          setTranscript((prev) => {
            const lastIdx = prev.length - 1;
            // Replace the pending (partial/italic) entry when it's the same role
            if (lastIdx >= 0 && prev[lastIdx].role === role && !prev[lastIdx].isFinal) {
              const updated = [...prev];
              updated[lastIdx] = { role, text: msg.transcript, isFinal };
              return updated;
            }
            return [...prev, { role, text: msg.transcript, isFinal }];
          });

          if (role === "user") {
            setIsUserSpeaking(!isFinal);
          }
        }
      });

      vapi.on("error", (err: any) => {
        addDebug(`error event: ${JSON.stringify(err)}`);
        micTrackRef.current?.stop();
        micTrackRef.current = null;
        setStartError("Connection error. Please check your microphone and try again.");
        setStarting(false);
        setPhase("intro");
      });

      addDebug("Calling vapi.start()…");
      // Start the Vapi call — returns a Call object with the Vapi call ID
      const vapiCall = await vapi.start(config.vapi_assistant_id, {
        metadata: config.metadata,
        silenceTimeoutSeconds: 90,
        transcriber: {
          provider: "deepgram",
          model: "nova-3-general",
          language: "en",
        },
      } as any);
      addDebug(`vapi.start() resolved id=${(vapiCall as any)?.id ?? "?"}`);

      // Register the Vapi call ID so the server-side webhook can find this ScreeningCall
      const vapiCallId = (vapiCall as any)?.id;
      if (vapiCallId) {
        fetch(`${API_URL}/api/v1/screening/invite/${token}/call-started`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vapi_call_id: vapiCallId }),
        }).catch(() => {});
      }

    } catch (e: any) {
      micTrackRef.current?.stop();
      micTrackRef.current = null;
      setStartError(e.message === "failed" ? "This link has already been used or has expired." : "Failed to start screening. Please try again.");
      setStarting(false);
    }
  }, [token, clearSilenceTimer, scheduleSilencePrompt]);

  const handleEnd = useCallback(() => {
    vapiRef.current?.stop();
  }, []);

  // ── Loading ──────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Invalid ──────────────────────────────────────────────────
  if (phase === "invalid") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Invalid Link</h1>
          <p className="text-[#666] text-sm">This screening link is invalid or does not exist. Please contact your recruiter.</p>
        </div>
      </div>
    );
  }

  // ── Expired ──────────────────────────────────────────────────
  if (phase === "expired") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Link Expired</h1>
          <p className="text-[#666] text-sm">This screening link has expired. Please ask your recruiter to send a new invitation.</p>
          {info?.org_name && <p className="text-[#444] text-xs mt-3">{info.org_name}</p>}
        </div>
      </div>
    );
  }

  // ── Completed ────────────────────────────────────────────────
  if (phase === "completed") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Screening Complete</h1>
          <p className="text-[#888] text-sm mb-8">
            Thank you{info?.candidate_name ? `, ${info.candidate_name}` : ""}! Your responses have been submitted.
            The recruiter will review them and get back to you shortly.
          </p>
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl px-5 py-4 text-left space-y-3">
            {info?.org_name && (
              <div className="flex items-center justify-between">
                <span className="text-[#555] text-xs">Company</span>
                <span className="text-[#aaa] text-sm font-medium">{info.org_name}</span>
              </div>
            )}
            {info?.job_title && (
              <div className="flex items-center justify-between">
                <span className="text-[#555] text-xs">Role</span>
                <span className="text-[#aaa] text-sm font-medium">{info.job_title}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[#555] text-xs">Status</span>
              <span className="text-emerald-400 text-sm font-medium">Submitted</span>
            </div>
          </div>
          {/* Webhook status */}
          {webhookStatus && (
            <div className={`mt-4 px-4 py-3 rounded-xl text-xs border ${
              webhookStatus === "sent" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
              webhookStatus === "failed" ? "bg-red-500/10 border-red-500/20 text-red-400" :
              "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}>
              {webhookStatus === "sent" ? "✅ Results saved to recruiter dashboard" :
               webhookStatus === "failed" ? "❌ Failed to save results — check backend" :
               "⏳ Saving results…"}
            </div>
          )}

          {/* Debug log */}
          {debugLog.length > 0 && (
            <div className="mt-4 bg-[#0d0d14] border border-[#1a1a24] rounded-xl p-3 text-left">
              <p className="text-[#444] text-xs font-mono mb-2">Debug log</p>
              {debugLog.map((line, i) => (
                <p key={i} className="text-[#555] text-xs font-mono">{line}</p>
              ))}
            </div>
          )}

          <p className="text-[#333] text-xs mt-6">You may close this window.</p>
        </div>
      </div>
    );
  }

  // ── Active call ──────────────────────────────────────────────
  if (phase === "active") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a24] bg-[#0d0d14] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-[#6c63ff] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            </div>
            <span className="text-[#888] text-sm font-medium">
              {info?.org_name ? `${info.org_name} — VoxHire Screening` : "VoxHire Screening"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-xs font-medium">Live</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Status panel */}
          <div className="w-64 shrink-0 border-r border-[#1a1a24] flex flex-col bg-[#0d0d14] p-4">
            {/* AI speaking indicator */}
            <div className="flex flex-col items-center justify-center flex-1 gap-5">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                isAISpeaking
                  ? "bg-[#6c63ff]/20 border-2 border-[#6c63ff]/60 shadow-lg shadow-[#6c63ff]/20"
                  : "bg-[#13131a] border border-[#1e1e2e]"
              }`}>
                <svg className={`w-10 h-10 transition-colors ${isAISpeaking ? "text-[#6c63ff]" : "text-[#333]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>

              <div className="text-center">
                <p className="text-[#888] text-sm font-medium">
                  {isAISpeaking ? "AI is speaking…" : isUserSpeaking ? "Listening…" : "AI Screener"}
                </p>
                <p className="text-[#444] text-xs mt-1">VoxHire Assistant</p>
              </div>

              {/* Speaking indicators */}
              {isAISpeaking && (
                <div className="flex gap-1 items-end h-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-1 bg-[#6c63ff] rounded-full animate-pulse"
                      style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
              )}
              {isUserSpeaking && !isAISpeaking && (
                <div className="flex gap-1 items-end h-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-1 bg-green-400 rounded-full animate-pulse"
                      style={{ height: `${6 + i * 3}px`, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>

            {/* Candidate info */}
            <div className="space-y-2">
              {info?.candidate_name && (
                <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-3 py-2.5">
                  <p className="text-[#555] text-xs mb-0.5">Candidate</p>
                  <p className="text-[#888] text-xs truncate">{info.candidate_name}</p>
                </div>
              )}
              {info?.job_title && (
                <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-3 py-2.5">
                  <p className="text-[#555] text-xs mb-0.5">Role</p>
                  <p className="text-[#888] text-xs truncate">{info.job_title}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleEnd}
              className="mt-4 w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
            >
              End Screening
            </button>

            {debugLog.length > 0 && (
              <div className="mt-3 p-2 bg-[#0a0a0f] border border-[#1a1a24] rounded-lg">
                {debugLog.slice(-4).map((line, i) => (
                  <p key={i} className="text-[#444] text-[10px] font-mono truncate">{line}</p>
                ))}
              </div>
            )}
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
                    <p className="text-[#444] text-sm">AI screener is connecting…</p>
                  </div>
                </div>
              )}

              {transcript.map((entry, i) => (
                <div key={i} className={`flex gap-3 ${entry.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${
                    entry.role === "assistant"
                      ? "bg-[#6c63ff]/20 text-[#6c63ff] border border-[#6c63ff]/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}>
                    {entry.role === "assistant" ? "AI" : "You"}
                  </div>
                  <div className={`max-w-[75%] flex flex-col gap-1 ${entry.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      entry.role === "assistant"
                        ? "bg-[#13131a] border border-[#1e1e2e] text-[#ccc] rounded-tl-sm"
                        : "bg-[#6c63ff]/10 border border-[#6c63ff]/20 text-white rounded-tr-sm"
                    } ${!entry.isFinal ? "opacity-60 italic" : ""}`}>
                      {entry.text}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>

            <div className="px-6 py-3 border-t border-[#1a1a24] bg-[#0d0d14]">
              <p className="text-[#444] text-xs text-center">
                {isAISpeaking ? "AI is speaking — listen carefully" : isUserSpeaking ? "Speaking — we're listening" : "Speak naturally when the AI pauses"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Intro ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* VoxHire logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-7 h-7 rounded-lg bg-[#6c63ff] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <span className="text-white font-semibold tracking-tight">VoxHire</span>
        </div>

        {/* Org + candidate header */}
        <div className="text-center mb-8">
          {info?.org_logo_url ? (
            <img src={info.org_logo_url} alt={info.org_name} className="w-14 h-14 rounded-2xl mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#6c63ff]/15 border border-[#6c63ff]/25 flex items-center justify-center mx-auto mb-4">
              <span className="text-[#6c63ff] text-xl font-bold">{info?.org_name?.charAt(0).toUpperCase() ?? "V"}</span>
            </div>
          )}
          <p className="text-[#888] text-sm mb-1">You've been invited by</p>
          <h1 className="text-white text-2xl font-bold">{info?.org_name ?? "VoxHire"}</h1>
          {info?.candidate_name && (
            <p className="text-[#666] text-sm mt-1">Hi, <span className="text-white">{info.candidate_name}</span></p>
          )}
          {info?.job_title && (
            <div className="inline-flex items-center gap-2 mt-3 bg-[#13131a] border border-[#1e1e2e] rounded-full px-4 py-1.5">
              <svg className="w-3.5 h-3.5 text-[#6c63ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-white text-sm font-medium">{info.job_title}</span>
            </div>
          )}
        </div>

        {/* What to expect */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5 mb-6 space-y-3">
          <p className="text-[#555] text-xs font-medium uppercase tracking-wider">What to expect</p>
          {[
            { icon: "🎙️", text: "A short AI-powered voice conversation (5–10 min)" },
            { icon: "💬", text: "Questions about your experience, availability, and expectations" },
            { icon: "🔒", text: "Your responses are securely stored and reviewed by the recruiter" },
          ].map((item) => (
            <div key={item.icon} className="flex items-start gap-3">
              <span className="text-base shrink-0">{item.icon}</span>
              <p className="text-[#888] text-sm leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>

        {startError && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {startError}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full py-4 bg-[#6c63ff] hover:bg-[#5a52e0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          {starting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Start Screening
            </>
          )}
        </button>

        <p className="text-center text-[#444] text-xs mt-4">
          Make sure you're in a quiet place with a working microphone.
        </p>
      </div>
    </div>
  );
}
