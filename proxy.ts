import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { clientRecordGuidePath, homeShareImagePath } from "@/lib/seo";

const PUBLIC_PATHS = new Set([
  "/",
  "/robots.txt",
  "/sitemap.xml",
  clientRecordGuidePath,
  homeShareImagePath,
]);

// Optimistic gate on the session cookie only. Real checks happen in every Convex
// function (convex/lib/authz.ts) and in the app shell, which signs out stale sessions.
const PUBLIC_PREFIXES = [
  "/ingresar",
  "/reservar",
  "/invitacion",
  "/terminos",
  "/privacidad",
  "/cookies",
  "/reembolsos",
  "/acuerdo-datos",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const path = pathname.replace(/\/$/, "") || "/";
  const isPublic =
    PUBLIC_PATHS.has(path) ||
    PUBLIC_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  if (!isPublic && !getSessionCookie(request)) {
    const url = new URL("/ingresar", request.url);
    url.searchParams.set("next", pathname + search);
    const response = NextResponse.redirect(url);
    response.headers.set("X-Robots-Tag", "noindex");
    return response;
  }

  const response = NextResponse.next();
  if (!isPublic || path === "/ingresar" || path.startsWith("/invitacion/")) {
    response.headers.set("X-Robots-Tag", "noindex");
  }
  return response;
}

export const config = {
  // Skip Next internals, the auth API, the PostHog proxy, icons, and the manifest.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|ingest|icons/|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)",
  ],
};
