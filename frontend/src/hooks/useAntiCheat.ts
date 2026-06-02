import { useEffect, useRef, useCallback, useState } from "react";

export type ViolationType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "MULTIPLE_SCREENS"
  | "DEVTOOLS_OPEN"
  | "COPY_PASTE"
  | "SCREEN_SHARE_STOP";

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
  maxViolations?: number; // terminate after N violations
  sessionId: string;
}

export function useAntiCheat({
  onViolation,
  onTerminate,
  maxViolations = 3,
  sessionId,
}: UseAntiCheatOptions) {
  const [state, setState] = useState<AntiCheatState>({
    isFullscreen: false,
    violations: [],
    totalViolations: 0,
    isTerminated: false,
    multipleScreensDetected: false,
  });

  const violationsRef = useRef<Violation[]>([]);
  const devtoolsCheckRef = useRef<NodeJS.Timeout | null>(null);
  const terminatedRef = useRef(false);

  // Log violation
  const recordViolation = useCallback(
    (type: ViolationType) => {
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

      setState((prev) => ({
        ...prev,
        violations: violationsRef.current,
        totalViolations: total,
      }));

      onViolation?.(violation);

      // Terminate if max violations exceeded
      if (total >= maxViolations) {
        terminatedRef.current = true;
        setState((prev) => ({ ...prev, isTerminated: true }));
        onTerminate?.(violationsRef.current);
      }
    },
    [onViolation, onTerminate, maxViolations]
  );

  // ─── Fullscreen ───────────────────────────────────────────────
  const requestFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      setState((prev) => ({ ...prev, isFullscreen: true }));
    } catch (e) {
      console.warn("Fullscreen request failed", e);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setState((prev) => ({ ...prev, isFullscreen: isFs }));
      if (!isFs && !terminatedRef.current) {
        recordViolation("FULLSCREEN_EXIT");
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [recordViolation]);

  // ─── Tab / Window Visibility ──────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) recordViolation("TAB_SWITCH");
    };
    const handleBlur = () => {
      // window blur = user switched to another app
      if (!document.hidden) recordViolation("TAB_SWITCH");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [recordViolation]);

  // ─── Multiple Screens ─────────────────────────────────────────
  useEffect(() => {
    const checkScreens = () => {
      // window.screen.isExtended is available in newer browsers
      const isExtended = (window.screen as any).isExtended;
      if (isExtended === true) {
        setState((prev) => ({ ...prev, multipleScreensDetected: true }));
        recordViolation("MULTIPLE_SCREENS");
      }
    };

    checkScreens();

    // Also check on screenchange event
    const screen = window.screen as any;
    screen.addEventListener?.("change", checkScreens);

    // Fallback: if window is positioned outside primary screen bounds
    const checkWindowPosition = () => {
      if (window.screenX < 0 || window.screenY < 0 ||
        window.screenX > window.screen.width ||
        window.screenY > window.screen.height) {
        setState((prev) => ({ ...prev, multipleScreensDetected: true }));
        recordViolation("MULTIPLE_SCREENS");
      }
    };
    window.addEventListener("resize", checkWindowPosition);

    return () => {
      screen.removeEventListener?.("change", checkScreens);
      window.removeEventListener("resize", checkWindowPosition);
    };
  }, [recordViolation]);

  // ─── DevTools Detection ───────────────────────────────────────
  useEffect(() => {
    const threshold = 160;
    const check = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > threshold || heightDiff > threshold) {
        recordViolation("DEVTOOLS_OPEN");
      }
    };
    devtoolsCheckRef.current = setInterval(check, 1500);
    return () => {
      if (devtoolsCheckRef.current) clearInterval(devtoolsCheckRef.current);
    };
  }, [recordViolation]);

  // ─── Copy / Paste Block ───────────────────────────────────────
  useEffect(() => {
    const block = (e: ClipboardEvent) => {
      e.preventDefault();
      recordViolation("COPY_PASTE");
    };
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);

    // Block keyboard shortcuts
    const blockKeys = (e: KeyboardEvent) => {
      const isCopy = (e.ctrlKey || e.metaKey) && ["c", "v", "x", "a"].includes(e.key.toLowerCase());
      if (isCopy) {
        e.preventDefault();
        recordViolation("COPY_PASTE");
      }
    };
    document.addEventListener("keydown", blockKeys);

    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("keydown", blockKeys);
    };
  }, [recordViolation]);

  // ─── Right Click Block ────────────────────────────────────────
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  // ─── Screen Share Detection ───────────────────────────────────
  const checkScreenShareStopped = useCallback((stream: MediaStream) => {
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        recordViolation("SCREEN_SHARE_STOP");
      });
    });
  }, [recordViolation]);

  return {
    ...state,
    requestFullscreen,
    checkScreenShareStopped,
    recordViolation,
  };
}
