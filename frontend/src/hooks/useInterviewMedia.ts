import { useEffect, useRef, useState, useCallback } from "react";

export interface TranscriptEntry {
  id: string;
  speaker: "ai" | "candidate";
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface UseInterviewMediaOptions {
  onTranscriptUpdate?: (entry: TranscriptEntry) => void;
}

export function useInterviewMedia({ onTranscriptUpdate }: UseInterviewMediaOptions = {}) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // ─── Camera + Mic ──────────────────────────────────────────────
  const initMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      setCameraStream(stream);
      setIsMediaReady(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      const message =
        err.name === "NotAllowedError"
          ? "Camera and microphone access is required for the interview."
          : err.name === "NotFoundError"
          ? "No camera or microphone found on this device."
          : "Failed to access camera/microphone. Please check your device settings.";
      setMediaError(message);
    }
  }, []);

  // ─── Attach stream to video element once ref is available ──────
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && cameraStream) {
      el.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // ─── Live Transcript (Web Speech API) ─────────────────────────
  const startTranscription = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    let interimId = "interim-" + Date.now();

    recognition.onstart = () => setIsSpeaking(true);
    recognition.onend = () => {
      setIsSpeaking(false);
      // Auto restart
      try { recognition.start(); } catch (_) {}
    };

    recognition.onresult = (event: any) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        const entry: TranscriptEntry = {
          id: "c-" + Date.now(),
          speaker: "candidate",
          text: finalText.trim(),
          timestamp: new Date(),
          isFinal: true,
        };
        setTranscript((prev) => {
          // Remove interim entry if exists
          const filtered = prev.filter((e) => e.id !== interimId);
          interimId = "interim-" + Date.now();
          return [...filtered, entry];
        });
        onTranscriptUpdate?.(entry);
      } else if (interimText) {
        const entry: TranscriptEntry = {
          id: interimId,
          speaker: "candidate",
          text: interimText.trim(),
          timestamp: new Date(),
          isFinal: false,
        };
        setTranscript((prev) => {
          const filtered = prev.filter((e) => e.id !== interimId);
          return [...filtered, entry];
        });
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onTranscriptUpdate]);

  const stopTranscription = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // ─── Add AI transcript entry ───────────────────────────────────
  const addAITranscript = useCallback((text: string) => {
    const entry: TranscriptEntry = {
      id: "ai-" + Date.now(),
      speaker: "ai",
      text,
      timestamp: new Date(),
      isFinal: true,
    };
    setTranscript((prev) => [...prev, entry]);
    onTranscriptUpdate?.(entry);
  }, [onTranscriptUpdate]);

  // ─── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.stop();
    };
  }, [cameraStream]);

  return {
    cameraStream,
    isMediaReady,
    mediaError,
    transcript,
    isSpeaking,
    initMedia,
    attachVideo,
    startTranscription,
    stopTranscription,
    addAITranscript,
  };
}
