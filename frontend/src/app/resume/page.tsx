"use client";

import { useState, useCallback, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────
interface SuggestedSkill {
  skill: string;
  category: "Primary" | "Secondary" | "Bonus";
  suggested_difficulty: "Easy" | "Medium" | "Hard";
  reason: string;
  interview_areas: string[];
}

interface ParseResponse {
  candidate_profile: {
    personal: { name?: string; email?: string; phone?: string; location?: string; linkedin?: string; github?: string };
    summary?: string;
    experience: { company?: string; role?: string; duration?: string; years?: number; description?: string; technologies?: string[] }[];
    education: { institution?: string; degree?: string; field?: string; year?: string; grade?: string }[];
    skills: { technical?: string[]; languages?: string[]; frameworks?: string[]; tools?: string[] };
    projects: { name?: string; description?: string; technologies?: string[] }[];
    certifications: { name?: string; issuer?: string; year?: string }[];
    total_experience_years?: number;
  };
  skill_suggestions: {
    suggested_skills: SuggestedSkill[];
    recommended_interview_duration_minutes: number;
    interview_focus?: string;
    red_flags: string[];
    strengths: string[];
  };
  filename: string;
}

type UploadState = "idle" | "uploading" | "done" | "error";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "text-green-400 bg-green-400/10 border-green-400/20",
  Medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Hard: "text-red-400 bg-red-400/10 border-red-400/20",
};

const CATEGORY_COLOR: Record<string, string> = {
  Primary: "text-[#6c63ff] bg-[#6c63ff]/10 border-[#6c63ff]/20",
  Secondary: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Bonus: "text-[#888] bg-white/5 border-white/10",
};

