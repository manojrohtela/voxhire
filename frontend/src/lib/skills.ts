/**
 * Normalize a candidate's parsed_profile.skills into a flat string array.
 * The parser can emit skills as:
 *   - a flat array:            ["Python", "FastAPI"]
 *   - a categorized object:    { languages: ["Python"], tools: ["Git"] }
 *   - an array of objects:     [{ name: "Python" }, { skill: "Git" }]
 * This shape-tolerance mirrors the backend's extract_candidate_skills helper,
 * and prevents `.slice`/`.map` crashes when the shape isn't a plain array.
 */
export function flattenSkills(raw: unknown, limit = 50): string[] {
  if (!raw) return [];
  const out: string[] = [];

  const pushVal = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const name = o.name ?? o.skill ?? o.label;
      if (typeof name === "string" && name.trim()) out.push(name.trim());
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach(pushVal);
  } else if (typeof raw === "object") {
    for (const v of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) v.forEach(pushVal);
      else pushVal(v);
    }
  }

  // De-dupe (case-insensitive) while preserving order.
  const seen = new Set<string>();
  const deduped = out.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return deduped.slice(0, limit);
}
