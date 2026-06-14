"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  open: boolean;
  onClose: () => void;
  onEnter: () => Promise<void> | void; // performs the demo login
}

/**
 * Playful "say hello before you explore" gate for the demo. Paper-sketch
 * aesthetic (handwritten font, wobbly dashed borders, sticky-note tilt) with a
 * springy entrance. Captures name (+ optional email/phone/feedback) → backend.
 */
export function DemoGate({ open, onClose, onEnter }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const firstName = name.trim().split(/\s+/)[0];

  const enter = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    // Capture the lead (best-effort — never block entry).
    try {
      await fetch(`${API_URL}/api/v1/demo/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim() }),
      });
    } catch { /* ignore */ }
    await onEnter();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="dialog" aria-modal="true" aria-label="Explore the demo"
        >
          <style jsx global>{`
            @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Patrick+Hand&display=swap');
            .sketch-note { font-family: 'Patrick Hand', 'Comic Sans MS', cursive; }
            .sketch-hand { font-family: 'Kalam', cursive; }
            .sketch-input {
              font-family: 'Kalam', cursive;
              background: transparent;
              border: none;
              border-bottom: 2px dashed #00000055;
              border-radius: 0;
              outline: none;
              transition: border-color .2s;
            }
            .sketch-input:focus { border-bottom-color: #6c63ff; }
            .sketch-input::placeholder { color: #00000040; }
          `}</style>

          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={busy ? undefined : onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -3, y: 24 }}
            animate={{ opacity: 1, scale: 1, rotate: -1.2, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, rotate: -3, y: 24 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative w-full max-w-md"
          >
            {/* paper note */}
            <div
              className="relative rounded-[14px] p-7 sm:p-8 shadow-2xl"
              style={{
                background: "#fdfaf2",
                boxShadow: "0 22px 60px rgba(0,0,0,.45)",
                border: "2.5px solid #1a1a1a",
                backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, #00000010 32px)",
              }}
            >
              {/* tape */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#6c63ff]/25 border border-[#6c63ff]/40 rotate-[-4deg] rounded-sm" />
              {/* corner doodle */}
              <div className="absolute top-3 right-4 sketch-note text-2xl select-none" aria-hidden>✦</div>

              <button onClick={onClose} disabled={busy} aria-label="Close"
                className="absolute top-3 left-4 text-black/40 hover:text-black/80 text-xl leading-none disabled:opacity-40">×</button>

              <h2 className="sketch-note text-3xl text-[#1a1a1a] mt-2 leading-tight">
                ✋ Hey, who&apos;s snooping? <span className="inline-block">👀</span>
              </h2>
              <p className="sketch-hand text-[#333] text-[15px] mt-2 leading-relaxed">
                The agents are curious too! Scribble your name so we can say hi —
                and tell us the one feature you wish VoxHire had.
              </p>

              {/* live greeting */}
              <div className="h-6 mt-2">
                {firstName && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sketch-hand text-[#6c63ff] text-base">
                    Hi {firstName}! 🎉 nice to meet you.
                  </motion.p>
                )}
              </div>

              <div className="space-y-4 mt-3">
                <input className="sketch-input w-full py-2 text-[#1a1a1a] text-lg" placeholder="your name…"
                  value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Your name" />
                <input className="sketch-input w-full py-2 text-[#1a1a1a] text-lg" placeholder="email (optional, for cool updates)"
                  value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email (optional)" />
                <input className="sketch-input w-full py-2 text-[#1a1a1a] text-lg" placeholder="phone (optional, only if you like calls)"
                  value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone (optional)" />
                <textarea className="sketch-input w-full py-2 text-[#1a1a1a] text-base resize-none" rows={2}
                  placeholder="✨ a feature you'd love? any feedback? (optional)"
                  value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Feedback (optional)" />
              </div>

              <motion.button
                whileHover={name.trim() ? { scale: 1.03, rotate: 0.5 } : undefined}
                whileTap={name.trim() ? { scale: 0.97 } : undefined}
                onClick={enter}
                disabled={!name.trim() || busy}
                className="sketch-note w-full mt-6 py-3 rounded-[10px] text-xl text-white disabled:opacity-50"
                style={{ background: "#1a1a1a", border: "2.5px solid #1a1a1a", boxShadow: "4px 4px 0 #6c63ff" }}
              >
                {busy ? "opening the door…" : "let me in! →"}
              </motion.button>
              <p className="sketch-hand text-center text-[#777] text-sm mt-3">No spam. Pinky promise 🤙</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
