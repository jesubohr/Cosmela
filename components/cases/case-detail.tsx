"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { errorText } from "@/components/agenda/parts";
import { PhotoThumbs } from "@/components/attention/session-photos";
import { AlertChips } from "@/components/shared/alert-chips";
import { EmptyState } from "@/components/shared/empty-state";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { addDaysToDateKey } from "@/convex/lib/time";
import { SESSION_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatShortDate, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FollowUpList } from "./follow-up-list";
import { reasonsText, sessionsProgress } from "./labels";
import { PhotoCompare } from "./photo-compare";

type CaseData = FunctionReturnType<typeof api.cases.get>;

/** `/casos/[id]`: progress, evolution timeline, photo comparison, follow-ups, and case actions. */
export function CaseDetail({ caseId }: { caseId: Id<"cases"> }) {
  const data = useQuery(api.cases.get, { caseId });
  return (
    <>
      <PageHeader title={data ? data.treatment.name : "Caso"} backHref="/casos" />
      <PageBody className="flex max-w-[960px] flex-col gap-10">{data ? <Body data={data} /> : <DetailSkeleton />}</PageBody>
    </>
  );
}

function Body({ data }: { data: CaseData }) {
  const openSheet = useAgendaSheets();
  const reopen = useMutation(api.cases.reopen);
  const [closing, setClosing] = useState(false);
  const { case: caseDoc, client, treatment, sessions, nextAppointment, followUps } = data;
  const motivo = reasonsText(caseDoc.reasons, caseDoc.reasonOther);
  const open = caseDoc.status === "open";
  const planned = caseDoc.plannedSessions;
  const photos = sessions.flatMap((s) => s.photos.map((p) => ({ ...p, sessionNumber: s.number })));

  function bookNext() {
    openSheet({
      kind: "create",
      prefill: {
        clientId: client._id,
        treatmentId: treatment._id,
        memberId: data.lastMemberId,
        caseId: caseDoc._id,
        date: addDaysToDateKey(todayKey(), treatment.followUpDays ?? 7),
      },
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <Link href={`/clientes/${client._id}`} className="self-start text-lg font-medium hover:underline">
            {client.name}
          </Link>
          {motivo && <span className="text-ink-soft">{motivo}</span>}
          <span className="text-sm text-ink-soft">
            {open ? `Abierto el ${formatShortDate(caseDoc.openedAt)}` : `Cerrado el ${formatShortDate(caseDoc.closedAt ?? caseDoc.openedAt)}`}
          </span>
        </div>
        <AlertChips client={client} />

        <div className="flex flex-col gap-2">
          <span className="font-medium tabular-nums">{sessionsProgress(caseDoc.sessionCount, planned)}</span>
          {planned ? (
            <div
              role="progressbar"
              aria-label="Sesiones hechas"
              aria-valuemin={0}
              aria-valuemax={planned}
              aria-valuenow={Math.min(caseDoc.sessionCount, planned)}
              className="h-2 max-w-md overflow-hidden rounded-full bg-line"
            >
              <div className="h-full rounded-full bg-plum" style={{ width: `${Math.min(100, (caseDoc.sessionCount / planned) * 100)}%` }} />
            </div>
          ) : null}
        </div>

        {nextAppointment && (
          <p>
            Próxima cita: <span className="font-medium">{formatDateTime(nextAppointment.start)}</span>, con {nextAppointment.memberName}
          </p>
        )}
        {!open && caseDoc.summary && (
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
            <span className="text-sm text-ink-soft">Resumen del cierre</span>
            <p className="whitespace-pre-line">{caseDoc.summary}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {open ? (
            <>
              {!client.isArchived && <Button onClick={bookNext}>Agendar siguiente sesión</Button>}
              <Button variant="secondary" onClick={() => setClosing(true)}>
                Cerrar caso
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() =>
                void reopen({ caseId: caseDoc._id })
                  .then(() => toast.success("Caso reabierto"))
                  .catch((error) => toast.error(errorText(error)))
              }
            >
              Reabrir caso
            </Button>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-[1.375rem] font-medium">Evolución</h2>
        {sessions.length === 0 ? (
          <EmptyState message="Este caso aún no tiene sesiones." />
        ) : (
          <ol className="flex flex-col">
            {sessions.map((s, index) => (
              <li key={s._id} className="relative flex gap-4 pb-8 last:pb-0">
                {index < sessions.length - 1 && <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-line" />}
                <span
                  aria-hidden
                  className={cn(
                    "z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                    s.status === "closed" ? "bg-plum text-white" : s.status === "postponed" ? "bg-rose-soft text-rose" : "bg-lilac text-plum",
                  )}
                >
                  {s.number}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Link
                    href={s.status === "draft" ? `/atencion/${s.appointmentId}` : `/casos/${caseDoc._id}/sesiones/${s._id}`}
                    className="group flex items-start justify-between gap-3"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium group-hover:underline">
                        Sesión {s.number}
                        {s.status !== "closed" && <span className="font-normal text-ink-soft">, {SESSION_STATUS_LABELS[s.status].toLowerCase()}</span>}
                      </span>
                      <span className="text-sm text-ink-soft">
                        {formatShortDate(s.closedAt ?? s.startedAt)}, con {s.memberName}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-soft" strokeWidth={1.75} />
                  </Link>
                  {s.contraindications && <p className="text-rose">Pospuesta por: {s.contraindications.join(", ")}</p>}
                  {s.evolution && <p>{s.evolution}</p>}
                  {s.keyValues.length > 0 && (
                    <dl className="flex flex-wrap gap-x-5 gap-y-1">
                      {s.keyValues.map((value) => (
                        <div key={value.label} className="flex gap-1.5">
                          <dt className="text-ink-soft">{value.label}</dt>
                          <dd className="font-medium">{value.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {s.notes && <p className="text-ink-soft">{s.notes}</p>}
                  <PhotoThumbs photos={s.photos} size="sm" />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {photos.length >= 2 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[1.375rem] font-medium">Comparar fotos</h2>
          <PhotoCompare photos={photos} />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-[1.375rem] font-medium">Seguimientos</h2>
        {followUps.length === 0 ? <p className="text-ink-soft">Sin seguimientos.</p> : <FollowUpList rows={followUps} />}
      </section>

      {closing && <CloseCaseDialog caseId={caseDoc._id} onClose={() => setClosing(false)} />}
    </>
  );
}

function CloseCaseDialog({ caseId, onClose }: { caseId: Id<"cases">; onClose: () => void }) {
  const close = useMutation(api.cases.close);
  const id = useId();
  const [summary, setSummary] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    try {
      await close({ caseId, summary });
      toast.success("Caso cerrado");
      onClose();
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Cerrar caso"
      description="Puedes reabrirlo después si el tratamiento continúa."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Volver
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            Cerrar caso
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-base">
          Resumen
        </Label>
        <Textarea id={id} rows={4} className="min-h-28" placeholder="Opcional: resultado del tratamiento, recomendaciones…" value={summary} onChange={(e) => setSummary(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
        )}
      </div>
    </ResponsiveDialog>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-11 w-56" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
