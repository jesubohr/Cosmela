"use client";

import { useMutation } from "convex/react";
import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { SingleChips } from "@/components/clients/chips";
import { reasonsText, sessionsProgress } from "@/components/cases/labels";
import { MultiChoice } from "@/components/forms/choice-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OBSERVED_ALTERATIONS, REASONS, SKIN_TYPES, type ObservedKey, type ReasonKey } from "@/convex/lib/validators";
import { OBSERVED_LABELS, REASON_LABELS, SKIN_TYPE_LABELS } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import { SessionPhotos } from "./session-photos";
import { errorText, StepBody, StepFooter, StepSection, type StepProps } from "./step-parts";

/** Paso 2: which case this session belongs to, motivo, what the professional sees today, evolution, photos before. */
export function AssessmentStep({ data, onBack, onDone, registerDraft }: StepProps) {
  const { session, client, treatment, openCases } = data;
  const saveAssessment = useMutation(api.sessions.saveAssessment);
  const ids = { reasonOther: useId(), planned: useId(), evolution: useId(), observedOther: useId(), notes: useId(), observed: useId(), skin: useId() };

  // Cases with sessions done can be continued; a case without sessions is this session's new case.
  const continuable = openCases.filter((c) => c.sessionCount > 0);
  const current = openCases.find((c) => c._id === session.caseId) ?? data.case;
  const [choice, setChoice] = useState<Id<"cases"> | "new">(continuable.some((c) => c._id === session.caseId) ? session.caseId : "new");
  const chosen = choice === "new" ? null : continuable.find((c) => c._id === choice);

  const [reasons, setReasons] = useState<ReasonKey[]>(current?.reasons ?? []);
  const [reasonOther, setReasonOther] = useState(current?.reasonOther ?? "");
  const [planned, setPlanned] = useState<number | undefined>(current?.plannedSessions ?? treatment.suggestedSessions);
  const [observed, setObserved] = useState<ObservedKey[]>(session.assessment?.observed ?? []);
  const [observedOther, setObservedOther] = useState(session.assessment?.observedOther ?? "");
  const [skinType, setSkinType] = useState(session.assessment?.skinType ?? client.skin.type);
  const [notes, setNotes] = useState(session.assessment?.notes ?? "");
  const [evolution, setEvolution] = useState(session.intake?.evolution ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const number = chosen ? chosen.sessionCount + 1 : 1;

  function choose(next: Id<"cases"> | "new") {
    setChoice(next);
    const target = next === "new" ? null : continuable.find((c) => c._id === next);
    setReasons(target?.reasons ?? []);
    setReasonOther(target?.reasonOther ?? "");
    setPlanned(target?.plannedSessions ?? treatment.suggestedSessions);
  }

  const args = {
    sessionId: session._id,
    // A new case that only holds this session (e.g. after a postponed try) stays the same case.
    caseId: choice === "new" && current && current.sessionCount === 0 ? current._id : choice,
    reasons,
    reasonOther,
    plannedSessions: planned,
    assessment: { observed, observedOther, skinType, notes },
    evolution: number > 1 ? evolution : undefined,
  };

  useEffect(() => {
    registerDraft(() => saveAssessment(args));
    return () => registerDraft(null);
  });

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await saveAssessment(args);
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
        {continuable.length > 0 && (
          <StepSection title="Caso">
            <div role="radiogroup" aria-label="Caso" className="flex flex-col gap-2">
              {continuable.map((c) => (
                <CaseOption
                  key={c._id}
                  selected={choice === c._id}
                  onSelect={() => choose(c._id)}
                  title={`Continuar: ${reasonsText(c.reasons, c.reasonOther) || treatment.name}`}
                  detail={`${sessionsProgress(c.sessionCount, c.plannedSessions)}${c.lastSessionAt ? `, la última el ${formatShortDate(c.lastSessionAt)}` : ""}`}
                />
              ))}
              <CaseOption selected={choice === "new"} onSelect={() => choose("new")} title="Empezar un caso nuevo" detail="Para un motivo de consulta distinto." />
            </div>
          </StepSection>
        )}

        <StepSection title="Motivo de consulta" description={`Sesión ${number}${planned ? ` de ${planned}` : ""} de este caso.`}>
          <MultiChoice
            label="Motivo de consulta"
            options={REASONS.map((r) => ({ value: r, label: REASON_LABELS[r] }))}
            value={reasons}
            onChange={(next) => setReasons(next as ReasonKey[])}
          />
          {reasons.includes("other") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={ids.reasonOther} className="text-base">
                ¿Cuál?
              </Label>
              <Input id={ids.reasonOther} value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.planned} className="text-base">
              Sesiones planeadas
            </Label>
            <Stepper id={ids.planned} value={planned} onChange={setPlanned} />
          </div>
        </StepSection>

        {number > 1 && (
          <StepSection title="Evolución">
            <div className="flex flex-col gap-2">
              <Label htmlFor={ids.evolution} className="text-base">
                ¿Cómo evolucionó desde la última sesión?
              </Label>
              <Textarea id={ids.evolution} rows={3} className="min-h-24" value={evolution} onChange={(e) => setEvolution(e.target.value)} />
            </div>
          </StepSection>
        )}

        <StepSection title="Lo que observas hoy">
          <div className="flex flex-col gap-3">
            <span id={ids.observed} className="text-base font-medium">
              Alteraciones observadas
            </span>
            <MultiChoice
              labelledBy={ids.observed}
              options={OBSERVED_ALTERATIONS.map((o) => ({ value: o, label: OBSERVED_LABELS[o] }))}
              value={observed}
              onChange={(next) => setObserved(next as ObservedKey[])}
            />
            {observed.includes("other") && (
              <Input aria-label="Otra alteración" placeholder="¿Cuál?" value={observedOther} onChange={(e) => setObservedOther(e.target.value)} />
            )}
          </div>
          <div className="flex flex-col gap-3">
            <span id={ids.skin} className="text-base font-medium">
              Tipo de piel hoy
            </span>
            <SingleChips
              labelledBy={ids.skin}
              options={SKIN_TYPES.map((t) => ({ value: t, label: SKIN_TYPE_LABELS[t] }))}
              value={skinType}
              onChange={setSkinType}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.notes} className="text-base">
              Notas de la valoración
            </Label>
            <Textarea id={ids.notes} rows={2} className="min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </StepSection>

        <StepSection title="Fotos antes" description="Opcional. Toma la foto con buena luz y el mismo ángulo de siempre.">
          {session.consent?.photoUse === "none" ? (
            <p className="text-ink-soft">El cliente no autorizó fotos.</p>
          ) : (
            <SessionPhotos sessionId={session._id} photos={session.photos} kind="before" />
          )}
        </StepSection>
      </StepBody>
      <StepFooter onBack={onBack} onContinue={() => void submit()} pending={pending} error={error} />
    </>
  );
}

