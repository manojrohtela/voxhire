"use client";

import { useState } from "react";
import { readDemoVisitor } from "@/lib/demoVisitor";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Slim bar shown only while exploring the demo org. Surfaces the two test
 * harnesses (candidate interview + screening call) so visitors can try the
 * voice experiences, and collects feedback AFTER they've had a look around
 * (rather than gating it up front).
 */
export default function DemoBar() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendFeedback = async () => {
    if (!msg.trim() || sending) return;
    setSending(true);
    const visitor = readDemoVisitor();
    try {
      await fetch(`${API_URL}/api/v1/demo/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: visitor?.name || "Demo explorer",
          email: visitor?.email,
          phone: visitor?.phone,
          message: `[Demo feedback] ${msg.trim()}`,
        }),
      });
      setSent(true);
      setMsg("");
      setTimeout(() => { setSent(false); setOpen(false); }, 1800);
    } catch {
      /* best-effort */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative" style={{ background: "rgba(109,86,186,0.10)", borderBottom: "1px solid rgba(109,86,186,0.25)" }}>
      <div className="flex items-center gap-3 px-6 py-2 flex-wrap">
        <span className="text-[#a78bfa] text-xs font-semibold uppercase tracking-wider">🧪 Demo mode</span>
        <span className="text-gray-400 text-xs hidden sm:inline">Try the live voice experiences:</span>

        <a href="/interview/test" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: "#6c63ff" }}>
          🎙️ Candidate interview ↗
        </a>
        <a href="/screening/test" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e2e0ea" }}>
          📞 Screening call ↗
        </a>

        <button onClick={() => setOpen((o) => !o)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e2e0ea" }}>
          💬 Share feedback
        </button>
      </div>

      {open && (
        <div className="absolute right-6 top-full mt-2 z-50 w-80 rounded-xl p-4 shadow-2xl"
          style={{ background: "#16141f", border: "1px solid rgba(255,255,255,0.1)" }}>
          {sent ? (
            <p className="text-emerald-400 text-sm text-center py-4">Thanks for the feedback! 🙌</p>
          ) : (
            <>
              <p className="text-white text-sm font-medium mb-2">How was the demo?</p>
              <textarea
                value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} autoFocus
                placeholder="What worked, what didn't, a feature you'd want…"
                className="w-full px-3 py-2 rounded-lg text-sm resize-none text-white placeholder-gray-600 focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
              <div className="flex items-center justify-end gap-2 mt-2">
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-xs">Cancel</button>
                <button onClick={sendFeedback} disabled={!msg.trim() || sending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: "#6c63ff" }}>
                  {sending ? "Sending…" : "Send feedback"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
