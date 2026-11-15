import type { ReactNode } from "react";

/** Sticky action bar at the bottom of a long page form, above the phone tab bar. Primary action last. */
export function SheetBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-10 -mx-4 flex justify-end gap-2 border-t border-line bg-porcelain/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:-mx-8 lg:px-8 [&>*]:flex-1 sm:[&>*]:flex-none">
      {children}
    </div>
  );
}
