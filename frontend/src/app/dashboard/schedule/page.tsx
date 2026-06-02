"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────
interface TimeSlot {
  time: string;
  available: boolean;
}

interface ScheduledInterview {
  candidateId: string;
  candidateName: string;
  role: string;
  date: string;
  time: string;
  duration: number;
  link: string;
  emailSent: boolean;
}

// ─── Mock Candidates ────────────────────────────────────────────
const PENDING_CANDIDATES = [
  { id: "5", name: "Vikram Nair", role: "DevOps Engineer", email: "vikram.nair@gmail.com", skills: ["AWS", "Kubernetes", "Terraform"] },
  { id: "6", name: "Ananya Reddy", role: "Frontend Developer", email: "ananya.reddy@gmail.com", skills: ["Vue.js", "TypeScript", "Tailwind"] },
  { id: "9", name: "Rahul Desai", role: "Backend Engineer", email: "rahul.desai@gmail.com", skills: ["Go", "PostgreSQL", "Docker"] },
  { id: "10", name: "Kavya Pillai", role: "Data Scientist", email: "kavya.pillai@gmail.com", skills: ["Python", "PyTorch", "SQL"] },
];

const DURATIONS = [30, 45, 60, 90];

const TIME_SLOTS: TimeSlot[] = [
  { time: "09:00 AM", available: true },
  { time: "09:30 AM", available: false },
  { time: "10:00 AM", available: true },
  { time: "10:30 AM", available: true },
  { time: "11:00 AM", available: false },
  { time: "11:30 AM", available: true },
  { time: "12:00 PM", available: true },
  { time: "12:30 PM", available: false },
  { time: "02:00 PM", available: true },
  { time: "02:30 PM", available: true },
  { time: "03:00 PM", available: true },
  { time: "03:30 PM", available: false },
  { time: "04:00 PM", available: true },
  { time: "04:30 PM", available: true },
  { time: "05:00 PM", available: true },
  { time: "05:30 PM", available: false },
];

// ─── Already scheduled (mock) ───────────────────────────────────
const ALREADY_SCHEDULED: ScheduledInterview[] = [
  {
    candidateId: "1", candidateName: "Arjun Mehta", role: "Senior iOS Developer",
    date: "Jun 2", time: "02:30 PM", duration: 45,
    link: "https://voxhire.ai/i/sess_arj2026", emailSent: true,
  },
  {
    candidateId: "2", candidateName: "Priya Sharma", role: "Full Stack Engineer",
    date: "Jun 2", time: "04:00 PM", duration: 45,
    link: "https://voxhire.ai/i/sess_pri2026", emailSent: true,
  },
  {
    candidateId: "5", candidateName: "Vikram Nair", role: "DevOps Engineer",
    date: "Jun 3", time: "11:00 AM", duration: 60,
    link: "https://voxhire.ai/i/sess_vik2026", emailSent: true,
  },
];

