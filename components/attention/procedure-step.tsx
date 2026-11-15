"use client";

import { useMutation } from "convex/react";
import { useEffect, useId, useState } from "react";
import { FormRenderer, validateAnswers, type AnswerErrors } from "@/components/forms/form-renderer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { FormAnswers } from "@/convex/lib/validators";
import { SessionPhotos } from "./session-photos";
import { errorText, StepBody, StepFooter, StepSection, type StepProps } from "./step-parts";

/** Paso 5: the treatment's custom form, notes, and photos after. */
export function ProcedureStep({ data, onBack, onDone, registerDraft }: StepProps) {
  const { session, treatment } = data;
  const save = useMutation(api.sessions.saveProcedure);
  const notesId = useId();
  const fields = session.procedure?.fields ?? treatment.formFields;
  const [answers, setAnswers] = useState<FormAnswers>(session.procedure?.answers ?? {});
  const [notes, setNotes] = useState(session.procedure?.notes ?? "");
  const [errors, setErrors] = useState<AnswerErrors>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    registerDraft(() => save({ sessionId: session._id, answers, notes }));
    return () => registerDraft(null);
  });

  async function submit() {
    const found = validateAnswers(fields, answers);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError("Completa los campos marcados.");
      document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setPending(true);
    setError(null);
    try {
      await save({ sessionId: session._id, answers, notes });
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
        {fields.length > 0 ? (
          <StepSection title={treatment.name}>
            <FormRenderer fields={fields} value={answers} onChange={setAnswers} errors={errors} />
          </StepSection>
        ) : null}
        <StepSection title="Notas">
          <div className="flex flex-col gap-2">
            <Label htmlFor={notesId} className="text-base">
              Notas del procedimiento
            </Label>
            <Textarea id={notesId} rows={3} className="min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </StepSection>
        <StepSection title="Fotos después" description="Opcional.">
          {session.consent?.photoUse === "none" ? (
            <p className="text-ink-soft">El cliente no autorizó fotos.</p>
          ) : (
            <SessionPhotos sessionId={session._id} photos={session.photos} kind="after" />
          )}
        </StepSection>
      </StepBody>
      <StepFooter onBack={onBack} onContinue={() => void submit()} pending={pending} error={error} />
    </>
  );
}
