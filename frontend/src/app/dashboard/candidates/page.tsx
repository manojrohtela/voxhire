"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { candidatesApi } from "@/lib/api-client";
import { apiWithAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const RATING_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  Strong:  { label: "Strong",  bg: "rgba(34,197,94,0.12)",   color: "#4ade80", border: "rgba(74,222,128,0.25)" },
  Medium:  { label: "Medium",  bg: "rgba(234,179,8,0.12)",   color: "#facc15", border: "rgba(250,204,21,0.25)" },
  Weak:    { label: "Weak",    bg: "rgba(239,68,68,0.12)",   color: "#f87171", border: "rgba(248,113,113,0.25)" },
  Pending: { label: "Pending", bg: "rgba(100,100,120,0.15)", color: "#9ca3af", border: "rgba(156,163,175,0.2)" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  suggested:            { label: "Suggested",    color: "#9ca3af" },
  shortlisted:          { label: "Shortlisted",  color: "#a78bfa" },
  interview_scheduled:  { label: "Scheduled",    color: "#60a5fa" },
  interview_completed:  { label: "Completed",    color: "#34d399" },
  hired:                { label: "Hired",         color: "#4ade80" },
  rejected:             { label: "Rejected",      color: "#f87171" },
};

const RATING_FILTERS = ["All", "Strong", "Medium", "Weak", "Pending"];
const PAGE_SIZE = 10;

// ── Helpers ──────────────────────────────────────────────────────

async function uploadResume(file: File): Promise<any> {
  const token = localStorage.getItem("access_token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/v1/candidates/parse-resume`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Parse failed"); }
  return res.json();
}

async function bulkUploadResumes(files: File[]): Promise<any> {
  const token = localStorage.getItem("access_token");
  const form = new FormData();
  files.forEach(f => form.append("files", f));
  const res = await fetch(`${API_URL}/api/v1/candidates/bulk-parse`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Bulk parse failed"); }
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35, background: `hsl(${hue},45%,38%)` }}
    >
      {initials}
    </div>
  );
}

function SkillTag({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-400"
      style={{ background: "rgba(109,86,186,0.15)", border: "1px solid rgba(109,86,186,0.2)" }}
    >
      {label}
      {onRemove && (
        <button onClick={onRemove} className="text-indigo-400/60 hover:text-indigo-300 ml-0.5 leading-none">×</button>
      )}
    </span>
  );
}

