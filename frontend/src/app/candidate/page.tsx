"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { candidateApi } from "@/lib/api-client";

function ScoreChip({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-surface-hi border border-base">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-foreground-4 text-[11px]">{label}</span>
    </div>
  );
}

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default function CandidatePortalPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<{ upcoming: any[]; past: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!candidateApi.isLoggedIn()) { router.replace("/candidate/login"); return; }
    Promise.all([candidateApi.me(), candidateApi.portal()])
      .then(([m, d]) => { setMe(m); setData(d); })
      .catch(() => { candidateApi.logout(); router.replace("/candidate/login"); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const upcoming = data?.upcoming ?? [];
  const past = data?.past ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-base bg-surface px-6 py-3 flex items-center gap-3 sticky top-0 z-20">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">V</div>
        <span className="font-semibold text-sm">VoxHire</span>
        <span className="text-foreground-4 text-xs">· My applications</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-foreground-3 text-sm hidden sm:inline">{me?.name}</span>
          <button onClick={() => { candidateApi.logout(); router.replace("/candidate/login"); }}
            className="text-foreground-3 hover:text-foreground text-sm">Log out</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-bold">Hi {me?.name?.split(" ")[0] || "there"} 👋</h1>
          <p className="text-foreground-3 text-sm">Your interviews, screenings and results across every company you've applied to.</p>
        </div>

        {/* Upcoming */}
        <section>
          <h2 className="text-foreground font-semibold text-sm mb-3">Upcoming</h2>
          {upcoming.length === 0 ? (
            <div className="bg-surface border border-base rounded-2xl p-6 text-center text-foreground-4 text-sm">Nothing scheduled right now.</div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((u, i) => (
                <div key={i} className="bg-surface border border-base rounded-2xl p-5 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-foreground font-semibold text-sm">{u.role}</p>
                    <p className="text-foreground-3 text-xs">{u.org} · {u.type === "screening" ? "Screening call" : `${u.interview_type} interview`}</p>
                    {u.scheduled_at && <p className="text-foreground-4 text-xs mt-1">Scheduled: {fmtDate(u.scheduled_at)}</p>}
                  </div>
                  <a href={u.type === "screening" ? u.screening_url : u.join_url} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap">
                    {u.type === "screening" ? "Start screening" : "Join interview"}
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past */}
        <section>
          <h2 className="text-foreground font-semibold text-sm mb-3">Past interviews</h2>
          {past.length === 0 ? (
            <div className="bg-surface border border-base rounded-2xl p-6 text-center text-foreground-4 text-sm">No completed interviews yet.</div>
          ) : (
            <div className="space-y-4">
              {past.map((p, i) => (
                <div key={i} className="bg-surface border border-base rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-foreground font-semibold">{p.role}</p>
                      <p className="text-foreground-3 text-xs">{p.org} · {p.interview_type} · {fmtDate(p.completed_at)}</p>
                    </div>
                    {!p.report_ready && <span className="text-amber-500 text-xs">Results pending</span>}
                  </div>

                  {p.report_ready && (
                    <>
                      <div className="flex gap-2 mb-4">
                        <ScoreChip label="Communication" value={p.scores?.communication} />
                        <ScoreChip label="Confidence" value={p.scores?.confidence} />
                        <ScoreChip label="Clarity" value={p.scores?.clarity} />
                      </div>
                      {p.strengths?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-emerald-400 text-xs font-semibold mb-1">What went well</p>
                          <ul className="space-y-1">
                            {p.strengths.map((s: string, j: number) => (
                              <li key={j} className="text-foreground-2 text-xs flex gap-2"><span className="text-emerald-400">+</span>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {p.areas_to_improve?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-amber-400 text-xs font-semibold mb-1">Areas to grow</p>
                          <ul className="space-y-1">
                            {p.areas_to_improve.map((s: string, j: number) => (
                              <li key={j} className="text-foreground-2 text-xs flex gap-2"><span className="text-amber-400">→</span>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {p.topics_covered?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.topics_covered.map((t: string) => (
                            <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">{t}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-foreground-5 text-xs pt-4">
          This is your personal view. Detailed hiring decisions stay with the recruiter.
        </p>
      </div>
    </div>
  );
}
