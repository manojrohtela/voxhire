"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000";

function toSubdomain(orgName: string): string {
  return orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function SignupPage() {
  const [form, setForm]       = useState({ org_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showPass, setShowPass] = useState(false);
  const [created, setCreated] = useState<{ orgName: string; subdomain: string } | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_name:   form.org_name,
          admin_name: form.org_name,   // org name used as admin identifier
          email:      form.email,
          password:   form.password,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Signup failed"); }
      setCreated({ orgName: form.org_name, subdomain: toSubdomain(form.org_name) });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Success screen ───────────────────────────────────────────────
  if (created) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-foreground text-xl font-bold mb-1">Organization created</h1>
          <p className="text-foreground-3 text-sm mb-6">{created.orgName} is ready on VoxHire.</p>

          <div className="bg-surface border border-base rounded-2xl p-5 text-left mb-5">
            <p className="text-foreground-3 text-xs font-medium mb-2">Your organization URL</p>
            <div className="flex items-center gap-2 bg-background border border-base rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-violet-400 text-sm font-mono font-medium truncate">
                {created.subdomain}.{APP_DOMAIN}
              </span>
            </div>
            <p className="text-foreground-4 text-xs mt-2 leading-relaxed">
              Share this URL with your recruiters. They'll sign in here to access the dashboard.
            </p>
          </div>

          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 w-full py-3 bg-violet-500 hover:bg-violet-400 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Continue to sign in →
          </Link>
        </div>
      </div>
    );
  }

  // ─── Create org form ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <h1 className="text-foreground text-xl font-semibold">Create organization</h1>
          <p className="text-foreground-3 text-sm mt-1">Set up your company on VoxHire</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-base rounded-2xl p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-foreground-3 text-xs mb-2 font-medium">Organization Name</label>
            <input
              type="text"
              value={form.org_name}
              onChange={set("org_name")}
              placeholder="Acme Corp"
              required
              className="w-full bg-background border border-base rounded-xl px-4 py-3 text-foreground text-sm placeholder-foreground-5 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
            {form.org_name && (
              <p className="text-foreground-4 text-xs mt-1.5 flex items-center gap-1">
                <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /></svg>
                <span className="text-violet-400">{toSubdomain(form.org_name)}.{APP_DOMAIN}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-foreground-3 text-xs mb-2 font-medium">Admin Email</label>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="admin@acmecorp.com"
              required
              className="w-full bg-background border border-base rounded-xl px-4 py-3 text-foreground text-sm placeholder-foreground-5 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-foreground-3 text-xs mb-2 font-medium">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder="Min 8 characters"
                required
                className="w-full bg-background border border-base rounded-xl px-4 py-3 text-foreground text-sm placeholder-foreground-5 focus:outline-none focus:border-violet-500/50 transition-colors pr-10"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-4 hover:text-foreground-2 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-violet-500 hover:bg-violet-400 disabled:bg-violet-500/40 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</>
              : "Create Organization →"
            }
          </button>
        </form>

        <p className="text-center text-foreground-4 text-xs mt-5">
          VoxHire admin access only.
        </p>
      </div>
    </div>
  );
}
