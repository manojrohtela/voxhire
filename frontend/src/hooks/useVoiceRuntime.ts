"use client";

import { useRef, useState, useCallback } from "react";
import { useInterviewMedia, type TranscriptEntry } from "./useInterviewMedia";
import { createInterviewMemory, type InterviewMemory } from "@/lib/voice/memory";
import { detectIntent, detectEmotionalTone, updateEngagement, assessMomentum } from "@/lib/voice/intent";
import { advanceStage } from "@/lib/voice/stateMachine";
import { interviewsApi } from "@/lib/api-client";
import type { StageContext } from "@/lib/voice/types";

const SILENCE_THRESHOLD   = 12;
const SILENCE_ONSET_DELAY = 400;
const SILENCE_DURATION_MS = 900;

function getSupportedMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

async function collectSSEText(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const d = line.slice(6).trim();
      if (d === "[DONE]") return full.trim();
      try {
        const delta = JSON.parse(d)?.choices?.[0]?.delta?.content;
        if (typeof delta === "string") full += delta;
      } catch {}
    }
  }
  return full.trim();
}

async function playAudioBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return new Promise<void>((resolve) => {
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    audio.play().catch(() => resolve());
  });
}

interface VoiceRuntimeOptions {
  /** Real session UUID returned from join endpoint */
  sessionId: string;
  /** URL link_token — used as auth token for candidate-side endpoints */
  linkToken: string;
  candidateName?: string;
  appliedRole?: string;
  skillsToAssess?: string[];
  onComplete?: () => void;
}

