"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function AdminLoginPage() {
  const { login } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0e14] flex items-center justify-center p-4 overflow-hidden">
      {/* Subtle radial glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 40%, rgba(109, 86, 186, 0.12) 0%, transparent 55%)" }}
      />

      {/* ── Floating notice card — top right ── */}
      <div className="hidden lg:block fixed right-12 top-12 w-72 z-10">
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(30, 28, 40, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-900/60 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              This portal is for <span className="text-indigo-400 font-medium">platform administrators</span> only.
              <span className="block text-gray-500 mt-1 text-xs">Unauthorised access is prohibited.</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Floating stats card — bottom left ── */}
      <div className="hidden lg:block fixed left-10 bottom-12 w-56 z-10">
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(30, 28, 40, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-gray-400 text-[11px]">Platform Organizations</p>
              <p className="text-white font-bold text-xl">2,400+</p>
            </div>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 w-3/4 rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Main login form ── */}
      <div className="relative z-10 w-full max-w-[420px]">

        {/* Branding */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)", boxShadow: "0 8px 32px rgba(79,55,138,0.3)" }}
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
          <p className="text-gray-400 text-sm mt-1">VoxHire Platform Administration</p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: "rgba(22, 20, 32, 0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-gray-300 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@voxhire.com"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-lg text-white placeholder-gray-600 text-sm outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(109,86,186,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(109,86,186,0.15)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";  e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="admin-password" className="text-sm font-medium text-gray-300">Password</label>
                <a href="#" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">Forgot Password?</a>
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="admin-password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 pl-10 pr-11 rounded-lg text-white placeholder-gray-600 text-sm outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(109,86,186,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(109,86,186,0.15)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";  e.currentTarget.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
              style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)", boxShadow: "0 4px 16px rgba(79,55,138,0.35)" }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In as Admin
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-white/5 flex flex-col items-center gap-3">
            <div className="flex items-center gap-4 text-gray-600 text-xs">
              <button className="flex items-center gap-1 hover:text-gray-400 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Contact Support
              </button>
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-5 flex justify-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-400 text-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Organization Login
          </Link>
        </div>

        {/* Security badge */}
        <div className="mt-4 flex justify-center items-center gap-2 opacity-30 hover:opacity-60 transition-opacity">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
          <span className="text-gray-400 text-[11px] tracking-widest uppercase">Enterprise Secure</span>
        </div>
      </div>
    </div>
  );
}
