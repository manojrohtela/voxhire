"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface NavItem { icon: string; label: string; href: string }

const NAV_ORG: NavItem[] = [
  { icon: "grid_view",        label: "Dashboard",   href: "/dashboard" },
  { icon: "work",             label: "Jobs",        href: "/dashboard/jobs" },
  { icon: "group",            label: "Candidates",  href: "/dashboard/candidates" },
  { icon: "event_available",  label: "Interviews",  href: "/dashboard/schedule" },
  { icon: "psychology",       label: "AI Reports",  href: "/dashboard/reports" },
  { icon: "group_work",       label: "Team",        href: "/dashboard/team" },
  { icon: "credit_card",      label: "Billing",     href: "/dashboard/billing" },
  { icon: "settings",         label: "Settings",    href: "/dashboard/settings" },
];

const NAV_ADMIN: NavItem[] = [
  { icon: "grid_view",        label: "Overview",       href: "/dashboard/admin" },
  { icon: "business",         label: "Organizations",  href: "/dashboard/admin/orgs" },
  { icon: "layers",           label: "Subscriptions",  href: "/dashboard/admin/plans" },
  { icon: "monitoring",       label: "Analytics",      href: "/dashboard/admin/analytics" },
  { icon: "security",         label: "Security",       href: "/dashboard/admin/security" },
  { icon: "settings",         label: "Settings",       href: "/dashboard/admin/settings" },
];

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    grid_view: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3 3h8v8H3zm0 10h8v8H3zM13 3h8v8h-8zm0 10h8v8h-8z" opacity=".9"/></svg>,
    work: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 3.17 16.83 2 15.35 2c-.9 0-1.64.5-2.14 1.26L12 5.08l-1.21-1.82C10.29 2.5 9.55 2 8.65 2 7.17 2 6 3.17 6 4.65c0 .47.11.91.18 1.35H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>,
    group: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
    event_available: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16.53 11.06L15.47 10l-4.88 4.88-2.12-2.12-1.06 1.06L10.59 17l5.94-5.94zM19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>,
    psychology: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13 8.57c-.79 0-1.43.64-1.43 1.43s.64 1.43 1.43 1.43 1.43-.64 1.43-1.43-.64-1.43-1.43-1.43zM13 3C9.25 3 6.2 5.94 6.02 9.64L4.1 12.2c-.25.33-.01.8.4.8H6v3c0 1.1.9 2 2 2h1v3h7v-4.68c2.36-1.12 4-3.53 4-6.32 0-3.87-3.13-7-7-7z"/></svg>,
    group_work: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 17.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM9.5 8c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5S9.5 9.38 9.5 8zm6.5 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
    settings: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>,
    business: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>,
    layers: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/></svg>,
    monitoring: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>,
    security: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>,
    help: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>,
    support: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 19v-3h-2v3c-3.87-.49-7-3.62-7.51-7.5H7v-1.5H3.49C3.98 7.62 7.11 4.49 11 4v3h2V4c3.89.49 7.02 3.62 7.51 7.5H17v1.5h3.51c-.49 3.88-3.62 7.01-7.51 7.5z"/></svg>,
    logout: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>,
    admin_panel: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17 11c.34 0 .67.03 1 .08V6.27L10.5 3 3 6.27v4.91c0 4.54 3.2 8.79 7.5 9.82.55-.13 1.08-.32 1.6-.55C11.41 19.47 11 18.28 11 17c0-3.31 2.69-6 6-6zm-6.5 6c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5zm4.5 2.93V21h1v-1.07c.76-.2 1.32-.89 1.32-1.72 0-.98-.79-1.78-1.78-1.78h-.58c-.43 0-.78-.35-.78-.78s.35-.78.78-.78h1.28c.43 0 .78.35.78.78h1c0-.83-.56-1.52-1.32-1.72V13h-1v1.07c-.76.2-1.32.89-1.32 1.72 0 .98.79 1.78 1.78 1.78h.58c.43 0 .78.35.78.78s-.35.78-.78.78h-1.28c-.43 0-.78-.35-.78-.78h-1c0 .83.56 1.52 1.32 1.72z"/></svg>,
  };
  return icons[name] ?? <span className="w-5 h-5 text-sm">{name[0]}</span>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, loading, logout, isSuperAdmin } = useAuth();

  // Role-based route guard
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/auth/login"); return; }
    if (isSuperAdmin && pathname === "/dashboard") {
      router.replace("/dashboard/admin");
    }
    if (!isSuperAdmin && pathname.startsWith("/dashboard/admin")) {
      router.replace("/dashboard");
    }
  }, [loading, user, isSuperAdmin, pathname, router]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const orgName = user?.org?.name ?? "Organization";
  const navItems = isSuperAdmin ? NAV_ADMIN : NAV_ORG;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0f0e14", color: "#e2e0ea" }}>

      {/* ── Sidebar ── */}
      <aside
        className="hidden md:flex flex-col h-full w-64 shrink-0 overflow-y-auto"
        style={{ background: "#0d0c13", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-4">
          {isSuperAdmin ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #6d56ba, #4f378a)" }}>
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">VoxHire AI</p>
                <p className="text-[11px]" style={{ color: "#6d56ba" }}>SUPER ADMIN</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: "linear-gradient(135deg, #6d56ba, #4f378a)" }}
              >
                {orgName[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{orgName}</p>
                <p className="text-[11px] text-gray-500">Enterprise Plan</p>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                  active
                    ? "text-white font-medium"
                    : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
                }`}
                style={active ? { background: "rgba(109,86,186,0.18)", color: "#a78bfa" } : {}}
              >
                <span className={active ? "text-indigo-400" : "text-gray-600"}>
                  <NavIcon name={item.icon} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5 pt-4 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
            <NavIcon name="help" />Help Center
          </button>
          <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
            <NavIcon name="support" />Contact Support
          </button>

          {/* User row */}
          <div className="flex items-center justify-between px-3 py-2 mt-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ background: "linear-gradient(135deg,#6d56ba,#4f378a)" }}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">{user?.name ?? "—"}</p>
                <p className="text-gray-500 text-[11px] truncate">
                  {isSuperAdmin ? "Platform Control" : user?.role === "org_admin" ? "Org Admin" : "Recruiter"}
                </p>
              </div>
            </div>
            <button onClick={logout} title="Sign out" className="text-gray-600 hover:text-gray-300 transition-colors ml-1 shrink-0">
              <NavIcon name="logout" />
            </button>
          </div>

          {isSuperAdmin && (
            <div className="mx-2 mt-2">
              <button
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-white"
                style={{ background: "rgba(109,86,186,0.25)", border: "1px solid rgba(109,86,186,0.3)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  System Status
                </div>
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
