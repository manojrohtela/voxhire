"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Mock Data ─────────────────────────────────────────────────
const CANDIDATE = {
  id: "1",
  name: "Arjun Mehta",
  role: "Senior iOS Developer",
  email: "arjun.mehta@gmail.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, India",
  experience: "5.5 years",
  github: "github.com/arjunmehta",
  linkedin: "linkedin.com/in/arjunmehta",
  interviewDate: "June 2, 2026 · 2:30 PM",
  interviewDuration: "41 minutes",
  overallRating: "Strong" as const,
  summary:
    "Arjun demonstrated strong command of Swift fundamentals and architectural patterns. His understanding of Combine and reactive programming was notably deep. System design answers were structured but lacked distributed systems depth. Overall a strong hire for mid-to-senior iOS roles.",
  skills: [
    {
      skill: "Swift",
      rating: "Strong" as const,
      score: 88,
      questions: 6,
      notes: "Excellent understanding of value vs reference types, memory management, and generics.",
    },
    {
      skill: "MVVM",
      rating: "Strong" as const,
      score: 82,
      questions: 5,
      notes: "Clearly applies MVVM in production. Understood binding, ViewModel lifecycle, and testability.",
    },
    {
      skill: "Combine",
      rating: "Strong" as const,
      score: 79,
      questions: 4,
      notes: "Comfortable with publishers, subscribers, and error handling. Could improve on backpressure.",
    },
    {
      skill: "Concurrency",
      rating: "Medium" as const,
      score: 61,
      questions: 5,
      notes: "Understood async/await basics but struggled with actor isolation edge cases.",
    },
    {
      skill: "System Design",
      rating: "Weak" as const,
      score: 42,
      questions: 4,
      notes: "Designed a basic architecture but missed caching strategy and scalability considerations.",
    },
  ],
  strengths: [
    "Deep knowledge of Swift memory management and ARC",
    "Strong practical experience with Combine framework",
    "Clear communication — explained concepts with examples",
    "Resume claims validated — all stated skills were confirmed",
  ],
  weakAreas: [
    "System design lacks distributed systems awareness",
    "Actor isolation in Swift Concurrency needs improvement",
    "No experience with modular app architecture at scale",
  ],
  transcript: [
    { speaker: "ai" as const, text: "Hello Arjun, welcome to your VoxHire technical interview. My name is Vox and I'll be your interviewer today. We have about 45 minutes and we'll cover Swift, MVVM, Combine, Concurrency, and System Design. Shall we begin?", time: "00:00" },
    { speaker: "candidate" as const, text: "Yes, absolutely. I'm ready.", time: "00:18" },
    { speaker: "ai" as const, text: "Great. Let's start with Swift fundamentals. Can you explain the difference between a class and a struct in Swift, and when you'd prefer one over the other?", time: "00:22" },
    { speaker: "candidate" as const, text: "Sure. The key difference is that classes are reference types and structs are value types. When you assign a struct to a new variable, you get a copy — the original is unaffected. With classes, both variables point to the same object in memory. I prefer structs for data models because they're thread-safe by default and avoid unintended side effects. Classes make sense when you need identity, inheritance, or Objective-C interoperability.", time: "00:35" },
    { speaker: "ai" as const, text: "Good explanation. Let's go deeper — how does ARC handle retain cycles, and how do you typically break them in practice?", time: "01:12" },
    { speaker: "candidate" as const, text: "ARC tracks the reference count of each object. A retain cycle happens when two objects hold strong references to each other — neither can be deallocated. The most common pattern I see is closures capturing self strongly. I break these using weak or unowned references. I use weak when self could be nil during the closure's lifetime, and unowned when I'm confident self will always be alive — like in a view controller referencing its own view model.", time: "01:24" },
    { speaker: "ai" as const, text: "Good. Let's move to MVVM. How do you handle the binding between a ViewModel and a View in your projects?", time: "02:10" },
    { speaker: "candidate" as const, text: "I use Combine for that. My ViewModel exposes @Published properties and the View subscribes to them using sink or assigns them directly with the $ syntax in SwiftUI. For UIKit projects, I create a custom binding layer using PassthroughSubject for one-time events and CurrentValueSubject for state. I try to keep the ViewModel completely free of UIKit imports so it's fully testable.", time: "02:28" },
    { speaker: "ai" as const, text: "Now, let me ask you about system design. Design a photo feed application like Instagram for iOS — walk me through your high-level architecture.", time: "08:45" },
    { speaker: "candidate" as const, text: "I'd start with a modular architecture — separate modules for Feed, Profile, Stories, and a Core networking module. For the feed, I'd use a UICollectionView with compositional layout. Images would be loaded lazily and cached using NSCache with a disk fallback. The networking layer would use URLSession with Combine publishers. For state management, I'd use a Redux-like pattern with a central app store.", time: "09:02" },
    { speaker: "ai" as const, text: "What caching strategy would you use for the image feed, and how would you handle offline mode?", time: "10:15" },
    { speaker: "candidate" as const, text: "For caching I'd use a two-tier approach — in-memory NSCache for recent images and disk cache for persistence. For offline mode I'd store the last fetched feed JSON locally using CoreData and display cached content when network is unavailable. I haven't worked extensively with distributed caching at the server side though.", time: "10:34" },
  ],
  violations: [
    { type: "Tab Switch", count: 1, time: "14:32" },
  ],
};

