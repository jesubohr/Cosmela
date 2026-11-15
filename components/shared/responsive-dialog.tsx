"use client";

import type { ReactNode } from "react";
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
};

/**
 * Bottom drawer (vaul) below 768 px; Dialog or side Sheet on larger screens.
 * Controlled only: open it from your own button with `open`/`onOpenChange`.
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
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const describedBy = description ? undefined : { "aria-describedby": undefined };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent {...describedBy}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4", bodyClassName)}>{children}</div>
          {footer && <DrawerFooter>{footer}</DrawerFooter>}
        </DrawerContent>
      </Drawer>
    );
  }

  if (desktop === "sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0" {...describedBy}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", bodyClassName)}>{children}</div>
          {footer && <SheetFooter className="flex-row justify-end">{footer}</SheetFooter>}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] grid-rows-[auto_minmax(0,1fr)_auto]" {...describedBy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={cn("-mx-6 overflow-y-auto px-6", bodyClassName)}>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
