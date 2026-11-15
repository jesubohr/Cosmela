import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  /** One sentence that says what to do, e.g. "Aún no tienes clientes. Crea el primero para empezar su ficha." */
  message: string;
  /** One button (usually primary) that performs that action. */
  action?: ReactNode;
  className?: string;
};

/** Empty list or day: one sentence + one button. No illustrations (DESIGN.md §6). */
export function EmptyState({ message, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-4 py-8", className)}>
      <p className="max-w-[36ch] text-base text-ink-soft">{message}</p>
      {action}
    </div>
  );
}
