import { handler } from "@/lib/auth-server";

/**
 * Passes the client IP to Better Auth (on Convex) in a header it trusts for rate limits.
 * The platform sets `x-real-ip` / `x-forwarded-for`; a value the browser sends is replaced.
 */
async function withClientIp(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete("x-cosmela-client-ip");
  const ip = headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) headers.set("x-cosmela-client-ip", ip);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  return new Request(request.url, { method: request.method, headers, body });
}

export async function GET(request: Request) {
  return handler.GET(await withClientIp(request));
}

export async function POST(request: Request) {
  return handler.POST(await withClientIp(request));
}
