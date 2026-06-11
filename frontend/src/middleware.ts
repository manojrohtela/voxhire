import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Set NEXT_PUBLIC_APP_DOMAIN in Vercel env vars to your root domain
// e.g. "voxhire.heyagenthive.com"
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "";

function extractSubdomain(hostname: string): string | null {
  const withoutPort = hostname.split(":")[0];

  // Production: if hostname IS the root domain → no subdomain
  if (APP_DOMAIN && withoutPort === APP_DOMAIN) return null;

  // Production: if hostname is {something}.{APP_DOMAIN} → extract subdomain
  if (APP_DOMAIN && withoutPort.endsWith(`.${APP_DOMAIN}`)) {
    const sub = withoutPort.slice(0, withoutPort.length - APP_DOMAIN.length - 1);
    return sub === "www" ? null : sub;
  }

  // Local dev fallback: "acme.localhost:3000" → "acme"
  const parts = withoutPort.split(".");
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
