/**
 * Demo visitor recognition (NOT auth). Remembers a browser-scoped visitor so a
 * returning explorer isn't asked to fill the gate again.
 *
 * Identity is shared across ALL AgentHive subdomains (the hub at
 * heyagenthive.com and agents like voxhire.heyagenthive.com) via a cookie
 * scoped to `.heyagenthive.com`. So filling the form once — on the hub OR on
 * VoxHire — unlocks every agent. localStorage is the per-origin cache/fallback.
 */

const STORAGE_KEY = "voxhire.demoVisitor.v1";
const COOKIE = "ah_demo_visitor"; // shared across *.heyagenthive.com

export interface DemoVisitor {
  name: string;
  email?: string;
  phone?: string;
  firstSeen: number;
}

// ── Shared cross-subdomain cookie ──────────────────────────────
function setVisitorCookie(name: string): void {
  if (typeof document === "undefined") return;
  const host = location.hostname;
  const domain = host.endsWith("heyagenthive.com") ? "; domain=.heyagenthive.com" : "";
  const value = encodeURIComponent(name || "1");
  document.cookie = `${COOKIE}=${value}; path=/${domain}; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function getVisitorCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)ah_demo_visitor=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// ── Public API ─────────────────────────────────────────────────
export function readDemoVisitor(): DemoVisitor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoVisitor;
      if (parsed?.name) return parsed;
    }
  } catch {
    /* ignore */
  }
  // No local record — but a sibling AgentHive site may have set the cookie.
  const cookie = getVisitorCookie();
  if (cookie) {
    return { name: cookie === "1" ? "" : cookie, firstSeen: Date.now() };
  }
  return null;
}

export function writeDemoVisitor(v: { name: string; email?: string; phone?: string }): void {
  if (typeof window === "undefined") return;
  const name = v.name.trim();
  try {
    const existing = readDemoVisitor();
    const rec: DemoVisitor = {
      name,
      email: v.email?.trim() || existing?.email,
      phone: v.phone?.trim() || existing?.phone,
      firstSeen: existing?.firstSeen ?? Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* private mode / storage unavailable — non-fatal */
  }
  // Share across all AgentHive subdomains.
  setVisitorCookie(name);
}

export function hasDemoVisitor(): boolean {
  return readDemoVisitor() !== null;
}
