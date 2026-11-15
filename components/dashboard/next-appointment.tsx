"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { confirmationMessage } from "@/components/agenda/messages";
import { AlertChips } from "@/components/shared/alert-chips";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import type { StaffColor } from "@/convex/lib/validators";
import { whatsappLink } from "@/lib/whatsapp";
import { TimeText } from "./parts";
import type { DayAppointment, InProgress } from "./hoy-view";

/** Set in team view, where the card names the professional. */
type Member = { name: string; color: StaffColor } | undefined;

export function NextAppointmentCard({ appointment, member }: { appointment: DayAppointment; member: Member }) {
  const viewer = useViewer();
  const message = confirmationMessage({
    clientName: appointment.client.name,
    treatmentName: appointment.treatmentName,
    start: appointment.start,
    memberName: member?.name,
    orgName: viewer.org.name,
  });

  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <TimeText ms={appointment.start} className="text-[2.75rem] leading-none" periodClassName="text-base" />
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
      </div>
    </div>
  );
}

export function InProgressCard({ session, member }: { session: InProgress; member: Member }) {
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
      <Button asChild size="lg" className="self-stretch sm:self-start">
        <Link href={`/atencion/${session.appointmentId}`}>Continuar atención</Link>
      </Button>
    </div>
  );
}

function MemberLine({ member }: { member: NonNullable<Member> }) {
  return (
    <p className="mt-1 flex items-center gap-2 text-ink-soft">
      <InitialsAvatar name={member.name} color={member.color} size="sm" />
      {member.name}
    </p>
  );
}
