"use client";

import { useMutation } from "convex/react";
import { Check, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/clients/chips";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { GENERAL_CONTRAINDICATIONS, type GeneralContraindicationKey } from "@/convex/lib/validators";
import { ALLERGY_LABELS, GENERAL_CONTRAINDICATION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { errorText, StepBody, StepFooter, StepSection, type DraftData, type StepProps } from "./step-parts";

const label = (key: GeneralContraindicationKey) => GENERAL_CONTRAINDICATION_LABELS[key];

/** Hints from the ficha and today's answers, by general contraindication. */
function flags({ client, session }: DraftData): Partial<Record<GeneralContraindicationKey, string>> {
  const result: Partial<Record<GeneralContraindicationKey, string>> = {};
  const { health } = client;
  if (session.intake?.pregnant) result.pregnancy = "Marcado porque hoy respondió que hay embarazo.";
  if (session.intake?.lactating) result.lactation = "Marcado porque hoy respondió que hay lactancia.";
  if (health.conditions.includes("herpes")) result.active_herpes = "Tiene antecedente de herpes simple. Revisa si hay una lesión activa.";
  if (health.allergies.length > 0) {
    const list = health.allergies.map((a) => ALLERGY_LABELS[a].toLowerCase()).join(", ");
    result.product_allergy = `Alergias registradas: ${list}${health.allergiesDetail ? ` (${health.allergiesDetail})` : ""}.`;
  }
  if (/isotret|roacut|acnotin/i.test(session.intake?.medications ?? "")) {
    result.isotretinoin = "En sus medicamentos aparece la isotretinoína.";
  }
  return result;
}

/** Paso 3: gate. Nothing applies, or a marked item leads to postponing or continuing with a justification. */
export function ContraindicationsStep(props: StepProps) {
  if (props.data.session.consent) return <Locked {...props} />;
  return <Checklist {...props} />;
}

function Checklist({ data, onBack, onDone }: StepProps) {
  const { session, treatment } = data;
  const save = useMutation(api.sessions.saveContraindications);
  const postpone = useMutation(api.sessions.postpone);
  const justificationId = useId();
  const hints = flags(data);
  const premarked = [session.intake?.pregnant && label("pregnancy"), session.intake?.lactating && label("lactation")].filter(
    (item): item is string => Boolean(item),
  );

  const saved = session.contraindications;
  const [marked, setMarked] = useState<string[]>(saved?.present ?? premarked);
  const [noneApplies, setNoneApplies] = useState(saved ? saved.present.length === 0 : false);
  const [proceed, setProceed] = useState(Boolean(saved?.justification));
  const [justification, setJustification] = useState(saved?.justification ?? "");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = [
    ...GENERAL_CONTRAINDICATIONS.map((key) => ({ label: label(key), hint: hints[key] })),
    ...treatment.contraindications.map((item) => ({ label: item, hint: undefined })),
  ];
  // Keep the list order, not the tap order.
  const present = items.map((i) => i.label).filter((item) => marked.includes(item));

  function toggle(item: string) {
    setNoneApplies(false);
    setMarked((current) => (current.includes(item) ? current.filter((i) => i !== item) : [...current, item]));
  }

  // Today's pregnancy or lactation answers can only be passed with "Continuar bajo mi criterio".
  const unmarked = premarked.filter((item) => !present.includes(item));
  const blocked =
    unmarked.length > 0
      ? `Hoy respondió que hay ${unmarked.join(" y ").toLowerCase()}. Déjalo marcado y elige si pospones o continúas bajo tu criterio.`
      : present.length === 0 && !noneApplies
      ? "Marca las contraindicaciones presentes o toca «Ninguna aplica»."
      : present.length > 0 && !proceed
        ? "Más abajo, elige si pospones el tratamiento o continúas bajo tu criterio."
        : present.length > 0 && !justification.trim()
          ? "Escribe por qué continúas para seguir."
          : null;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await save({ sessionId: session._id, present, justification: present.length > 0 ? justification : undefined });
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  async function confirmPostpone() {
    setPending(true);
    try {
      await postpone({ sessionId: session._id, present });
      toast.success("Tratamiento pospuesto");
    } catch (err) {
      setError(errorText(err));
      setConfirming(false);
      setPending(false);
    }
  }

  return (
    <>
      <StepBody>
        <StepSection title="¿Alguna aplica hoy?" description="Pregunta y revisa cada una antes de continuar.">
          <Chip
            aria-pressed={noneApplies}
            selected={noneApplies}
            disabled={premarked.length > 0}
            onClick={() => {
              setNoneApplies(true);
              setMarked([]);
              setProceed(false);
            }}
            className="min-h-12 self-start px-5"
          >
            Ninguna aplica
          </Chip>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((item) => {
              const checked = marked.includes(item.label);
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(item.label)}
                    className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-porcelain"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                        checked ? "border-rose bg-rose text-white" : "border-ink-soft/50 bg-surface",
                      )}
                    >
                      {checked && <Check className="size-4" strokeWidth={2.5} />}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className={cn(checked && "font-medium text-rose")}>{item.label}</span>
                      {item.hint && <span className="text-sm text-amber">{item.hint}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </StepSection>

        {present.length > 0 && (
          <section role="alert" className="flex flex-col gap-4 rounded-xl bg-rose-soft p-4 text-rose">
            <div className="flex gap-3">
              <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
              <p>
                {present.length === 1 ? "Marcaste una contraindicación" : `Marcaste ${present.length} contraindicaciones`}: {present.join(", ")}. Lo más seguro es posponer el tratamiento.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="destructive" size="lg" onClick={() => setConfirming(true)}>
                Posponer tratamiento
              </Button>
              <Button
                variant="secondary"
                size="lg"
                aria-pressed={proceed}
                onClick={() => setProceed(true)}
                className={cn(proceed && "border-plum/30 bg-lilac text-plum hover:bg-lilac")}
              >
                Continuar bajo mi criterio
              </Button>
            </div>
            {proceed && (
              <div className="flex flex-col gap-2 text-ink">
                <Label htmlFor={justificationId} className="text-base">
                  ¿Por qué continúas?
                </Label>
                <Textarea
                  id={justificationId}
                  rows={3}
                  className="min-h-24"
                  placeholder="La lesión está fuera de la zona a tratar…"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
              </div>
            )}
          </section>
        )}
      </StepBody>
      <StepFooter onBack={onBack} onContinue={() => void submit()} pending={pending} blocked={blocked} error={error} />

      <ResponsiveDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Posponer el tratamiento?"
        description="La cita queda cancelada como «Pospuesta por contraindicación» y esta atención se guarda en su historial."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Volver
            </Button>
            <Button variant="destructive" onClick={() => void confirmPostpone()} disabled={pending}>
              Posponer tratamiento
            </Button>
          </>
        }
      >
        <span />
      </ResponsiveDialog>
    </>
  );
}

/** After the consent is signed, contraindications are read-only. */
function Locked({ data, onBack, onDone }: StepProps) {
  const saved = data.session.contraindications;
  return (
    <>
      <StepBody>
        <StepSection title="Contraindicaciones" description="El consentimiento ya está firmado, así que esta revisión no se puede cambiar.">
          {saved && saved.present.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
              <p className="font-medium text-rose">{saved.present.join(", ")}</p>
              {saved.justification && <p className="text-ink-soft">Continuó bajo su criterio: {saved.justification}</p>}
            </div>
          ) : (
            <p className="rounded-xl border border-line bg-surface p-4">Ninguna aplica.</p>
          )}
        </StepSection>
      </StepBody>
      <StepFooter onBack={onBack} onContinue={onDone} />
    </>
  );
}
