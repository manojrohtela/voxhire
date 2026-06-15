/**
 * Demo visitor recognition (NOT auth). We remember a browser-scoped record so a
 * returning explorer isn't asked to fill the "say hi" gate again — same pattern
 * as the AgentHive hub. No accounts, purely localStorage.
 */

const STORAGE_KEY = "voxhire.demoVisitor.v1";

export interface DemoVisitor {
  name: string;
  email?: string;
  phone?: string;
  firstSeen: number;
}

export function readDemoVisitor(): DemoVisitor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoVisitor;
    return parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDemoVisitor(v: { name: string; email?: string; phone?: string }): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readDemoVisitor();
    const rec: DemoVisitor = {
      name: v.name.trim(),
      email: v.email?.trim() || existing?.email,
      phone: v.phone?.trim() || existing?.phone,
      firstSeen: existing?.firstSeen ?? Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* private mode / storage unavailable — non-fatal */
  }
}

export function hasDemoVisitor(): boolean {
  return readDemoVisitor() !== null;
}
