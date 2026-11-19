"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useFormOptions } from "@/components/agenda/parts";
import { Segmented } from "@/components/forms/segmented";
import { EmptyState } from "@/components/shared/empty-state";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { STAFF_COLORS } from "@/lib/constants";
import { bogotaToEpoch } from "@/convex/lib/time";
import { formatShortDate } from "@/lib/format";
import { reasonsText, sessionsProgress } from "./labels";

type Status = "open" | "closed" | "all";
const FILTERS = [
  ["open", "Abiertos"],
  ["closed", "Cerrados"],
  ["all", "Todos"],
] as const;

const EMPTY: Record<Status, string> = {
  open: "No hay casos abiertos. Se abren solos cuando inicias una atención.",
  closed: "Aún no has cerrado casos. Ciérralos desde su detalle cuando termine el tratamiento.",
  all: "Aún no hay casos. Se abren solos cuando inicias una atención.",
};

/** `/casos`: cases with status and professional filters. */
export function CaseList() {
  const viewer = useViewer();
  const options = useFormOptions();
  const [status, setStatus] = useState<Status>("open");
  const [memberId, setMemberId] = useState<Id<"members"> | "all">("all");
  const cases = useQuery(api.cases.list, { status, memberId: memberId === "all" ? undefined : memberId });
  const showMembers = viewer.org.kind === "salon" && (options?.members.length ?? 0) > 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Estado de los casos" options={FILTERS} value={status} onChange={setStatus} />
        {showMembers && options && (
          <Select value={memberId} onValueChange={(value) => setMemberId(value as Id<"members"> | "all")}>
            <SelectTrigger aria-label="Profesional" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="min-h-11 text-base">
                Todo el equipo
              </SelectItem>
              {options.members.map((member) => (
                <SelectItem key={member._id} value={member._id} className="min-h-11 text-base">
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {cases === undefined ? (
        <div aria-busy className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <EmptyState
          message={EMPTY[status]}
          action={
            <Button asChild>
              <Link href="/agenda">Ir a la agenda</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {cases.map((c) => {
            const motivo = reasonsText(c.reasons, c.reasonOther);
            return (
              <li key={c._id}>
                <Link href={`/casos/${c._id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-porcelain">
                  <span aria-hidden className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: STAFF_COLORS[c.color].strong }} />
                  <div className="grid min-w-0 flex-1 gap-x-6 gap-y-0.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{c.clientName}</span>
                      <span className="truncate text-ink-soft">{c.treatmentName}</span>
                    </div>
                    <div className="flex min-w-0 flex-col">
                      {motivo && <span className="truncate text-ink-soft md:text-ink">{motivo}</span>}
                      <span className="text-sm text-ink-soft tabular-nums">
                        {sessionsProgress(c.sessionCount, c.plannedSessions)}
                        {c.status === "closed" && ", cerrado"}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col text-sm text-ink-soft md:text-base">
                      {c.lastSessionAt && <span>Última sesión {formatShortDate(c.lastSessionAt)}</span>}
                      {c.next?.kind === "appointment" && <span className="text-plum">Próxima cita {formatShortDate(c.next.start)}</span>}
                      {c.next?.kind === "followUp" && <span>Seguimiento {formatShortDate(bogotaToEpoch(c.next.dueDate))}</span>}
                    </div>
                  </div>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" strokeWidth={1.5} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
