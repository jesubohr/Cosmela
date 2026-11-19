"use client";

import { useMutation } from "convex/react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/clients/chips";
import { errorText } from "@/components/forms/error-message";
import { useUploadFile } from "@/components/shared/photo-upload";
import { SignaturePad, type SignaturePadHandle } from "@/components/shared/signature-pad";
import { useSignedUrl } from "@/components/shared/use-signed-urls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { SIGNATURE_AGREEMENT_LABEL, renderConsentText, renderDocument } from "@/convex/lib/consent";
import { DOCUMENT_TYPES, PHOTO_USES, type DocumentType, type PhotoUse } from "@/convex/lib/validators";
import { DOCUMENT_TYPE_LABELS, PHOTO_USE_LABELS } from "@/lib/constants";
import { ConsentDocument } from "./consent-document";
import { StepBody, StepFooter, StepSection, type StepProps } from "./step-parts";


/** Procedure consent follows the separate authorization to collect health data. */
export function ConsentStep(props: StepProps) {
  const { session, client, member } = props.data;
  if (session.consent) {
    return (
      <>
        <StepBody>
          <StepSection title="Consentimiento firmado" description="Quedó guardado y ya no se puede cambiar.">
            <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
              <ConsentDocument consent={session.consent} clientName={`${client.firstName} ${client.lastName}`.trim()} professionalName={member.name} />
            </div>
          </StepSection>
        </StepBody>
        <StepFooter onBack={props.onBack} onContinue={props.onDone} />
      </>
    );
  }
  return <SignForm {...props} />;
}

