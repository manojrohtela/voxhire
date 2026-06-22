"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { candidateApi } from "@/lib/api-client";

export default function CandidateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await candidateApi.login(email.trim(), password);
      router.push("/candidate");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface border border-base rounded-2xl p-7">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">V</div>
          <span className="font-semibold">VoxHire</span>
        </div>
        <h1 className="text-2xl font-bold mt-3 mb-5">Candidate login</h1>
        <form onSubmit={submit} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required
            className="w-full px-3 py-2.5 rounded-xl bg-surface-hi border border-base text-foreground text-sm focus:border-primary focus:outline-none" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required
            className="w-full px-3 py-2.5 rounded-xl bg-surface-hi border border-base text-foreground text-sm focus:border-primary focus:outline-none" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="text-center text-foreground-4 text-xs mt-4">
          Your account is created from an interview invite link.
        </p>
      </div>
    </div>
  );
}
