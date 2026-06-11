import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function extractSubdomain(hostname: string): string | null {
  // Strip port: "acme.localhost:3000" → "acme.localhost"
  const withoutPort = hostname.split(":")[0];
  const parts = withoutPort.split(".");

  // "acme.localhost" → ["acme", "localhost"] → subdomain = "acme"
  // "localhost"      → ["localhost"]         → no subdomain
  // "acme.voxhire.com" → ["acme", "voxhire", "com"] → subdomain = "acme"
  if (parts.length < 2) return null;
  const sub = parts[0];
  if (sub === "www" || sub === "localhost") return null;
  return sub;
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const subdomain = extractSubdomain(hostname);
  const { pathname } = request.nextUrl;

  // No subdomain — normal routing (landing page)
  if (!subdomain) return NextResponse.next();

  // ── admin.localhost → Admin portal ────────────────────────────
  if (subdomain === "admin") {
    if (pathname === "/" || pathname === "") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── {org}.localhost → Org login ───────────────────────────────
  const response =
    pathname === "/" || pathname === ""
      ? (() => {
          const url = request.nextUrl.clone();
          url.pathname = "/auth/login";
          return NextResponse.redirect(url);
        })()
      : NextResponse.next();

  // Pass slug to the login page via cookie (readable by client JS)
  response.cookies.set("voxhire_org_slug", subdomain, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 300, // 5 min — just enough to survive the redirect
  });

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
