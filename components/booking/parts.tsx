import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";

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
  whatsapp,
  children,
}: {
  name: string;
  city?: string;
  logoUrl?: string | null;
  whatsapp?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
          <img src={logoUrl} alt="" className="size-14 shrink-0 rounded-card object-cover" />
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] leading-tight text-balance sm:text-[2.25rem]">{name}</h1>
          {city && <p className="mt-0.5 text-ink-soft">{city}</p>}
          {whatsapp && (
            <a
              href={whatsappLink(whatsapp, `Hola, ${name}. Tengo una pregunta sobre mi cita.`)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-medium text-plum underline-offset-4 hover:underline"
            >
              <MessageCircle aria-hidden className="size-4" />
              WhatsApp
            </a>
          )}
        </div>
      </div>
      {children}
    </header>
  );
}

/** A heading plus its content. The flow moves focus to the heading when the step appears. */
export function Step({ title, children, className, id }: { title: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-label={title} className={cn("flex scroll-mt-6 flex-col gap-4", className)}>
      <h2 tabIndex={-1} className="text-[1.125rem] leading-snug font-medium outline-none">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Rows with hairline dividers (DESIGN.md: lists are lists). */
export function RowList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-line border-y border-line">
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
