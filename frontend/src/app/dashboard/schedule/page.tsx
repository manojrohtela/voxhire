"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCandidates, useInterviews } from "@/hooks/useData";
import { interviewsApi } from "@/lib/api-client";
import { SegmentedControl } from "@/components/ui";

const DURATIONS = [30, 45, 60, 90];
const INTERVIEW_TYPES = ["Technical", "HR", "Leadership", "Sales"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const AI_PERSONALITIES = ["Friendly", "Neutral", "Strict"];

const TIME_SLOTS = [
  { time: "09:00 AM", available: true }, { time: "09:30 AM", available: true },
  { time: "10:00 AM", available: true }, { time: "10:30 AM", available: true },
  { time: "11:00 AM", available: true }, { time: "11:30 AM", available: true },
  { time: "12:00 PM", available: true }, { time: "02:00 PM", available: true },
  { time: "02:30 PM", available: true }, { time: "03:00 PM", available: true },
  { time: "03:30 PM", available: true }, { time: "04:00 PM", available: true },
  { time: "04:30 PM", available: true }, { time: "05:00 PM", available: true },
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function timeToISO(date: Date, timeStr: string): string {
  const [time, period] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("candidate");

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(preselectedId);
  const [duration, setDuration] = useState(45);
  const [interviewType, setInterviewType] = useState("Technical");
  const [difficulty, setDifficulty] = useState("Medium");
  const [aiPersonality, setAiPersonality] = useState("Neutral");
  const [focusSkills, setFocusSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [step, setStep] = useState<"pick" | "confirm" | "done">("pick");
  const [newInterview, setNewInterview] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { candidates, loading: candidatesLoading } = useCandidates({ limit: 100 } as any);
  const { interviews, refetch: refetchInterviews } = useInterviews();

  const pendingCandidates = candidates.filter((c) => !c.overall_rating);
  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) || null;

  // Auto-populate skills from candidate's resume when selection changes
  useEffect(() => {
    if (!selectedCandidate) return;
    const profile = selectedCandidate.parsed_profile as any;
    if (!profile?.skills) return;
    const all: string[] = [];
    for (const cat of ["technical", "languages", "frameworks", "tools"]) {
      if (Array.isArray(profile.skills[cat])) all.push(...profile.skills[cat]);
    }
    if (all.length > 0) setFocusSkills(all.slice(0, 12));
  }, [selectedCandidateId]);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();

  const selectedDate = useMemo(() => {
    if (!selectedDay) return null;
    return new Date(calYear, calMonth, selectedDay);
  }, [calYear, calMonth, selectedDay]);

  const dateLabel = selectedDate?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) || "";

  const handleSchedule = async () => {
    if (!selectedCandidate || !selectedDate || !selectedSlot) return;
    setSaving(true);
    setError(null);
    try {
      const scheduledAt = timeToISO(selectedDate, selectedSlot);
      const session = await interviewsApi.create({
        candidate_id: selectedCandidate.id,
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        interview_type: interviewType,
        difficulty,
        ai_personality: aiPersonality,
        language: "en",
        focus_skills: focusSkills,
      });
      setNewInterview({ ...session, candidateName: selectedCandidate.name, role: selectedCandidate.applied_role });
      refetchInterviews();
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const upcomingInterviews = interviews.filter((i) => i.status === "scheduled" || i.status === "in_progress");

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-20 px-7 py-4 border-b border-faint bg-background/90 backdrop-blur flex items-center justify-between">
        <div>
          <h1 className="text-foreground font-semibold text-lg tracking-tight">Schedule Interview</h1>
          <p className="text-foreground-4 text-xs mt-0.5">Pick a candidate, date, and time</p>
        </div>
        <Link href="/dashboard" className="text-foreground-3 hover:text-foreground-2 text-sm transition-colors flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Dashboard
        </Link>
      </div>

      <div className="px-7 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
        <div className="lg:col-span-2 space-y-5">

          {step === "done" && newInterview ? (
            <div className="bg-surface border border-emerald-500/20 rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-foreground text-xl font-semibold mb-1">Interview Scheduled!</h2>
              <p className="text-foreground-3 text-sm mb-6">{newInterview.candidateName} · {duration} min</p>
              <div className="bg-background border border-base rounded-xl px-4 py-3 flex items-center gap-3 mb-4 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground-4 text-xs mb-0.5">Interview Link</p>
                  <p className="text-foreground-2 text-sm font-mono truncate">{newInterview.interview_link}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(newInterview.interview_link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-ink/[0.05] text-foreground-3 border border-base"
                  }`}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button onClick={() => { setStep("pick"); setSelectedCandidateId(null); setSelectedDay(today.getDate()); setSelectedSlot(null); setNewInterview(null); }}
                className="px-6 py-2.5 bg-ink/[0.05] hover:bg-ink/10 border border-base text-foreground-2 rounded-xl text-sm transition-colors">
                Schedule Another
              </button>
            </div>

          ) : step === "confirm" ? (
            <div className="bg-surface border border-base rounded-2xl p-6 space-y-4">
              <h2 className="text-foreground font-semibold mb-2">Confirm Schedule</h2>
              {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
              {[
                { label: "Candidate", value: `${selectedCandidate?.name} — ${selectedCandidate?.applied_role || ""}` },
                { label: "Date", value: dateLabel },
                { label: "Time", value: selectedSlot! },
                { label: "Duration", value: `${duration} minutes` },
                { label: "Interview Type", value: `${interviewType} · ${difficulty}` },
                { label: "AI Personality", value: aiPersonality },
                { label: "Focus Skills", value: focusSkills.length > 0 ? focusSkills.join(", ") : "From resume" },
                { label: "Email", value: selectedCandidate?.email || "" },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between py-3 border-b border-faint last:border-0">
                  <span className="text-foreground-3 text-sm">{item.label}</span>
                  <span className="text-foreground-2 text-sm font-medium text-right max-w-[60%]">{item.value}</span>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep("pick")} className="flex-1 py-3 border border-base text-foreground-3 rounded-xl text-sm transition-colors">← Back</button>
                <button onClick={handleSchedule} disabled={saving}
                  className="flex-1 py-3 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scheduling...</> : "Confirm & Generate Link"}
                </button>
              </div>
            </div>

          ) : (
            <>
              {/* Step 1: Candidate */}
              <div className="bg-surface border border-base rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">1</div>
                  <h2 className="text-foreground-2 text-sm font-medium">Select Candidate</h2>
                </div>
                {candidatesLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[1,2,3,4].map(i => <div key={i} className="h-16 bg-ink/[0.04] rounded-xl animate-pulse" />)}
                  </div>
                ) : pendingCandidates.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-foreground-4 text-sm">No candidates without interviews</p>
                    <Link href="/resume" className="text-violet-400 text-xs mt-2 block hover:text-violet-300">Upload resume first →</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pendingCandidates.map((c) => (
                      <button key={c.id} onClick={() => setSelectedCandidateId(c.id)}
                        className={`text-left px-4 py-3 rounded-xl border transition-all ${
                          selectedCandidateId === c.id ? "bg-violet-500/10 border-violet-500/30" : "bg-surface-hi border-base hover:border-strong"
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/15 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0">
                            {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-foreground text-sm font-medium truncate">{c.name}</p>
                            <p className="text-foreground-3 text-xs truncate">{c.applied_role || c.email}</p>
                          </div>
                          {selectedCandidateId === c.id && (
                            <svg className="w-4 h-4 text-violet-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: Calendar */}
              <div className="bg-surface border border-base rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">2</div>
                  <h2 className="text-foreground-2 text-sm font-medium">Pick a Date</h2>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); } else setCalMonth(m => m-1); setSelectedDay(null); setSelectedSlot(null); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-3 hover:text-foreground-2 hover:bg-ink/[0.05] transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-foreground-2 text-sm font-medium">{MONTH_NAMES[calMonth]} {calYear}</span>
                  <button onClick={() => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); } else setCalMonth(m => m+1); setSelectedDay(null); setSelectedSlot(null); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-3 hover:text-foreground-2 hover:bg-ink/[0.05] transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-2">
                  {DAY_NAMES.map(d => <div key={d} className="text-center text-foreground-4 text-xs py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    const isPast = new Date(calYear, calMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const isSelected = day === selectedDay;
                    const isWeekend = new Date(calYear, calMonth, day).getDay() === 0 || new Date(calYear, calMonth, day).getDay() === 6;
                    return (
                      <button key={day} disabled={isPast || isWeekend} onClick={() => { setSelectedDay(day); setSelectedSlot(null); }}
                        className={`aspect-square rounded-lg text-sm font-medium transition-all flex items-center justify-center ${
                          isSelected ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                          : isToday ? "border border-violet-500/40 text-violet-300"
                          : isPast || isWeekend ? "text-foreground-5 cursor-not-allowed"
                          : "text-foreground-2 hover:bg-ink/[0.06] hover:text-foreground"
                        }`}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Time */}
              {selectedDay && (
                <div className="bg-surface border border-base rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">3</div>
                    <h2 className="text-foreground-2 text-sm font-medium">Select Time</h2>
                    <span className="text-foreground-4 text-xs ml-auto">{dateLabel}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      // Disable slots already in the past when the selected day is today.
                      const slotPast = selectedDate
                        ? new Date(timeToISO(selectedDate, slot.time)).getTime() <= Date.now()
                        : false;
                      return (
                        <button key={slot.time} disabled={slotPast}
                          onClick={() => setSelectedSlot(slot.time)}
                          className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                            slotPast ? "bg-surface-hi/40 border border-faint text-foreground-5 cursor-not-allowed line-through"
                            : selectedSlot === slot.time ? "bg-violet-500 text-white border border-violet-400"
                            : "bg-surface-hi border border-base text-foreground-2 hover:border-violet-500/30 hover:text-foreground"
                          }`}>
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                  {selectedDate && TIME_SLOTS.every((s) => new Date(timeToISO(selectedDate, s.time)).getTime() <= Date.now()) && (
                    <p className="text-foreground-4 text-xs mt-3">No time slots left today — pick a future date.</p>
                  )}
                </div>
              )}

              {/* Step 4: Duration */}
              {selectedSlot && (
                <div className="bg-surface border border-base rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">4</div>
                    <h2 className="text-foreground-2 text-sm font-medium">Duration</h2>
                  </div>
                  <SegmentedControl
                    options={DURATIONS.map((d) => ({ label: `${d}m`, value: d }))}
                    value={duration}
                    onChange={setDuration}
                  />
                </div>
              )}

              {/* Step 5: Interview Configuration */}
              {selectedSlot && (
                <div className="bg-surface border border-base rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">5</div>
                    <h2 className="text-foreground-2 text-sm font-medium">Interview Configuration</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-foreground-4 text-xs mb-2">Interview Type</p>
                      <SegmentedControl columns={4} options={INTERVIEW_TYPES} value={interviewType} onChange={setInterviewType} />
                    </div>
                    <div>
                      <p className="text-foreground-4 text-xs mb-2">Difficulty</p>
                      <SegmentedControl options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
                    </div>
                    <div>
                      <p className="text-foreground-4 text-xs mb-2">AI Personality</p>
                      <SegmentedControl options={AI_PERSONALITIES} value={aiPersonality} onChange={setAiPersonality} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Skills & Focus Areas */}
              {selectedSlot && (
                <div className="bg-surface border border-base rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">6</div>
                    <h2 className="text-foreground-2 text-sm font-medium">Skills & Focus Areas</h2>
                    <span className="text-foreground-4 text-xs ml-auto">What should the AI probe?</span>
                  </div>
                  <p className="text-foreground-4 text-xs mb-3 ml-7">
                    {selectedCandidate ? "Pre-filled from resume — edit as needed." : "Add the skills the AI should focus on during the interview."}
                  </p>

                  {/* Tag input */}
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
                    {focusSkills.map((skill) => (
                      <span key={skill} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium">
                        {skill}
                        <button
                          onClick={() => setFocusSkills(focusSkills.filter((s) => s !== skill))}
                          className="text-violet-400 hover:text-red-400 transition-colors leading-none"
                        >×</button>
                      </span>
                    ))}
                    {focusSkills.length === 0 && (
                      <span className="text-foreground-5 text-xs italic">No skills added yet</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === ",") && skillInput.trim()) {
                          e.preventDefault();
                          const skill = skillInput.trim().replace(/,$/, "");
                          if (skill && !focusSkills.includes(skill)) {
                            setFocusSkills([...focusSkills, skill]);
                          }
                          setSkillInput("");
                        }
                      }}
                      placeholder="Type a skill and press Enter…"
                      className="flex-1 bg-surface-hi border border-base rounded-lg px-3 py-2 text-sm text-foreground-2 placeholder-foreground-5 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                    <button
                      onClick={() => {
                        const skill = skillInput.trim();
                        if (skill && !focusSkills.includes(skill)) {
                          setFocusSkills([...focusSkills, skill]);
                        }
                        setSkillInput("");
                      }}
                      disabled={!skillInput.trim()}
                      className="px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-violet-500/20 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              <button disabled={!selectedCandidateId || !selectedDay || !selectedSlot}
                onClick={() => setStep("confirm")}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  selectedCandidateId && selectedDay && selectedSlot
                    ? "bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/20"
                    : "bg-ink/[0.04] text-foreground-4 cursor-not-allowed"
                }`}>
                {selectedCandidateId && selectedDay && selectedSlot
                  ? `Schedule Interview for ${selectedCandidate?.name} →`
                  : "Select candidate, date & time to proceed"}
              </button>
            </>
          )}
        </div>

        {/* Right: Upcoming */}
        <div className="space-y-4">
          <div className="bg-surface border border-base rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-faint">
              <h2 className="text-foreground-2 text-sm font-medium">Upcoming Interviews</h2>
            </div>
            <div className="divide-y divide-ink/[0.04]">
              {upcomingInterviews.length === 0 ? (
                <p className="px-5 py-6 text-foreground-4 text-xs text-center">No upcoming interviews</p>
              ) : upcomingInterviews.map((s: any) => {
                const cand = candidates.find((c) => c.id === s.candidate_id);
                return (
                <div key={s.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-foreground-2 text-sm font-medium truncate">
                      {cand?.name ?? s.candidate_id}
                    </p>
                    {s.scheduled_at && (
                      <span className="text-violet-400 text-xs shrink-0">
                        {new Date(s.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-4 text-xs">
                      {s.scheduled_at ? new Date(s.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Time TBD"} · {s.duration_minutes}m
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded border text-violet-400 bg-violet-500/10 border-violet-500/20 capitalize">{s.status}</span>
                  </div>
                  {s.interview_link && (
                    <div className="mt-2 flex items-center gap-2 bg-ink/[0.03] border border-faint rounded-lg px-2.5 py-1.5">
                      <span className="text-foreground-4 text-xs font-mono truncate">{s.interview_link.replace("https://", "")}</span>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense>
      <ScheduleContent />
    </Suspense>
  );
}
