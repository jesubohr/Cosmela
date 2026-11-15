"use client";

import { useMutation } from "convex/react";
import { useEffect, useId, useState } from "react";
import { Chip } from "@/components/clients/chips";
import { FichaForm, fichaFromClient, useSaveFicha, type FichaErrors } from "@/components/clients/ficha-form";
import { FichaSummary } from "@/components/clients/ficha-summary";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { formatShortDate } from "@/lib/format";
import { errorText, StepBody, StepFooter, StepSection, YesNo, type StepProps } from "./step-parts";

/** Paso 1: the permanent ficha (complete on the first visit, confirm later) plus per-visit health. */
export function FichaStep({ data, onDone, registerDraft }: StepProps) {
  const { client, session } = data;
  const firstVisit = !client.fichaCompletedAt;
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

  const editing = firstVisit || changed === true;
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
            <p className="text-ink-soft">Es la primera visita de {client.firstName}. Completa su ficha; las preguntas de salud son opcionales.</p>
            <FichaForm value={ficha} onChange={setFicha} errors={errors} />
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
              <FichaForm value={ficha} onChange={setFicha} errors={errors} sections={["health", "habits", "skin"]} />
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
