"use client";

import { useRef, useState, useCallback } from "react";
import { useInterviewMedia, type TranscriptEntry } from "./useInterviewMedia";
import { createInterviewMemory, type InterviewMemory } from "@/lib/voice/memory";
import { detectIntent, detectEmotionalTone, updateEngagement, assessMomentum } from "@/lib/voice/intent";
import { advanceStage, advanceSkill, isSkillExhausted, MIN_TURNS_PER_STAGE } from "@/lib/voice/stateMachine";
import { interviewsApi } from "@/lib/api-client";
import type { StageContext } from "@/lib/voice/types";

// ── Turn state machine ────────────────────────────────────────────────────────
export type TurnPhase = "IDLE" | "LISTENING" | "THINKING_PAUSE" | "PROCESSING" | "SPEAKING";

// ── Silence tier thresholds ───────────────────────────────────────────────────
const SPEECH_THRESHOLD        = 20;
const THINKING_PAUSE_ONSET_MS = 1_800;
const PROCESS_AFTER_SPEECH_MS = 3_000;
const ENCOURAGE_MS            = 7_000;
const REPEAT_QUESTION_MS      = 12_000;
const MIN_RECORDING_MS        = 600;
const MIN_BLOB_BYTES          = 1_500;

// ── Barge-in ─────────────────────────────────────────────────────────────────
const BARGE_IN_THRESHOLD = 28;   // RMS×100 for mic speech during AI speaking
const BARGE_IN_DELAY_MS  = 600;  // wait before enabling barge-in (echo guard)

// ── Pre-cached audio ─────────────────────────────────────────────────────────
// Fetched once at interview start; played instantly without TTS latency
const FILLER_TEXTS = [
  "Hmm, let me think.",
  "I see.",
  "Got it.",
  "Interesting.",
  "Right.",
  "Let me consider that.",
];
const BARGE_ACK_TEXT = "Sure, go ahead.";

