"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ org_name: "", admin_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

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
        body: JSON.stringify(form),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Signup failed"); }
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
          <h1 className="text-foreground text-xl font-semibold">Create your organization</h1>
          <p className="text-foreground-3 text-sm mt-1">Get started with VoxHire</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-base rounded-2xl p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          {[
            { key: "org_name", label: "Organization Name", placeholder: "Acme Corp", type: "text" },
            { key: "admin_name", label: "Your Name", placeholder: "Rahul Sharma", type: "text" },
            { key: "email", label: "Work Email", placeholder: "you@company.com", type: "email" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-foreground-3 text-xs mb-2 font-medium">{field.label}</label>
              <input
                type={field.type}
                value={form[field.key as keyof typeof form]}
                onChange={set(field.key)}
                placeholder={field.placeholder}
                required
                className="w-full bg-background border border-base rounded-xl px-4 py-3 text-foreground text-sm placeholder-foreground-5 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          ))}

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
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-4 hover:text-foreground-2 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-violet-500 hover:bg-violet-400 disabled:bg-violet-500/40 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</> : "Create Organization →"}
          </button>
        </form>

        <p className="text-center text-foreground-4 text-sm mt-5">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-violet-400 hover:text-violet-300 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