export function useVoiceRuntime({
  sessionId,
  linkToken,
  candidateName = "",
  appliedRole = "",
  skillsToAssess = [],
  onComplete,
}: VoiceRuntimeOptions) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isListening, setIsListening]   = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [voiceError, setVoiceError]     = useState<string | null>(null);

  const memoryRef         = useRef<InterviewMemory>(createInterviewMemory(candidateName, appliedRole));
  const messagesRef       = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const busyRef           = useRef(false);
  const inCallRef         = useRef(false);
  const recorderRef       = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<BlobPart[]>([]);
  const silenceCleanupRef = useRef<(() => void) | null>(null);
  const startListenRef    = useRef<() => void>(() => {});
  const completedRef      = useRef(false);

  const { isMediaReady, mediaError, cameraStream, initMedia, attachVideo } = useInterviewMedia();

  const addEntry = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [...prev.filter((e) => e.id !== entry.id), entry]);
  }, []);

  const buildStageContext = (): StageContext => {
    const m = memoryRef.current;
    return {
      stage: m.stage,
      emotionalTone: m.emotionalTone,
      intent: m.intent,
      engagementLevel: m.engagementLevel,
      momentum: m.momentum,
      consecutiveSameTone: m.consecutiveSameTone,
      candidateName,
      appliedRole,
      currentSkill: m.currentSkill,
      skillsToAssess,
    };
  };

  const callAI = useCallback(async (messages: typeof messagesRef.current): Promise<string> => {
    const chatRes = await fetch("/api/voice/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        candidateName,
        appliedRole,
        skillsToAssess,
        stageContext: buildStageContext(),
      }),
    });
    if (!chatRes.ok || !chatRes.body) throw new Error("Chat API failed");
    const text = await collectSSEText(chatRes.body);
    if (!text) throw new Error("Empty AI response");
    return text;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateName, appliedRole, skillsToAssess]);

  const speakText = useCallback(async (text: string) => {
    setIsAISpeaking(true);
    try {
      const ttsRes = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (ttsRes.ok) {
        await playAudioBlob(await ttsRes.blob());
      }
    } finally {
      setIsAISpeaking(false);
    }
  }, []);

  const finishInterview = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    inCallRef.current = false;

    recorderRef.current?.stop();
    silenceCleanupRef.current?.();

    interviewsApi.updateStatusByToken(linkToken, "completed").catch(() => {});
    onComplete?.();
  }, [linkToken, onComplete]);

  const runTurn = useCallback(
    async (audioBlob: Blob) => {
      if (busyRef.current || audioBlob.size < 1000) {
        if (inCallRef.current) startListenRef.current();
        return;
      }
      busyRef.current = true;
      setVoiceError(null);
      setIsAIThinking(true);

      try {
        // STT
        const fd = new FormData();
        fd.append("audio", audioBlob, "audio.webm");
        const sttRes = await fetch("/api/voice/stt", { method: "POST", body: fd });
        const userText: string = ((await sttRes.json()).text ?? "").trim();

        if (!userText) {
          setIsAIThinking(false);
          busyRef.current = false;
          if (inCallRef.current) startListenRef.current();
          return;
        }

        addEntry({ id: `c-${Date.now()}`, speaker: "candidate", text: userText, timestamp: new Date(), isFinal: true });

        // Update memory
        const prev = memoryRef.current;
        const wordCount = userText.split(/\s+/).filter(Boolean).length;
        const intent      = detectIntent(userText);
        const tone        = detectEmotionalTone(userText);
        const engagement  = updateEngagement(prev, userText);
        const momentum    = assessMomentum(prev, wordCount);
        const consecutive = tone === prev.emotionalTone ? prev.consecutiveSameTone + 1 : 1;

        const updated: InterviewMemory = {
          ...prev,
          turnCount: prev.turnCount + 1,
          intent, emotionalTone: tone,
          consecutiveSameTone: consecutive,
          engagementLevel: engagement,
          momentum,
          lastResponseWordCount: wordCount,
        };
        updated.stage = advanceStage(updated);
        memoryRef.current = updated;

        // Check if wrap_up stage is complete — natural interview end
        const isWrapUpDone = updated.stage === "wrap_up" && updated.turnCount > 0 &&
          messagesRef.current.filter((m) => m.role === "assistant").length >= 2 &&
          updated.turnCount >= (updated as any).stageStartTurn + 2;

        // Chat
        messagesRef.current = [...messagesRef.current, { role: "user", content: userText }];
        const aiText = await callAI(messagesRef.current);
        messagesRef.current = [...messagesRef.current, { role: "assistant", content: aiText }];
        setIsAIThinking(false);

        await speakText(aiText);

        addEntry({ id: `ai-${Date.now()}`, speaker: "ai", text: aiText, timestamp: new Date(), isFinal: true });

        // Persist transcript (fire-and-forget) — uses real sessionId + linkToken for auth
        interviewsApi
          .appendTranscript(
            sessionId,
            [
              { speaker: "candidate", text: userText, timestamp_seconds: (Date.now() / 1000) },
              { speaker: "ai",        text: aiText,   timestamp_seconds: (Date.now() / 1000) },
            ],
            linkToken,
          )
          .catch(() => {});

        // Natural completion after wrap_up
        if (isWrapUpDone) {
          await finishInterview();
          return;
        }

      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : "Voice error");
        setIsAIThinking(false);
      } finally {
        busyRef.current = false;
        if (inCallRef.current) startListenRef.current();
      }
    },
    [sessionId, linkToken, callAI, speakText, addEntry, finishInterview]
  );

  const startListening = useCallback(() => {
    if (busyRef.current || !cameraStream) return;

    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;

    const audioStream = new MediaStream(cameraStream.getAudioTracks());
    const mimeType    = getSupportedMimeType();
    const recorder    = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);

    recorderRef.current = recorder;
    chunksRef.current   = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      silenceCleanupRef.current?.();
      silenceCleanupRef.current = null;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      setIsListening(false);
      void runTurn(blob);
    };

    recorder.start(120);
    setIsListening(true);

    try {
      const audioCtx = new AudioContext();
      const source   = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data  = new Uint8Array(analyser.frequencyBinCount);
      const start = Date.now();
      let silenceStart: number | null = null;
      let rafId = 0;

      const check = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const s = (data[i] - 128) / 128; sum += s * s; }
        const rms     = Math.sqrt(sum / data.length) * 100;
        const elapsed = Date.now() - start;

        if (elapsed > SILENCE_ONSET_DELAY) {
          if (rms < SILENCE_THRESHOLD) {
            if (silenceStart === null) silenceStart = Date.now();
            else if (Date.now() - silenceStart > SILENCE_DURATION_MS) {
              audioCtx.close().catch(() => {});
              if (recorder.state === "recording") recorder.stop();
              return;
            }
          } else {
            silenceStart = null;
          }
        }
        if (recorder.state === "recording") rafId = requestAnimationFrame(check);
      };

      rafId = requestAnimationFrame(check);
      silenceCleanupRef.current = () => { cancelAnimationFrame(rafId); audioCtx.close().catch(() => {}); };
    } catch { /* Silence detection unavailable */ }
  }, [cameraStream, runTurn]);

  startListenRef.current = startListening;

  const beginInterview = useCallback(async () => {
    inCallRef.current = true;
    busyRef.current   = true;
    setIsAIThinking(true);

    // Mark session as in_progress
    interviewsApi.updateStatusByToken(linkToken, "in_progress").catch(() => {});

    try {
      const greeting = await callAI([{ role: "user", content: "Hello, I'm ready to begin." }]);
      messagesRef.current = [
        { role: "user",      content: "Hello, I'm ready to begin." },
        { role: "assistant", content: greeting },
      ];
      setIsAIThinking(false);
      await speakText(greeting);
      addEntry({ id: `ai-greeting`, speaker: "ai", text: greeting, timestamp: new Date(), isFinal: true });
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Failed to start interview");
      setIsAIThinking(false);
    } finally {
      busyRef.current = false;
      startListenRef.current();
    }
  }, [linkToken, callAI, speakText, addEntry]);

  return {
    isMediaReady,
    mediaError: voiceError ?? mediaError,
    attachVideo,
    initMedia,
    transcript,
    isListening,
    isAIThinking,
    isAISpeaking,
    beginInterview,
    finishInterview,
  };
}
