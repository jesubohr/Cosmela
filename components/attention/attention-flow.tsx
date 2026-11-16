"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Ellipsis, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertChips } from "@/components/shared/alert-chips";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AssessmentStep } from "./assessment-step";
import { ClosingStep } from "./closing-step";
import { ConsentStep } from "./consent-step";
import { ContraindicationsStep } from "./contraindications-step";
import { DiscardAttentionDialog } from "./discard-dialog";
import { FichaStep } from "./ficha-step";
import { BlockedScreen, PostponedScreen, SuccessScreen } from "./finished-screens";
import { ProcedureStep } from "./procedure-step";
import { errorText, type DraftData, type StepProps } from "./step-parts";

const STEPS = [
  { title: "Ficha", component: FichaStep },
  { title: "Valoración", component: AssessmentStep },
  { title: "Contraindicaciones", component: ContraindicationsStep },
  { title: "Consentimiento", component: ConsentStep },
  { title: "Procedimiento", component: ProcedureStep },
  { title: "Cierre", component: ClosingStep },
] as const;

const STARTABLE = ["scheduled", "in_progress"];

/** `/atencion/[appointmentId]`: starts (or resumes) the session and runs the 6-step stepper. */
export function AttentionFlow({ appointmentId }: { appointmentId: Id<"appointments"> }) {
  const data = useQuery(api.sessions.attention, { appointmentId });
  const start = useMutation(api.sessions.start);
  const [startError, setStartError] = useState<string | null>(null);
  const starting = useRef(false);
  // Set when the attention is discarded, so the page does not start a new draft while it leaves.
  const [leaving, setLeaving] = useState(false);

  const needsStart = data && !data.session && STARTABLE.includes(data.appointment.status);
  useEffect(() => {
    if (!needsStart || starting.current || leaving) return;
    starting.current = true;
    start({ appointmentId }).catch((error) => setStartError(errorText(error)));
  }, [needsStart, start, appointmentId, leaving]);

  if (startError) return <BlockedScreen message={startError} />;
  if (data === undefined || needsStart || (leaving && !data.session)) return <FlowSkeleton />;
  if (!data.session) {
    return (
      <BlockedScreen
        message={
          data.appointment.status === "requested"
            ? "Esta cita es una solicitud por confirmar. Confírmala en la agenda para iniciar la atención."
            : "Esta cita ya no admite una atención. Revisa su estado en la agenda."
        }
      />
    );
  }
  const draft = data as DraftData;
  if (draft.session.status === "closed") return <SuccessScreen data={draft} />;
  if (draft.session.status === "postponed") return <PostponedScreen data={draft} />;
  return <Stepper data={draft} onLeave={() => setLeaving(true)} />;
}

function Stepper({ data, onLeave }: { data: DraftData; onLeave: () => void }) {
  const router = useRouter();
  const { client, treatment, appointment, session } = data;
  const [step, setStep] = useState(() => Math.min(session.step + 1, STEPS.length));
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [closing, setClosing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const draft = useRef<(() => Promise<unknown>) | null>(null);

  function go(next: number) {
    setDirection(next > step ? "forward" : "back");
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  async function closeFlow() {
    setClosing(true);
    try {
      await draft.current?.();
    } catch {
      // A half-filled step that fails validation stays as it was last saved.
    }
    toast.success("Atención guardada. Puedes continuarla desde Hoy.");
    router.push("/hoy");
  }

  // Today's pregnancy answers replace the last visit's in the alert chips.
  const { intake } = session;
  const alertSource =
    intake?.pregnant !== undefined
      ? { ...client, lastPregnancy: { pregnant: intake.pregnant, lactating: intake.lactating ?? false, at: session.startedAt } }
      : client;

  const { title, component: Step } = STEPS[step - 1];
  const props: StepProps = {
    data,
    onBack: step > 1 ? () => go(step - 1) : undefined,
    onDone: () => go(Math.min(step + 1, STEPS.length)),
    registerDraft: (save) => {
      draft.current = save;
    },
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-porcelain/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-porcelain/85">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 pt-3 pb-3">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-lg font-medium">{`${client.firstName} ${client.lastName}`.trim()}</span>
              <span className="truncate text-ink-soft">
                {treatment.name}
                <span className="font-display ml-3 text-ink tabular-nums">{formatTime(appointment.start)}</span>
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Más opciones" disabled={closing}>
                  <Ellipsis className="size-6" strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem variant="destructive" className="min-h-11 text-base" onSelect={() => setDiscarding(true)}>
                  Descartar atención
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" aria-label="Cerrar y guardar" onClick={() => void closeFlow()} disabled={closing} className="-mr-2">
              <X className="size-6" strokeWidth={1.75} />
            </Button>
          </div>
          <AlertChips client={alertSource} />
          <div className="flex items-center gap-3 pt-1">
            <span className="shrink-0 text-sm text-ink-soft tabular-nums">
              Paso {step} de {STEPS.length}
            </span>
            <div
              role="progressbar"
              aria-label="Avance de la atención"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={step}
              className="h-1 flex-1 overflow-hidden rounded-full bg-line"
            >
              <div className="h-full rounded-full bg-plum transition-[width] duration-300" style={{ width: `${(step / STEPS.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </header>

      <main
        key={step}
        className={cn(
          "mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-6 duration-150 animate-in fade-in",
          direction === "forward" ? "slide-in-from-right-2" : "slide-in-from-left-2",
          "motion-reduce:slide-in-from-right-0 motion-reduce:slide-in-from-left-0",
        )}
      >
        <h1 className="font-display mb-6 text-[1.75rem] leading-tight">{title}</h1>
        <Step {...props} />
      </main>
      <DiscardAttentionDialog
        sessionId={session._id}
        consentSigned={session.consent !== undefined}
        open={discarding}
        onOpenChange={setDiscarding}
        onBeforeDiscard={onLeave}
        onDiscarded={() => router.push("/hoy")}
      />
    </div>
  );
}

function FlowSkeleton() {
  return (
    <div aria-busy className="flex min-h-dvh flex-col">
      <div className="border-b border-line">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-1 w-full" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