function DropZone({ onFile, accept, label }: { onFile: (f: File) => void; accept: string; label: string }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 p-10 rounded-2xl cursor-pointer transition-all"
      style={{
        border: `2px dashed ${dragging ? "rgba(109,86,186,0.7)" : "rgba(255,255,255,0.12)"}`,
        background: dragging ? "rgba(109,86,186,0.06)" : "rgba(255,255,255,0.02)",
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(109,86,186,0.15)" }}>
        <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-gray-500 text-xs mt-1">PDF, DOCX supported · Max 10 MB</p>
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ── Add Candidate Modal (multi-step) ──────────────────────────

type AddStep = "choose" | "uploading" | "review" | "saving" | "matching" | "matches";

interface ParsedCandidate {
  first_name: string; last_name: string; email: string; phone: string;
  skills: string[]; linkedin: string; github: string; portfolio: string;
  resume_text?: string;
}

interface JobMatch {
  job_id: string; job_title: string; match_score: number;
  match_reason: { matched: string[]; missing: string[] }; status: string;
}

function AddCandidateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<AddStep>("choose");
  const [parsed, setParsed] = useState<ParsedCandidate | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [uploadErr, setUploadErr] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  const handleFile = async (file: File) => {
    setUploadErr(""); setStep("uploading");
    try {
      const data = await uploadResume(file);
      setParsed({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        phone: data.phone || "",
        skills: Array.isArray(data.skills) ? data.skills : [],
        linkedin: data.linkedin || "",
        github: data.github || "",
        portfolio: data.portfolio || "",
        resume_text: data.resume_text || "",
      });
      setStep("review");
    } catch (e: any) {
      setUploadErr(e.message); setStep("choose");
    }
  };

  const addSkill = () => {
    if (!newSkill.trim() || !parsed) return;
    const s = newSkill.trim();
    if (!parsed.skills.includes(s)) setParsed({ ...parsed, skills: [...parsed.skills, s] });
    setNewSkill("");
  };

  const removeSkill = (s: string) => {
    if (!parsed) return;
    setParsed({ ...parsed, skills: parsed.skills.filter(sk => sk !== s) });
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaveErr(""); setStep("saving");
    try {
      const name = `${parsed.first_name} ${parsed.last_name}`.trim() || parsed.email;
      const res = await apiWithAuth("/api/v1/candidates", {
        method: "POST",
        body: JSON.stringify({
          name,
          email: parsed.email,
          phone: parsed.phone || undefined,
          linkedin: parsed.linkedin || undefined,
          github: parsed.github || undefined,
          portfolio: parsed.portfolio || undefined,
          resume_text: parsed.resume_text || undefined,
          parsed_profile: { skills: parsed.skills },
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Save failed"); }
      const candidate = await res.json();
      setSavedId(candidate.id);
      onSaved();
      // Trigger job matching
      setStep("matching");
      const mRes = await apiWithAuth(`/api/v1/candidates/${candidate.id}/match-jobs`, { method: "POST" });
      if (mRes.ok) {
        const mData = await mRes.json();
        setMatches(mData.suggestions || []);
      }
      setStep("matches");
    } catch (e: any) {
      setSaveErr(e.message); setStep("review");
    }
  };

  const handleAssign = async (jobId: string) => {
    if (!savedId) return;
    setAssigning(jobId);
    try {
      const raw = await apiWithAuth(`/api/v1/candidates/${savedId}/jobs/${jobId}`, {
        method: "POST",
        body: JSON.stringify({ status: "shortlisted" }),
      });
      if (!raw.ok) { const e = await raw.json(); throw new Error(e.detail || "Assignment failed"); }
      const res = await raw.json();
      setAssignedIds(prev => new Set(Array.from(prev).concat(jobId)));
      if (res.invitation_sent) {
        if (res.email_sent) {
          alert(`✅ Screening invitation emailed to ${res.candidate_email}\n\nLink: ${res.invitation_url}`);
        } else {
          alert(`⚠️ Email failed — copy this screening link manually:\n\n${res.invitation_url}`);
        }
      }
    } catch (e: any) {
      alert(`❌ Assignment failed: ${e.message}`);
    }
    finally { setAssigning(null); }
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={step === "matches" || step === "choose" ? onClose : undefined}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-white font-bold text-base">
            {{ choose: "Add Candidate", uploading: "Parsing Resume…", review: "Review Extracted Info", saving: "Saving…", matching: "Finding Job Matches…", matches: "Job Matches" }[step]}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* ── Step: choose ── */}
          {step === "choose" && (
            <div className="p-6 space-y-4">
              {uploadErr && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{uploadErr}</div>
              )}
              <DropZone onFile={handleFile} accept=".pdf,.docx,.doc" label="Drop resume here or click to upload" />
            </div>
          )}

          {/* ── Step: uploading / saving / matching ── */}
          {(step === "uploading" || step === "saving" || step === "matching") && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">
                {step === "uploading" ? "Extracting resume with AI…" : step === "saving" ? "Saving candidate…" : "Matching candidate to open jobs…"}
              </p>
            </div>
          )}

          {/* ── Step: review ── */}
          {step === "review" && parsed && (
            <div className="p-6 space-y-4">
              {saveErr && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{saveErr}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "First Name", key: "first_name" },
                  { label: "Last Name",  key: "last_name" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
                    <input type="text" value={(parsed as any)[key]}
                      onChange={e => setParsed({ ...parsed, [key]: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg text-sm" style={inputStyle} />
                  </div>
                ))}
              </div>
              {[
                { label: "Email",     key: "email",     type: "email" },
                { label: "Phone",     key: "phone",     type: "tel" },
                { label: "LinkedIn",  key: "linkedin",  type: "url" },
                { label: "GitHub",    key: "github",    type: "url" },
                { label: "Portfolio", key: "portfolio", type: "url" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    {label}
                    {["linkedin","github","portfolio"].includes(key) && <span className="text-gray-600 ml-1">optional</span>}
                  </label>
                  <input type={type} value={(parsed as any)[key]}
                    onChange={e => setParsed({ ...parsed, [key]: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg text-sm" style={inputStyle} />
                </div>
              ))}

              {/* Skills */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Skills</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {parsed.skills.map(s => <SkillTag key={s} label={s} onRemove={() => removeSkill(s)} />)}
                  {parsed.skills.length === 0 && <span className="text-gray-600 text-xs">No skills extracted</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    placeholder="Add skill…"
                    className="flex-1 h-8 px-3 rounded-lg text-xs"
                    style={inputStyle}
                  />
                  <button onClick={addSkill} className="h-8 px-3 rounded-lg text-xs text-indigo-400 hover:text-white transition-colors"
                    style={{ background: "rgba(109,86,186,0.15)", border: "1px solid rgba(109,86,186,0.2)" }}>
                    Add
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep("choose")}
                  className="flex-1 h-10 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  ← Back
                </button>
                <button onClick={handleSave} disabled={!parsed.email}
                  className="flex-1 h-10 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)" }}>
                  Save & Find Job Matches
                </button>
              </div>
            </div>
          )}

          {/* ── Step: matches ── */}
          {step === "matches" && (
            <div className="p-6 space-y-4">
              {matches.length === 0 ? (
                <div className="text-center py-10 text-gray-600">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-sm">No active jobs found to match against.</p>
                  <p className="text-xs mt-1">Create job descriptions first to enable AI matching.</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-500 text-sm">{matches.length} job{matches.length !== 1 ? "s" : ""} matched — assign the ones you want to shortlist.</p>
                  <div className="space-y-3">
                    {matches.map(m => {
                      const assigned = assignedIds.has(m.job_id);
                      return (
                        <div
                          key={m.job_id}
                          className="rounded-xl p-4"
                          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${assigned ? "rgba(109,86,186,0.4)" : "rgba(255,255,255,0.06)"}` }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white text-sm font-medium">{m.job_title}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-indigo-400 font-bold text-sm">{m.match_score}%</span>
                              {assigned ? (
                                <span className="text-xs text-emerald-400 flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  Assigned
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAssign(m.job_id)}
                                  disabled={assigning === m.job_id}
                                  className="h-7 px-3 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-all"
                                  style={{ background: "linear-gradient(135deg, #6d56ba, #4f378a)" }}
                                >
                                  {assigning === m.job_id ? "…" : "Assign"}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Match bar */}
                          <div className="h-1 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full" style={{ width: `${m.match_score}%`, background: m.match_score >= 70 ? "#6d56ba" : m.match_score >= 40 ? "#facc15" : "#f87171" }} />
                          </div>

                          <div className="flex gap-4 text-xs">
                            {m.match_reason?.matched?.length > 0 && (
                              <div>
                                <span className="text-emerald-400 font-medium">✓ </span>
                                <span className="text-gray-500">{m.match_reason.matched.slice(0, 3).join(", ")}{m.match_reason.matched.length > 3 ? " …" : ""}</span>
                              </div>
                            )}
                            {m.match_reason?.missing?.length > 0 && (
                              <div>
                                <span className="text-red-400 font-medium">✗ </span>
                                <span className="text-gray-600">{m.match_reason.missing.slice(0, 3).join(", ")}{m.match_reason.missing.length > 3 ? " …" : ""}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <button onClick={onClose}
                className="w-full h-10 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors mt-2"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bulk Upload Modal ─────────────────────────────────────────

type BulkStep = "upload" | "processing" | "results";

interface BulkResult {
  filename: string; status: "parsed" | "error"; error?: string;
  first_name?: string; last_name?: string; email?: string; skills?: string[];
}

interface BulkSaveState {
  status: "idle" | "saving" | "saved" | "error";
  candidateId?: string;
  matches?: JobMatch[];
  matchesLoading?: boolean;
  assignedJobIds?: Set<string>;
  expanded?: boolean;
}

function BulkUploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<BulkStep>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [saveStates, setSaveStates] = useState<BulkSaveState[]>([]);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles(Array.from(newFiles).slice(0, 50));
  };

  const handleProcess = async () => {
    if (!files.length) return;
    setStep("processing");
    try {
      const data = await bulkUploadResumes(files);
      const r = data.results || [];
      setResults(r);
      setSaveStates(r.map(() => ({ status: "idle" as const, assignedJobIds: new Set<string>() })));
      setStep("results");
    } catch (e: any) {
      setErr(e.message); setStep("upload");
    }
  };

  const handleSaveOne = async (idx: number, result: BulkResult) => {
    setSaveStates(p => { const n = [...p]; n[idx] = { ...n[idx], status: "saving" }; return n; });
    try {
      const name = `${result.first_name || ""} ${result.last_name || ""}`.trim() || result.email || "";
      const res = await apiWithAuth("/api/v1/candidates", {
        method: "POST",
        body: JSON.stringify({
          name, email: result.email || "",
          parsed_profile: { skills: result.skills || [] },
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const candidate = await res.json();
      setSaveStates(p => {
        const n = [...p];
        n[idx] = { status: "saved", candidateId: candidate.id, matchesLoading: true, assignedJobIds: new Set(), expanded: false };
        return n;
      });
      onSaved();

      // Run job matching in background, then show results
      const mRes = await apiWithAuth(`/api/v1/candidates/${candidate.id}/match-jobs`, { method: "POST" });
      const matches: JobMatch[] = mRes.ok ? ((await mRes.json()).suggestions || []) : [];
      setSaveStates(p => {
        const n = [...p];
        n[idx] = { ...n[idx], matchesLoading: false, matches };
        return n;
      });
    } catch {
      setSaveStates(p => { const n = [...p]; n[idx] = { status: "error", assignedJobIds: new Set() }; return n; });
    }
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "parsed" && saveStates[i]?.status === "idle") {
        await handleSaveOne(i, results[i]);
      }
    }
  };

  const handleAssign = async (idx: number, jobId: string) => {
    const state = saveStates[idx];
    if (!state?.candidateId) return;
    try {
      const raw = await apiWithAuth(`/api/v1/candidates/${state.candidateId}/jobs/${jobId}`, {
        method: "POST", body: JSON.stringify({ status: "shortlisted" }),
      });
      const res = raw.ok ? await raw.json() : {};
      setSaveStates(p => {
        const n = [...p];
        const prev = n[idx].assignedJobIds ?? new Set<string>();
        n[idx] = { ...n[idx], assignedJobIds: new Set(Array.from(prev).concat(jobId)) };
        return n;
      });
      if (res.invitation_sent) {
        if (res.email_sent) {
          alert(`✅ Screening invitation emailed to ${res.candidate_email}\n\nLink: ${res.invitation_url}`);
        } else {
          alert(`⚠️ Email failed — copy this screening link manually:\n\n${res.invitation_url}`);
        }
      }
    } catch (e: any) {
      alert(`❌ Assignment failed: ${e.message}`);
    }
  };

  const toggleExpand = (idx: number) => {
    setSaveStates(p => { const n = [...p]; n[idx] = { ...n[idx], expanded: !n[idx].expanded }; return n; });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={step !== "results" ? onClose : undefined}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-white font-bold text-base">Bulk Upload Resumes</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {step === "upload" && (
            <div className="space-y-5">
              {err && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{err}</div>}
              <div
                className="flex flex-col items-center justify-center gap-3 p-10 rounded-2xl cursor-pointer transition-all"
                style={{ border: "2px dashed rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}
                onClick={() => inputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(109,86,186,0.15)" }}>
                  <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-white text-sm font-medium">Select multiple resumes</p>
                  <p className="text-gray-500 text-xs mt-1">PDF, DOCX · Up to 50 files · 10 MB each</p>
                </div>
                <input ref={inputRef} type="file" accept=".pdf,.docx" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
              </div>

              {files.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-gray-400 text-sm mb-2">{files.length} file{files.length !== 1 ? "s" : ""} selected</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-gray-700">({(f.size / 1024).toFixed(0)} KB)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={onClose}
                  className="flex-1 h-10 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Cancel
                </button>
                <button onClick={handleProcess} disabled={files.length === 0}
                  className="flex-1 h-10 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all"
                  style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)" }}>
                  Parse {files.length > 0 ? `${files.length} Resumes` : "Resumes"}
                </button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Parsing {files.length} resumes with AI…</p>
            </div>
          )}

          {step === "results" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">
                  {results.filter(r => r.status === "parsed").length} parsed · {results.filter(r => r.status === "error").length} failed
                </p>
                <button onClick={handleSaveAll}
                  className="h-8 px-4 rounded-lg text-xs font-medium text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #6d56ba, #4f378a)" }}>
                  Save All & Match Jobs
                </button>
              </div>

              {results.map((r, i) => {
                const state = saveStates[i] ?? { status: "idle", assignedJobIds: new Set() };
                return (
                  <div key={i} className="rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${r.status === "error" || state.status === "error" ? "rgba(239,68,68,0.2)" : state.status === "saved" ? "rgba(109,86,186,0.3)" : "rgba(255,255,255,0.06)"}` }}>

                    {/* Candidate row */}
                    <div className="p-4 flex items-center gap-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {r.first_name || r.last_name ? `${r.first_name} ${r.last_name}`.trim() : r.filename}
                        </p>
                        <p className="text-gray-500 text-xs">{r.email || r.filename}</p>
                        {r.skills && r.skills.length > 0 && (
                          <p className="text-indigo-400 text-xs mt-1">{r.skills.slice(0, 4).join(", ")}{r.skills.length > 4 ? " …" : ""}</p>
                        )}
                        {r.status === "error" && <p className="text-red-400 text-xs mt-1">{r.error}</p>}
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {/* Match jobs toggle (once saved) */}
                        {state.status === "saved" && !state.matchesLoading && (state.matches?.length ?? 0) > 0 && (
                          <button onClick={() => toggleExpand(i)}
                            className="h-7 px-3 rounded-lg text-xs font-medium transition-all"
                            style={{ background: state.expanded ? "rgba(109,86,186,0.25)" : "rgba(109,86,186,0.1)", color: "#a78bfa", border: "1px solid rgba(109,86,186,0.25)" }}>
                            {state.expanded ? "Hide" : `${state.matches!.length} matches`}
                          </button>
                        )}
                        {state.status === "saved" && state.matchesLoading && (
                          <span className="text-gray-600 text-xs flex items-center gap-1">
                            <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
                            Matching…
                          </span>
                        )}

                        {/* Save / status */}
                        {r.status === "error" || state.status === "error" ? (
                          <span className="text-red-400 text-xs">Failed</span>
                        ) : state.status === "saved" ? (
                          <span className="text-emerald-400 text-xs flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Saved
                          </span>
                        ) : state.status === "saving" ? (
                          <span className="text-gray-500 text-xs flex items-center gap-1">
                            <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
                            Saving…
                          </span>
                        ) : (
                          <button onClick={() => handleSaveOne(i, r)}
                            className="h-7 px-3 rounded-lg text-xs font-medium text-white"
                            style={{ background: "linear-gradient(135deg, #6d56ba, #4f378a)" }}>
                            Save
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Job matches panel (expandable) */}
                    {state.expanded && state.matches && (
                      <div className="px-4 pb-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-gray-500 text-xs pt-3">Assign to jobs:</p>
                        {state.matches.map(m => {
                          const assigned = state.assignedJobIds?.has(m.job_id);
                          return (
                            <div key={m.job_id} className="flex items-center gap-3 py-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-medium truncate">{m.job_title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                                    <div className="h-full rounded-full" style={{ width: `${m.match_score}%`, background: m.match_score >= 70 ? "#6d56ba" : m.match_score >= 40 ? "#facc15" : "#f87171" }} />
                                  </div>
                                  <span className="text-indigo-400 text-xs font-bold shrink-0">{m.match_score}%</span>
                                </div>
                              </div>
                              {assigned ? (
                                <span className="text-emerald-400 text-xs shrink-0">✓ Assigned</span>
                              ) : (
                                <button onClick={() => handleAssign(i, m.job_id)}
                                  className="h-6 px-2.5 rounded-lg text-xs font-medium text-white shrink-0"
                                  style={{ background: "linear-gradient(135deg, #6d56ba, #4f378a)" }}>
                                  Assign
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <button onClick={onClose}
                className="w-full h-10 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors mt-2"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Job Assignments Modal ─────────────────────────────────────

function JobsModal({ candidate, onClose }: { candidate: any; onClose: () => void }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    apiWithAuth(`/api/v1/candidates/${candidate.id}/jobs`)
      .then(r => r.json()).then(setJobs).finally(() => setLoading(false));
  }, [candidate.id]);

  const updateStatus = async (jobId: string, status: string) => {
    setUpdating(jobId);
    try {
      await apiWithAuth(`/api/v1/candidates/${candidate.id}/jobs/${jobId}`, {
        method: "POST", body: JSON.stringify({ status }),
      });
      setJobs(p => p.map(j => j.job_id === jobId ? { ...j, status } : j));
    } catch {}
    finally { setUpdating(null); }
  };

  const removeJob = async (jobId: string) => {
    setUpdating(jobId);
    try {
      await apiWithAuth(`/api/v1/candidates/${candidate.id}/jobs/${jobId}`, { method: "DELETE" });
      setJobs(p => p.filter(j => j.job_id !== jobId));
    } catch {}
    finally { setUpdating(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-4 px-6 py-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Avatar name={candidate.name} size={40} />
          <div className="flex-1">
            <h2 className="text-white font-bold text-sm">{candidate.name}</h2>
            <p className="text-gray-500 text-xs">{candidate.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="text-sm">No job assignments yet.</p>
              <p className="text-xs mt-1">Add candidate first, then run AI matching.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(j => {
                const st = STATUS_CONFIG[j.status] ?? STATUS_CONFIG.suggested;
                return (
                  <div key={j.job_id} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-medium">{j.job_title}</span>
                      <div className="flex items-center gap-2">
                        {j.match_score != null && <span className="text-indigo-400 text-xs font-bold">{j.match_score}%</span>}
                        <span className="text-xs font-medium" style={{ color: st.color }}>{st.label}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                        <button key={val} onClick={() => updateStatus(j.job_id, val)}
                          disabled={updating === j.job_id || j.status === val}
                          className="h-6 px-2 rounded text-xs font-medium transition-all disabled:opacity-40"
                          style={j.status === val
                            ? { background: "rgba(109,86,186,0.25)", color: "#a78bfa", border: "1px solid rgba(109,86,186,0.3)" }
                            : { background: "rgba(255,255,255,0.04)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.07)" }
                          }>
                          {cfg.label}
                        </button>
                      ))}
                      <button onClick={() => removeJob(j.job_id)} disabled={updating === j.job_id}
                        className="h-6 px-2 rounded text-xs text-red-400 transition-all ml-auto"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function CandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [page, setPage]             = useState(1);
  const [modal, setModal] = useState<"add" | "bulk" | null>(null);
  const [jobsCandidate, setJobsCandidate] = useState<any | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await candidatesApi.list({
        search: search || undefined,
        rating: ratingFilter !== "All" ? ratingFilter as any : undefined,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setCandidates(res.candidates);
      setTotal(res.total);
    } catch { setCandidates([]); setTotal(0); }
    finally { setLoading(false); }
  }, [search, ratingFilter, page]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); setDeleting(id);
    try {
      await candidatesApi.delete(id);
      setCandidates(p => p.filter(c => c.id !== id));
      setTotal(t => t - 1);
    } catch {}
    finally { setDeleting(null); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const inputStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0e14", color: "#e2e0ea" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Candidates</h1>
          <p className="text-gray-500 text-sm mt-1">Manage candidates across all job pipelines.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setModal("bulk")}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium text-gray-300 transition-all hover:text-white"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Bulk Upload
          </button>
          <button onClick={() => setModal("add")}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)", boxShadow: "0 4px 16px rgba(79,55,138,0.35)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Candidate
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Candidates", value: total },
            { label: "Strong",   value: candidates.filter(c => c.overall_rating === "Strong").length },
            { label: "Medium",   value: candidates.filter(c => c.overall_rating === "Medium").length },
            { label: "Pending",  value: candidates.filter(c => !c.overall_rating || c.overall_rating === "Pending").length },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-5" style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</p>
              <span className="text-3xl font-bold text-white">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email…" className="w-full h-10 pl-10 pr-4 rounded-xl text-sm" style={inputStyle} />
          </div>
          <div className="flex gap-1.5">
            {RATING_FILTERS.map(r => (
              <button key={r} onClick={() => { setRatingFilter(r); setPage(1); }}
                className="h-10 px-4 rounded-xl text-sm font-medium transition-all"
                style={ratingFilter === r
                  ? { background: "linear-gradient(135deg, #6d56ba, #4f378a)", color: "#fff" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.06)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Candidate", "Email", "Skills", "Jobs", "Rating", "Added", ""].map(h => (
                      <th key={h} className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-20 text-center">
                        <svg className="w-10 h-10 text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-gray-600 text-sm">{search || ratingFilter !== "All" ? "No candidates match your filters" : "No candidates yet"}</p>
                        {!search && ratingFilter === "All" && (
                          <button onClick={() => setModal("add")} className="mt-3 text-indigo-400 text-sm hover:text-indigo-300 transition-colors">
                            Add first candidate →
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : candidates.map((c, idx) => {
                    const rc = RATING_CONFIG[c.overall_rating] ?? RATING_CONFIG.Pending;
                    const skills: string[] = c.parsed_profile?.skills ?? [];
                    const jobCount = c.job_count ?? 0;
                    return (
                      <tr key={c.id}
                        style={{ borderBottom: idx < candidates.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", transition: "background 0.15s", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        onClick={() => router.push(`/dashboard/candidates/${c.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} />
                            <span className="text-white text-sm font-medium">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4"><span className="text-gray-400 text-sm">{c.email}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {skills.slice(0, 2).map((s, i) => (
                              <span key={i} className="px-2 py-0.5 rounded text-xs"
                                style={{ background: "rgba(109,86,186,0.15)", color: "#a78bfa", border: "1px solid rgba(109,86,186,0.2)" }}>{s}</span>
                            ))}
                            {skills.length > 2 && <span className="text-gray-600 text-xs">+{skills.length - 2}</span>}
                            {skills.length === 0 && <span className="text-gray-700 text-xs">—</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={e => { e.stopPropagation(); setJobsCandidate(c); }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-indigo-400 hover:text-white transition-colors"
                            style={{ background: "rgba(109,86,186,0.12)", border: "1px solid rgba(109,86,186,0.2)" }}>
                            {jobCount} job{jobCount !== 1 ? "s" : ""}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: rc.color }} />
                            {rc.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-500 text-xs">
                            {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={e => { e.stopPropagation(); handleDelete(c.id, e); }} disabled={deleting === c.id}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors">
                            {deleting === c.id
                              ? <div className="w-3.5 h-3.5 border border-current/30 border-t-current rounded-full animate-spin" />
                              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            }
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-gray-500 text-sm">
                  {total === 0 ? "0" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`} of {total}
                </span>
                <div className="flex items-center gap-1">
                  {[
                    { label: "←", action: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1 },
                    { label: "→", action: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page === totalPages },
                  ].map(btn => (
                    <button key={btn.label} onClick={btn.action} disabled={btn.disabled}
                      className="w-8 h-8 rounded-lg text-sm text-gray-500 disabled:opacity-30 hover:text-white transition-colors"
                      style={{ background: "rgba(255,255,255,0.05)" }}>
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === "add"  && <AddCandidateModal  onClose={() => setModal(null)} onSaved={() => { fetchCandidates(); }} />}
      {modal === "bulk" && <BulkUploadModal     onClose={() => setModal(null)} onSaved={() => { fetchCandidates(); }} />}
      {jobsCandidate    && <JobsModal candidate={jobsCandidate} onClose={() => setJobsCandidate(null)} />}
    </div>
  );
}
