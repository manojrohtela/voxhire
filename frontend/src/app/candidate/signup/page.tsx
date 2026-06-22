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

const TREND = [
  { label: "1st", h: 42, c: "from-sky-400 to-sky-500" },
  { label: "2nd", h: 56, c: "from-violet-400 to-violet-500" },
  { label: "3rd", h: 64, c: "from-fuchsia-400 to-fuchsia-500" },
  { label: "4th", h: 78, c: "from-amber-400 to-orange-500" },
  { label: "Now", h: 92, c: "from-emerald-400 to-emerald-500" },
];

function BenefitsPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-center p-10 xl:p-12 text-white overflow-hidden"
      style={{ background: "linear-gradient(135deg, #4338ca 0%, #7c3aed 45%, #db2777 100%)" }}>
      {/* colorful decorative blobs */}
      <div className="absolute -top-20 -right-16 w-72 h-72 bg-cyan-400/25 rounded-full blur-3xl" />
      <div className="absolute bottom-0 -left-20 w-72 h-72 bg-amber-400/20 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-56 h-56 bg-emerald-400/15 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">V</div>
          <span className="font-semibold">VoxHire</span>
        </div>
        <h2 className="text-3xl xl:text-[2.4rem] font-bold leading-[1.1] mb-2">
          Watch yourself <span className="bg-gradient-to-r from-amber-200 to-emerald-200 bg-clip-text text-transparent">get better.</span>
        </h2>
        <p className="text-white/85 text-sm mb-6">Track every application, get feedback after each interview, and grow with every attempt.</p>

        {/* Improvement graph */}
        <div className="rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-4 mb-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/80 text-xs font-medium">Your interview scores</p>
            <span className="text-emerald-200 text-xs font-semibold bg-emerald-400/15 px-2 py-0.5 rounded-full">↑ improving</span>
          </div>
          <div className="flex items-end justify-between gap-2 h-28">
            {TREND.map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className={`w-full rounded-t-md bg-gradient-to-t ${b.c}`} style={{ height: `${b.h}%` }} />
                <span className="text-[10px] text-white/60 mt-1.5">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Colorful stat tiles */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { v: "All", l: "companies, one place", c: "from-sky-400/30 to-sky-500/10" },
            { v: "Every", l: "interview, feedback", c: "from-emerald-400/30 to-emerald-500/10" },
            { v: "Free", l: "30-sec setup", c: "from-amber-400/30 to-orange-500/10" },
          ].map((s) => (
            <div key={s.l} className={`rounded-xl bg-gradient-to-br ${s.c} border border-white/15 p-3 text-center`}>
              <div className="text-base font-extrabold">{s.v}</div>
              <div className="text-[10px] text-white/75 leading-tight mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className="rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-4">
          <div className="flex items-center gap-1 mb-2 text-amber-300">{"★★★★★"}</div>
          <p className="text-white/90 text-sm leading-relaxed">“I finally knew where I stood after every interview — and exactly what to improve. Landed my offer in 3 weeks.”</p>
          <div className="flex items-center gap-2.5 mt-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-500 flex items-center justify-center text-xs font-bold">PR</div>
            <div>
              <p className="text-sm font-semibold leading-none">Priya R.</p>
              <p className="text-white/60 text-[11px]">Frontend Engineer</p>
            </div>
          </div>
        </div>

        {/* mock company chips */}
        <div className="flex items-center gap-2 mt-5">
          <span className="text-white/50 text-[11px]">Used across</span>
          {[["A", "bg-rose-400/30"], ["N", "bg-sky-400/30"], ["Z", "bg-emerald-400/30"], ["+", "bg-white/15"]].map(([t, c], i) => (
            <span key={i} className={`w-6 h-6 rounded-full ${c} border border-white/20 flex items-center justify-center text-[11px] font-bold`}>{t}</span>
          ))}
          <span className="text-white/50 text-[11px]">companies</span>
        </div>
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
