"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ViewerProvider, type Viewer } from "@/components/shell/viewer";
import { api } from "@/convex/_generated/api";

/**
 * Auth for full-screen pages outside the app shell (attention flow, print views):
 * redirects like the shell does and renders children once the viewer has an org.
 */
export function MemberGate({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const result = useQuery(api.auth.viewer, isAuthenticated ? {} : "skip");
  const viewer = result?.member && result.org ? (result as Viewer) : undefined;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace(`/ingresar?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, isAuthenticated, pathname, router]);

  useEffect(() => {
    if (result === null) router.replace("/ingresar");
    else if (result && !result.member) router.replace("/bienvenida");
  }, [result, router]);

  return viewer ? <ViewerProvider viewer={viewer}>{children}</ViewerProvider> : fallback;
}
