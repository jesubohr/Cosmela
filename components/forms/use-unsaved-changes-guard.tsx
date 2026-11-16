"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";

/**
 * Warns before the user leaves a page with unsaved edits. Render the returned dialog once.
 * Covers closing the tab and clicks on links to other pages of the app. The browser's back
 * button is not covered: the App Router gives no way to cancel it.
 */
export function useUnsavedChangesGuard(dirty: boolean): ReactNode {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    // Capture phase: runs before the click reaches Next's <Link> handler.
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    };

    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);

  return (
    <ResponsiveDialog
      open={target !== null}
      onOpenChange={(open) => !open && setTarget(null)}
      title="¿Descartar cambios?"
      footer={
        <>
          <Button variant="secondary" onClick={() => setTarget(null)}>
            Seguir editando
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (target) router.push(target);
              setTarget(null);
            }}
          >
            Descartar cambios
          </Button>
        </>
      }
    >
      <p className="text-ink-soft">Lo que no guardaste se perderá.</p>
    </ResponsiveDialog>
  );
}
