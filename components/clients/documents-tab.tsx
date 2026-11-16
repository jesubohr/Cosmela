"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Printer } from "lucide-react";
import { useState } from "react";
import { useSignedUrls } from "@/components/shared/use-signed-urls";
import { EmptyState } from "@/components/shared/empty-state";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { ClientDoc } from "@/convex/clients";
import { AUTHORIZATION_METHOD_LABELS } from "@/lib/constants";
import { consentDate } from "@/convex/lib/consent";
import { formatShortDate, formatTime, sessionLabel } from "@/lib/format";

/** Documentos: the data authorization and every signed consent, viewable and printable. */
export function DocumentsTab({ client }: { client: ClientDoc }) {
  const sessions = useQuery(api.sessions.listByClient, { clientId: client._id });
  const [viewing, setViewing] = useState(false);
  const authorization = client.dataAuthorization;
  if (sessions === undefined) return <Skeleton className="h-24 w-full" />;
  const consents = sessions.filter((s) => s.signedAt !== undefined);

  if (!authorization && consents.length === 0) {
    return <EmptyState message="Los consentimientos firmados y la autorización de datos aparecerán aquí después de la primera atención." />;
  }
  return (
    <>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {authorization && (
          <li className="flex min-h-16 items-center gap-3 px-4 py-2.5">
            <button type="button" onClick={() => setViewing(true)} className="flex min-w-0 flex-1 flex-col text-left">
              <span className="font-medium hover:underline">Autorización de tratamiento de datos</span>
              <span className="text-sm text-ink-soft">
                {formatShortDate(authorization.at)}, {AUTHORIZATION_METHOD_LABELS[authorization.method].toLowerCase()}
              </span>
            </button>
            <PrintLink href={`/imprimir/ficha/${client._id}`} label="Imprimir ficha con la autorización" />
          </li>
        )}
        {consents.map((s) => (
          <li key={s._id} className="flex min-h-16 items-center gap-3 px-4 py-2.5">
            <Link href={`/casos/${s.caseId}/sesiones/${s._id}`} className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium hover:underline">Consentimiento de {s.treatmentName.toLowerCase()}</span>
              <span className="text-sm text-ink-soft">
                {formatShortDate(s.signedAt!)}, {sessionLabel(s).toLowerCase()}
              </span>
            </Link>
            <PrintLink href={`/imprimir/sesion/${s._id}`} label={`Imprimir consentimiento de ${s.treatmentName.toLowerCase()}`} />
          </li>
        ))}
      </ul>
      {authorization && <AuthorizationDialog open={viewing} onOpenChange={setViewing} authorization={authorization} />}
    </>
  );
}

function PrintLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="icon" asChild>
      <Link href={href} aria-label={label}>
        <Printer strokeWidth={1.75} />
      </Link>
    </Button>
  );
}

function AuthorizationDialog({
  open,
  onOpenChange,
  authorization,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorization: NonNullable<ClientDoc["dataAuthorization"]>;
}) {
  const url = useSignedUrls([authorization.signatureKey])[authorization.signatureKey ?? ""];
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Autorización de tratamiento de datos" desktop="sheet">
      <div className="flex flex-col gap-6 pb-4">
        <p className="text-ink-soft">
          {AUTHORIZATION_METHOD_LABELS[authorization.method]} el {consentDate(authorization.at)}, a las {formatTime(authorization.at)}
        </p>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
          <img src={url} alt="Firma de la autorización" className="signature-ink h-24 w-auto self-start object-contain" />
        )}
        <p className="whitespace-pre-line">{authorization.policyText}</p>
      </div>
    </ResponsiveDialog>
  );
}
