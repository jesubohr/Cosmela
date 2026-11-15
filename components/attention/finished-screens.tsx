"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { MessageCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppointmentForm } from "@/components/agenda/appointment-form";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { errorText, type DraftData } from "./step-parts";

/** Prefilled WhatsApp text with the aftercare list. */
export function aftercareMessage({ firstName, treatmentName, items, notes, orgName }: {
  firstName: string;
  treatmentName: string;
  items: string[];
  notes?: string;
  orgName: string;
}) {
  return [
    `Hola, ${firstName}. Estas son tus indicaciones después de tu ${treatmentName.toLowerCase()}:`,
    items.map((item) => `• ${item}`).join("\n"),
    notes,
    `Si tienes alguna duda, escríbenos.\n${orgName}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-10">
      <h1 className="font-display text-[2.25rem] leading-tight">{title}</h1>
      {children}
    </main>
  );
}

/** After "Finalizar atención": share the aftercare, open the case, or go back to Hoy. */
export function SuccessScreen({ data }: { data: DraftData }) {
  const { session, client, treatment, org, appointment, nextAppointment } = data;
  const sendAftercare = useMutation(api.sessions.sendAftercare);
  const [sending, setSending] = useState(false);
  const items = session.aftercare?.items ?? [];
  const balance = appointment.price - appointment.paidTotal;
  const message = aftercareMessage({
    firstName: client.firstName,
    treatmentName: treatment.name,
    items,
    notes: session.aftercare?.notes,
    orgName: org.name,
  });

  async function email() {
    setSending(true);
    try {
      await sendAftercare({ sessionId: session._id });
      toast.success("Indicaciones enviadas por correo");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen title="Atención finalizada">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium">{`${client.firstName} ${client.lastName}`.trim()}</p>
        <p className="text-ink-soft">
          {treatment.name}, sesión {session.number}
        </p>
        {balance > 0 && <p className="mt-2 font-medium text-amber tabular-nums">Saldo pendiente {formatMoney(balance)}</p>}
        {nextAppointment && <p className="mt-2">Próxima cita: {formatDateTime(nextAppointment.start)}</p>}
      </div>
      <div className="flex flex-col gap-2">
        {items.length > 0 && (
          <Button size="lg" asChild>
            <a href={whatsappLink(client.phone, message)} target="_blank" rel="noopener noreferrer">
              <MessageCircle strokeWidth={1.75} />
              Enviar indicaciones por WhatsApp
            </a>
          </Button>
        )}
        {items.length > 0 &&
          (client.email ? (
            <Button size="lg" variant="secondary" onClick={() => void email()} disabled={sending}>
              {sending ? "Enviando…" : "Enviar por correo"}
            </Button>
          ) : (
            <p className="py-2 text-sm text-ink-soft">Para enviarlas por correo, agrega el correo de {client.firstName} en su ficha.</p>
          ))}
        <Button size="lg" variant="secondary" asChild>
          <Link href={`/casos/${session.caseId}`}>Ver caso</Link>
        </Button>
        <Button size="lg" variant="ghost" asChild>
          <Link href="/hoy">Volver a Hoy</Link>
        </Button>
      </div>
    </Screen>
  );
}

/** After "Posponer tratamiento". */
export function PostponedScreen({ data }: { data: DraftData }) {
  const { session, client, treatment } = data;
  const [booking, setBooking] = useState(false);
  return (
    <Screen title="Tratamiento pospuesto">
      <div className="flex flex-col gap-2">
        <p className="text-lg font-medium">{`${client.firstName} ${client.lastName}`.trim()}</p>
        <p className="text-ink-soft">La cita de {treatment.name.toLowerCase()} quedó cancelada y la atención se guardó en su historial.</p>
        {session.contraindications && session.contraindications.present.length > 0 && (
          <p className="text-rose">Contraindicación: {session.contraindications.present.join(", ")}.</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={() => setBooking(true)}>
          Agendar nueva cita
        </Button>
        <Button size="lg" variant="secondary" asChild>
          <Link href={`/casos/${session.caseId}`}>Ver caso</Link>
        </Button>
        <Button size="lg" variant="ghost" asChild>
          <Link href="/hoy">Volver a Hoy</Link>
        </Button>
      </div>
      {booking && (
        <ResponsiveDialog open={booking} onOpenChange={setBooking} title="Nueva cita" desktop="sheet" bodyClassName="pb-0">
          <AppointmentForm
            mode="create"
            prefill={{ clientId: client._id, treatmentId: treatment._id, memberId: session.memberId, caseId: session.caseId }}
            onDone={() => setBooking(false)}
          />
        </ResponsiveDialog>
      )}
    </Screen>
  );
}

/** The appointment cannot start an attention (requested, cancelled, no show…). */
export function BlockedScreen({ message }: { message: string }) {
  return (
    <Screen title="Atención">
      <p className="max-w-[44ch] text-ink-soft">{message}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" asChild>
          <Link href="/agenda">Ir a la agenda</Link>
        </Button>
        <Button size="lg" variant="secondary" asChild>
          <Link href="/hoy">Volver a Hoy</Link>
        </Button>
      </div>
    </Screen>
  );
}
