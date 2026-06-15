"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type TurnPhase =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING";

export interface TranscriptEntry {
  id: string;
  speaker: "ai" | "candidate";
  text: string;
  timestamp: Date;
}

interface UseVapiInterviewOptions {
  sessionId: string;
  linkToken: string;
  onComplete?: () => void;
  // Extra query params appended to the vapi-config request (used by the test
  // harness so a tester can pick their own name / role / stack / level).
  configParams?: Record<string, string>;
}

interface UseVapiInterviewReturn {
  transcript: TranscriptEntry[];
  turnPhase: TurnPhase;
  isListening: boolean;
  isAIThinking: boolean;
  isAISpeaking: boolean;
  isCandidateThinking: boolean;
  vapiError: string | null;
  isMediaReady: boolean;
  mediaError: string | null;
  attachVideo: (el: HTMLVideoElement | null) => void;
  initMedia: () => Promise<void>;
  beginInterview: () => Promise<void>;
  endInterview: () => void;
  reconnect: () => void;
}

export function useVapiInterview({
  sessionId,
  linkToken,
  onComplete,
  configParams,
}: UseVapiInterviewOptions): UseVapiInterviewReturn {
  const vapiRef = useRef<Vapi | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callStartedRef = useRef(false);

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>("IDLE");
  const [vapiError, setVapiError] = useState<string | null>(null);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const isListening = turnPhase === "LISTENING";
  const isAIThinking = turnPhase === "THINKING";
  const isAISpeaking = turnPhase === "SPEAKING";
  const isCandidateThinking = turnPhase === "LISTENING";

  // Video attachment ref callback
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
    }
  }, []);

  // Request mic + camera (retry-able; classifies the failure for a clear message)
  const initMedia = useCallback(async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsMediaReady(true);
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setMediaError("Camera/microphone access is blocked. Click the camera icon in your browser's address bar, choose Allow, then tap Try again.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setMediaError("No camera or microphone was found. Please connect one and tap Try again.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setMediaError("Your camera/mic is in use by another app (Zoom, Meet, etc.). Close it and tap Try again.");
      } else {
        setMediaError("Couldn't access your camera or microphone. Check permissions and tap Try again.");
      }
    }
  }, []);

  // Fetch Vapi config from backend
  const fetchVapiConfig = useCallback(async () => {
    const qs = configParams ? `?${new URLSearchParams(configParams).toString()}` : "";
    const res = await fetch(`${API_URL}/api/v1/interviews/${sessionId}/vapi-config${qs}`, {
      headers: { "X-Interview-Token": linkToken },
    });
    if (!res.ok) throw new Error("Failed to load interview config");
    return res.json();
  }, [sessionId, linkToken, configParams]);

  // Mark session as started via existing REST endpoint
  const markStarted = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/v1/interviews/session/${linkToken}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
    } catch {
      // Non-fatal
    }
  }, [linkToken]);

  // Begin the interview — fetch config then start Vapi call
  const beginInterview = useCallback(async () => {
    if (callStartedRef.current) return;
    callStartedRef.current = true;

    try {
      const config = await fetchVapiConfig();
      const vapi = new Vapi(config.vapi_public_key);
      vapiRef.current = vapi;

      // Wire Vapi events
      vapi.on("speech-start", () => setTurnPhase("SPEAKING"));
      vapi.on("speech-end", () => setTurnPhase("THINKING"));

      vapi.on("message", (msg: any) => {
        if (msg.type === "transcript") {
          const isFinal = msg.transcriptType === "final";
          if (!isFinal) return; // ignore interim
          const speaker: "ai" | "candidate" = msg.role === "assistant" ? "ai" : "candidate";
          setTranscript((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              speaker,
              text: msg.transcript,
              timestamp: new Date(),
            },
          ]);
          if (speaker === "candidate") {
            setTurnPhase("THINKING");
          }
        }

        if (msg.type === "speech-update") {
          if (msg.status === "started") setTurnPhase("SPEAKING");
          if (msg.status === "stopped") setTurnPhase("LISTENING");
        }
      });

      vapi.on("call-start", () => {
        setTurnPhase("LISTENING");
        setVapiError(null);
        markStarted();
      });

      vapi.on("call-end", () => {
        setTurnPhase("IDLE");
        onComplete?.();
      });

      vapi.on("error", (err: any) => {
        const msg = err?.message || err?.error?.message || "Voice connection error";
        setVapiError(msg);
        setTurnPhase("IDLE");
        // Allow the candidate to retry the connection.
        callStartedRef.current = false;
      });

      // Start the call with dynamic assistant overrides.
      // firstMessage + assistant-speaks-first guarantees the AI greets the
      // candidate immediately, so they know audio is working.
      const overrides: Record<string, any> = {
        variableValues: config.variable_values,
        metadata: config.metadata,
      };
      if (config.first_message) {
        overrides.firstMessage = config.first_message;
        overrides.firstMessageMode = config.first_message_mode || "assistant-speaks-first";
      }
      // Drive the interview content (role, level, skills) from our app instead
      // of the assistant's hardcoded dashboard prompt.
      if (config.model_override) {
        overrides.model = config.model_override;
      }
      await vapi.start(config.vapi_assistant_id, overrides);
    } catch (err: any) {
      setVapiError(err?.message || "Failed to start interview");
      callStartedRef.current = false;
    }
  }, [fetchVapiConfig, markStarted, onComplete]);

  const endInterview = useCallback(() => {
    vapiRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // Retry the voice connection after an error/drop.
  const reconnect = useCallback(() => {
    setVapiError(null);
    beginInterview();
  }, [beginInterview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      vapiRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    transcript,
    turnPhase,
    isListening,
    isAIThinking,
    isAISpeaking,
    isCandidateThinking,
    vapiError,
    isMediaReady,
    mediaError,
    attachVideo,
    initMedia,
    beginInterview,
    endInterview,
    reconnect,
  };
}
