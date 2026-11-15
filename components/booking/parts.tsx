import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** "1 h 30 min", "45 min". */
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Page frame shared by the booking pages: one calm column on porcelain. */
export function BookingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh px-4 pt-safe pb-safe sm:px-8">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-8 py-8 sm:py-14">{children}</div>
    </main>
  );
}

export function BusinessHeader({
  name,
  city,
  logoUrl,
  children,
}: {
  name: string;
  city?: string;
  logoUrl?: string | null;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
          <img src={logoUrl} alt="" className="size-14 shrink-0 rounded-card border border-line bg-surface object-cover" />
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] leading-tight text-balance sm:text-[2.25rem]">{name}</h1>
          {city && <p className="mt-0.5 text-ink-soft">{city}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}

/** A heading plus its content; the heading receives focus-free scroll targets. */
export function Step({ title, children, className, id }: { title: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-label={title} className={cn("flex scroll-mt-6 flex-col gap-4", className)}>
      <h2 className="text-[1.125rem] leading-snug font-medium">{title}</h2>
      {children}
    </section>
  );
}

/** White list with hairline dividers (DESIGN.md: lists are lists). */
export function RowList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {children}
    </ul>
  );
}

/** A calm full-page message: unknown link, disabled booking. */
export function BookingMessage({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h2 className="font-display text-[1.375rem] leading-snug">{title}</h2>
      <p className="max-w-[44ch] text-ink-soft">{text}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
