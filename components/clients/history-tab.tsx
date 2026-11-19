"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { PhotoThumbs } from "@/components/attention/session-photos";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SESSION_STATUS_LABELS } from "@/lib/constants";
import { formatShortDate, sessionLabel } from "@/lib/format";

/** Historial: the client's sessions, newest first, with key values and photos. */
export function HistoryTab({ clientId }: { clientId: Id<"clients"> }) {
  const sessions = useQuery(api.sessions.listByClient, { clientId });
  if (sessions === undefined) return <Skeleton className="h-40 w-full" />;
  if (sessions.length === 0) {
    return <EmptyState message="Aún no hay atenciones registradas. Cada atención que cierres aparecerá aquí con sus fotos." />;
  }
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {sessions.map((s) => (
        <li key={s._id}>
          <Link
            href={s.status === "draft" ? `/atencion/${s.appointmentId}` : `/casos/${s.caseId}/sesiones/${s._id}`}
            className="flex gap-3 px-4 py-3 hover:bg-porcelain"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-col">
                <span className="font-medium">
                  {s.treatmentName}
                  {s.status !== "closed" && <span className="font-normal text-ink-soft">, {SESSION_STATUS_LABELS[s.status].toLowerCase()}</span>}
                </span>
                <span className="text-sm text-ink-soft">
                  {formatShortDate(s.startedAt)}, {sessionLabel(s).toLowerCase()}, con {s.memberName}
                </span>
              </div>
              {s.keyValues.length > 0 && (
                <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                  {s.keyValues.map((value) => (
                    <div key={value.label} className="flex gap-1">
                      <dt className="text-ink-soft">{value.label}</dt>
                      <dd>{value.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <PhotoThumbs photos={s.photos} size="sm" />
            </div>
            <ChevronRight aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-soft" strokeWidth={1.5} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
