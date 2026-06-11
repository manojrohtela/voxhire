"use client";

import { useState, useEffect } from "react";
import { useAuth, apiWithAuth } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";

export default function SettingsPage() {
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.org) {
      setDisplayName(user.org.name);
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await apiWithAuth("/api/v1/auth/org/settings", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName || undefined,
          logo_url: logoUrl || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save settings");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const orgInitial = (user?.org?.name || "O").charAt(0).toUpperCase();

  const fieldStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#9ca3af",
    outline: "none",
  };

  const editableFieldStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0e14", padding: "32px" }}>
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your organization profile and preferences</p>
        </div>

        {/* Organization Profile */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h2 className="text-base font-semibold text-white mb-5">Organization Profile</h2>

          {/* Current icon preview */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0 overflow-hidden"
              style={logoUrl ? { background: "transparent" } : { background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)" }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="org logo"
                  className="w-full h-full object-contain"
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    (e.currentTarget.parentElement as HTMLElement).style.background = "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)";
                  }}
                />
              ) : orgInitial}
            </div>
            <div>
              <p className="text-white text-sm font-medium">{user?.org?.name || "Your Organization"}</p>
              <p className="text-gray-500 text-xs mt-0.5">{user?.org?.slug}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Display Name (editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your organization display name"
                className="w-full h-10 px-3 rounded-lg text-sm transition-all"
                style={editableFieldStyle}
                onFocus={e => {
                  e.currentTarget.style.borderColor = "rgba(109,86,186,0.7)";
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(109,86,186,0.15)";
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Logo URL (editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Logo URL
                <span className="text-gray-600 font-normal ml-2 text-xs">optional</span>
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://your-cdn.com/logo.png"
                className="w-full h-10 px-3 rounded-lg text-sm transition-all"
                style={editableFieldStyle}
                onFocus={e => {
                  e.currentTarget.style.borderColor = "rgba(109,86,186,0.7)";
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(109,86,186,0.15)";
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Org Name (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">
                Organization Name
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-600">read-only</span>
              </label>
              <input
                type="text"
                value={user?.org?.name || ""}
                disabled
                className="w-full h-10 px-3 rounded-lg text-sm cursor-not-allowed"
                style={fieldStyle}
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">
                Admin Email
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-600">read-only</span>
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full h-10 px-3 rounded-lg text-sm cursor-not-allowed"
                style={fieldStyle}
              />
            </div>

            {/* Save */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-6 rounded-lg text-white font-semibold text-sm flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #6d56ba 0%, #4f378a 100%)" }}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : saved ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Appearance */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "#1a1825", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h2 className="text-base font-semibold text-white mb-2">Appearance</h2>
          <p className="text-gray-500 text-sm mb-5">Choose how VoxHire looks on your device</p>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
