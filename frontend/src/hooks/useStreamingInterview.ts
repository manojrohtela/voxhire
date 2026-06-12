"use client";

/**
 * Real-time streaming interview client.
 *
 * Replaces the batch pipeline (MediaRecorder → Whisper → full LLM → full TTS)
 * with a single WebSocket to the backend voice pipeline:
 *
 *   mic → AudioWorklet (16 kHz PCM16) → WS → [Deepgram + Silero VAD + Groq + Cartesia]
 *   WS → 24 kHz PCM16 chunks → Web Audio scheduled playback
 *
 * Interruption: the server detects speech during agent audio and sends
 * "clear_audio" — we stop every scheduled buffer within one frame, so the
 * agent goes silent instantly, exactly like Vapi.
 *
 * Return surface matches useVoiceRuntime so the interview page is a drop-in swap.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useInterviewMedia, type TranscriptEntry } from "./useInterviewMedia";

export type TurnPhase = "IDLE" | "LISTENING" | "THINKING_PAUSE" | "PROCESSING" | "SPEAKING";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const OUTPUT_SAMPLE_RATE = 24_000;

interface StreamingInterviewOptions {
  sessionId: string;
  linkToken: string;
  candidateName?: string;
  appliedRole?: string;
  skillsToAssess?: string[];
  difficulty?: string;
  aiPersonality?: string;
  interviewType?: string;
  onComplete?: () => void;
}

export function useStreamingInterview({
  linkToken,
  onComplete,
}: StreamingInterviewOptions) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>("IDLE");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Playback scheduling
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const agentEndedTurnRef = useRef<number | null>(null);
  const currentTurnRef = useRef(0);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const { isMediaReady, mediaError, cameraStream, initMedia, attachVideo } = useInterviewMedia();
  const cameraStreamRef = useRef<MediaStream | null>(null);
  cameraStreamRef.current = cameraStream;

  const upsertEntry = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx === -1) return [...prev, entry];
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
  }, []);

  // ── Playback: schedule PCM16@24k chunks back-to-back ──────────────────────
  const playChunk = useCallback((data: ArrayBuffer) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const int16 = new Int16Array(data);
    if (int16.length === 0) return;

    const buffer = ctx.createBuffer(1, int16.length, OUTPUT_SAMPLE_RATE);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) ch[i] = int16[i] / 32768;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.03, nextPlayTimeRef.current);
    src.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(src);
    src.onended = () => {
      activeSourcesRef.current.delete(src);
      maybeReportDrained();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tell the server when the last scheduled chunk has actually finished playing —
  // it holds the SPEAKING state until then so endpointing stays accurate.
  const maybeReportDrained = useCallback(() => {
    const turn = agentEndedTurnRef.current;
    if (turn === null || activeSourcesRef.current.size > 0) return;
    agentEndedTurnRef.current = null;
    wsRef.current?.send(JSON.stringify({ type: "playback_finished", turn_id: turn }));
  }, []);

  // INTERRUPTION: flush every scheduled buffer immediately
  const clearAudio = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try { src.onended = null; src.stop(); } catch {}
    });
    activeSourcesRef.current.clear();
    nextPlayTimeRef.current = 0;
    agentEndedTurnRef.current = null;
    if (drainTimerRef.current) { clearTimeout(drainTimerRef.current); drainTimerRef.current = null; }
  }, []);

  // ── Server messages ────────────────────────────────────────────────────────
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      playChunk(event.data);
      return;
    }
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data as string); } catch { return; }

    switch (msg.type) {
      case "state": {
        const map: Record<string, TurnPhase> = {
          listening: "LISTENING",
          thinking: "PROCESSING",
          speaking: "SPEAKING",
        };
        setTurnPhase(map[msg.state as string] ?? "IDLE");
        break;
      }
      case "transcript": {
        upsertEntry({
          id: `user-${msg.turn}`,
          speaker: "candidate",
          text: msg.text as string,
          timestamp: new Date(),
          isFinal: Boolean(msg.final),
        });
        break;
      }
      case "agent_start":
        currentTurnRef.current = msg.turn_id as number;
        break;
      case "agent_text": {
        const id = `ai-${msg.turn_id}`;
        setTranscript((prev) => {
          const idx = prev.findIndex((e) => e.id === id);
          if (idx === -1) {
            return [...prev, { id, speaker: "ai" as const, text: msg.text as string, timestamp: new Date(), isFinal: false }];
          }
          const next = [...prev];
          next[idx] = { ...next[idx], text: `${next[idx].text} ${msg.text}` };
          return next;
        });
        break;
      }
      case "agent_end": {
        const id = `ai-${msg.turn_id}`;
        setTranscript((prev) => prev.map((e) => (e.id === id ? { ...e, isFinal: true } : e)));
        agentEndedTurnRef.current = msg.turn_id as number;
        // Fallback drain check in case onended doesn't fire (e.g. zero sources)
        const ctx = audioCtxRef.current;
        const waitMs = ctx ? Math.max(0, (nextPlayTimeRef.current - ctx.currentTime) * 1000) + 150 : 150;
        drainTimerRef.current = setTimeout(maybeReportDrained, waitMs);
        break;
      }
      case "clear_audio":
        clearAudio();
        break;
      case "interview_complete":
        completedRef.current = true;
        wsRef.current?.close();
        onCompleteRef.current?.();
        break;
      case "error":
        setVoiceError(msg.message as string);
        break;
    }
  }, [playChunk, upsertEntry, clearAudio, maybeReportDrained]);

  // ── Start: open WS + wire mic worklet ──────────────────────────────────────
  const beginInterview = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setVoiceError(null);

    const stream = cameraStreamRef.current;
    if (!stream) {
      setVoiceError("Microphone is not ready yet.");
      startedRef.current = false;
      return;
    }

    try {
      // Single AudioContext for capture + playback; created inside the click
      // handler so autoplay policy allows it.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      await ctx.resume();
      await ctx.audioWorklet.addModule("/pcm-worklet.js");

      const wsUrl = `${API_URL.replace(/^http/, "ws")}/api/v1/ws/interview/${linkToken}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onmessage = handleMessage;
      ws.onerror = () => setVoiceError("Voice connection error. Please refresh.");
      ws.onclose = () => {
        if (!completedRef.current && startedRef.current) {
          setTurnPhase("IDLE");
        }
      };

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        const t = setTimeout(() => reject(new Error("Voice server connection timed out")), 8000);
        ws.addEventListener("open", () => clearTimeout(t), { once: true });
      });

      // Mic → worklet → (muted) destination. Worklet posts 512-sample PCM16
      // frames which we forward as binary WS messages.
      const micSource = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      const worklet = new AudioWorkletNode(ctx, "pcm-capture");
      const mute = ctx.createGain();
      mute.gain.value = 0;
      micSource.connect(worklet);
      worklet.connect(mute);
      mute.connect(ctx.destination);
      micSourceRef.current = micSource;
      workletRef.current = worklet;

      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };

      setTurnPhase("PROCESSING");
      ws.send(JSON.stringify({ type: "start" }));
    } catch (err) {
      startedRef.current = false;
      setVoiceError(err instanceof Error ? err.message : "Failed to start the interview.");
    }
  }, [linkToken, handleMessage]);

  const finishInterview = useCallback(async () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && !completedRef.current) {
      // Server runs a closing turn, marks the session completed, then sends
      // interview_complete — which triggers onComplete.
      ws.send(JSON.stringify({ type: "end_interview" }));
    } else if (!completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
  }, []);

  // ── Teardown ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearAudio();
      workletRef.current?.disconnect();
      micSourceRef.current?.disconnect();
      wsRef.current?.close();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [clearAudio]);

  return {
    isMediaReady,
    mediaError: voiceError ?? mediaError,
    attachVideo,
    initMedia,
    transcript,
    turnPhase,
    isListening: turnPhase === "LISTENING" || turnPhase === "THINKING_PAUSE",
    isCandidateThinking: turnPhase === "THINKING_PAUSE",
    isAIThinking: turnPhase === "PROCESSING",
    isAISpeaking: turnPhase === "SPEAKING",
    beginInterview,
    finishInterview,
  };
}
