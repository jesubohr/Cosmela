"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatMoney, formatShortDate } from "@/lib/format";

/** Pagos: what is still owed (with "Registrar pago") and every payment received. */
export function PaymentsTab({ clientId }: { clientId: Id<"clients"> }) {
  const data = useQuery(api.payments.listByClient, { clientId });
  const openSheet = useAgendaSheets();

  if (!data) return <Skeleton className="h-48 w-full" />;
  const { payments, owing } = data;
  const received = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Section title="Por cobrar">
        {owing.length === 0 ? (
          <p className="text-ink-soft">No debe nada.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {owing.map((a) => (
              <li key={a._id} className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="flex min-w-40 flex-1 flex-col">
                  <span className="font-medium">{a.treatmentName}</span>
                  <span className="text-sm text-ink-soft">{formatShortDate(a.start)}</span>
                </span>
                <span className="font-medium text-amber tabular-nums">{formatMoney(a.price - a.paidTotal)}</span>
                <Button variant="secondary" onClick={() => openSheet({ kind: "payment", appointmentId: a._id })}>
                  Registrar pago
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Pagos recibidos" meta={payments.length > 0 ? formatMoney(received) : undefined}>
        {payments.length === 0 ? (
          <p className="text-ink-soft">Aún no hay pagos.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {payments.map((p) => (
              <li key={p._id} className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{p.treatmentName}</span>
                  <span className="text-sm text-ink-soft">
                    {formatShortDate(p.paidAt)}, {PAYMENT_METHOD_LABELS[p.method].toLowerCase()}
                  </span>
                </span>
                <span className="tabular-nums">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline justify-between gap-3 text-[1.125rem] font-medium">
        {title}
        {meta && <span className="text-base font-normal text-ink-soft tabular-nums">{meta}</span>}
      </h2>
      {children}
    </section>
  );
}
