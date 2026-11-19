"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { bogotaDateKey } from "@/convex/lib/time";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Report = FunctionReturnType<typeof api.reports.month>;

/** "2026-01" and -1 → "2025-12". */
function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  return format(new Date(year, m - 1 + delta, 1), "yyyy-MM");
}

/** "2026-11" → "Noviembre de 2026". */
function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  const label = format(new Date(year, m - 1, 1), "MMMM 'de' yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ReportsView() {
  const viewer = useViewer();
  if (viewer.member.role !== "admin") {
    return <EmptyState message="Solo los administradores del negocio pueden ver los reportes." />;
  }
  return <AdminReports />;
}

function AdminReports() {
  const viewer = useViewer();
  const [current] = useState(() => bogotaDateKey(Date.now()).slice(0, 7));
  const [month, setMonth] = useState(current);
  const report = useQuery(api.reports.month, { month });
  // The query also tallies treatments that only received an abono this month.
  const treatments = report?.treatments.filter((t) => t.count > 0) ?? [];

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft />
        </Button>
        <h2 className="min-w-44 text-center text-[1.125rem] font-medium" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mes siguiente"
          disabled={month >= current}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight />
        </Button>
      </div>

      {report === undefined ? (
        <ReportSkeleton />
      ) : (
        <>
          <dl className="flex flex-col gap-6">
            <Figure label="Ingresos recibidos" value={formatMoney(report.income)} large />
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-6 sm:grid-cols-3">
              <Figure label="Citas atendidas" value={String(report.completed)} />
              <Figure label="Clientes nuevos" value={String(report.newClients)} />
              <Figure label="Saldo por cobrar" value={formatMoney(report.balance)} hint="A hoy" className="col-span-2 sm:col-span-1" />
            </div>
          </dl>

          {report.income === 0 && report.completed === 0 ? (
            <p className="text-ink-soft">No hubo pagos ni citas atendidas en este mes.</p>
          ) : (
            <>
              <ByMethod rows={report.byMethod} />
              {treatments.length > 0 && (
                <Block title="Tratamientos más realizados">
                  <ul className="divide-y divide-line border-y border-line">
                    {treatments.map((t) => (
                      <Row key={t.treatmentId} primary={t.name} secondary={citas(t.count)} amount={t.revenue} />
                    ))}
                  </ul>
                </Block>
              )}
              {viewer.org.kind === "salon" && (
                <Block title="Por profesional">
                  <ul className="divide-y divide-line border-y border-line">
                    {report.members.map((m) => (
                      <Row
                        key={m.memberId}
                        leading={<InitialsAvatar name={m.name} color={m.color} />}
                        primary={m.name}
                        secondary={citas(m.count)}
                        amount={m.revenue}
                      />
                    ))}
                  </ul>
                </Block>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function citas(count: number) {
  return count === 1 ? "1 cita atendida" : `${count} citas atendidas`;
}

function Figure({ label, value, hint, large, className }: { label: string; value: string; hint?: string; large?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <dt className="text-ink-soft">
        {label}
        {hint && <span className="sr-only">, {hint.toLowerCase()}</span>}
      </dt>
      <dd className={cn("font-display leading-none whitespace-nowrap tabular-nums", large ? "text-[2.75rem]" : "text-[1.75rem]")}>{value}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[1.125rem] font-medium">{title}</h2>
      {children}
    </section>
  );
}

function ByMethod({ rows }: { rows: Report["byMethod"] }) {
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <Block title="Ingresos por medio de pago">
      {rows.length === 0 ? (
        <p className="text-ink-soft">No hubo pagos en este mes.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.method} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <span>{PAYMENT_METHOD_LABELS[row.method]}</span>
                <span className="font-medium tabular-nums">{formatMoney(row.amount)}</span>
              </div>
              <div aria-hidden className="h-2 rounded-full bg-lilac">
                <div className="h-full rounded-full bg-plum" style={{ width: `${(row.amount / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function Row({ leading, primary, secondary, amount }: { leading?: ReactNode; primary: string; secondary: string; amount: number }) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2.5">
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{primary}</span>
        <span className="text-ink-soft">{secondary}</span>
      </span>
      <span className="flex flex-col items-end">
        <span className="font-medium tabular-nums">{formatMoney(amount)}</span>
        <span className="text-sm text-ink-soft">recibido</span>
      </span>
    </li>
  );
}

function ReportSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
