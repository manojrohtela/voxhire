"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

interface OrgInfo {
  name: string;
  slug: string;
  logo_url: string | null;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getOrgSlugFromHostname(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname; // "acme.localhost" or "localhost"
  const parts = hostname.split(".");
  if (parts.length >= 2 && parts[0] !== "www" && parts[0] !== "localhost") {
    return parts[0];
  }
  return null;
}

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showPass, setShowPass] = useState(false);
  const [org, setOrg]         = useState<OrgInfo | null>(null);

  // Detect org slug from subdomain or cookie, then fetch org details
  useEffect(() => {
    const slug = getOrgSlugFromHostname() ?? getCookie("voxhire_org_slug");
    if (!slug) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
    fetch(`${apiUrl}/api/v1/auth/org/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setOrg(data); })
      .catch(() => {});
  }, []);

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

      {/* ── Floating testimonial card — top right ── */}
      <div className="hidden lg:block fixed right-12 top-12 w-72 z-10">
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(30, 28, 40, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">
              HR
            </div>
            <p className="text-gray-300 text-sm italic leading-relaxed">
              &ldquo;The AI-driven candidate scoring has cut our hiring time by 40%.&rdquo;
              <span className="block text-gray-500 mt-1 not-italic text-xs">— HR Director, Global Tech</span>
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
            <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-gray-400 text-[11px]">Active Organizations</p>
              <p className="text-white font-bold text-xl">2,400+</p>
            </div>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 w-2/3 rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Main login form ── */}
      <div className="relative z-10 w-full max-w-[420px]">

        {/* Branding / Org context */}
        <div className="flex flex-col items-center mb-8 text-center">
          {org ? (
            <>
              {/* Org logo or initials */}
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-900/40 overflow-hidden">
                {org.logo_url ? (
                  <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-2xl font-bold">{org.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{org.name}</h1>
              <p className="text-gray-400 text-sm mt-1">Sign in to your workspace</p>
            </>
          ) : (
            <>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)", boxShadow: "0 8px 32px rgba(79,55,138,0.3)" }}
              >
                {/* Hub / network icon */}
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">VoxHire for Business</h1>
              <p className="text-gray-400 text-sm mt-1">Manage your organization&apos;s recruitment ecosystem</p>
            </>
          )}
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Work Email
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-lg text-white placeholder-gray-600 text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(109,86,186,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(109,86,186,0.15)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-300">Password</label>
                <a href="#" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">Forgot Password?</a>
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 pl-10 pr-11 rounded-lg text-white placeholder-gray-600 text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(109,86,186,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(109,86,186,0.15)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
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
                  Login to Workspace
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-white/5 flex flex-col items-center gap-3">
            <p className="text-gray-500 text-sm">
              New here?{" "}
              <a href="mailto:hello@voxhire.com" className="text-gray-300 hover:text-indigo-400 transition-colors font-medium">
                Contact sales for access
              </a>
            </p>
            <div className="flex items-center gap-4 text-gray-600 text-xs">
              <button className="flex items-center gap-1 hover:text-gray-400 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Contact Support
              </button>
              <span>·</span>
              <button className="hover:text-gray-400 transition-colors">EN</button>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-5 flex justify-center items-center gap-2 opacity-30 hover:opacity-60 transition-opacity">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
          <span className="text-gray-400 text-[11px] tracking-widest uppercase">Enterprise Secure</span>
        </div>
      </div>
    </div>
  );
}
