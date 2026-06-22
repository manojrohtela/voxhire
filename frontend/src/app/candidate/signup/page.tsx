"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { candidateApi } from "@/lib/api-client";

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError("This sign-up link is invalid."); setLoading(false); return; }
    candidateApi
      .prefill(token)
      .then((d) => {
        setName(d.name || ""); setEmail(d.email || ""); setPhone(d.phone || "");
        setAlreadyRegistered(!!d.already_registered);
      })
      .catch(() => setError("We couldn't recognize this link."))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await candidateApi.signup({ token, name: name.trim(), phone: phone.trim(), password });
      router.push("/candidate");
    } catch (err: any) {
      setError(err?.message || "Sign-up failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-base rounded-2xl p-7">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">V</div>
          <span className="font-semibold">VoxHire</span>
        </div>
        <h1 className="text-2xl font-bold mt-3 mb-1">Create your candidate account</h1>
        <p className="text-foreground-3 text-sm mb-5">Track your applications, upcoming interviews, and results — all in one place.</p>

        {alreadyRegistered && (
          <div className="mb-4 text-sm bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl px-4 py-3">
            You already have an account with this email.{" "}
            <Link href="/candidate/login" className="underline font-medium">Log in instead →</Link>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-foreground-3 text-xs font-medium mb-1.5">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-xl bg-surface-hi border border-base text-foreground text-sm focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="block text-foreground-3 text-xs font-medium mb-1.5">Email <span className="text-foreground-5">(locked)</span></label>
            <input value={email} readOnly disabled
              className="w-full px-3 py-2.5 rounded-xl bg-ink/5 border border-base text-foreground-3 text-sm cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-foreground-3 text-xs font-medium mb-1.5">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-xl bg-surface-hi border border-base text-foreground text-sm focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="block text-foreground-3 text-xs font-medium mb-1.5">Password <span className="text-foreground-5">(6+ characters)</span></label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-hi border border-base text-foreground text-sm focus:border-primary focus:outline-none" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={submitting || alreadyRegistered}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-foreground-4 text-xs mt-4">
          Already registered? <Link href="/candidate/login" className="text-primary underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default function CandidateSignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SignupInner />
    </Suspense>
  );
}
