"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { candidateApi } from "@/lib/api-client";

const BENEFITS = [
  { icon: "📊", title: "All your applications, one dashboard", body: "Every company you’ve applied to — interviews, screenings, status — in real time." },
  { icon: "📅", title: "Never miss an interview", body: "Upcoming interviews & screening calls with one-tap join links." },
  { icon: "🌱", title: "Know how you did", body: "Personalized feedback after each interview: your strengths and what to improve." },
  { icon: "⚡", title: "Apply faster, everywhere", body: "Your details autofill for future roles — one profile, many companies." },
];

function BenefitsPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-center p-10 xl:p-14 text-white overflow-hidden"
      style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6C63FF 55%, #7c3aed 100%)" }}>
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      <div className="relative z-10 max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-bold">V</div>
          <span className="font-semibold">VoxHire</span>
        </div>
        <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-3">Your hiring journey,<br/>all in one place.</h2>
        <p className="text-white/80 mb-8">Create a free candidate account and stay on top of every application — across every company.</p>

        <ul className="space-y-5">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex gap-3">
              <span className="text-xl shrink-0">{b.icon}</span>
              <div>
                <p className="font-semibold text-sm">{b.title}</p>
                <p className="text-white/75 text-sm leading-relaxed">{b.body}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Tangible preview of what they'll get */}
        <div className="mt-9 rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-4">
          <p className="text-white/70 text-[11px] uppercase tracking-wider mb-2">A peek at your results</p>
          <div className="flex gap-2 mb-3">
            {[["Communication", 82], ["Confidence", 76], ["Clarity", 80]].map(([l, v]) => (
              <div key={l as string} className="flex-1 rounded-xl bg-white/10 py-2 text-center">
                <div className="text-lg font-bold">{v as number}</div>
                <div className="text-[10px] text-white/70">{l as string}</div>
              </div>
            ))}
          </div>
          <p className="text-emerald-200 text-xs">+ Clear, structured answers with strong examples</p>
        </div>
        <p className="text-white/55 text-xs mt-6">Free · 30 seconds · your results stay private to you.</p>
      </div>
    </div>
  );
}

function SignupForm() {
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
    candidateApi.prefill(token)
      .then((d) => { setName(d.name || ""); setEmail(d.email || ""); setPhone(d.phone || ""); setAlreadyRegistered(!!d.already_registered); })
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

  return (
    <div className="flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md">
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">V</div>
          <span className="font-semibold">VoxHire</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">Create your account</h1>
        <p className="text-foreground-3 text-sm mb-6">Track your applications, interviews, and results — for free.</p>

        {/* mobile benefits teaser */}
        <ul className="lg:hidden grid grid-cols-2 gap-2 mb-6">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex items-start gap-1.5 text-foreground-3 text-xs"><span>{b.icon}</span>{b.title}</li>
          ))}
        </ul>

        {loading ? (
          <div className="py-10 flex justify-center"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
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
                {submitting ? "Creating account…" : "Create free account"}
              </button>
            </form>
            <p className="text-center text-foreground-4 text-xs mt-4">
              Already registered? <Link href="/candidate/login" className="text-primary underline">Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CandidateSignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-2">
        <BenefitsPanel />
        <SignupForm />
      </div>
    </Suspense>
  );
}
