"use client";

import { useQuery } from "convex/react";
import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { StatusChip } from "@/components/agenda/parts";
import { EmptyState } from "@/components/shared/empty-state";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { STAFF_COLORS } from "@/lib/constants";
import { formatShortDate, formatTime } from "@/lib/format";

/** Citas: every appointment of the client, newest first. Tap one to open its detail. */
export function AppointmentsTab({ clientId, archived }: { clientId: Id<"clients">; archived: boolean }) {
  const appointments = useQuery(api.appointments.listByClient, { clientId });
  const openSheet = useAgendaSheets();
  const isSalon = useViewer().org.kind === "salon";

  if (!appointments) return <Skeleton className="h-48 w-full" />;
  if (appointments.length === 0) {
    return (
      <EmptyState
        message="Aún no tiene citas."
        action={!archived && <Button onClick={() => openSheet({ kind: "create", prefill: { clientId } })}>Nueva cita</Button>}
      />
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {appointments.map((a) => (
        <li key={a._id}>
          <button
            type="button"
            onClick={() => openSheet({ kind: "detail", appointmentId: a._id })}
            className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-porcelain"
          >
            <span aria-hidden className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: STAFF_COLORS[a.color].strong }} />
            <span className="flex w-24 shrink-0 flex-col sm:w-32">
              <span className="text-sm text-ink-soft">{formatShortDate(a.start)}</span>
              <span className="font-display text-[1.125rem] leading-tight tabular-nums">{formatTime(a.start)}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{a.treatmentName}</span>
              {isSalon && <span className="truncate text-sm text-ink-soft">{a.memberName}</span>}
            </span>
            <StatusChip status={a.status} className="hidden shrink-0 sm:inline-flex" />
          </button>
        </li>
      ))}
    </ul>
  );
}
