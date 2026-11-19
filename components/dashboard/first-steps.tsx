"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { Check, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { useBookingUrl } from "@/components/settings/booking-settings";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/convex/_generated/api";
import type { TodayData } from "./hoy-view";
import { Section } from "./parts";

type Step = { key: string; label: string; done: boolean; action: { href: string } | { onClick: () => void } };

/** "Primeros pasos" for admins until every step is done or the list is dismissed. */
export function FirstSteps({ checklist, bookingEnabled }: { checklist: NonNullable<TodayData["checklist"]>; bookingEnabled: boolean }) {
  const viewer = useViewer();
  const openSheet = useAgendaSheets();
  const dismiss = useMutation(api.dashboard.dismissChecklist);
  const mark = useMutation(api.dashboard.markChecklist);
  const bookingUrl = useBookingUrl(viewer.org.slug);
  // Phones get the system share sheet; computers copy the link.
  const isPhone = useIsMobile();

  async function shareBooking() {
    const text = `Reserva tu cita en ${viewer.org.name}`;
    try {
      if (isPhone && typeof navigator.share === "function") {
        await navigator.share({ title: viewer.org.name, text, url: bookingUrl });
      } else {
        await navigator.clipboard.writeText(bookingUrl);
        toast.success("Enlace copiado. Pégalo en tu WhatsApp o Instagram.");
      }
      await mark({ step: "booking" });
    } catch (error) {
      // Closing the share sheet is not an error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("No pudimos compartir el enlace. Cópialo desde Configuración, Reservas en línea.");
    }
  }

  const steps: Step[] = [
    { key: "client", label: "Crea tu primer cliente", done: checklist.client, action: { href: "/clientes/nuevo" } },
    {
      key: "appointment",
      label: "Agenda tu primera cita",
      done: checklist.appointment,
      action: { onClick: () => openSheet({ kind: "create", prefill: {} }) },
    },
    { key: "consent", label: "Revisa tu consentimiento informado", done: checklist.consent, action: { href: "/tratamientos" } },
    { key: "signature", label: "Guarda tu firma", done: checklist.signature, action: { href: "/configuracion/perfil" } },
    {
      key: "booking",
      label: "Comparte tu página de reservas",
      done: checklist.booking,
      action: bookingEnabled ? { onClick: () => void shareBooking() } : { href: "/configuracion/reservas" },
    },
  ];
  if (checklist.team !== null) {
    steps.push({ key: "team", label: "Invita a tu equipo", done: checklist.team, action: { href: "/configuracion/equipo" } });
  }
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <Section
      title="Primeros pasos"
      aside={
        <Button
          variant="ghost"
          size="sm"
          className="text-ink-soft"
          onClick={() => void dismiss().catch(() => toast.error("No pudimos ocultar la lista. Intenta de nuevo."))}
        >
          Ocultar
        </Button>
      }
    >
      <p className="-mt-2 text-ink-soft">
        {doneCount} de {steps.length} listos
      </p>
      <ul className="divide-y divide-line border-y border-line">
        {steps.map((step) => (
          <li key={step.key}>
            {step.done ? (
              <div className="flex min-h-14 items-center gap-3 text-ink-soft">
                <StepMark done />
                <span>{step.label}</span>
                <span className="sr-only">, listo</span>
              </div>
            ) : (
              <StepAction action={step.action}>
                <StepMark done={false} />
                <span className="flex-1 font-medium">{step.label}</span>
                <ChevronRight aria-hidden className="size-5 text-ink-soft" />
              </StepAction>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function StepAction({ action, children }: { action: Step["action"]; children: ReactNode }) {
  const className = "-mx-3 flex min-h-14 w-[calc(100%+1.5rem)] items-center gap-3 rounded-lg px-3 text-left hover:bg-lilac/60";
  if ("href" in action) {
    return (
      <Link href={action.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {children}
    </button>
  );
}

function StepMark({ done }: { done: boolean }) {
  return done ? (
    <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
      <Check className="size-4" strokeWidth={2.5} />
    </span>
  ) : (
    <span aria-hidden className="size-6 shrink-0 rounded-full border-[1.5px] border-field-line" />
  );
}