function getSupportedMimeType(): string {
  const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return c.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

// Detect first complete sentence in a streaming token buffer.
// Avoids splitting on abbreviations by requiring the post-period char to be uppercase.
function extractNextSentence(buf: string): { sentence: string; rest: string } | null {
  if (buf.length < 15) return null;
  for (let i = 10; i < buf.length - 1; i++) {
    const c    = buf[i];
    const next = buf[i + 1];
    if ((c === "!" || c === "?") && next === " ") {
      return { sentence: buf.slice(0, i + 1).trim(), rest: buf.slice(i + 2) };
    }
    if (c === "." && next === " ") {
      const afterSpace = buf.slice(i + 2).trimStart();
      // Only split if next word starts with uppercase (new sentence, not abbreviation)
      if (afterSpace && afterSpace[0] !== afterSpace[0].toLowerCase()) {
        return { sentence: buf.slice(0, i + 1).trim(), rest: buf.slice(i + 2) };
      }
    }
  }
  return null;
}

interface VoiceRuntimeOptions {
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

export function useVoiceRuntime({
  sessionId,
  linkToken,
  candidateName = "",
  appliedRole   = "",
  skillsToAssess = [],
  difficulty    = "Medium",
  aiPersonality = "Neutral",
  interviewType = "Technical",
  onComplete,
}: VoiceRuntimeOptions) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [turnPhase, setTurnPhase]   = useState<TurnPhase>("IDLE");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const memoryRef        = useRef<InterviewMemory>(
    createInterviewMemory(candidateName, appliedRole, skillsToAssess, difficulty, aiPersonality, interviewType)
  );
  const messagesRef      = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const busyRef          = useRef(false);
  const inCallRef        = useRef(false);
  const recorderRef      = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<BlobPart[]>([]);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const animFrameRef     = useRef<number>(0);
  const silenceActionRef = useRef<"none" | "encourage" | "repeat">("none");
  const startListenRef   = useRef<() => void>(() => {});
  const completedRef     = useRef(false);

  // Barge-in state (shared across speakBlob and callAIAndSpeak)
  const activeAudioRef   = useRef<HTMLAudioElement | null>(null);
  const speakResolveRef  = useRef<(() => void) | null>(null);
  const bargeInFiredRef  = useRef(false);
  const cameraStreamRef  = useRef<MediaStream | null>(null);

  // Pre-cached audio blobs
  const fillerBlobsRef   = useRef<Blob[]>([]);
  const bargeAckBlobRef  = useRef<Blob | null>(null);
  const cacheFetchedRef  = useRef(false);

  const { isMediaReady, mediaError, cameraStream, initMedia, attachVideo } = useInterviewMedia();
  cameraStreamRef.current = cameraStream; // always current — no re-render needed

  const addEntry = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [...prev.filter((e) => e.id !== entry.id), entry]);
  }, []);

  const buildStageContext = useCallback((): StageContext => {
    const m = memoryRef.current;
    return {
      stage:                        m.stage,
      emotionalTone:                m.emotionalTone,
      intent:                       m.intent,
      engagementLevel:              m.engagementLevel,
      momentum:                     m.momentum,
      consecutiveSameTone:          m.consecutiveSameTone,
      deflectStreak:                m.deflectStreak,
      questionsAskedOnCurrentSkill: m.questionsAskedOnCurrentSkill,
      candidateName,
      appliedRole,
      currentSkill:                 m.currentSkill,
      skillsToAssess,
      remainingSkills:              m.skillsQueue.filter((s) => !m.skillsCovered.includes(s)),
      difficulty:                   m.difficulty,
      aiPersonality:                m.aiPersonality,
      interviewType:                m.interviewType,
    };
  }, [candidateName, appliedRole, skillsToAssess]);

  // ── TTS fetch ─────────────────────────────────────────────────────────────
  const fetchTTSBlob = useCallback(async (text: string): Promise<Blob | null> => {
    try {
      const res = await fetch("/api/voice/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      });
      return res.ok ? res.blob() : null;
    } catch { return null; }
  }, []);

  // ── Pre-cache fillers and barge-ack audio (called once at interview start) ─
  const prefetchAudioCache = useCallback(async () => {
    if (cacheFetchedRef.current) return;
    cacheFetchedRef.current = true;
    const [fillerResults, ackBlob] = await Promise.all([
      Promise.allSettled(FILLER_TEXTS.map((t) => fetchTTSBlob(t))),
      fetchTTSBlob(BARGE_ACK_TEXT),
    ]);
    fillerBlobsRef.current = fillerResults
      .filter((r): r is PromiseFulfilledResult<Blob | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((b): b is Blob => b !== null);
    bargeAckBlobRef.current = ackBlob;
  }, [fetchTTSBlob]);

  // ── Simple blob playback (no barge-in) — for fillers and ack ─────────────
  const playBlob = useCallback(async (blob: Blob): Promise<void> => {
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);
    return new Promise<void>((resolve) => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(() => resolve());
    });
  }, []);

  const playFiller = useCallback(async (): Promise<void> => {
    const blobs = fillerBlobsRef.current;
    if (!blobs.length) return;
    await playBlob(blobs[Math.floor(Math.random() * blobs.length)]);
  }, [playBlob]);

  const playBargeAck = useCallback(async (): Promise<void> => {
    const blob = bargeAckBlobRef.current;
    if (!blob) return;
    await playBlob(blob);
  }, [playBlob]);

  // ── Blob playback with barge-in detection ─────────────────────────────────
  // Core speaking primitive. Sets SPEAKING → IDLE on completion or interruption.
  const speakBlob = useCallback(async (blob: Blob): Promise<void> => {
    if (bargeInFiredRef.current) return;
    setTurnPhase("SPEAKING");

    let bargeCtx: AudioContext | null = null;
    let bargeRaf = 0;

    const stopBarge = () => {
      cancelAnimationFrame(bargeRaf);
      bargeCtx?.close().catch(() => {});
      bargeCtx = null;
    };

    try {
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      activeAudioRef.current = audio;

      await new Promise<void>((resolve) => {
        const finish = () => {
          URL.revokeObjectURL(url);
          activeAudioRef.current  = null;
          speakResolveRef.current = null;
          resolve();
        };
        // Expose resolver so barge-in can stop the audio from outside
        speakResolveRef.current = () => { audio.pause(); finish(); };

        audio.onended = finish;
        audio.onerror = finish;
        audio.play().catch(finish);

        // Start barge-in monitor after delay (avoids echo self-triggering)
        setTimeout(() => {
          const stream = cameraStreamRef.current;
          if (!stream || !activeAudioRef.current) return;
          try {
            bargeCtx = new AudioContext();
            const src      = bargeCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
            const analyser = bargeCtx.createAnalyser();
            analyser.fftSize = 512;
            src.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const check = () => {
              if (!activeAudioRef.current) return;
              analyser.getByteTimeDomainData(data);
              let sum = 0;
              for (let i = 0; i < data.length; i++) { const s = (data[i] - 128) / 128; sum += s * s; }
              if (Math.sqrt(sum / data.length) * 100 > BARGE_IN_THRESHOLD) {
                bargeInFiredRef.current = true;
                speakResolveRef.current?.();
                return;
              }
              bargeRaf = requestAnimationFrame(check);
            };
            bargeRaf = requestAnimationFrame(check);
          } catch {}
        }, BARGE_IN_DELAY_MS);
      });
    } finally {
      stopBarge();
      setTurnPhase("IDLE");
    }
  }, []);

  // ── LLM call + sentence-streaming TTS ────────────────────────────────────
  // Key improvement: the FIRST sentence is TTS-fetched the moment it arrives from
  // the LLM stream, while the rest of the response is still generating.
  // Each sentence's TTS blob is pre-fetched concurrently while the previous plays.
  // Returns the full response text.
  const callAIAndSpeak = useCallback(async (
    messages: typeof messagesRef.current
  ): Promise<string> => {
    bargeInFiredRef.current = false;

    const chatRes = await fetch("/api/voice/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        messages,
        candidateName,
        appliedRole,
        skillsToAssess,
        stageContext:            buildStageContext(),
        recentAssistantOpenings: memoryRef.current.recentAssistantOpenings,
      }),
    });
    if (!chatRes.ok || !chatRes.body) throw new Error("Chat API failed");

    const reader  = chatRes.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "", sseBuf = "", tokenBuf = "";

    // TTS pipeline: each sentence is pre-fetched concurrently, played sequentially
    let ttsChain = Promise.resolve();
    const enqueueSentence = (sentence: string) => {
      // Kick off TTS fetch immediately (concurrent with LLM generation and previous playback)
      const blobPromise = fetchTTSBlob(sentence);
      ttsChain = ttsChain.then(async () => {
        if (bargeInFiredRef.current) return;
        const blob = await blobPromise; // likely already downloaded by now
        if (!blob || bargeInFiredRef.current) return;
        await speakBlob(blob);
      });
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuf += decoder.decode(value, { stream: true });
      const lines = sseBuf.split("\n");
      sseBuf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const d = line.slice(6).trim();
        if (d === "[DONE]") break;
        try {
          const delta = JSON.parse(d)?.choices?.[0]?.delta?.content;
          if (typeof delta === "string") {
            fullText += delta;
            tokenBuf += delta;
            // Extract and enqueue complete sentences as they arrive
            let result;
            while ((result = extractNextSentence(tokenBuf)) !== null) {
              enqueueSentence(result.sentence);
              tokenBuf = result.rest;
            }
          }
        } catch {}
      }
    }

    // Flush final partial sentence
    if (tokenBuf.trim()) enqueueSentence(tokenBuf.trim());

    // Wait for all queued sentences to finish playing
    await ttsChain;

    if (!fullText.trim()) throw new Error("Empty AI response");
    return fullText.trim();
  }, [speakBlob, fetchTTSBlob, candidateName, appliedRole, skillsToAssess, buildStageContext]);

  const finishInterview = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    inCallRef.current = false;
    recorderRef.current?.stop();
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close().catch(() => {});
    speakResolveRef.current?.();
    interviewsApi.updateStatusByToken(linkToken, "completed").catch(() => {});
    onComplete?.();
  }, [linkToken, onComplete]);

  // ── Silence action: encouragement / repeat question ───────────────────────
  const runSilenceAction = useCallback(async (type: "encourage" | "repeat") => {
    if (busyRef.current) { if (inCallRef.current) startListenRef.current(); return; }
    busyRef.current = true;
    setTurnPhase("PROCESSING");
    try {
      const hint = type === "repeat"
        ? "[The candidate has not spoken for 12+ seconds. Gently ask if they'd like the question repeated or rephrased. One warm sentence, under 15 words.]"
        : "[The candidate is silent and thinking. Offer one brief, warm encouragement. Under 10 words. Do not ask a new question.]";

      const aiText = await callAIAndSpeak([...messagesRef.current, { role: "user", content: hint }]);
      messagesRef.current = [...messagesRef.current, { role: "assistant", content: aiText }];
      memoryRef.current   = {
        ...memoryRef.current,
        recentAssistantOpenings: [...memoryRef.current.recentAssistantOpenings, aiText.split(/\s+/).slice(0, 5).join(" ")].slice(-6),
      };
      addEntry({ id: `ai-${Date.now()}`, speaker: "ai", text: aiText, timestamp: new Date(), isFinal: true });
      interviewsApi.appendTranscript(sessionId, [{ speaker: "ai", text: aiText, timestamp_seconds: Date.now() / 1000 }], linkToken).catch(() => {});
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Voice error");
      setTurnPhase("IDLE");
    } finally {
      // Barge-in ack if candidate interrupted the encouragement
      if (inCallRef.current && bargeInFiredRef.current) {
        bargeInFiredRef.current = false;
        await playBargeAck();
      }
      busyRef.current = false;
      if (inCallRef.current) startListenRef.current();
    }
  }, [callAIAndSpeak, playBargeAck, addEntry, sessionId, linkToken]);

  // ── Main turn processor ───────────────────────────────────────────────────
  const runTurn = useCallback(async (audioBlob: Blob) => {
    if (busyRef.current) { if (inCallRef.current) startListenRef.current(); return; }
    busyRef.current = true;
    setVoiceError(null);
    setTurnPhase("PROCESSING");

    // Thinking filler plays immediately, covering the STT latency gap
    const fillerDone = playFiller();

    try {
      // STT
      const fd = new FormData();
      fd.append("audio", audioBlob, "audio.webm");
      const sttRes   = await fetch("/api/voice/stt", { method: "POST", body: fd });
      const userText = ((await sttRes.json()).text ?? "").trim() as string;

      if (!userText) {
        await fillerDone;
        setTurnPhase("IDLE");
        busyRef.current = false;
        if (inCallRef.current) startListenRef.current();
        return;
      }

      addEntry({ id: `c-${Date.now()}`, speaker: "candidate", text: userText, timestamp: new Date(), isFinal: true });

      // Memory update
      const prev        = memoryRef.current;
      const wordCount   = userText.split(/\s+/).filter(Boolean).length;
      const intent      = detectIntent(userText);
      const tone        = detectEmotionalTone(userText);
      const engagement  = updateEngagement(prev, userText);
      const momentum    = assessMomentum(prev, wordCount);
      const consecutive = tone === prev.emotionalTone ? prev.consecutiveSameTone + 1 : 1;
      const deflect     = intent === "deflecting" ? prev.deflectStreak + 1 : 0;

      let updated: InterviewMemory = {
        ...prev,
        turnCount:                    prev.turnCount + 1,
        intent, emotionalTone: tone,
        consecutiveSameTone:          consecutive,
        engagementLevel:              engagement,
        momentum,
        lastResponseWordCount:        wordCount,
        deflectStreak:                deflect,
        questionsAskedOnCurrentSkill: prev.questionsAskedOnCurrentSkill + 1,
      };

      if ((updated.stage === "technical" || updated.stage === "deep_dive") && updated.currentSkill && isSkillExhausted(updated)) {
        updated = { ...updated, ...advanceSkill(updated) };
      }

      const prevStage = updated.stage;
      const nextStage = advanceStage(updated);
      if (nextStage !== prevStage) {
        updated.stage                        = nextStage;
        updated.stageStartTurn               = updated.turnCount;
        updated.questionsAskedOnCurrentSkill = 0;
        updated.deflectStreak                = 0;
        if (nextStage === "deep_dive") {
          const remaining = updated.skillsQueue.filter((s) => !updated.skillsCovered.includes(s));
          if (remaining.length > 0 && !updated.currentSkill) updated.currentSkill = remaining[0];
        }
      }
      memoryRef.current = updated;

      const turnsInWrapUp   = updated.turnCount - updated.stageStartTurn;
      const aiResponseCount = messagesRef.current.filter((m) => m.role === "assistant").length;
      const isWrapUpDone    = updated.stage === "wrap_up" && turnsInWrapUp >= MIN_TURNS_PER_STAGE["wrap_up"] && aiResponseCount >= 2;

      messagesRef.current = [...messagesRef.current, { role: "user", content: userText }];

      // Wait for filler to finish before AI speaks (prevents overlap)
      await fillerDone;

      // LLM + sentence-streaming TTS — first sentence plays as soon as it arrives
      const aiText = await callAIAndSpeak(messagesRef.current);
      messagesRef.current = [...messagesRef.current, { role: "assistant", content: aiText }];
      memoryRef.current   = {
        ...memoryRef.current,
        recentAssistantOpenings: [...memoryRef.current.recentAssistantOpenings, aiText.split(/\s+/).slice(0, 5).join(" ")].slice(-6),
      };

      addEntry({ id: `ai-${Date.now()}`, speaker: "ai", text: aiText, timestamp: new Date(), isFinal: true });
      interviewsApi.appendTranscript(sessionId, [
        { speaker: "candidate", text: userText, timestamp_seconds: Date.now() / 1000 },
        { speaker: "ai",        text: aiText,   timestamp_seconds: Date.now() / 1000 },
      ], linkToken).catch(() => {});

      if (isWrapUpDone) { await finishInterview(); return; }
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Voice error");
      setTurnPhase("IDLE");
    } finally {
      // If candidate interrupted, acknowledge before switching to listening
      if (inCallRef.current && bargeInFiredRef.current) {
        bargeInFiredRef.current = false;
        await playBargeAck();
      }
      busyRef.current = false;
      if (inCallRef.current) startListenRef.current();
    }
  }, [playFiller, playBargeAck, callAIAndSpeak, addEntry, sessionId, linkToken, finishInterview]);

  // ── Listening + silence detection ─────────────────────────────────────────
  const startListening = useCallback(() => {
    if (busyRef.current || !cameraStream) return;

    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;

    const audioStream = new MediaStream(cameraStream.getAudioTracks());
    const mimeType    = getSupportedMimeType();
    const recorder    = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);

    recorderRef.current      = recorder;
    chunksRef.current        = [];
    silenceActionRef.current = "none";
    const recordingStartedAt = Date.now();

    let hasSpeech          = false;
    let lastSpeechAt: number | null = null;
    let pauseUIShown       = false;
    let encourageTriggered = false;
    let repeatTriggered    = false;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

    recorder.onstop = () => {
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      setTurnPhase("IDLE");

      const action = silenceActionRef.current;
      silenceActionRef.current = "none";
      const blob     = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const duration = Date.now() - recordingStartedAt;
      chunksRef.current = [];

      if (action !== "none") { void runSilenceAction(action); return; }
      if (!hasSpeech || duration < MIN_RECORDING_MS || blob.size < MIN_BLOB_BYTES) {
        if (inCallRef.current) startListenRef.current();
        return;
      }
      void runTurn(blob);
    };

    recorder.start(120);
    setTurnPhase("LISTENING");

    try {
      const audioCtx  = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source    = audioCtx.createMediaStreamSource(audioStream);
      const analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const check = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const s = (data[i] - 128) / 128; sum += s * s; }
        const rms     = Math.sqrt(sum / data.length) * 100;
        const now     = Date.now();
        const elapsed = now - recordingStartedAt;

        if (rms > SPEECH_THRESHOLD) {
          hasSpeech    = true;
          lastSpeechAt = now;
          pauseUIShown = false;
          setTurnPhase("LISTENING");
        } else {
          const silenceSinceSpeech = lastSpeechAt ? now - lastSpeechAt : 0;
          if (hasSpeech) {
            if (silenceSinceSpeech >= PROCESS_AFTER_SPEECH_MS) { if (recorder.state === "recording") recorder.stop(); return; }
            if (!pauseUIShown && silenceSinceSpeech >= THINKING_PAUSE_ONSET_MS) { pauseUIShown = true; setTurnPhase("THINKING_PAUSE"); }
          } else {
            if (!repeatTriggered && elapsed >= REPEAT_QUESTION_MS) { repeatTriggered = true; silenceActionRef.current = "repeat"; if (recorder.state === "recording") recorder.stop(); return; }
            if (!encourageTriggered && elapsed >= ENCOURAGE_MS) { encourageTriggered = true; silenceActionRef.current = "encourage"; if (recorder.state === "recording") recorder.stop(); return; }
          }
        }
        if (recorder.state === "recording") animFrameRef.current = requestAnimationFrame(check);
      };
      animFrameRef.current = requestAnimationFrame(check);
    } catch {}
  }, [cameraStream, runTurn, runSilenceAction]);

  startListenRef.current = startListening;

  const beginInterview = useCallback(async () => {
    inCallRef.current = true;
    busyRef.current   = true;
    setTurnPhase("PROCESSING");
    interviewsApi.updateStatusByToken(linkToken, "in_progress").catch(() => {});

    // Pre-cache filler + ack audio in background (ready by the time candidate first responds)
    prefetchAudioCache().catch(() => {});

    try {
      const seed     = "Hello, I'm ready to begin.";
      const greeting = await callAIAndSpeak([{ role: "user", content: seed }]);
      messagesRef.current = [
        { role: "user",      content: seed },
        { role: "assistant", content: greeting },
      ];
      memoryRef.current = {
        ...memoryRef.current,
        recentAssistantOpenings: [greeting.split(/\s+/).slice(0, 5).join(" ")],
      };
      addEntry({ id: "ai-greeting", speaker: "ai", text: greeting, timestamp: new Date(), isFinal: true });
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Failed to start interview");
      setTurnPhase("IDLE");
    } finally {
      busyRef.current = false;
      startListenRef.current();
    }
  }, [linkToken, prefetchAudioCache, callAIAndSpeak, addEntry]);

  return {
    isMediaReady,
    mediaError:          voiceError ?? mediaError,
    attachVideo,
    initMedia,
    transcript,
    turnPhase,
    isListening:         turnPhase === "LISTENING" || turnPhase === "THINKING_PAUSE",
    isCandidateThinking: turnPhase === "THINKING_PAUSE",
    isAIThinking:        turnPhase === "PROCESSING",
    isAISpeaking:        turnPhase === "SPEAKING",
    beginInterview,
    finishInterview,
  };
}
