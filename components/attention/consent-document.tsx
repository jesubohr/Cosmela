"use client";

import { consentDate, verificationCode } from "@/convex/lib/consent";
import type { SessionConsent } from "@/convex/lib/validators";
import { PHOTO_USE_LABELS } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSignedUrls } from "@/components/shared/use-signed-urls";

/** The signed consent snapshot: text, photo use, signatures, and evidence. Used on screen and in print. */
export function ConsentDocument({
  consent,
  clientName,
  professionalName,
  className,
}: {
  consent: SessionConsent;
  clientName: string;
  professionalName: string;
  className?: string;
}) {
  const urls = useSignedUrls([consent.clientSignatureKey, consent.professionalSignatureKey]);
  const signer = consent.guardian ? `${consent.guardian.name} (acudiente)` : clientName;

  return (
    <article className={cn("flex flex-col gap-6", className)}>
      <p className="max-w-[70ch] whitespace-pre-line">{consent.text}</p>
      {consent.guardian && (
        <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="text-ink-soft">Acudiente</dt>
          <dd>{consent.guardian.name}</dd>
          <dt className="text-ink-soft">Documento del acudiente</dt>
          <dd>{consent.guardian.document}</dd>
          <dt className="text-ink-soft">Parentesco</dt>
          <dd>{consent.guardian.relationship}</dd>
        </dl>
      )}
      <p>
        <span className="text-ink-soft">Uso de fotos: </span>
        {PHOTO_USE_LABELS[consent.photoUse]}
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <Signature url={urls[consent.clientSignatureKey]} name={signer} role={consent.guardian ? "Firma del acudiente" : "Firma del cliente"} />
        <Signature
          url={consent.professionalSignatureKey ? urls[consent.professionalSignatureKey] : undefined}
          name={professionalName}
          role="Firma del profesional"
        />
      </div>
      <dl className="flex flex-col gap-1 text-sm text-ink-soft">
        <div>
          <dt className="inline">Firmado el </dt>
          <dd className="inline">
            {consentDate(consent.signedAt)}, {formatTime(consent.signedAt)}
          </dd>
        </div>
        <div>
          <dt className="inline">Código de verificación: </dt>
          <dd className="inline font-medium tabular-nums text-ink">{verificationCode(consent.hash)}</dd>
        </div>
      </dl>
    </article>
  );
}

function Signature({ url, name, role }: { url?: string; name: string; role: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-28 items-end border-b border-ink/40 pb-1">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
          <img src={url} alt={`${role}: ${name}`} className="signature-ink max-h-full max-w-full object-contain" />
        )}
      </div>
      <figcaption className="flex flex-col">
        <span className="font-medium">{name}</span>
        <span className="text-sm text-ink-soft">{role}</span>
      </figcaption>
    </figure>
  );
}
