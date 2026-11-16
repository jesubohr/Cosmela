"use client";

import { useMutation } from "convex/react";
import { useEffect, useId, useState } from "react";
import { Chip } from "@/components/clients/chips";
import { FichaForm, fichaFromClient, useSaveFicha, withoutFixedErrors, type FichaErrors, type FichaValue } from "@/components/clients/ficha-form";
import { FichaSummary } from "@/components/clients/ficha-summary";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { formatShortDate } from "@/lib/format";
import { errorText, StepBody, StepFooter, StepSection, YesNo, type StepProps } from "./step-parts";

/** Paso 1: the permanent ficha (complete or confirm it on the first visit, review it later) plus per-visit health. */
export function FichaStep(props: StepProps) {
  if (props.data.session.consent) return <Locked {...props} />;
  return <Editable {...props} />;
}

function Editable({ data, onDone, registerDraft }: StepProps) {
  const { client, session, firstVisit } = data;
  const saveFicha = useSaveFicha();
  const saveIntake = useMutation(api.sessions.saveIntake);
  const ids = { medications: useId(), changes: useId() };

  const [ficha, setFicha] = useState(() => fichaFromClient(client));
  const [errors, setErrors] = useState<FichaErrors>({});
  const [changed, setChanged] = useState<boolean | undefined>(session.intake && !firstVisit ? session.intake.healthChanged : undefined);
  const [medications, setMedications] = useState(session.intake?.medications ?? client.lastMedications ?? "");
  const [pregnant, setPregnant] = useState(session.intake?.pregnant);
  const [lactating, setLactating] = useState(session.intake?.lactating);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateFicha(next: FichaValue) {
    setErrors((current) => withoutFixedErrors(current, ficha, next));
    setFicha(next);
  }

  const editing = firstVisit || changed === true;
  const missing = [!client.skin.fitzpatrick && "fototipo", !client.skin.type && "tipo de piel"].filter((item): item is string => Boolean(item));
  const asksPregnancy = (editing ? ficha.sex : client.sex) !== "male";
  const blocked =
    !firstVisit && changed === undefined
      ? "Elige «Sin cambios» o «Actualizar» para continuar."
      : asksPregnancy && (pregnant === undefined || lactating === undefined)
        ? "Responde si hay embarazo o lactancia para continuar."
        : null;

  const intake = {
    sessionId: session._id,
    healthChanged: firstVisit || changed === true,
    medications,
    pregnant: asksPregnancy ? pregnant : undefined,
    lactating: asksPregnancy ? lactating : undefined,
  };

  useEffect(() => {
    registerDraft(blocked ? null : () => saveIntake(intake));
    return () => registerDraft(null);
  });

  async function submit() {
    setPending(true);
    setError(null);
    try {
      if (editing) {
        const result = await saveFicha({ clientId: client._id, value: ficha });
        if (!result.ok) {
          setErrors(result.errors);
          setError("Revisa los datos marcados en la ficha.");
          return;
        }
        setErrors({});
      }
      await saveIntake(intake);
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
        {firstVisit ? (
          <>
            <div className="flex flex-col gap-1 text-ink-soft">
              <p>
                Es la primera visita de {client.firstName}. {client.fichaCompletedAt ? "Confirma su ficha" : "Completa su ficha"}; las preguntas de salud son
                opcionales.
              </p>
              {missing.length > 0 && <p className="text-amber">Falta: {missing.join(" y ")}.</p>}
            </div>
            <FichaForm value={ficha} onChange={updateFicha} errors={errors} />
          </>
        ) : (
          <>
            <StepSection
              title="¿Hubo cambios en tu salud desde la última visita?"
              description={client.healthReviewedAt ? `Revisada por última vez el ${formatShortDate(client.healthReviewedAt)}.` : undefined}
            >
              <div role="radiogroup" aria-label="Cambios en la salud" className="grid grid-cols-2 gap-2">
                <Chip role="radio" aria-checked={changed === false} selected={changed === false} onClick={() => setChanged(false)} className="min-h-12 justify-center">
                  Sin cambios
                </Chip>
                <Chip role="radio" aria-checked={changed === true} selected={changed === true} onClick={() => setChanged(true)} className="min-h-12 justify-center">
                  Actualizar
                </Chip>
              </div>
            </StepSection>
            {changed ? (
              <FichaForm value={ficha} onChange={updateFicha} errors={errors} sections={["health", "habits", "skin"]} />
            ) : (
              <FichaSummary client={client} sections={["health", "skin"]} />
            )}
          </>
        )}

        <StepSection title="Hoy">
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.medications} className="text-base">
              Medicamentos actuales
            </Label>
            <Textarea
              id={ids.medications}
              rows={2}
              className="min-h-20"
              placeholder="Anticonceptivos, isotretinoína, antibióticos…"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Chip selected={medications.trim() === "Ninguno"} onClick={() => setMedications("Ninguno")} className="min-h-10">
                Ninguno
              </Chip>
              {client.lastMedications && !session.intake && (
                <span className="text-sm text-ink-soft">Traído de la última visita. Confírmalo con el cliente.</span>
              )}
            </div>
          </div>
          {asksPregnancy && (
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
              <YesNo label="Embarazo" value={pregnant} onChange={setPregnant} />
              <YesNo label="Lactancia" value={lactating} onChange={setLactating} />
            </div>
          )}
        </StepSection>
      </StepBody>
      <StepFooter onContinue={() => void submit()} pending={pending} blocked={blocked} error={error} />
    </>
  );
}

/** After the consent is signed, today's answers are part of the signed record and read-only. */
function Locked({ data, onBack, onDone }: StepProps) {
  const { client, session } = data;
  const intake = session.intake;
  const yesNo = (value: boolean | undefined) => (value === undefined ? "Sin dato" : value ? "Sí" : "No");
  return (
    <>
      <StepBody>
        <FichaSummary client={client} sections={["health", "skin"]} />
        <StepSection title="Hoy" description="El consentimiento ya está firmado, así que estas respuestas no se pueden cambiar.">
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-soft">Medicamentos actuales</dt>
            <dd>{intake?.medications || "Sin dato"}</dd>
            {client.sex !== "male" && (
              <>
                <dt className="text-ink-soft">Embarazo</dt>
                <dd>{yesNo(intake?.pregnant)}</dd>
                <dt className="text-ink-soft">Lactancia</dt>
                <dd>{yesNo(intake?.lactating)}</dd>
              </>
            )}
          </dl>
        </StepSection>
      </StepBody>
      <StepFooter onBack={onBack} onContinue={onDone} />
    </>
  );
}
