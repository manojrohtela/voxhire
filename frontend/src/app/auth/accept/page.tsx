"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AcceptInvitePage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [form, setForm] = useState({ name: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (!token) setError("Invalid invite link — token missing.");
  }, [token]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: form.name, password: form.password }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070d] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <h1 className="text-white text-xl font-semibold">Accept your invite</h1>
          <p className="text-white/30 text-sm mt-1">Set up your VoxHire account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0c0c14] border border-white/[0.07] rounded-2xl p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-white/40 text-xs mb-2 font-medium">Your Name</label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              placeholder="Priya Sharma"
              required
              className="w-full bg-[#07070d] border border-white/[0.08] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/15 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-white/40 text-xs mb-2 font-medium">Set Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder="Min 8 characters"
                required
                className="w-full bg-[#07070d] border border-white/[0.08] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/15 focus:outline-none focus:border-violet-500/50 transition-colors pr-10"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full py-3 bg-violet-500 hover:bg-violet-400 disabled:bg-violet-500/40 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Setting up...</> : "Join Organization →"}
          </button>
        </form>
      </div>
    </div>
  );
}