export default function ResumeUploadPage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadResume = useCallback(async (file: File) => {
    setUploadState("uploading");
    setError(null);
    setResult(null);
    setSelectedSkills(new Set());

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/resume/parse`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to parse resume");
      }

      const data: ParseResponse = await res.json();
      setResult(data);
      // Auto-select all Primary skills
      const primarySkills = new Set(
        data.skill_suggestions.suggested_skills
          .filter((s) => s.category === "Primary")
          .map((s) => s.skill)
      );
      setSelectedSkills(primarySkills);
      setUploadState("done");
    } catch (e: any) {
      setError(e.message);
      setUploadState("error");
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) && !file.name.endsWith(".docx")) {
      setError("Please upload a PDF, DOCX, or image file.");
      return;
    }
    uploadResume(file);
  }, [uploadResume]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      next.has(skill) ? next.delete(skill) : next.add(skill);
      return next;
    });
  };

  const p = result?.candidate_profile;
  const suggestions = result?.skill_suggestions;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-[#1a1a24] bg-[#0d0d14] px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-[#6c63ff] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
        </div>
        <span className="font-semibold text-white">VoxHire</span>
        <span className="text-[#333] mx-2">/</span>
        <span className="text-[#888] text-sm">Resume Intelligence</span>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Resume Upload</h1>
          <p className="text-[#666] text-sm">Upload a candidate's resume to extract profile and get AI interview suggestions.</p>
        </div>

        {/* Upload Zone */}
        {uploadState !== "done" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => uploadState === "idle" || uploadState === "error" ? fileInputRef.current?.click() : null}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 mb-6 ${
              dragOver
                ? "border-[#6c63ff] bg-[#6c63ff]/5"
                : uploadState === "uploading"
                ? "border-[#2a2a3a] bg-[#13131a] cursor-default"
                : "border-[#1e1e2e] bg-[#0d0d14] hover:border-[#6c63ff]/40 hover:bg-[#13131a]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {uploadState === "uploading" ? (
              <div>
                <div className="w-12 h-12 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white font-medium mb-1">Parsing resume...</p>
                <p className="text-[#555] text-sm">Extracting profile & generating skill suggestions</p>
              </div>
            ) : (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#13131a] border border-[#1e1e2e] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-white font-medium mb-1">Drop resume here or click to upload</p>
                <p className="text-[#555] text-sm">PDF, DOCX, JPG, PNG — up to 10MB</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
            <button onClick={() => { setError(null); setUploadState("idle"); }} className="ml-auto text-red-400/60 hover:text-red-400">Retry</button>
          </div>
        )}

        {/* Results */}
        {result && p && suggestions && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left col — Candidate Profile */}
            <div className="lg:col-span-2 space-y-5">

              {/* Personal Info */}
              <div className="bg-[#0d0d14] border border-[#1a1a24] rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{p.personal.name || "Unknown Candidate"}</h2>
                    {p.summary && <p className="text-[#888] text-sm mt-1 leading-relaxed">{p.summary}</p>}
                  </div>
                  {p.total_experience_years != null && (
                    <div className="shrink-0 ml-4 text-center bg-[#6c63ff]/10 border border-[#6c63ff]/20 rounded-xl px-4 py-2">
                      <p className="text-[#6c63ff] text-xl font-bold">{p.total_experience_years}</p>
                      <p className="text-[#666] text-xs">yrs exp</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {p.personal.email && (
                    <a href={`mailto:${p.personal.email}`} className="flex items-center gap-1.5 text-[#888] hover:text-white text-xs transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      {p.personal.email}
                    </a>
                  )}
                  {p.personal.phone && (
                    <span className="flex items-center gap-1.5 text-[#888] text-xs">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      {p.personal.phone}
                    </span>
                  )}
                  {p.personal.location && (
                    <span className="flex items-center gap-1.5 text-[#888] text-xs">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {p.personal.location}
                    </span>
                  )}
                  {p.personal.github && (
                    <a href={p.personal.github} target="_blank" className="flex items-center gap-1.5 text-[#888] hover:text-white text-xs transition-colors">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                      GitHub
                    </a>
                  )}
                </div>
              </div>

              {/* Skills */}
              {(p.skills.technical?.length || p.skills.languages?.length || p.skills.frameworks?.length) ? (
                <div className="bg-[#0d0d14] border border-[#1a1a24] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-4">Skills</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Languages", items: p.skills.languages },
                      { label: "Frameworks", items: p.skills.frameworks },
                      { label: "Technical", items: p.skills.technical },
                      { label: "Tools", items: p.skills.tools },
                    ].filter((s) => s.items?.length).map((section) => (
                      <div key={section.label}>
                        <p className="text-[#555] text-xs mb-2">{section.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {section.items!.map((skill) => (
                            <span key={skill} className="px-2.5 py-1 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-[#ccc] text-xs">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Experience */}
              {p.experience.length > 0 && (
                <div className="bg-[#0d0d14] border border-[#1a1a24] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-4">Experience</h3>
                  <div className="space-y-4">
                    {p.experience.map((exp, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-px bg-[#1e1e2e] mx-1.5 mt-1.5 shrink-0" />
                        <div className="pb-4">
                          <p className="text-white font-medium text-sm">{exp.role}</p>
                          <p className="text-[#6c63ff] text-xs mt-0.5">{exp.company}</p>
                          <p className="text-[#555] text-xs mt-0.5">{exp.duration} {exp.years ? `· ${exp.years}y` : ""}</p>
                          {exp.description && <p className="text-[#888] text-xs mt-2 leading-relaxed">{exp.description}</p>}
                          {exp.technologies?.length ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {exp.technologies.map((t) => (
                                <span key={t} className="px-2 py-0.5 bg-[#13131a] border border-[#1e1e2e] rounded text-[#666] text-xs">{t}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {p.education.length > 0 && (
                <div className="bg-[#0d0d14] border border-[#1a1a24] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-4">Education</h3>
                  <div className="space-y-3">
                    {p.education.map((edu, i) => (
                      <div key={i}>
                        <p className="text-white text-sm font-medium">{edu.institution}</p>
                        <p className="text-[#888] text-xs mt-0.5">{edu.degree} {edu.field ? `· ${edu.field}` : ""}</p>
                        <p className="text-[#555] text-xs">{edu.year} {edu.grade ? `· ${edu.grade}` : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right col — AI Skill Suggestions */}
            <div className="space-y-5">

              {/* Interview Focus */}
              {suggestions.interview_focus && (
                <div className="bg-[#6c63ff]/5 border border-[#6c63ff]/20 rounded-2xl p-4">
                  <p className="text-[#6c63ff] text-xs font-semibold uppercase tracking-wider mb-2">AI Interview Focus</p>
                  <p className="text-[#ccc] text-sm leading-relaxed">{suggestions.interview_focus}</p>
                  <div className="mt-3 flex items-center gap-2 text-[#888] text-xs">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {suggestions.recommended_interview_duration_minutes} min recommended
                  </div>
                </div>
              )}

              {/* Skill Selection */}
              <div className="bg-[#0d0d14] border border-[#1a1a24] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[#888] uppercase tracking-wider">Skill Selection</h3>
                  <span className="text-[#6c63ff] text-xs font-medium">{selectedSkills.size} selected</span>
                </div>
                <div className="space-y-2">
                  {suggestions.suggested_skills.map((s) => (
                    <div key={s.skill}>
                      <button
                        onClick={() => { toggleSkill(s.skill); setExpandedSkill(expandedSkill === s.skill ? null : s.skill); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                          selectedSkills.has(s.skill)
                            ? "bg-[#6c63ff]/10 border-[#6c63ff]/30"
                            : "bg-[#13131a] border-[#1e1e2e] hover:border-[#2a2a3a]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              selectedSkills.has(s.skill) ? "bg-[#6c63ff] border-[#6c63ff]" : "border-[#333]"
                            }`}>
                              {selectedSkills.has(s.skill) && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-white text-sm font-medium truncate">{s.skill}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[s.category]}`}>{s.category}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${DIFFICULTY_COLOR[s.suggested_difficulty]}`}>{s.suggested_difficulty}</span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {expandedSkill === s.skill && (
                        <div className="mt-1 ml-6 px-3 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl">
                          <p className="text-[#888] text-xs mb-2">{s.reason}</p>
                          {s.interview_areas.length > 0 && (
                            <div>
                              <p className="text-[#555] text-xs mb-1.5">Cover in interview:</p>
                              <div className="flex flex-wrap gap-1">
                                {s.interview_areas.map((area) => (
                                  <span key={area} className="text-xs px-2 py-0.5 bg-[#13131a] border border-[#1e1e2e] rounded text-[#666]">{area}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths & Red Flags */}
              {suggestions.strengths.length > 0 && (
                <div className="bg-[#0d0d14] border border-[#1a1a24] rounded-2xl p-4">
                  <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-3">Strengths</p>
                  <ul className="space-y-1.5">
                    {suggestions.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[#888] text-xs">
                        <span className="text-green-400 mt-0.5">✓</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {suggestions.red_flags.length > 0 && (
                <div className="bg-[#0d0d14] border border-amber-500/20 rounded-2xl p-4">
                  <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">Points to Probe</p>
                  <ul className="space-y-1.5">
                    {suggestions.red_flags.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[#888] text-xs">
                        <span className="text-amber-400 mt-0.5">!</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Proceed CTA */}
              {selectedSkills.size > 0 && (
                <button className="w-full py-3.5 bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold rounded-xl transition-colors text-sm">
                  Schedule Interview →
                </button>
              )}

              {/* Upload another */}
              <button
                onClick={() => { setResult(null); setUploadState("idle"); setError(null); }}
                className="w-full py-2.5 border border-[#1e1e2e] hover:border-[#2a2a3a] text-[#666] hover:text-[#888] rounded-xl transition-colors text-sm"
              >
                Upload another resume
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
