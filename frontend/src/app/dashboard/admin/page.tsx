"use client";

import { useState, useEffect, useCallback } from "react";
import { apiWithAuth } from "@/lib/auth";

interface OrgRow {
  id: string; name: string; slug: string; is_active: boolean;
  created_at: string; users: number; interviews: number;
}
interface Stats { organizations: number; users: number; interviews: number; candidates: number }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, ...style }}>
      {children}
    </div>
  );
}

// Deterministic bar heights for the chart (Mon–Sun pattern matching screenshot)
const CHART_BARS = [
  { day: "Mon", h: 45 }, { day: "Tue", h: 62 }, { day: "Wed", h: 38 },
  { day: "Thu", h: 78 }, { day: "Fri", h: 91 }, { day: "Sat", h: 55 }, { day: "Sun", h: 70 },
];

const SYSTEM_HEALTH = [
  { label: "API Gateway",       status: "99.9%",      color: "#34d399", dot: "#34d399" },
  { label: "AI Model Engine",   status: "Operational", color: "#34d399", dot: "#34d399" },
  { label: "Media Processing",  status: "High Load",   color: "#fbbf24", dot: "#fbbf24" },
  { label: "Database Clusters", status: "Healthy",     color: "#34d399", dot: "#34d399" },
];

const PLAN_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: "Starter",    color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
  1: { label: "Scale",      color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  2: { label: "Enterprise", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
};

function getPlan(idx: number) { return PLAN_LABELS[idx % 3]; }
function getRevenue(idx: number) {
  const plans = ["$950/mo", "$4,200/mo", "$17,500/mo"];
  return plans[idx % 3];
}

export default function AdminDashboard() {
  const [orgs, setOrgs]           = useState<OrgRow[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [timeRange, setTimeRange] = useState<"24h"|"7d"|"30d">("24h");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        apiWithAuth("/api/v1/admin/stats").then((r) => r.json()),
        apiWithAuth("/api/v1/admin/orgs").then((r) => r.json()),
      ]);
      setStats(s); setOrgs(o);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleOrg = async (id: string) => {
    await apiWithAuth(`/api/v1/admin/orgs/${id}/toggle`, { method: "PATCH" });
    fetchData();
  };
  const deleteOrg = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its data? This cannot be undone.`)) return;
    await apiWithAuth(`/api/v1/admin/orgs/${id}`, { method: "DELETE" });
    fetchData();
  };

  const recentOrgs = [...orgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div style={{ background: "#0f0e14", minHeight: "100vh", color: "#e2e0ea" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 sticky top-0 z-10"
        style={{ background: "rgba(15,14,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <h1 className="text-xl font-bold text-white">System Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
            Monitoring global recruitment infrastructure and platform health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", background: "rgba(255,255,255,0.03)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export Report
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6d56ba,#4f378a)", boxShadow: "0 4px 12px rgba(79,55,138,0.3)" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Add Organization
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Organizations", value: loading ? "—" : (stats?.organizations ?? 0).toLocaleString(), delta: "+12%", icon: "🏢", iconBg: "rgba(109,86,186,0.18)", deltaColor: "#34d399" },
            { label: "Active Plans",        value: loading ? "—" : Math.round((stats?.organizations ?? 0) * 0.71).toLocaleString(), delta: "+8.4%", icon: "⚡", iconBg: "rgba(52,211,153,0.12)", deltaColor: "#34d399" },
            { label: "Total Interviews",    value: loading ? "—" : (stats?.interviews ?? 0) >= 1000 ? `${((stats?.interviews ?? 0)/1000).toFixed(1)}k` : String(stats?.interviews ?? 0), delta: "+24%", icon: "🎙", iconBg: "rgba(251,191,36,0.12)", deltaColor: "#34d399" },
            { label: "Total Candidates",    value: loading ? "—" : (stats?.candidates ?? 0).toLocaleString(), delta: "+18%", icon: "👥", iconBg: "rgba(239,68,68,0.1)", deltaColor: "#34d399" },
          ].map((m) => (
            <Card key={m.label} style={{ padding: "20px" }}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm" style={{ color: "#6b7280" }}>{m.label}</p>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: m.iconBg }}>{m.icon}</div>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-white">{m.value}</p>
                <span className="text-xs font-medium mb-1 flex items-center gap-0.5" style={{ color: m.deltaColor }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l9.2-9.2M17 17V7H7"/>
                  </svg>
                  {m.delta}
                </span>
              </div>
            </Card>
          ))}
        </div>

        {/* Chart + Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Infrastructure Performance */}
          <Card style={{ padding: "24px", gridColumn: "span 2" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-white">Infrastructure Performance</h2>
                <p className="text-xs mt-1" style={{ color: "#6b7280" }}>Real-time load balancing across regional nodes.</p>
              </div>
              <div className="flex gap-1" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 4 }}>
                {(["24h","7d","30d"] as const).map((t) => (
                  <button key={t} onClick={() => setTimeRange(t)}
                    className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                    style={timeRange === t
                      ? { background: "rgba(109,86,186,0.5)", color: "#fff" }
                      : { color: "#6b7280" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {/* Bar chart */}
            <div className="flex items-end justify-between gap-2 h-40 mt-2">
              {CHART_BARS.map((b) => (
                <div key={b.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full rounded-t-md transition-all" style={{
                    height: `${b.h}%`,
                    background: "linear-gradient(180deg, #8b5cf6 0%, #6d56ba 100%)",
                    opacity: 0.85,
                    minHeight: 8,
                  }} />
                  <span className="text-[11px]" style={{ color: "#4b5563" }}>{b.day}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* System Health */}
          <Card style={{ padding: "24px" }}>
            <h2 className="text-base font-semibold text-white mb-5">System Health</h2>
            <div className="space-y-4">
              {SYSTEM_HEALTH.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.dot, boxShadow: `0 0 6px ${item.dot}` }} />
                    <span className="text-sm" style={{ color: "#9ca3af" }}>{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: item.color }}>{item.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "#9ca3af" }}>Server Load</span>
                <span className="text-xs font-semibold text-white">62%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="h-full rounded-full" style={{ width: "62%", background: "linear-gradient(90deg,#6d56ba,#8b5cf6)" }} />
              </div>
            </div>
          </Card>
        </div>

        {/* Timeline + New Signups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Platform Timeline */}
          <Card style={{ padding: "24px" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Platform Timeline</h2>
              <button className="text-xs hover:text-white transition-colors" style={{ color: "#6d56ba" }}>View All</button>
            </div>
            <div className="space-y-5">
              {recentOrgs.slice(0, 3).map((org, i) => {
                const colors = ["#6d56ba", "#34d399", "#fbbf24"];
                const events = [
                  `New Organization: "${org.name}"`,
                  "System Update Deployed",
                  "High Volume Alert",
                ];
                const subs = [
                  `Enterprise Plan · ${org.users} Seats`,
                  "V2.4.0-alpha stable build live across all regions.",
                  `"${org.name}" started ${org.interviews * 50}+ concurrent interviews.`,
                ];
                const times = ["3 mins ago", "43 mins ago", "2 hours ago"];
                return (
                  <div key={org.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ background: colors[i % 3], boxShadow: `0 0 8px ${colors[i % 3]}80` }} />
                      {i < 2 && <div className="flex-1 w-px mt-2" style={{ background: "rgba(255,255,255,0.07)", minHeight: 32 }} />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-white">{events[i]}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>{subs[i]}</p>
                      <p className="text-[11px] mt-1" style={{ color: "#4b5563" }}>{times[i]}</p>
                    </div>
                  </div>
                );
              })}
              {recentOrgs.length === 0 && !loading && (
                <p className="text-sm text-center py-4" style={{ color: "#4b5563" }}>No activity yet</p>
              )}
            </div>
          </Card>

          {/* New Signups */}
          <Card style={{ padding: "24px" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">New Signups</h2>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280" }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
                </svg>
                Filter orgs…
              </div>
            </div>
            <div className="overflow-hidden rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Organization", "Status", "Plan", "Revenue"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#4b5563" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        {[1,2,3,4].map((j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)", width: j===1?"120px":"60px" }}/>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : recentOrgs.slice(0, 5).map((org, i) => {
                    const plan = getPlan(i);
                    const revenue = getRevenue(i);
                    return (
                      <tr key={org.id} className="transition-colors hover:bg-white/5 cursor-pointer"
                        style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ background: `hsl(${(i * 60 + 240) % 360}, 45%, 35%)` }}>
                              {org.name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-white">{org.name}</p>
                              <p className="text-[11px]" style={{ color: "#4b5563" }}>
                                {org.slug.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={org.is_active
                              ? { background: "rgba(52,211,153,0.12)", color: "#34d399" }
                              : { background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
                            {org.is_active ? "ACTIVE" : "PENDING"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: plan.bg, color: plan.color }}>{plan.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-white">{revenue}</td>
                      </tr>
                    );
                  })}
                  {recentOrgs.length === 0 && !loading && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "#4b5563" }}>No organizations yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {showModal && <CreateOrgModal onClose={() => setShowModal(false)} onCreated={fetchData} />}
    </div>
  );
}

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm]       = useState({ org_name: "", admin_email: "", admin_password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await apiWithAuth("/api/v1/admin/orgs", { method: "POST", body: JSON.stringify(form) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Failed"); }
      onCreated(); onClose();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl" style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Create Organization</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>{error}</div>}
          {[
            { label: "Organization Name", key: "org_name",       type: "text",     placeholder: "Acme Corp" },
            { label: "Admin Email",       key: "admin_email",    type: "email",    placeholder: "admin@acmecorp.com" },
            { label: "Admin Password",    key: "admin_password", type: "password", placeholder: "Min 8 characters" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-2" style={{ color: "#9ca3af" }}>{label}</label>
              <input
                type={type} value={(form as any)[key]} onChange={set(key)}
                placeholder={placeholder} required
                className="w-full h-11 px-4 rounded-lg text-white text-sm outline-none transition-all placeholder-gray-600"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(109,86,186,0.7)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full h-11 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
            style={{ background: "linear-gradient(135deg,#6d56ba,#4f378a)", boxShadow: "0 4px 12px rgba(79,55,138,0.3)" }}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Creating…</>
            ) : "Create Organization"}
          </button>
        </form>
      </div>
    </div>
  );
}