function SignForm({ data, onBack, onDone }: StepProps) {
  // The member running the attention signs as the professional.
  const { session, client, treatment, signer, org } = data;
  const upload = useUploadFile();
  const sign = useMutation(api.sessions.signConsent);
  const attach = useMutation(api.files.attach);
  const clientPad = useRef<SignaturePadHandle>(null);
  const proPad = useRef<SignaturePadHandle>(null);
  const ids = { docType: useId(), authorize: useId(), saveSignature: useId(), photoUse: useId() };

  const savedSignatureUrl = useSignedUrl(signer.signatureKey);

  const [docType, setDocType] = useState<DocumentType | undefined>("CC");
  const [docNumber, setDocNumber] = useState("");
  const [photoUse, setPhotoUse] = useState<PhotoUse | undefined>();
  const [authorize, setAuthorize] = useState(false);
  const [clientSigned, setClientSigned] = useState(false);
  const [redrawPro, setRedrawPro] = useState(!signer.signatureKey);
  const [proSigned, setProSigned] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  const clientName = `${client.firstName} ${client.lastName}`.trim();
  const documentText = client.documentNumber ? renderDocument(client.documentType, client.documentNumber) : renderDocument(docType, docNumber);
  const text = renderConsentText(treatment.consentText, {
    clientName,
    documentText,
    treatmentName: treatment.name,
    orgName: org.name,
    at: openedAt,
  });
  const signerLabel = `Firma de ${client.firstName}`;
  const hasBeforePhotos = session.photos.length > 0;

  const blocked = !photoUse
    ? "Elige el uso de fotos para continuar."
    : !authorize
      ? "Acepta el uso de la firma en pantalla."
      : !clientSigned
        ? `Falta la firma de ${client.firstName}.`
        : redrawPro && !proSigned ? "Falta tu firma." : null;

  async function submit() {
    if (!photoUse) return;
    setPending(true);
    setError(null);
    let clientSignatureKey: string;
    let professionalSignatureKey: string | undefined;
    try {
      const clientBlob = await clientPad.current?.toBlob();
      if (!clientBlob) throw new Error("empty signature");
      clientSignatureKey = await upload(clientBlob, "signature");
      if (redrawPro) {
        const proBlob = await proPad.current?.toBlob();
        if (!proBlob) throw new Error("empty signature");
        professionalSignatureKey = await upload(proBlob, "signature");
      }
    } catch (err) {
      // Storage failures (e.g. the bucket rejects this site's origin) are not connection problems.
      console.error("Signature upload failed", err);
      setError("No pudimos guardar las firmas. Intenta de nuevo; si sigue, escríbenos.");
      setPending(false);
      return;
    }
    try {
      if (professionalSignatureKey && !signer.signatureKey && saveToProfile) {
        await attach({ key: professionalSignatureKey, target: { kind: "memberSignature" } });
      }
      await sign({
        sessionId: session._id,
        photoUse,
        signatureAccepted: authorize,
        clientSignatureKey,
        professionalSignatureKey,
        userAgent: navigator.userAgent,
        document: !client.documentNumber && docNumber.trim() ? { type: docType, number: docNumber } : undefined,
      });
      toast.success("Consentimiento firmado");
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <StepBody>
        <StepSection title="Consentimiento informado" description="Léelo con el cliente o entrégale el teléfono.">
          {!client.documentNumber && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={ids.docType} className="text-base">
                Documento <span className="font-normal text-ink-soft">(opcional)</span>
              </Label>
              <div className="flex gap-2">
                <Select value={docType ?? ""} onValueChange={(v) => setDocType(v as DocumentType)}>
                  <SelectTrigger id={ids.docType} aria-label="Tipo de documento" className="w-28 shrink-0">
                    <SelectValue placeholder="Tipo">{docType}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.filter((type) => type !== "TI").map((type) => (
                      <SelectItem key={type} value={type} className="min-h-11 text-base">
                        {DOCUMENT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input aria-label="Número de documento" inputMode="numeric" autoComplete="off" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
              </div>
            </div>
          )}
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
            <p className="max-w-[70ch] whitespace-pre-line">{text}</p>
          </div>
        </StepSection>

        <StepSection title="Uso de fotos">
          <div role="radiogroup" aria-label="Uso de fotos" className="flex flex-col gap-2">
            {PHOTO_USES.filter((use) => use !== "clinical_and_marketing").map((use) => (
              <Chip key={use} role="radio" aria-checked={photoUse === use} selected={photoUse === use} onClick={() => setPhotoUse(use)} className="min-h-12 self-stretch rounded-xl px-4">
                {PHOTO_USE_LABELS[use]}
              </Chip>
            ))}
          </div>
          {photoUse === "none" && hasBeforePhotos && <p className="text-sm text-amber">Las fotos de antes se eliminarán al firmar.</p>}
        </StepSection>

        <div className="flex items-start gap-3">
          <Checkbox id={ids.authorize} checked={authorize} onCheckedChange={(value) => setAuthorize(value === true)} className="mt-0.5 size-6" />
          <Label htmlFor={ids.authorize} className="max-w-[70ch] text-base leading-normal font-normal">
            {SIGNATURE_AGREEMENT_LABEL}
          </Label>
        </div>
        <StepSection title={signerLabel}>
          <SignaturePad ref={clientPad} label={signerLabel} onChange={(empty) => setClientSigned(!empty)} disabled={pending} />
        </StepSection>

        <StepSection title="Tu firma">
          {redrawPro ? (
            <div className="flex flex-col gap-3">
              <SignaturePad ref={proPad} label="Tu firma" onChange={(empty) => setProSigned(!empty)} disabled={pending} />
              {!signer.signatureKey && (
                <div className="flex items-center gap-3">
                  <Checkbox id={ids.saveSignature} checked={saveToProfile} onCheckedChange={(value) => setSaveToProfile(value === true)} className="size-6" />
                  <Label htmlFor={ids.saveSignature} className="text-base font-normal">
                    Guardar esta firma en mi perfil
                  </Label>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex h-28 items-center rounded-xl border border-line bg-surface px-4">
                {savedSignatureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
                  <img src={savedSignatureUrl} alt={`Firma guardada de ${signer.name}`} className="signature-ink max-h-24 max-w-full object-contain" />
                )}
              </div>
              <p className="text-sm text-ink-soft">Se usa la firma guardada en el perfil.</p>
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setRedrawPro(true)}>
                Firmar de nuevo
              </Button>
            </div>
          )}
        </StepSection>
      </StepBody>
      <StepFooter onBack={onBack} onContinue={() => void submit()} label="Firmar consentimiento" pending={pending} blocked={blocked} error={error} />
    </>
  );
}