const RATING_STYLE = {
  Strong: { badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", bar: "bg-emerald-500" },
  Medium: { badge: "text-amber-400 bg-amber-500/10 border-amber-500/20", bar: "bg-amber-400" },
  Weak: { badge: "text-red-400 bg-red-500/10 border-red-500/20", bar: "bg-red-500" },
};

type Tab = "report" | "transcript" | "recording";

export default function CandidateDetailPage({ params }: { params: { candidateId: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>("report");
  const c = CANDIDATE;

  return (
    <div className="min-h-full bg-[#07070d]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 px-7 py-4 border-b border-white/[0.05] bg-[#07070d]/90 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-white/25 hover:text-white/50 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-white/10">/</span>
            <span className="text-white/30 text-sm">Candidates</span>
            <span className="text-white/10">/</span>
            <span className="text-white/70 text-sm">{c.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-white/[0.08] hover:border-white/20 text-white/40 hover:text-white/60 rounded-lg text-xs transition-colors">
              Download Report
            </button>
            <button className="px-3 py-1.5 bg-violet-500 hover:bg-violet-400 text-white rounded-lg text-xs font-medium transition-colors">
              Share with Hiring Manager
            </button>
          </div>
        </div>
      </div>

      <div className="px-7 py-6 max-w-6xl">
        {/* Candidate header */}
        <div className="flex items-start gap-6 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-600/30 border border-violet-500/20 flex items-center justify-center text-violet-300 text-2xl font-bold shrink-0">
            {c.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-white text-xl font-semibold">{c.name}</h1>
              <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${RATING_STYLE[c.overallRating].badge}`}>
                {c.overallRating} Candidate
              </span>
              {c.violations.length > 0 && (
                <span className="px-2.5 py-1 rounded-lg border text-xs font-medium text-amber-400 bg-amber-500/10 border-amber-500/20">
                  ⚠ {c.violations.length} violation
                </span>
              )}
            </div>
            <p className="text-white/40 text-sm mt-1">{c.role} · {c.experience}</p>
            <div className="flex gap-4 mt-2 flex-wrap">
              {[
                { icon: "✉", val: c.email },
                { icon: "📍", val: c.location },
                { icon: "🕐", val: c.interviewDate },
                { icon: "⏱", val: c.interviewDuration },
              ].map((item) => (
                <span key={item.val} className="text-white/25 text-xs flex items-center gap-1">
                  <span>{item.icon}</span>{item.val}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/[0.05]">
          {(["report", "transcript", "recording"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-all border-b-2 -mb-px ${
                activeTab === tab
                  ? "text-violet-300 border-violet-500"
                  : "text-white/25 border-transparent hover:text-white/50"
              }`}
            >
              {tab === "report" ? "📊 Evaluation Report" : tab === "transcript" ? "📝 Transcript" : "🎥 Recording"}
            </button>
          ))}
        </div>

        {/* ── REPORT TAB ─────────────────────────────────────────── */}
        {activeTab === "report" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left — Skills + Summary */}
            <div className="lg:col-span-2 space-y-5">
              {/* AI Summary */}
              <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-md bg-violet-500/20 border border-violet-500/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h2 className="text-white/60 text-sm font-medium">AI Evaluation Summary</h2>
                </div>
                <p className="text-white/70 text-sm leading-relaxed">{c.summary}</p>
              </div>

              {/* Skill Breakdown */}
              <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-5">
                <h2 className="text-white/60 text-sm font-medium mb-4">Skill Breakdown</h2>
                <div className="space-y-4">
                  {c.skills.map((s) => {
                    const style = RATING_STYLE[s.rating];
                    return (
                      <div key={s.skill} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-white/70 text-sm font-medium">{s.skill}</span>
                            <span className={`px-2 py-0.5 rounded border text-xs ${style.badge}`}>{s.rating}</span>
                            <span className="text-white/20 text-xs">{s.questions} questions</span>
                          </div>
                          <span className="text-white/40 text-sm font-mono">{s.score}/100</span>
                        </div>
                        {/* Score bar */}
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${style.bar}`}
                            style={{ width: `${s.score}%` }}
                          />
                        </div>
                        <p className="text-white/25 text-xs leading-relaxed">{s.notes}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Violations */}
              {c.violations.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                  <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">Anti-Cheat Violations</p>
                  <div className="space-y-2">
                    {c.violations.map((v, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-white/40 text-sm">{v.type}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-white/20 text-xs">at {v.time}</span>
                          <span className="text-amber-400 text-xs">{v.count}×</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-white/20 text-xs mt-3">Minor violation — not severe enough to terminate. Review recording for context.</p>
                </div>
              )}
            </div>

            {/* Right — Verdict + Details */}
            <div className="space-y-4">
              {/* Overall verdict */}
              <div className={`rounded-2xl p-5 border ${RATING_STYLE[c.overallRating].badge}`}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 opacity-60">Overall Verdict</p>
                <p className={`text-4xl font-bold ${RATING_STYLE[c.overallRating].badge.split(" ")[0]}`}>
                  {c.overallRating}
                </p>
                <p className="text-white/30 text-xs mt-2">Recommended for next round</p>

                {/* Radar-style skill summary */}
                <div className="mt-4 space-y-2">
                  {c.skills.map((s) => (
                    <div key={s.skill} className="flex items-center gap-2">
                      <span className="text-white/30 text-xs w-24 shrink-0">{s.skill}</span>
                      <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${RATING_STYLE[s.rating].bar}`} style={{ width: `${s.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths */}
              <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-4">
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">Strengths</p>
                <ul className="space-y-2">
                  {c.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/50 text-xs leading-relaxed">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weak Areas */}
              <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-4">
                <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-3">Weak Areas</p>
                <ul className="space-y-2">
                  {c.weakAreas.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/50 text-xs leading-relaxed">
                      <span className="text-red-400 mt-0.5 shrink-0">✗</span>{w}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-medium rounded-xl text-sm transition-colors">
                  ✓ Move to Next Round
                </button>
                <button className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-medium rounded-xl text-sm transition-colors">
                  ✗ Reject Candidate
                </button>
                <button className="w-full py-3 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/40 hover:text-white/60 font-medium rounded-xl text-sm transition-colors">
                  ↗ Share Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSCRIPT TAB ──────────────────────────────────────── */}
        {activeTab === "transcript" && (
          <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <h2 className="text-white/60 text-sm font-medium">Full Interview Transcript</h2>
              <span className="text-white/20 text-xs">{c.transcript.length} exchanges · {c.interviewDuration}</span>
            </div>
            <div className="p-5 space-y-5 max-h-[600px] overflow-y-auto">
              {c.transcript.map((entry, i) => (
                <div key={i} className={`flex gap-4 ${entry.speaker === "candidate" ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-1 border ${
                    entry.speaker === "ai"
                      ? "bg-violet-500/20 border-violet-500/20 text-violet-300"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  }`}>
                    {entry.speaker === "ai" ? "AI" : "A"}
                  </div>
                  <div className={`max-w-[75%] flex flex-col gap-1 ${entry.speaker === "candidate" ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      entry.speaker === "ai"
                        ? "bg-[#13131f] border border-white/[0.06] text-white/60 rounded-tl-sm"
                        : "bg-violet-500/10 border border-violet-500/15 text-white/80 rounded-tr-sm"
                    }`}>
                      {entry.text}
                    </div>
                    <span className="text-white/15 text-xs px-1">{entry.time}</span>
                  </div>
                </div>
              ))}

              {/* Ellipsis — full transcript */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-white/[0.05]" />
                <span className="text-white/15 text-xs">transcript continues for {c.interviewDuration}</span>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>
            </div>
          </div>
        )}

        {/* ── RECORDING TAB ───────────────────────────────────────── */}
        {activeTab === "recording" && (
          <div className="space-y-5">
            <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl overflow-hidden">
              {/* Mock video player */}
              <div className="aspect-video bg-[#070710] flex items-center justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-white/10 transition-colors">
                      <svg className="w-7 h-7 text-white/40 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <p className="text-white/25 text-sm">Recording available</p>
                    <p className="text-white/15 text-xs mt-1">{c.interviewDuration} · 720p</p>
                  </div>
                </div>
                {/* Fake timeline */}
                <div className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-black/60">
                  <div className="h-1 bg-white/10 rounded-full mb-3">
                    <div className="h-full w-[32%] bg-violet-500 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/30">
                    <span>13:12</span>
                    <span>{c.interviewDuration}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recording metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Duration", value: c.interviewDuration },
                { label: "Resolution", value: "720p HD" },
                { label: "Format", value: "WebM / VP9" },
                { label: "Recorded", value: c.interviewDate },
              ].map((item) => (
                <div key={item.label} className="bg-[#0c0c14] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-white/20 text-xs mb-1">{item.label}</p>
                  <p className="text-white/60 text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
