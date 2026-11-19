"use client";

import type { ReactNode, RefObject } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sentence-case title, e.g. "Nueva cita". */
  title: string;
  /** Optional line under the title. Screen readers get the title alone when omitted. */
  description?: string;
  /** Scrollable body. */
  children: ReactNode;
  /** Sticky actions, e.g. `<Button>Guardar cita</Button>`. Put the primary action last. */
  footer?: ReactNode;
  /** Desktop surface: centered "dialog" (default) or right "sheet" for long forms. Phones always get a bottom drawer. */
  desktop?: "dialog" | "sheet";
  /** Extra classes for the scrollable body. */
  bodyClassName?: string;
  /** The opener, when a menu or drawer removes the focused item before this overlay opens. */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

/** Where focus goes back to when each open overlay closes, keyed by its content node. */
const openers = new WeakMap<Element, HTMLElement>();

/**
 * The element that opened this overlay. When one overlay replaces another (agenda detail →
 * reschedule), focus sits in the closing one, so the new overlay inherits its opener instead.
 */
function findOpener(): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  const closing = active.closest('[role="dialog"][data-state="closed"]');
  if (closing) return openers.get(closing) ?? null;
  // A menu item unmounts with its menu; its trigger stays.
  const menu = active.closest('[role="menu"]');
  const trigger = menu && document.getElementById(menu.getAttribute("aria-labelledby") ?? "");
  return trigger instanceof HTMLElement ? trigger : active;
}

function onOpenAutoFocus(event: Event, mobile: boolean, returnFocus?: HTMLElement | null) {
  const content = event.currentTarget as HTMLElement;
  const opener = returnFocus ?? findOpener();
  if (opener) openers.set(content, opener);

  const preferred =
    content.querySelector<HTMLElement>("[data-autofocus]") ??
    // Destructive confirmations start on the safe choice ("Volver", "Cancelar").
    (content.querySelector('[data-variant="destructive"]')
      ? content.querySelector<HTMLElement>('button:not([data-variant="destructive"]):not([data-slot$="-close"]):not(:disabled)')
      : null);
  if (preferred) {
    event.preventDefault();
    preferred.focus();
  } else if (mobile) {
    // The drawer itself, so the phone keyboard does not cover the sheet as it opens.
    event.preventDefault();
    content.focus();
  }
  // Otherwise Radix focuses the first focusable element.
}

function onCloseAutoFocus(event: Event) {
  event.preventDefault();
  // Another overlay already took focus (agenda transitions): leave it there.
  if (document.activeElement?.closest('[role="dialog"][data-state="open"]')) return;
  const opener = openers.get(event.currentTarget as Element);
  const target =
    (opener?.isConnected ? opener : null) ??
    (opener?.id ? document.getElementById(opener.id) : null) ??
    document.getElementById("main-content");
  target?.focus();
}

/**
 * Bottom drawer (vaul) below 768 px; Dialog or side Sheet on larger screens.
 * Controlled only: open it from your own button with `open`/`onOpenChange`.
 * Mark a control with `data-autofocus` to receive focus on open.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  desktop = "dialog",
  bodyClassName,
  returnFocusRef,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const contentProps = {
    ...(description ? {} : { "aria-describedby": undefined }),
    onOpenAutoFocus: (event: Event) => onOpenAutoFocus(event, isMobile, returnFocusRef?.current),
    onCloseAutoFocus,
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent {...contentProps}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4", bodyClassName)}>{children}</div>
          {footer && <DrawerFooter>{footer}</DrawerFooter>}
        </DrawerContent>
      </Drawer>
    );
  }

  if (desktop === "sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0" {...contentProps}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4", bodyClassName)}>{children}</div>
          {footer && <SheetFooter className="flex-row justify-end">{footer}</SheetFooter>}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] grid-rows-[auto_minmax(0,1fr)_auto]" {...contentProps}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={cn("-mx-6 overflow-y-auto overscroll-contain px-6", bodyClassName)}>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
