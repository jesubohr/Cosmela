"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { dayStart } from "@/components/agenda/dates";
import { confirmationMessage } from "@/components/agenda/messages";
import { errorText } from "@/components/agenda/parts";
import { AlertChips } from "@/components/shared/alert-chips";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { addDaysToDateKey } from "@/convex/lib/time";
import type { StaffColor } from "@/convex/lib/validators";
import { whatsappLink } from "@/lib/whatsapp";
import { NotStartedChip, Section, TimeText } from "./parts";
import type { DayAppointment, InProgress } from "./hoy-view";

/** Set in team view, where the card names the professional. */
type Member = { name: string; color: StaffColor } | undefined;

export function NextAppointmentCard({ appointment, member, now }: { appointment: DayAppointment; member: Member; now: number }) {
  const viewer = useViewer();
  const markNoShow = useMutation(api.appointments.markNoShow);
  const [pending, setPending] = useState(false);
  const notStarted = appointment.start <= now;

  async function noShow() {
    setPending(true);
    try {
      await markNoShow({ appointmentId: appointment._id });
      toast.success("Marcada como no asistió");
    } catch (error) {
      toast.error(errorText(error));
      setPending(false);
    }
  }

  const message = confirmationMessage({
    clientName: appointment.client.name,
    treatmentName: appointment.treatmentName,
    start: appointment.start,
    memberName: member?.name,
    orgName: viewer.org.name,
  });

  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TimeText ms={appointment.start} className="text-[2.75rem] leading-none" periodClassName="text-base" />
        {notStarted && <NotStartedChip />}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[1.125rem] font-medium">{appointment.client.name}</p>
        <p className="text-ink-soft">{appointment.treatmentName}</p>
        {member && <MemberLine member={member} />}
      </div>
      <AlertChips client={appointment.client} />
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg" className="flex-1 sm:flex-none">
          <Link href={`/atencion/${appointment._id}`}>Iniciar atención</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <a href={whatsappLink(appointment.client.phone, message)} target="_blank" rel="noopener noreferrer">
            <MessageCircle strokeWidth={1.75} />
            WhatsApp
          </a>
        </Button>
        {notStarted && (
          <Button size="lg" variant="secondary" onClick={() => void noShow()} disabled={pending}>
            Marcar no asistió
          </Button>
        )}
      </div>
    </div>
  );
}

/** When today has nothing left: tomorrow's first appointment, so the evening still shows what comes next. */
export function TomorrowCard({
  today,
  memberId,
  members,
}: {
  today: string;
  /** Only this professional's appointments (Mi día). */
  memberId?: Id<"members">;
  /** Set in team view, where the card names the professional. */
  members?: Map<Id<"members">, { name: string; color: StaffColor }>;
}) {
  const openSheet = useAgendaSheets();
  const tomorrow = addDaysToDateKey(today, 1);
  const data = useQuery(api.appointments.agenda, { start: dayStart(tomorrow), end: dayStart(addDaysToDateKey(tomorrow, 1)) });
  const first = data?.appointments
    .filter((a) => a.status === "scheduled" && (!memberId || a.memberId === memberId))
    .sort((a, b) => a.start - b.start)[0];
  if (!first) return null;
  const member = members?.get(first.memberId);

  return (
    <Section title="Próxima cita">
      <button
        type="button"
        onClick={() => openSheet({ kind: "detail", appointmentId: first._id })}
        className="flex flex-col items-start gap-4 rounded-card border border-line bg-surface p-5 text-left hover:bg-porcelain"
      >
        <span className="flex flex-col gap-1">
          <span className="text-ink-soft">Mañana</span>
          <TimeText ms={first.start} className="text-[2.75rem] leading-none" periodClassName="text-base" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[1.125rem] font-medium">{first.clientName}</span>
          <span className="text-ink-soft">{first.treatmentName}</span>
          {member && <MemberLine member={member} />}
        </span>
      </button>
    </Section>
  );
}

export function InProgressCard({ session, member }: { session: InProgress; member: Member }) {
  const [discarding, setDiscarding] = useState(false);
  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <p className="flex items-baseline gap-2">
        <span aria-hidden className="size-2.5 animate-pulse self-center rounded-full bg-plum" />
        <span className="text-ink-soft">Desde las</span>
        <TimeText ms={session.startedAt} className="text-[1.75rem] leading-none" />
      </p>
      <div className="flex flex-col gap-0.5">
        <p className="text-[1.125rem] font-medium">{session.clientName}</p>
        <p className="text-ink-soft">{session.treatmentName}</p>
        <p className="text-ink-soft">Paso {Math.min(session.step + 1, 6)} de 6</p>
        {member && <MemberLine member={member} />}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg" className="flex-1 sm:flex-none">
          <Link href={`/atencion/${session.appointmentId}`}>Continuar atención</Link>
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setDiscarding(true)}>
          Descartar atención
        </Button>
      </div>
      <DiscardDialog session={session} open={discarding} onOpenChange={setDiscarding} />
    </div>
  );
}

function DiscardDialog({ session, open, onOpenChange }: { session: InProgress; open: boolean; onOpenChange: (open: boolean) => void }) {
  const discard = useMutation(api.sessions.discard);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      await discard({ sessionId: session.sessionId });
      toast.success("Atención descartada");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="¿Descartar atención?"
      bodyClassName="p-0"
      description={
        session.consentSigned
          ? `${session.clientName} ya firmó el consentimiento. Lo guardamos en su historia como atención no realizada y la cita queda cancelada.`
          : `Borramos lo que llevas de la atención de ${session.clientName}. La cita sigue agendada.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Seguir con la atención
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={pending}>
            {pending ? "Descartando…" : "Descartar atención"}
          </Button>
        </>
      }
    >
      {null}
    </ResponsiveDialog>
  );
}

function MemberLine({ member }: { member: NonNullable<Member> }) {
  return (
    <span className="mt-1 flex items-center gap-2 text-ink-soft">
      <InitialsAvatar name={member.name} color={member.color} size="sm" />
      {member.name}
    </span>
  );
}