function CaseOption({ selected, onSelect, title, detail }: { selected: boolean; onSelect: () => void; title: string; detail: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        selected
          ? "flex min-h-16 flex-col items-start justify-center rounded-xl border border-plum/30 bg-lilac px-4 py-3 text-left"
          : "flex min-h-16 flex-col items-start justify-center rounded-xl border border-line bg-surface px-4 py-3 text-left hover:bg-porcelain"
      }
    >
      <span className={selected ? "font-medium text-plum" : "font-medium"}>{title}</span>
      <span className="text-sm text-ink-soft">{detail}</span>
    </button>
  );
}

/** Small number stepper (1–50) with − / + buttons, so planning sessions needs no keyboard. */
function Stepper({ id, value, onChange }: { id: string; value: number | undefined; onChange: (value: number | undefined) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" size="icon" aria-label="Una sesión menos" disabled={!value || value <= 1} onClick={() => onChange((value ?? 2) - 1)}>
        <Minus />
      </Button>
      <Input
        id={id}
        inputMode="numeric"
        className="w-20 text-center tabular-nums"
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
          onChange(digits ? Math.min(50, Math.max(1, Number(digits))) : undefined);
        }}
      />
      <Button type="button" variant="secondary" size="icon" aria-label="Una sesión más" disabled={(value ?? 0) >= 50} onClick={() => onChange((value ?? 0) + 1)}>
        <Plus />
      </Button>
    </div>
  );
}
