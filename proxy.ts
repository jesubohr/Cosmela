import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate on the session cookie only. Real checks happen in every Convex
// function (convex/lib/authz.ts) and in the app shell, which signs out stale sessions.
const PUBLIC_PREFIXES = ["/ingresar", "/reservar", "/invitacion", "/terminos", "/privacidad"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isPublic || getSessionCookie(request)) return NextResponse.next();

  const url = new URL("/ingresar", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, the auth API, the PostHog proxy, icons, and the manifest.
  matcher: ["/((?!api/auth|_next/static|_next/image|ingest|icons/|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)"],
};
