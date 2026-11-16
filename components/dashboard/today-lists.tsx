"use client";

import { useMutation } from "convex/react";
import { ChevronRight, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { DoneDialog, followUpMessage, type FollowUpRow } from "@/components/cases/follow-up-list";
import { errorText } from "@/components/forms/error-message";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { StaffColor } from "@/convex/lib/validators";
import { formatCalendarDate, formatMoney, formatShortDate } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { dayAndTime, firstName, Section } from "./parts";
import type { TodayData } from "./hoy-view";

const listClass = "divide-y divide-line rounded-card border border-line bg-surface";

export function Requests({
  rows,
  today,
  members,
}: {
  rows: TodayData["requests"];
  today: string;
  members: Map<Id<"members">, { name: string; color: StaffColor }>;
}) {
  const viewer = useViewer();
  const openSheet = useAgendaSheets();
  const confirm = useMutation(api.appointments.confirm);
  const [pending, setPending] = useState<Id<"appointments"> | null>(null);
  if (rows.length === 0) return null;

  async function accept(appointmentId: Id<"appointments">) {
    setPending(appointmentId);
    try {
      await confirm({ appointmentId });
      toast.success("Cita confirmada");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <Section title="Por confirmar" count={rows.length}>
      <ul className={listClass}>
        {rows.map((row) => {
          const member = viewer.org.kind === "salon" ? members.get(row.memberId) : undefined;
          return (
            <li key={row._id} className="flex flex-col gap-3 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{row.clientName}</span>
                  <span className="text-ink-soft">{row.treatmentName}</span>
                  <span className="text-ink-soft tabular-nums">{dayAndTime(row.start, today)}</span>
                </div>
                {member && (
                  <span title={member.name}>
                    <InitialsAvatar name={member.name} color={member.color} size="sm" />
                    <span className="sr-only">{member.name}</span>
                  </span>
                )}
              </div>
              <div className="flex gap-2 [&>*]:flex-1">
                <Button onClick={() => void accept(row._id)} disabled={pending === row._id}>
                  Confirmar
                </Button>
                <Button variant="secondary" onClick={() => openSheet({ kind: "reject", appointmentId: row._id })} disabled={pending === row._id}>
                  Rechazar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function DueFollowUps({ rows }: { rows: FollowUpRow[] }) {
  const viewer = useViewer();
  const openSheet = useAgendaSheets();
  const [done, setDone] = useState<FollowUpRow | null>(null);
  if (rows.length === 0) return null;

  return (
    <Section title="Seguimientos" count={rows.length}>
      <ul className={listClass}>
        {rows.map((row) => (
          <li key={row._id} className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{row.client.name}</span>
              {(row.note || row.treatmentName) && <span className="text-ink-soft">{row.note || row.treatmentName}</span>}
              <span className={row.overdue ? "text-amber" : "text-ink-soft"}>
                {row.overdue ? `Vencido, ${formatCalendarDate(row.dueDate)}` : "Para hoy"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 [&>*]:px-3">
              <Button variant="secondary" asChild>
                <a href={whatsappLink(row.client.phone, followUpMessage(row, viewer.org.name))} target="_blank" rel="noopener noreferrer">
                  <MessageCircle strokeWidth={1.75} />
                  WhatsApp
                </a>
              </Button>
              <Button variant="secondary" onClick={() => setDone(row)}>
                Hecho
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  openSheet({
                    kind: "create",
                    prefill: { clientId: row.client._id, treatmentId: row.treatmentId, caseId: row.caseId },
                  })
                }
              >
                Agendar
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {done && <DoneDialog row={done} onClose={() => setDone(null)} />}
    </Section>
  );
}

const PAYMENT_ROWS = 5;

export function PendingPayments({ data }: { data: TodayData["pendingPayments"] }) {
  const openSheet = useAgendaSheets();
  const [expanded, setExpanded] = useState(false);
  if (data.rows.length === 0) return null;
  const visible = expanded ? data.rows : data.rows.slice(0, PAYMENT_ROWS);

  return (
    <Section title="Pagos pendientes" aside={<span className="text-[1.125rem] font-medium text-amber tabular-nums">{formatMoney(data.total)}</span>}>
      <ul className={listClass}>
        {visible.map((row) => (
          <li key={row._id}>
            <button
              type="button"
              onClick={() => openSheet({ kind: "payment", appointmentId: row._id })}
              aria-label={`Registrar pago de ${row.clientName}`}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-porcelain"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 font-medium">{row.clientName}</span>
                <span className="text-ink-soft tabular-nums">{formatShortDate(row.start)}</span>
              </span>
              <span className="font-medium tabular-nums">{formatMoney(row.balance)}</span>
              <ChevronRight aria-hidden className="size-5 text-ink-soft" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
      {data.rows.length > PAYMENT_ROWS && (
        <Button variant="ghost" className="self-start" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Ver menos" : `Ver los ${data.rows.length}`}
        </Button>
      )}
    </Section>
  );
}

export function birthdayMessage(name: string, orgName: string) {
  return `¡Feliz cumpleaños, ${firstName(name)}! Te deseamos un día muy especial y un año lleno de cosas lindas.\n${orgName}`;
}

export function Birthdays({ rows }: { rows: TodayData["birthdays"] }) {
  const viewer = useViewer();
  if (rows.length === 0) return null;
  return (
    <Section title="Cumpleaños" count={rows.length}>
      <ul className={listClass}>
        {rows.map((row) => (
          <li key={row._id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
            <span className="line-clamp-2 min-w-0 flex-1 font-medium">{row.name}</span>
            <Button variant="secondary" asChild>
              <a href={whatsappLink(row.phone, birthdayMessage(row.name, viewer.org.name))} target="_blank" rel="noopener noreferrer">
                <MessageCircle strokeWidth={1.75} />
                Felicitar
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
