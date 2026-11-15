"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { StatusChip } from "@/components/agenda/parts";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { REASON_LABELS } from "@/lib/constants";
import { formatDate, formatMoney, formatTime } from "@/lib/format";

/** Resumen: next appointment, open cases, balance, and notes. */
export function SummaryTab({ clientId, notes }: { clientId: Id<"clients">; notes?: string }) {
  const summary = useQuery(api.clients.summary, { clientId });
  const openSheet = useAgendaSheets();
  const viewer = useViewer();

  if (!summary) {
    return (
      <div aria-busy className="flex flex-col gap-6">
        <Skeleton className="h-28 w-full max-w-md" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  const next = summary.nextAppointment;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Section title="Próxima cita">
        {next ? (
          <button
            type="button"
            onClick={() => openSheet({ kind: "detail", appointmentId: next._id })}
            className="flex flex-col items-start gap-1 rounded-xl border border-line bg-surface p-4 text-left hover:bg-porcelain"
          >
            <span className="font-display text-[1.75rem] leading-none tabular-nums">{formatTime(next.start)}</span>
            <span className="text-ink-soft first-letter:uppercase">{formatDate(next.start)}</span>
            <span className="mt-1 font-medium">{next.treatmentName}</span>
            {viewer.org.kind === "salon" && <span className="text-ink-soft">{next.memberName}</span>}
            <StatusChip status={next.status} className="mt-2" />
          </button>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-ink-soft">No tiene citas próximas.</p>
            <Button variant="secondary" onClick={() => openSheet({ kind: "create", prefill: { clientId } })}>
              Agendar cita
            </Button>
          </div>
        )}
      </Section>

      <Section title="Saldo pendiente">
        {summary.balance > 0 ? (
          <p className="font-display text-[1.75rem] leading-none text-amber tabular-nums">{formatMoney(summary.balance)}</p>
        ) : (
          <p className="font-medium text-sage">Al día</p>
        )}
        {summary.credit > 0 && (
          <p className="text-ink-soft">
            Abonos para próximas citas: <span className="tabular-nums">{formatMoney(summary.credit)}</span>
          </p>
        )}
      </Section>

      <Section title="Casos abiertos">
        {summary.openCases.length === 0 ? (
          <p className="text-ink-soft">No tiene casos abiertos.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {summary.openCases.map((c) => (
              <li key={c._id}>
                <Link href={`/casos/${c._id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-porcelain">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{c.treatmentName}</span>
                    <span className="truncate text-sm text-ink-soft">
                      {[...c.reasons.filter((r) => r !== "other").map((r) => REASON_LABELS[r]), c.reasonOther].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-ink-soft tabular-nums">
                    {c.plannedSessions ? `${c.sessionCount} de ${c.plannedSessions} sesiones` : `${c.sessionCount} sesiones`}
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" strokeWidth={1.75} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Notas">
        <p className={notes ? "whitespace-pre-line" : "text-ink-soft"}>{notes || "Sin notas."}</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[1.125rem] font-medium">{title}</h2>
      {children}
    </section>
  );
}
