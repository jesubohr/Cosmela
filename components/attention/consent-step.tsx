"use client";

import { useMutation } from "convex/react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Chip, SingleChips } from "@/components/clients/chips";
import { useUploadFile } from "@/components/shared/photo-upload";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { SignaturePad, type SignaturePadHandle } from "@/components/shared/signature-pad";
import { useSignedUrl } from "@/components/shared/use-signed-urls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { isMinor, renderConsentText, renderDocument } from "@/convex/lib/consent";
import { DOCUMENT_TYPES, PHOTO_USES, type DocumentType, type PhotoUse } from "@/convex/lib/validators";
import { DOCUMENT_TYPE_LABELS, PHOTO_USE_LABELS } from "@/lib/constants";
import { ConsentDocument } from "./consent-document";
import { errorText, StepBody, StepFooter, StepSection, type StepProps } from "./step-parts";

const RELATIONSHIPS = ["Madre", "Padre", "Otro"] as const;

/** Paso 4: gate. Consent text with placeholders, photo use, Habeas Data on the first visit, and signatures. */
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
  const ids = { docType: useId(), guardianName: useId(), guardianDoc: useId(), authorize: useId(), saveSignature: useId(), relationship: useId(), photoUse: useId() };

  const minor = isMinor(client.birthDate);
  const needsAuthorization = !client.dataAuthorization;
  const savedSignatureUrl = useSignedUrl(signer.signatureKey);

  const [docType, setDocType] = useState<DocumentType | undefined>(minor ? "TI" : "CC");
  const [docNumber, setDocNumber] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianDoc, setGuardianDoc] = useState("");
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number] | undefined>();
  const [relationshipOther, setRelationshipOther] = useState("");
  const [photoUse, setPhotoUse] = useState<PhotoUse | undefined>();
  const [authorize, setAuthorize] = useState(false);
  const [clientSigned, setClientSigned] = useState(false);
  const [redrawPro, setRedrawPro] = useState(!signer.signatureKey);
  const [proSigned, setProSigned] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [policyOpen, setPolicyOpen] = useState(false);
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
  const relationshipText = relationship === "Otro" ? relationshipOther.trim() : relationship;
  const signerLabel = minor ? "Firma del acudiente" : `Firma de ${client.firstName}`;
  const hasBeforePhotos = session.photos.length > 0;

  const blocked =
    minor && (!guardianName.trim() || !guardianDoc.trim() || !relationshipText)
      ? "Escribe los datos del acudiente para continuar."
      : !photoUse
        ? "Elige el uso de fotos para continuar."
        : needsAuthorization && !authorize
          ? "Falta la autorización de tratamiento de datos."
          : !clientSigned
            ? minor
              ? "Falta la firma del acudiente."
              : `Falta la firma de ${client.firstName}.`
            : redrawPro && !proSigned
              ? "Falta tu firma."
              : null;

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
        clientSignatureKey,
        professionalSignatureKey,
        userAgent: navigator.userAgent,
        document: !client.documentNumber && docNumber.trim() ? { type: docType, number: docNumber } : undefined,
        guardian: minor ? { name: guardianName, document: guardianDoc, relationship: relationshipText ?? "" } : undefined,
        authorizeData: needsAuthorization ? authorize : undefined,
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
                {minor ? "Documento del menor" : "Documento"} <span className="font-normal text-ink-soft">(opcional)</span>
              </Label>
              <div className="flex gap-2">
                <Select value={docType ?? ""} onValueChange={(v) => setDocType(v as DocumentType)}>
                  <SelectTrigger id={ids.docType} aria-label="Tipo de documento" className="w-28 shrink-0">
                    <SelectValue placeholder="Tipo">{docType}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
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

        {minor && (
          <StepSection title="Datos del acudiente" description={`${client.firstName} es menor de edad, así que firma su acudiente.`}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={ids.guardianName} className="text-base">
                  Nombre completo
                </Label>
                <Input id={ids.guardianName} autoComplete="off" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={ids.guardianDoc} className="text-base">
                  Documento
                </Label>
                <Input id={ids.guardianDoc} inputMode="numeric" autoComplete="off" placeholder="CC 52.000.111" value={guardianDoc} onChange={(e) => setGuardianDoc(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <span id={ids.relationship} className="text-base font-medium">
                Parentesco
              </span>
              <SingleChips labelledBy={ids.relationship} options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))} value={relationship} onChange={setRelationship} />
              {relationship === "Otro" && (
                <Input aria-label="Parentesco" placeholder="Tía, abuelo, tutor legal…" value={relationshipOther} onChange={(e) => setRelationshipOther(e.target.value)} />
              )}
            </div>
          </StepSection>
        )}

        <StepSection title="Uso de fotos">
          <div role="radiogroup" aria-label="Uso de fotos" className="flex flex-col gap-2">
            {PHOTO_USES.map((use) => (
              <Chip key={use} role="radio" aria-checked={photoUse === use} selected={photoUse === use} onClick={() => setPhotoUse(use)} className="min-h-12 self-stretch rounded-xl px-4">
                {PHOTO_USE_LABELS[use]}
              </Chip>
            ))}
          </div>
          {photoUse === "none" && hasBeforePhotos && <p className="text-sm text-amber">Las fotos de antes se eliminarán al firmar.</p>}
        </StepSection>

        {needsAuthorization && (
          <StepSection title="Autorización de tratamiento de datos">
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
              <p className="max-w-[70ch]">
                {org.name} guarda tus datos de contacto y de salud, tus fotos y tu firma para atenderte y llevar tu historia. Los datos de salud son sensibles y no tienes la obligación de darlos. Puedes conocer, corregir o pedir que se eliminen tus datos cuando quieras.
              </p>
              <Button variant="link" className="h-auto self-start p-0" onClick={() => setPolicyOpen(true)}>
                Leer la política completa
              </Button>
              <div className="flex items-start gap-3">
                <Checkbox id={ids.authorize} checked={authorize} onCheckedChange={(value) => setAuthorize(value === true)} className="mt-1 size-6" />
                <Label htmlFor={ids.authorize} className="text-base leading-normal font-normal">
                  {minor ? "Como acudiente, autorizo" : "Autorizo"} a {org.name} a tratar mis datos personales, incluidos los de salud, según su política de tratamiento de datos.
                </Label>
              </div>
            </div>
          </StepSection>
        )}

        <StepSection title={signerLabel} description={needsAuthorization ? "Esta firma acepta el consentimiento y la autorización de datos." : undefined}>
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

      <ResponsiveDialog open={policyOpen} onOpenChange={setPolicyOpen} title="Política de tratamiento de datos" desktop="sheet">
        <p className="whitespace-pre-line pb-4">{org.privacyPolicy}</p>
      </ResponsiveDialog>
    </>
  );
}
