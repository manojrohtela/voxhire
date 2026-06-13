"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { resumeApi, candidatesApi } from "@/lib/api-client";

type UploadState = "idle" | "uploading" | "parsed" | "saving" | "done" | "error" | "duplicate";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "text-green-400 bg-green-400/10 border-green-400/20",
  Medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Hard: "text-red-400 bg-red-400/10 border-red-400/20",
};
const CATEGORY_COLOR: Record<string, string> = {
  Primary: "text-brand bg-brand/10 border-brand/20",
  Secondary: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Bonus: "text-foreground-3 bg-ink/5 border-base",
};

export default function ResumeUploadPage() {
  const router = useRouter();
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<any>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [appliedRole, setAppliedRole] = useState<string>("");
  const [rawResumeText, setRawResumeText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadResume = useCallback(async (file: File) => {
    setUploadState("uploading");
    setError(null);
    setResult(null);
    setSelectedSkills(new Set());
    try {
      const data = await resumeApi.parse(file);
      setResult(data);
      const primarySkills = new Set<string>(
        data.skill_suggestions.suggested_skills
          .filter((s: any) => s.category === "Primary")
          .map((s: any) => s.skill as string)
      );
      setSelectedSkills(primarySkills);
      // Pre-fill applied_role from parsed experience (editable before save)
      setAppliedRole(data.candidate_profile?.experience?.[0]?.role ?? "");
      setRawResumeText(data.raw_text ?? data.candidate_profile?.summary ?? "");
      setUploadState("parsed");
    } catch (e: any) {
      setError(e.message);
      setUploadState("error");
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    uploadResume(file);
  }, [uploadResume]);

  const handleSaveCandidate = async () => {
    if (!result) return;
    setUploadState("saving");
    try {
      const p = result.candidate_profile;

      const candidate = await candidatesApi.create({
        name: p.personal?.name || "Unknown",
        email: p.personal?.email || "",
        phone: p.personal?.phone,
        location: p.personal?.location,
        linkedin: p.personal?.linkedin,
        github: p.personal?.github,
        summary: result.candidate_profile.summary,
        total_experience_years: p.total_experience_years,
        applied_role: appliedRole || p.experience?.[0]?.role || "",
        resume_text: rawResumeText || undefined,
        parsed_profile: p,
      });

      if (selectedSkills.size > 0) {
        const skills = result.skill_suggestions.suggested_skills
          .filter((s: any) => selectedSkills.has(s.skill))
          .map((s: any) => ({
            skill: s.skill,
            category: s.category,
            difficulty: s.suggested_difficulty,
            weight_percent: 0,
            interview_areas: s.interview_areas,
          }));
        await candidatesApi.saveSkills(candidate.id, skills);
      }

      setUploadState("done");
      setTimeout(() => router.push(`/dashboard/candidates/${candidate.id}`), 1200);
    } catch (e: any) {
      // 409 = duplicate candidate
      if (e?.status === 409 || e?.detail?.code === "DUPLICATE_CANDIDATE") {
        const detail = e?.detail ?? {};
        setDuplicate(detail.existing_candidate ?? null);
        setUploadState("duplicate");
      } else {
        setError(e.message ?? "Failed to save candidate");
        setUploadState("parsed");
      }
    }
  };

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-base bg-surface px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>
        </div>
        <span className="font-semibold text-foreground">VoxHire</span>
        <span className="text-foreground-4 mx-2">/</span>
        <span className="text-foreground-3 text-sm">Resume Intelligence</span>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Resume Upload</h1>
          <p className="text-foreground-3 text-sm">Upload a candidate's resume to extract profile and get AI interview suggestions.</p>
        </div>

        {/* Upload Zone */}
        {(uploadState === "idle" || uploadState === "error") && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 mb-6 ${
              dragOver ? "border-brand bg-brand/5" : "border-base bg-surface hover:border-brand/40 hover:bg-surface-hi"
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div className="w-14 h-14 rounded-2xl bg-surface-hi border border-base flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-foreground-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="text-foreground font-medium mb-1">Drop resume here or click to upload</p>
            <p className="text-foreground-3 text-sm">PDF, DOCX, JPG, PNG — up to 10MB</p>
          </div>
        )}

        {/* Uploading */}
        {uploadState === "uploading" && (
          <div className="border-2 border-dashed border-base bg-surface-hi rounded-2xl p-12 text-center mb-6">
            <div className="w-12 h-12 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium mb-1">Parsing resume with AI...</p>
            <p className="text-foreground-3 text-sm">Extracting profile & generating skill suggestions</p>
          </div>
        )}

        {/* Saving */}
        {uploadState === "saving" && (
          <div className="border-2 border-dashed border-base bg-surface-hi rounded-2xl p-12 text-center mb-6">
            <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium mb-1">Saving candidate...</p>
          </div>
        )}

        {/* Done */}
        {/* Duplicate candidate notification */}
        {uploadState === "duplicate" && duplicate && (
          <div className="border-2 border-amber-500/25 bg-amber-500/5 rounded-2xl p-8 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-amber-400 font-semibold text-base mb-1">Candidate Already Exists</h3>
                <p className="text-foreground-3 text-sm mb-4">
                  A candidate with the same {duplicate.email ? "email address" : "phone number"} was already added to your organization.
                </p>
                <div className="bg-surface border border-base rounded-xl p-4 space-y-2 mb-5">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-4 text-xs">Name</span>
                    <span className="text-foreground text-sm font-medium">{duplicate.name}</span>
                  </div>
                  {duplicate.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-4 text-xs">Email</span>
                      <span className="text-foreground-2 text-sm">{duplicate.email}</span>
                    </div>
                  )}
                  {duplicate.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-4 text-xs">Phone</span>
                      <span className="text-foreground-2 text-sm">{duplicate.phone}</span>
                    </div>
                  )}
                  {duplicate.applied_role && (
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-4 text-xs">Applied Role</span>
                      <span className="text-foreground-2 text-sm">{duplicate.applied_role}</span>
                    </div>
                  )}
                  {duplicate.created_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-4 text-xs">Added on</span>
                      <span className="text-foreground-2 text-sm">
                        {new Date(duplicate.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/dashboard/candidates/${duplicate.id}`)}
                    className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-semibold rounded-xl text-sm transition-colors"
                  >
                    View Existing Candidate →
                  </button>
                  <button
                    onClick={() => { setUploadState("parsed"); setDuplicate(null); }}
                    className="px-4 py-2.5 border border-base text-foreground-3 hover:text-foreground-2 rounded-xl text-sm transition-colors"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {uploadState === "done" && (
          <div className="border-2 border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-12 text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-foreground font-medium mb-1">Candidate saved!</p>
            <p className="text-foreground-3 text-sm">Redirecting to candidate profile...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {error}
          </div>
        )}

        {/* Results */}
        {uploadState === "parsed" && result && p && suggestions && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Personal Info */}
              <div className="bg-surface border border-base rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{p.personal?.name || "Unknown"}</h2>
                    {p.summary && <p className="text-foreground-3 text-sm mt-1 leading-relaxed">{p.summary}</p>}
                  </div>
                  {p.total_experience_years != null && (
                    <div className="shrink-0 ml-4 text-center bg-brand/10 border border-brand/20 rounded-xl px-4 py-2">
                      <p className="text-brand text-xl font-bold">{p.total_experience_years}</p>
                      <p className="text-foreground-3 text-xs">yrs exp</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mb-4">
                  {p.personal?.email && <span className="text-foreground-3 text-xs">✉ {p.personal.email}</span>}
                  {p.personal?.phone && <span className="text-foreground-3 text-xs">📱 {p.personal.phone}</span>}
                  {p.personal?.location && <span className="text-foreground-3 text-xs">📍 {p.personal.location}</span>}
                </div>
                {/* Applied role — editable so recruiter can set the actual job being applied for */}
                <div>
                  <label className="text-foreground-4 text-xs font-medium block mb-1">Applying for role</label>
                  <input
                    type="text"
                    value={appliedRole}
                    onChange={(e) => setAppliedRole(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 bg-surface-hi border border-base rounded-lg text-foreground text-sm placeholder:text-foreground-5 focus:outline-none focus:border-brand/50 transition-colors"
                  />
                  <p className="text-foreground-5 text-xs mt-1">Set the role this candidate is applying for. This is used in the interview.</p>
                </div>
              </div>

              {/* Skills */}
              {(p.skills?.technical?.length || p.skills?.languages?.length) && (
                <div className="bg-surface border border-base rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-foreground-3 uppercase tracking-wider mb-4">Skills</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Languages", items: p.skills?.languages },
                      { label: "Frameworks", items: p.skills?.frameworks },
                      { label: "Technical", items: p.skills?.technical },
                      { label: "Tools", items: p.skills?.tools },
                    ].filter((s) => s.items?.length).map((section) => (
                      <div key={section.label}>
                        <p className="text-foreground-4 text-xs mb-2">{section.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {section.items!.map((skill: string) => (
                            <span key={skill} className="px-2.5 py-1 bg-surface-hi border border-base rounded-lg text-foreground-2 text-xs">{skill}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {p.experience?.length > 0 && (
                <div className="bg-surface border border-base rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-foreground-3 uppercase tracking-wider mb-4">Experience</h3>
                  <div className="space-y-4">
                    {p.experience.map((exp: any, i: number) => (
                      <div key={i} className="pl-4 border-l border-base">
                        <p className="text-foreground font-medium text-sm">{exp.role}</p>
                        <p className="text-brand text-xs mt-0.5">{exp.company}</p>
                        <p className="text-foreground-4 text-xs">{exp.duration}</p>
                        {exp.description && <p className="text-foreground-3 text-xs mt-2 leading-relaxed">{exp.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Skill Selection */}
            <div className="space-y-4">
              {suggestions.interview_focus && (
                <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4">
                  <p className="text-brand text-xs font-semibold uppercase tracking-wider mb-2">AI Interview Focus</p>
                  <p className="text-foreground-2 text-sm leading-relaxed">{suggestions.interview_focus}</p>
                  <p className="text-foreground-3 text-xs mt-2">⏱ {suggestions.recommended_interview_duration_minutes} min recommended</p>
                </div>
              )}

              <div className="bg-surface border border-base rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground-3 uppercase tracking-wider">Select Skills</h3>
                  <span className="text-brand text-xs">{selectedSkills.size} selected</span>
                </div>
                <div className="space-y-2">
                  {suggestions.suggested_skills.map((s: any) => (
                    <div key={s.skill}>
                      <button onClick={() => { toggleSkill(s.skill); setExpandedSkill(expandedSkill === s.skill ? null : s.skill); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                          selectedSkills.has(s.skill) ? "bg-brand/10 border-brand/30" : "bg-surface-hi border-base hover:border-strong"
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              selectedSkills.has(s.skill) ? "bg-brand border-brand" : "border-base"
                            }`}>
                              {selectedSkills.has(s.skill) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-foreground text-sm font-medium truncate">{s.skill}</span>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[s.category]}`}>{s.category}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${DIFFICULTY_COLOR[s.suggested_difficulty]}`}>{s.suggested_difficulty}</span>
                          </div>
                        </div>
                      </button>
                      {expandedSkill === s.skill && (
                        <div className="mt-1 ml-6 px-3 py-2.5 bg-background border border-base rounded-xl">
                          <p className="text-foreground-3 text-xs mb-2">{s.reason}</p>
                          {s.interview_areas?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {s.interview_areas.map((area: string) => (
                                <span key={area} className="text-xs px-2 py-0.5 bg-surface-hi border border-base rounded text-foreground-3">{area}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {suggestions.strengths?.length > 0 && (
                <div className="bg-surface border border-base rounded-2xl p-4">
                  <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-3">Strengths</p>
                  <ul className="space-y-1.5">
                    {suggestions.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-foreground-3 text-xs"><span className="text-green-400 mt-0.5">✓</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button onClick={handleSaveCandidate} disabled={!p.personal?.email}
                className="w-full py-3.5 bg-brand hover:bg-brand/90 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors text-sm">
                Save Candidate & Skills →
              </button>

              <button onClick={() => { setResult(null); setUploadState("idle"); setError(null); }}
                className="w-full py-2.5 border border-base hover:border-strong text-foreground-3 hover:text-foreground-2 rounded-xl transition-colors text-sm">
                Upload another resume
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
