"use client";

import { useState, useEffect } from "react";
import { apiWithAuth } from "@/lib/auth";

interface Org {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  users: number;
  interviews: number;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        background: active ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color: active ? "#4ade80" : "#f87171",
        border: `1px solid ${active ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: active ? "#4ade80" : "#f87171", boxShadow: `0 0 5px ${active ? "#4ade80" : "#f87171"}` }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Org | null>(null);

  const fetchOrgs = async () => {
    try {
      const res = await apiWithAuth("/api/v1/admin/orgs");
      if (res.ok) setOrgs(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrgs(); }, []);

  const handleToggle = async (org: Org) => {
    setTogglingId(org.id);
    try {
      const res = await apiWithAuth(`/api/v1/admin/orgs/${org.id}/toggle`, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json();
        setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, is_active: updated.is_active } : o));
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (org: Org) => {
    setDeletingId(org.id);
    try {
      const res = await apiWithAuth(`/api/v1/admin/orgs/${org.id}`, { method: "DELETE" });
      if (res.ok) setOrgs(prev => prev.filter(o => o.id !== org.id));
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0e14", padding: "32px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Organizations</h1>
          <p className="text-gray-500 text-sm mt-1">
            {orgs.length} organization{orgs.length !== 1 ? "s" : ""} on the platform
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search organizations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 pl-10 pr-4 rounded-lg text-sm w-64"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Table card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600">
            <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-sm">{search ? "No organizations match your search" : "No organizations yet"}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Organization", "Slug", "Users", "Interviews", "Status", "Created", "Actions"].map(h => (
                  <th
                    key={h}
                    className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((org, idx) => (
                <tr
                  key={org.id}
                  style={{
                    borderBottom: idx < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Name + initial */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)" }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm font-medium">{org.name}</span>
                    </div>
                  </td>

                  {/* Slug */}
                  <td className="px-6 py-4">
                    <code className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">
                      {org.slug}
                    </code>
                  </td>

                  {/* Users */}
                  <td className="px-6 py-4">
                    <span className="text-gray-300 text-sm">{org.users}</span>
                  </td>

                  {/* Interviews */}
                  <td className="px-6 py-4">
                    <span className="text-gray-300 text-sm">{org.interviews}</span>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <StatusBadge active={org.is_active} />
                  </td>

                  {/* Created */}
                  <td className="px-6 py-4">
                    <span className="text-gray-500 text-xs">
                      {new Date(org.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(org)}
                        disabled={togglingId === org.id}
                        title={org.is_active ? "Deactivate" : "Activate"}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        style={{
                          background: org.is_active ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                          border: `1px solid ${org.is_active ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
                          color: org.is_active ? "#f87171" : "#4ade80",
                        }}
                      >
                        {togglingId === org.id ? (
                          <div className="w-3.5 h-3.5 border border-current/30 border-t-current rounded-full animate-spin" />
                        ) : org.is_active ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setConfirmDelete(org)}
                        title="Delete organization"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        style={{
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.15)",
                          color: "#f87171",
                        }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Delete Organization</h3>
                <p className="text-gray-500 text-xs mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to delete <span className="text-white font-medium">{confirmDelete.name}</span>?
              All data including users, candidates, and interviews will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 h-9 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 h-9 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)" }}
              >
                {deletingId === confirmDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