function generateSessionId() {
  return "sess_" + Math.random().toString(36).substring(2, 10);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ─── Component ─────────────────────────────────────────────────
export default function SchedulePage() {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<typeof PENDING_CANDIDATES[0] | null>(null);
  const [duration, setDuration] = useState(45);
  const [step, setStep] = useState<"pick" | "confirm" | "done">("pick");
  const [scheduled, setScheduled] = useState<ScheduledInterview[]>(ALREADY_SCHEDULED);
  const [newInterview, setNewInterview] = useState<ScheduledInterview | null>(null);
  const [copied, setCopied] = useState(false);

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  const dateLabel = useMemo(() => {
    if (!selectedDay) return "";
    const d = new Date(calYear, calMonth, selectedDay);
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [calYear, calMonth, selectedDay]);

  const handlePrevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDay(null); setSelectedSlot(null);
  };

  const handleNextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDay(null); setSelectedSlot(null);
  };

  const handleSchedule = () => {
    if (!selectedCandidate || !selectedDay || !selectedSlot) return;
    const sessionId = generateSessionId();
    const interview: ScheduledInterview = {
      candidateId: selectedCandidate.id,
      candidateName: selectedCandidate.name,
      role: selectedCandidate.role,
      date: `${MONTH_NAMES[calMonth].slice(0, 3)} ${selectedDay}`,
      time: selectedSlot,
      duration,
      link: `https://voxhire.ai/i/${sessionId}`,
      emailSent: true,
    };
    setNewInterview(interview);
    setScheduled(prev => [...prev, interview]);
    setStep("done");
  };

  const handleCopy = () => {
    if (newInterview) {
      navigator.clipboard.writeText(newInterview.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const canProceed = selectedCandidate && selectedDay && selectedSlot;

  return (
    <div className="min-h-full bg-[#07070d]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 px-7 py-4 border-b border-white/[0.05] bg-[#07070d]/90 backdrop-blur flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-lg tracking-tight">Schedule Interview</h1>
          <p className="text-white/25 text-xs mt-0.5">Pick a candidate, date, and time — AI will handle the rest</p>
        </div>
        <Link href="/dashboard" className="text-white/25 hover:text-white/50 text-sm transition-colors flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
      </div>

      <div className="px-7 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">

        {/* ── LEFT: Scheduler ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {step === "done" && newInterview ? (
            /* ── SUCCESS STATE ─────────────────────────────────── */
            <div className="bg-[#0c0c14] border border-emerald-500/20 rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-white text-xl font-semibold mb-1">Interview Scheduled!</h2>
              <p className="text-white/40 text-sm mb-6">
                {newInterview.candidateName} · {newInterview.date} at {newInterview.time} · {newInterview.duration} min
              </p>

              {/* Interview link */}
              <div className="bg-[#07070d] border border-white/[0.07] rounded-xl px-4 py-3 flex items-center gap-3 mb-4 text-left">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/20 text-xs mb-0.5">Interview Link</p>
                  <p className="text-white/70 text-sm font-mono truncate">{newInterview.link}</p>
                </div>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/[0.05] text-white/40 hover:text-white/60 border border-white/[0.07]"
                  }`}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* Email status */}
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm mb-6">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Confirmation email sent to candidate
              </div>

              <button
                onClick={() => { setStep("pick"); setSelectedCandidate(null); setSelectedDay(today.getDate()); setSelectedSlot(null); setNewInterview(null); }}
                className="px-6 py-2.5 bg-white/[0.05] hover:bg-white/10 border border-white/[0.08] text-white/50 hover:text-white/70 rounded-xl text-sm transition-colors"
              >
                Schedule Another
              </button>
            </div>
          ) : step === "confirm" ? (
            /* ── CONFIRM STATE ─────────────────────────────────── */
            <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <h2 className="text-white font-semibold mb-2">Confirm Schedule</h2>

              {[
                { label: "Candidate", value: `${selectedCandidate?.name} — ${selectedCandidate?.role}` },
                { label: "Date", value: dateLabel },
                { label: "Time", value: selectedSlot! },
                { label: "Duration", value: `${duration} minutes` },
                { label: "Interview Type", value: "AI Video Interview (Browser)" },
                { label: "Email", value: selectedCandidate?.email || "" },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between py-3 border-b border-white/[0.04] last:border-0">
                  <span className="text-white/30 text-sm">{item.label}</span>
                  <span className="text-white/70 text-sm font-medium text-right max-w-[60%]">{item.value}</span>
                </div>
              ))}

              <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl px-4 py-3 text-xs text-white/40 leading-relaxed">
                A unique interview link will be generated and emailed to the candidate. The link expires after the scheduled time.
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep("pick")} className="flex-1 py-3 border border-white/[0.08] text-white/40 hover:text-white/60 rounded-xl text-sm transition-colors">
                  ← Back
                </button>
                <button onClick={handleSchedule} className="flex-1 py-3 bg-violet-500 hover:bg-violet-400 text-white font-semibold rounded-xl text-sm transition-colors">
                  Confirm & Send Link
                </button>
              </div>
            </div>
          ) : (
            /* ── PICK STATE ─────────────────────────────────────── */
            <>
              {/* Step 1: Candidate */}
              <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">1</div>
                  <h2 className="text-white/70 text-sm font-medium">Select Candidate</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PENDING_CANDIDATES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCandidate(c)}
                      className={`text-left px-4 py-3 rounded-xl border transition-all ${
                        selectedCandidate?.id === c.id
                          ? "bg-violet-500/10 border-violet-500/30"
                          : "bg-[#0a0a12] border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/15 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0">
                          {c.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white/80 text-sm font-medium truncate">{c.name}</p>
                          <p className="text-white/30 text-xs truncate">{c.role}</p>
                        </div>
                        {selectedCandidate?.id === c.id && (
                          <svg className="w-4 h-4 text-violet-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex gap-1 mt-2 ml-11 flex-wrap">
                        {c.skills.slice(0, 3).map(s => (
                          <span key={s} className="text-xs px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-white/25">{s}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Calendar */}
              <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">2</div>
                  <h2 className="text-white/70 text-sm font-medium">Pick a Date</h2>
                </div>

                {/* Calendar header */}
                <div className="flex items-center justify-between mb-4">
                  <button onClick={handlePrevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-white/70 text-sm font-medium">{MONTH_NAMES[calMonth]} {calYear}</span>
                  <button onClick={handleNextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                {/* Day names */}
                <div className="grid grid-cols-7 mb-2">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-center text-white/20 text-xs py-1">{d}</div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    const isPast = new Date(calYear, calMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const isSelected = day === selectedDay;
                    const isWeekend = new Date(calYear, calMonth, day).getDay() === 0 || new Date(calYear, calMonth, day).getDay() === 6;

                    return (
                      <button
                        key={day}
                        disabled={isPast || isWeekend}
                        onClick={() => { setSelectedDay(day); setSelectedSlot(null); }}
                        className={`aspect-square rounded-lg text-sm font-medium transition-all flex items-center justify-center ${
                          isSelected
                            ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                            : isToday
                            ? "border border-violet-500/40 text-violet-300"
                            : isPast || isWeekend
                            ? "text-white/[0.12] cursor-not-allowed"
                            : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Time Slot */}
              {selectedDay && (
                <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">3</div>
                    <h2 className="text-white/70 text-sm font-medium">Select Time Slot</h2>
                    <span className="text-white/20 text-xs ml-auto">{dateLabel}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot.time)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                          selectedSlot === slot.time
                            ? "bg-violet-500 text-white border border-violet-400"
                            : slot.available
                            ? "bg-[#0a0a12] border border-white/[0.07] text-white/50 hover:border-violet-500/30 hover:text-white/80"
                            : "bg-[#0a0a12] border border-white/[0.04] text-white/[0.12] cursor-not-allowed line-through"
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Duration */}
              {selectedSlot && (
                <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">4</div>
                    <h2 className="text-white/70 text-sm font-medium">Interview Duration</h2>
                  </div>
                  <div className="flex gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          duration === d
                            ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                            : "border-white/[0.07] text-white/30 hover:text-white/50 hover:border-white/15"
                        }`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Proceed button */}
              <button
                disabled={!canProceed}
                onClick={() => setStep("confirm")}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  canProceed
                    ? "bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/20"
                    : "bg-white/[0.04] text-white/20 cursor-not-allowed"
                }`}
              >
                {canProceed ? `Schedule Interview for ${selectedCandidate?.name} →` : "Select candidate, date & time to proceed"}
              </button>
            </>
          )}
        </div>

        {/* ── RIGHT: Upcoming Interviews ──────────────────────── */}
        <div className="space-y-4">
          <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05]">
              <h2 className="text-white/60 text-sm font-medium">Upcoming Interviews</h2>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {scheduled.map((s, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-white/70 text-sm font-medium">{s.candidateName}</p>
                      <p className="text-white/25 text-xs">{s.role}</p>
                    </div>
                    <span className="text-violet-400 text-xs font-medium shrink-0">{s.date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/25 text-xs">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {s.time} · {s.duration}m
                    </div>
                    {s.emailSent && (
                      <span className="flex items-center gap-1 text-emerald-400/60 text-xs">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Sent
                      </span>
                    )}
                  </div>
                  {/* Link */}
                  <div className="mt-2 flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-1.5">
                    <svg className="w-3 h-3 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-white/25 text-xs font-mono truncate">{s.link.replace("https://", "")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-[#0c0c14] border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <p className="text-white/25 text-xs uppercase tracking-wider font-semibold">This Week</p>
            {[
              { label: "Scheduled", value: scheduled.length, color: "text-violet-400" },
              { label: "Pending", value: PENDING_CANDIDATES.length, color: "text-amber-400" },
              { label: "Completed", value: 5, color: "text-emerald-400" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-white/35 text-sm">{item.label}</span>
                <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
