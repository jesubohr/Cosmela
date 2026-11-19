"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AgendaSheets } from "@/components/agenda/agenda-sheets";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { api } from "@/convex/_generated/api";
import { identifyUser } from "@/lib/analytics";
import { AppSidebar } from "./app-sidebar";
import { BillingBanner } from "./billing-banner";
import { BottomTabs } from "./bottom-tabs";
import { PRIMARY_NAV, SECONDARY_NAV, TABS } from "./nav";
import { OfflineBanner } from "./offline-banner";
import { ViewerProvider, type Viewer } from "./viewer";

/**
 * Authenticated shell. Navigation renders at once; the page renders once the
 * viewer has an active membership, so pages can call `useViewer()` and member
 * queries without "no org" branches. Redirects to /ingresar or /bienvenida.
 */
export function AppShell({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
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

  const userId = result?.user.id;
  useEffect(() => {
    if (userId) identifyUser(userId);
  }, [userId]);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-surface-raised focus:border focus:border-transparent focus:px-4 focus:py-3 focus:text-ink focus:shadow-float"
      >
        Saltar al contenido
      </a>
      <AppSidebar viewer={viewer} />
      <SidebarInset
        id="main-content"
        tabIndex={-1}
        className="min-h-dvh pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] outline-none lg:pb-0"
      >
        <OfflineBanner />
        {viewer ? (
          <ViewerProvider viewer={viewer}>
            <BillingBanner />
            <AgendaSheets>{children}</AgendaSheets>
          </ViewerProvider>
        ) : (
          <ShellSkeleton title={routeTitle(pathname)} />
        )}
      </SidebarInset>
      <BottomTabs />
    </SidebarProvider>
  );
}

/** Top-level routes show their title while the viewer loads; detail pages wait for their own. */
function routeTitle(pathname: string) {
  return [...PRIMARY_NAV, ...SECONDARY_NAV, ...TABS].find((item) => item.href === pathname)?.label;
}

function ShellSkeleton({ title }: { title?: string }) {
  return (
    <div aria-busy className="w-full max-w-[1120px]">
      <div className="flex h-14 items-center border-b border-line px-4 lg:px-8">
        {title ? (
          <p className="font-display text-[1.375rem] leading-tight lg:text-[1.75rem]">{title}</p>
        ) : (
          <Skeleton className="h-7 w-32" />
        )}
      </div>
      <div className="flex flex-col gap-3 px-4 py-6 lg:px-8">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-2/3" />
      </div>
    </div>
  );
}
