"use client";

import { useState, useEffect } from "react";
import { jobsApi } from "@/lib/api-client";

const DEPARTMENTS = ["Engineering", "Design", "Product", "Analytics", "Marketing", "Sales"];

function statusBadge(isActive: boolean, parsed: boolean) {
  if (!parsed) return { label: "Draft",      bg: "rgba(100,100,120,0.2)", color: "#9ca3af", border: "rgba(100,100,120,0.3)" };
  if (isActive) return { label: "Published", bg: "rgba(34,197,94,0.12)",  color: "#4ade80", border: "rgba(74,222,128,0.25)" };
  return           { label: "Archived",    bg: "rgba(100,100,120,0.2)", color: "#9ca3af", border: "rgba(100,100,120,0.3)" };
}

const PAGE_SIZE = 8;

export default function JobsPage() {
  const [jds, setJds]           = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedJd, setSelectedJd] = useState<any | null>(null);
  const [page, setPage]         = useState(1);

  // Create form state
  const [title, setTitle]       = useState("");
  const [rawText, setRawText]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchJds = async () => {
    setLoading(true);
    try { setJds(await jobsApi.list()); }
    catch { setJds([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchJds(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !rawText.trim()) return;
    setSaving(true); setSaveError("");
    try {
      await jobsApi.create({ title: title.trim(), raw_text: rawText.trim() });
      setTitle(""); setRawText("");
      setShowModal(false);
      fetchJds();
    } catch (err: any) {
      setSaveError(err.message ?? "Failed to create job");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await jobsApi.delete(id);
      setJds(p => p.filter(j => j.id !== id));
      if (selectedJd?.id === id) setSelectedJd(null);
    } catch {}
  };

  const filtered = jds.filter(j =>
    !search || j.title.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount = jds.filter(j => j.is_active).length;
  const parsedCount = jds.filter(j => j.parsed_jd).length;

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0e14", color: "#e2e0ea" }}>

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-8 py-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Job Management</h1>
          <p className="text-gray-500 text-sm mt-1">Oversee active openings and archived roles across the organization.</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setSelectedJd(null); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)", boxShadow: "0 4px 16px rgba(79,55,138,0.35)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Job
        </button>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Jobs",         value: activeCount,                    trend: "+12%", up: true },
            { label: "Total Candidates",    value: "1,284",                        trend: "+8%",  up: true },
            { label: "Interviews Today",    value: 12,                             trend: "+3",   up: true },
            { label: "Avg. Time to Hire",   value: "19d",                          trend: "-2d",  up: false },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl p-5"
              style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{s.label}</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-white">{s.value}</span>
                <span className={`text-xs mb-1 font-medium ${s.up ? "text-emerald-400" : "text-red-400"}`}>
                  {s.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search + Filters ── */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search jobs by title or keywords..."
              className="w-full h-10 pl-10 pr-4 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
          {["Filters", "Sort"].map(label => (
            <button
              key={label}
              className="h-10 px-4 rounded-xl text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {label === "Filters"
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M9 17h6" />
                }
              </svg>
              {label}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Job Title", "Department", "Candidates", "Status", "Date Created", "Actions"].map(h => (
                      <th key={h} className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <svg className="w-10 h-10 text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <p className="text-gray-600 text-sm">
                          {search ? "No jobs match your search" : "No job descriptions yet — create your first"}
                        </p>
                        {!search && (
                          <button
                            onClick={() => setShowModal(true)}
                            className="mt-3 text-indigo-400 text-sm hover:text-indigo-300 transition-colors"
                          >
                            Create Job →
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : paged.map((jd, idx) => {
                    const badge = statusBadge(jd.is_active, !!jd.parsed_jd);
                    const skills: string[] = jd.parsed_jd?.skills ?? [];
                    const dept = jd.parsed_jd?.industry ?? DEPARTMENTS[jd.title.length % DEPARTMENTS.length];
                    const seniority = jd.parsed_jd?.seniority_level ?? "Mid-level";
                    const empType = jd.parsed_jd?.employment_type ?? "Full-time";
                    return (
                      <tr
                        key={jd.id}
                        style={{
                          borderBottom: idx < paged.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        onClick={() => setSelectedJd(jd)}
                      >
                        {/* Job Title */}
                        <td className="px-6 py-4">
                          <p className="text-white text-sm font-medium">{jd.title}</p>
                          <p className="text-gray-500 text-xs mt-0.5">Remote · {empType}</p>
                        </td>

                        {/* Department */}
                        <td className="px-6 py-4">
                          <span className="text-gray-400 text-sm">{dept}</span>
                        </td>

                        {/* Candidates (avatar stack) */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                              {skills.slice(0, 3).map((s, i) => (
                                <div
                                  key={i}
                                  className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold text-white"
                                  style={{
                                    background: `hsl(${(i * 80 + 240) % 360},50%,45%)`,
                                    borderColor: "#1a1825",
                                  }}
                                >
                                  {s.slice(0, 2).toUpperCase()}
                                </div>
                              ))}
                              {skills.length === 0 && (
                                <div
                                  className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-gray-600"
                                  style={{ background: "rgba(255,255,255,0.05)", borderColor: "#1a1825" }}
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <span className="text-gray-400 text-xs">
                              {skills.length > 3 ? `+${skills.length - 3}` : skills.length > 0 ? `${skills.length}` : "0"}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.color }} />
                            {badge.label}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4">
                          <span className="text-gray-500 text-xs">
                            {new Date(jd.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <button
                            onClick={e => handleDelete(jd.id, e)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-gray-500 text-sm">
                  Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} results
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 disabled:opacity-30 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className="w-8 h-8 rounded-lg text-sm font-medium transition-all"
                      style={page === n
                        ? { background: "linear-gradient(135deg, #6d56ba, #4f378a)", color: "#fff" }
                        : { background: "rgba(255,255,255,0.05)", color: "#6b7280" }
                      }
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 disabled:opacity-30 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Bottom bento ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* AI Recommendation */}
          <div
            className="lg:col-span-2 rounded-2xl p-6 relative overflow-hidden"
            style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(109,86,186,0.15) 0%, transparent 70%)" }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L9.1 9.1 2 12l7.1 2.9L12 22l2.9-7.1L22 12l-7.1-2.9z" />
                </svg>
                <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider">AI Recommendation</span>
              </div>
              <h3 className="text-white text-lg font-bold mb-2">
                {jds.length === 0 ? "Frontend pipeline is slowing down" : `${activeCount} active job${activeCount !== 1 ? "s" : ""} in your pipeline`}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                {jds.length === 0
                  ? "Upload a job description to power AI-generated interview questions and enable precise candidate matching."
                  : `${parsedCount} of ${jds.length} descriptions have been parsed by AI. Parsed JDs enable smarter question generation and better candidate scoring.`}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowModal(true)}
                  className="text-indigo-400 text-sm font-semibold hover:text-indigo-300 transition-colors underline underline-offset-2"
                >
                  {jds.length === 0 ? "View Team Map" : "Add Another JD"}
                </button>
                <button className="text-gray-600 text-sm hover:text-gray-400 transition-colors">Dismiss</button>
              </div>
            </div>
          </div>

          {/* Upgrade card */}
          <div
            className="rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)" }}
          >
            <div className="absolute top-0 right-0 opacity-10">
              <svg className="w-32 h-32" fill="white" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm-1 14H9V8h2v9zm4 0h-2V8h2v9z" />
              </svg>
            </div>
            <div className="relative z-10">
              <h3 className="text-white text-base font-bold mb-2">Upgrade for AI Video Screening</h3>
              <p className="text-white/75 text-sm leading-relaxed">
                Automate your first-round interviews with VoxHire's proprietary AI Interviewer.
              </p>
            </div>
            <button
              className="relative z-10 mt-6 h-10 rounded-xl text-indigo-700 bg-white text-sm font-bold transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
            >
              Explore Enterprise
            </button>
          </div>
        </div>
      </div>

      {/* ── Create Job Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <h2 className="text-white font-bold text-base">New Job Description</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {saveError && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{saveError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Job Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full h-10 px-3 rounded-lg text-sm"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Job Description</label>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  rows={10}
                  placeholder="Paste the full job description here. AI will extract skills, requirements, and keywords..."
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={inputStyle}
                  required
                />
                <p className="text-gray-600 text-xs mt-1">{rawText.length} characters</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 h-10 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim() || !rawText.trim()}
                  className="flex-1 h-10 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)" }}
                >
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Parsing…</>
                  ) : (
                    <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L9.1 9.1 2 12l7.1 2.9L12 22l2.9-7.1L22 12l-7.1-2.9z" /></svg> Save & Parse JD</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Job Detail Drawer ── */}
      {selectedJd && !showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedJd(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl max-h-[85vh] overflow-y-auto"
            style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 sticky top-0" style={{ background: "#1a1825", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <h2 className="text-white font-bold text-base">{selectedJd.title}</h2>
                <p className="text-gray-500 text-xs mt-0.5">{selectedJd.parsed_jd?.employment_type ?? "Full-time"} · {selectedJd.parsed_jd?.seniority_level ?? ""}</p>
              </div>
              <button onClick={() => setSelectedJd(null)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {selectedJd.parsed_jd ? (
                <>
                  {selectedJd.parsed_jd.skills?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Required Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedJd.parsed_jd.skills.map((s: string) => (
                          <span key={s} className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-400" style={{ background: "rgba(109,86,186,0.12)", border: "1px solid rgba(109,86,186,0.2)" }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedJd.parsed_jd.experience_requirements && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Experience</p>
                      <p className="text-gray-300 text-sm">{selectedJd.parsed_jd.experience_requirements}</p>
                    </div>
                  )}
                  {selectedJd.parsed_jd.responsibilities?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Responsibilities</p>
                      <ul className="space-y-1.5">
                        {selectedJd.parsed_jd.responsibilities.map((r: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                            <span className="text-indigo-400 mt-0.5 shrink-0">•</span>{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-3 flex-wrap">
                    {[["Seniority", selectedJd.parsed_jd.seniority_level], ["Type", selectedJd.parsed_jd.employment_type], ["Industry", selectedJd.parsed_jd.industry]].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <p className="text-gray-500 text-xs">{k}</p>
                        <p className="text-white text-sm font-medium mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">This JD hasn't been parsed yet</p>
                </div>
              )}
              <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  onClick={e => handleDelete(selectedJd.id, e)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-400 text-sm transition-colors hover:bg-red-500/10"
                  style={{ border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
