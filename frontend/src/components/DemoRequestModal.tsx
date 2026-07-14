"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * "Request a demo" — same shape as the access form the other agents use:
 * who are you, and what do you want to see. The submission emails us; we hand
 * out the demo credentials deliberately instead of leaving a shared account
 * open to anyone who finds the page.
 */
export function DemoRequestModal({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/v1/demo/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, message }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Something went wrong. Please try again.");
      }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    onClose();
    // reset a moment later so the modal doesn't visibly flip back mid-fade
    setTimeout(() => { setSent(false); setError(""); }, 250);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(8,8,14,0.72)", backdropFilter: "blur(4px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="w-full max-w-[440px] rounded-2xl p-8"
            style={{ background: "#14141f", border: "1px solid #2a2a3d" }}
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="text-center">
                <div className="text-4xl mb-3">🎧</div>
                <h2 className="text-xl font-bold text-white mb-2">Request received</h2>
                <p className="text-[#a9a9bd] text-sm leading-relaxed">
                  We&apos;ll email your demo credentials shortly — usually within a few hours.
                </p>
                <button
                  onClick={close}
                  className="mt-6 w-full h-11 rounded-xl font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#6c63ff,#8b5cf6)" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 className="text-xl font-bold text-white mb-1.5">Request a demo</h2>
                <p className="text-[#8a8a9e] text-sm leading-relaxed mb-5">
                  Tell us a little about you and we&apos;ll email you access to a fully-loaded
                  workspace — sample jobs, candidates and AI-scored interview reports.
                </p>

                {error && (
                  <div className="mb-4 px-3 py-2.5 rounded-lg text-sm"
                       style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.35)", color: "#ffb4b4" }}>
                    {error}
                  </div>
                )}

                <Field label="Your name" value={name} onChange={setName} placeholder="Jane Doe" required />
                <Field label="Work email" value={email} onChange={setEmail} placeholder="you@company.com" type="email" required />
                <Field label="Company (optional)" value={company} onChange={setCompany} placeholder="Acme Inc." />

                <label className="block text-xs font-bold text-[#a9a9bd] mt-3.5 mb-1.5">
                  What would you like to see?
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. I hire ~20 engineers a quarter and want to see the AI screening reports."
                  className="w-full rounded-xl px-3.5 py-3 text-[15px] text-white outline-none resize-y min-h-[88px]"
                  style={{ background: "#0f0f18", border: "1.5px solid #2f2f45" }}
                />

                <button
                  type="submit"
                  disabled={busy || !name.trim() || !email.trim()}
                  className="mt-5 w-full h-11 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#6c63ff,#8b5cf6)" }}
                >
                  {busy ? "Sending…" : "Request demo access"}
                </button>
                <button type="button" onClick={close}
                        className="w-full mt-3 text-xs text-[#6a6a80] hover:text-[#a9a9bd] transition-colors">
                  Cancel
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", required = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; type?: string; required?: boolean;
}) {
  return (
    <>
      <label className="block text-xs font-bold text-[#a9a9bd] mt-3.5 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl px-3.5 py-3 text-[15px] text-white outline-none"
        style={{ background: "#0f0f18", border: "1.5px solid #2f2f45" }}
      />
    </>
  );
}
