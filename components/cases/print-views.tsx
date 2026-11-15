"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { useFileUrls } from "@/components/attention/step-parts";
import { FichaSummary } from "@/components/clients/ficha-summary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { consentDate, renderDocument } from "@/convex/lib/consent";
import { AUTHORIZATION_METHOD_LABELS } from "@/lib/constants";
import { formatDateTime, formatShortDate, formatTime } from "@/lib/format";
import { reasonsText } from "./labels";
import { PrintFrame } from "./print-frame";
import { SessionRecord } from "./session-record";

function Loading() {
  return (
    <div aria-busy className="mx-auto flex w-full max-w-[800px] flex-col gap-4 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-soft">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** `/imprimir/sesion/[sessionId]`: the whole session with its consent, signatures, and verification code. */
export function PrintSession({ sessionId }: { sessionId: Id<"sessions"> }) {
  const data = useQuery(api.sessions.detail, { sessionId });
  if (!data) return <Loading />;
  const { session, client, treatment, member, org } = data;
  const motivo = reasonsText(data.case.reasons, data.case.reasonOther);

  return (
    <PrintFrame org={org} title="Registro de atención">
      <Facts
        items={[
          ["Cliente", client.name],
          ["Documento", renderDocument(client.documentType, client.documentNumber)],
          ["Tratamiento", `${treatment.name}, sesión ${session.number}`],
          ...(motivo ? [["Motivo de consulta", motivo] as [string, ReactNode]] : []),
          ["Fecha", consentDate(session.closedAt ?? session.startedAt)],
          ["Profesional", member.title ? `${member.name}, ${member.title.toLowerCase()}` : member.name],
        ]}
      />
      <SessionRecord data={data} print />
      {session.addenda.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[1.125rem] font-medium">Notas adicionales</h2>
          <ul className="flex flex-col gap-3">
            {session.addenda.map((addendum) => (
              <li key={addendum.at}>
                <p className="whitespace-pre-line">{addendum.text}</p>
                <span className="text-sm text-ink-soft">
                  {addendum.author}, {formatDateTime(addendum.at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PrintFrame>
  );
}

/** `/imprimir/ficha/[clientId]`: the permanent ficha, the data authorization, and the sessions list. */
export function PrintFicha({ clientId }: { clientId: Id<"clients"> }) {
  const client = useQuery(api.clients.get, { clientId });
  const org = useQuery(api.orgs.get);
  const sessions = useQuery(api.sessions.listByClient, { clientId });
  const signature = useFileUrls([client?.dataAuthorization?.signatureKey])[client?.dataAuthorization?.signatureKey ?? ""];
  if (!client || !org || !sessions) return <Loading />;
  const authorization = client.dataAuthorization;
  const done = sessions.filter((s) => s.status !== "draft");

  return (
    <PrintFrame org={org} title="Ficha clínica">
      <Facts items={[["Cliente", `${client.firstName} ${client.lastName}`.trim()]]} />
      <FichaSummary client={client} />
      <section className="flex break-inside-avoid-page flex-col gap-2">
        <h2 className="text-[1.125rem] font-medium">Autorización de tratamiento de datos</h2>
        {authorization ? (
          <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <p>
              {AUTHORIZATION_METHOD_LABELS[authorization.method]} el {consentDate(authorization.at)}, a las {formatTime(authorization.at)}
            </p>
            {signature && (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
              <img src={signature} alt="Firma de la autorización" className="h-20 w-auto self-start object-contain" />
            )}
            <p className="text-sm whitespace-pre-line text-ink-soft">{authorization.policyText}</p>
          </div>
        ) : (
          <p className="text-ink-soft">Sin autorización registrada.</p>
        )}
      </section>
      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[1.125rem] font-medium">Atenciones</h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {done.map((s) => (
              <li key={s._id} className="flex flex-col px-4 py-2">
                <span>
                  {formatShortDate(s.startedAt)}, {s.treatmentName}, sesión {s.number}
                  {s.status === "postponed" && ", pospuesta"}
                </span>
                <span className="text-sm text-ink-soft">Con {s.memberName}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PrintFrame>
  );
}
