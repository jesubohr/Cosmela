"use client";

import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { ConsentDocument } from "@/components/attention/consent-document";
import { PhotoThumbs } from "@/components/attention/session-photos";
import type { api } from "@/convex/_generated/api";
import { OBSERVED_LABELS, SKIN_TYPE_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SessionDetailData = FunctionReturnType<typeof api.sessions.detail>;

/** Every step of a session, read-only. Shared by the session page and its print view. Empty rows and groups are hidden. */
export function SessionRecord({ data, print = false }: { data: SessionDetailData; print?: boolean }) {
  const { session, client, member, appointment } = data;
  const { intake, assessment, contraindications, aftercare, followUp } = session;
  const observed = assessment?.observed.map((o) => (o === "other" ? assessment.observedOther || OBSERVED_LABELS.other : OBSERVED_LABELS[o]));
  const procedureRows = withoutEmptyRows(session.procedureRows);

  return (
    <div className={cn("flex flex-col", print ? "gap-6" : "gap-8")}>
      <Group title="Antes del tratamiento" print={print}>
        <Row label="Cambios en la salud">{intake ? (intake.healthChanged ? "Sí, se actualizó la ficha" : "Sin cambios") : null}</Row>
        <Row label="Medicamentos actuales">{intake?.medications || (intake ? "Ninguno" : null)}</Row>
        {intake?.pregnant !== undefined && <Row label="Embarazo">{intake.pregnant ? "Sí" : "No"}</Row>}
        {intake?.lactating !== undefined && <Row label="Lactancia">{intake.lactating ? "Sí" : "No"}</Row>}
        {intake?.evolution && <Row label="Evolución desde la última sesión">{intake.evolution}</Row>}
      </Group>

      <Group title="Valoración" print={print}>
        <Row label="Alteraciones observadas">{observed?.length ? observed.join(", ") : null}</Row>
        <Row label="Tipo de piel hoy">{assessment?.skinType ? SKIN_TYPE_LABELS[assessment.skinType] : null}</Row>
        {assessment?.notes && <Row label="Notas">{assessment.notes}</Row>}
      </Group>

      <Group title="Contraindicaciones" print={print}>
        <Row label="Revisión" tone={contraindications?.present.length ? "rose" : undefined}>
          {contraindications ? (contraindications.present.length ? contraindications.present.join(", ") : "Ninguna aplica") : null}
        </Row>
        {contraindications?.justification && <Row label="Continuó bajo su criterio">{contraindications.justification}</Row>}
        {session.status === "postponed" && <Row label="Decisión">Tratamiento pospuesto</Row>}
      </Group>

      {session.consent && (
        <section className={cn("flex flex-col gap-3", print && "break-inside-avoid-page")}>
          <h2 className="text-[1.125rem] font-medium">Consentimiento informado</h2>
          <div className={cn("rounded-xl border border-line bg-surface", print ? "p-4" : "p-4 sm:p-6")}>
            <ConsentDocument consent={session.consent} clientName={client.name} professionalName={member.name} />
          </div>
        </section>
      )}

      {session.status !== "postponed" && (
        <Group title="Procedimiento" print={print}>
          {procedureRows.map((row) =>
            row.kind === "section" ? (
              <div key={row.id} className="px-4 pt-4 pb-1 font-medium">
                {row.label}
              </div>
            ) : (
              <Row key={row.id} label={row.label}>
                {row.value}
              </Row>
            ),
          )}
          <Row label="Notas del procedimiento">{session.procedureNotes}</Row>
        </Group>
      )}

      {session.photos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[1.125rem] font-medium">Fotos</h2>
          {(["before", "after"] as const).map((kind) => {
            const photos = session.photos.filter((p) => p.kind === kind);
            if (photos.length === 0) return null;
            return (
              <div key={kind} className="flex flex-col gap-2">
                <span className="text-sm text-ink-soft">{kind === "before" ? "Antes" : "Después"}</span>
                <PhotoThumbs photos={photos} />
              </div>
            );
          })}
        </section>
      )}

      {session.status === "closed" && (
        <>
          <Group title="Indicaciones posteriores" print={print}>
            <Row label="Indicaciones">
              {aftercare?.items.length ? (
                <ul className="flex flex-col gap-1">
                  {aftercare.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </Row>
            {aftercare?.notes && <Row label="Notas para el cliente">{aftercare.notes}</Row>}
          </Group>

          <Group title="Cierre" print={print}>
            <Row label="Precio">{formatMoney(appointment.price)}</Row>
            <Row label="Pagado" tone={appointment.paidTotal < appointment.price ? "amber" : undefined}>
              {formatMoney(appointment.paidTotal)}
              {appointment.paidTotal < appointment.price && `, saldo ${formatMoney(appointment.price - appointment.paidTotal)}`}
            </Row>
            <Row label="Seguimiento">
              {followUp ? (followUp.recommended ? `En ${followUp.inDays} días${followUp.note ? `: ${followUp.note}` : ""}` : "No recomendado") : null}
            </Row>
          </Group>
        </>
      )}
    </div>
  );
}

type ProcedureRow = SessionDetailData["session"]["procedureRows"][number];

/** Drops unanswered rows, then section headings left without an answer under them. */
function withoutEmptyRows(rows: ProcedureRow[]) {
  const answered = rows.filter((row) => row.kind === "section" || row.value);
  return answered.filter((row, i) => row.kind === "answer" || answered[i + 1]?.kind === "answer");
}

function Group({ title, children, print }: { title: string; children: ReactNode; print?: boolean }) {
  return (
    <section className={cn("flex flex-col gap-2 has-[dl:empty]:hidden", print && "break-inside-avoid-page")}>
      <h2 className="text-[1.125rem] font-medium">{title}</h2>
      <dl className="divide-y divide-line rounded-xl border border-line bg-surface">{children}</dl>
    </section>
  );
}

function Row({ label, children, tone }: { label: string; children: ReactNode; tone?: "rose" | "amber" }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
      <dt className="text-sm text-ink-soft sm:w-52 sm:shrink-0 sm:pt-0.5">{label}</dt>
      <dd className={cn("min-w-0 [overflow-wrap:anywhere]", tone === "rose" && "font-medium text-rose", tone === "amber" && "text-amber")}>
        {children}
      </dd>
    </div>
  );
}
