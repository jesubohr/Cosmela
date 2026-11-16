import type { ReactNode } from "react";
import { addDaysToDateKey, bogotaDateKey } from "@/convex/lib/time";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Amber chip for a scheduled appointment whose start time passed without an attention. */
export function NotStartedChip({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex min-h-7 items-center rounded-full bg-amber-soft px-2.5 text-sm font-medium text-amber", className)}>
      Sin iniciar
    </span>
  );
}

/** "10:30" in Newsreader with a small "a. m." after it. */
export function TimeText({ ms, className, periodClassName }: { ms: number; className?: string; periodClassName?: string }) {
  const [clock, ...period] = formatTime(ms).split(" ");
  return (
    <span className={cn("font-display whitespace-nowrap tabular-nums", className)}>
      {clock}
      <span className={cn("ml-1 font-sans text-sm font-normal text-ink-soft", periodClassName)}>{period.join(" ")}</span>
    </span>
  );
}

export function Section({
  title,
  count,
  aside,
  children,
  className,
}: {
  title: string;
  count?: number;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-[1.125rem] font-medium">
          {title}
          {count !== undefined && <span className="ml-2 font-normal text-ink-soft tabular-nums">{count}</span>}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** "Hoy, 3:00 p. m.", "Mañana, 9:00 a. m.", "Jueves 19 de noviembre, 9:00 a. m." */
export function dayAndTime(ms: number, today: string) {
  const key = bogotaDateKey(ms);
  const day = key === today ? "Hoy" : key === addDaysToDateKey(today, 1) ? "Mañana" : capitalize(formatDate(ms));
  return `${day}, ${formatTime(ms)}`;
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}
