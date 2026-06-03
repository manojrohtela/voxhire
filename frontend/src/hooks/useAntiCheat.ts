import { useEffect, useRef, useCallback, useState } from "react";
import { interviewsApi } from "@/lib/api-client";

export type ViolationType = "TAB_SWITCH" | "FULLSCREEN_EXIT" | "MULTIPLE_SCREENS" | "DEVTOOLS_OPEN" | "COPY_PASTE" | "SCREEN_SHARE_STOP";

export interface Violation {
  type: ViolationType;
  timestamp: Date;
  count: number;
}

export interface AntiCheatState {
  isFullscreen: boolean;
  violations: Violation[];
  totalViolations: number;
  isTerminated: boolean;
  multipleScreensDetected: boolean;
}

interface UseAntiCheatOptions {
  onViolation?: (violation: Violation) => void;
  onTerminate?: (violations: Violation[]) => void;
  maxViolations?: number;
  sessionId: string;
}

export function useAntiCheat({ onViolation, onTerminate, maxViolations = 3, sessionId }: UseAntiCheatOptions) {
  const [state, setState] = useState<AntiCheatState>({
    isFullscreen: false, violations: [], totalViolations: 0, isTerminated: false, multipleScreensDetected: false,
  });

  const violationsRef = useRef<Violation[]>([]);
  const devtoolsCheckRef = useRef<NodeJS.Timeout | null>(null);
  const terminatedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const recordViolation = useCallback((type: ViolationType) => {
    if (terminatedRef.current) return;
    const existing = violationsRef.current.find((v) => v.type === type);
    let violation: Violation;

    if (existing) {
      existing.count += 1;
      existing.timestamp = new Date();
      violation = existing;
      violationsRef.current = [...violationsRef.current];
    } else {
      violation = { type, timestamp: new Date(), count: 1 };
      violationsRef.current = [...violationsRef.current, violation];
    }

    const total = violationsRef.current.reduce((sum, v) => sum + v.count, 0);
    setState((prev) => ({ ...prev, violations: violationsRef.current, totalViolations: total }));
    onViolation?.(violation);

    // Save to backend
    const timestampSeconds = (Date.now() - startTimeRef.current) / 1000;
    interviewsApi.recordViolation(sessionId, type, timestampSeconds).catch(() => {});

    if (total >= maxViolations) {
      terminatedRef.current = true;
      setState((prev) => ({ ...prev, isTerminated: true }));
      onTerminate?.(violationsRef.current);
    }
  }, [onViolation, onTerminate, maxViolations, sessionId]);

  const requestFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      setState((prev) => ({ ...prev, isFullscreen: true }));
    } catch (e) { console.warn("Fullscreen failed", e); }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setState((prev) => ({ ...prev, isFullscreen: isFs }));
      if (!isFs && !terminatedRef.current) recordViolation("FULLSCREEN_EXIT");
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [recordViolation]);

  useEffect(() => {
    const handleVisibility = () => { if (document.hidden) recordViolation("TAB_SWITCH"); };
    const handleBlur = () => { if (!document.hidden) recordViolation("TAB_SWITCH"); };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => { document.removeEventListener("visibilitychange", handleVisibility); window.removeEventListener("blur", handleBlur); };
  }, [recordViolation]);

  useEffect(() => {
    const check = () => {
      const isExtended = (window.screen as any).isExtended;
      if (isExtended === true) { setState((prev) => ({ ...prev, multipleScreensDetected: true })); recordViolation("MULTIPLE_SCREENS"); }
    };
    check();
    (window.screen as any).addEventListener?.("change", check);
    return () => (window.screen as any).removeEventListener?.("change", check);
  }, [recordViolation]);

  useEffect(() => {
    devtoolsCheckRef.current = setInterval(() => {
      if (window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160) recordViolation("DEVTOOLS_OPEN");
    }, 1500);
    return () => { if (devtoolsCheckRef.current) clearInterval(devtoolsCheckRef.current); };
  }, [recordViolation]);

  useEffect(() => {
    const block = (e: ClipboardEvent) => { e.preventDefault(); recordViolation("COPY_PASTE"); };
    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c","v","x","a"].includes(e.key.toLowerCase())) { e.preventDefault(); recordViolation("COPY_PASTE"); }
    };
    document.addEventListener("copy", block); document.addEventListener("cut", block); document.addEventListener("paste", block);
    document.addEventListener("keydown", blockKeys);
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    return () => { document.removeEventListener("copy", block); document.removeEventListener("cut", block); document.removeEventListener("paste", block); document.removeEventListener("keydown", blockKeys); };
  }, [recordViolation]);

  return { ...state, requestFullscreen, recordViolation };
}
