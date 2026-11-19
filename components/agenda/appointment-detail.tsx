"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Ban, CalendarClock, MessageCircle, UserX, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TimeText } from "@/components/dashboard/parts";
import { errorText } from "@/components/forms/error-message";
import { AlertChips } from "@/components/shared/alert-chips";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PAYMENT_METHOD_LABELS, STAFF_COLORS } from "@/lib/constants";
import { formatDate, formatMoney, formatPhone, formatShortDate, formatTime } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { confirmationMessage } from "./messages";
import { SheetActions, StatusChip, useNow } from "./parts";

export type DetailActions = {
  onReschedule: () => void;
  onPay: () => void;
  onCancel: () => void;
  onReject: () => void;
};

/** Body of the appointment detail sheet. */
export function AppointmentDetail({ appointmentId, actions }: { appointmentId: Id<"appointments">; actions: DetailActions }) {
  const viewer = useViewer();
  const detail = useQuery(api.appointments.detail, { appointmentId });
  const confirm = useMutation(api.appointments.confirm);
  const markNoShow = useMutation(api.appointments.markNoShow);
  const saveContactEmail = useMutation(api.appointments.saveContactEmail);
  const now = useNow();
  const [pending, setPending] = useState(false);

  if (!detail) return <DetailSkeleton />;
  const { appointment, client, treatment, member, payments } = detail;
  const clientName = `${client.firstName} ${client.lastName}`.trim();
  const balance = appointment.price - appointment.paidTotal;
  const status = appointment.status;
  const open = status === "requested" || status === "scheduled";
  const beforeSession = open;
  const isSalon = viewer.org.kind === "salon";

  async function run(action: () => Promise<unknown>, done: string) {
    setPending(true);
    try {
      await action();
      toast.success(done);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  const whatsapp = whatsappLink(
    client.phone,
    confirmationMessage({
      clientName,
      treatmentName: treatment.name,
      start: appointment.start,
      memberName: isSalon ? member.name : undefined,
      orgName: viewer.org.name,
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <TimeText ms={appointment.start} className="text-[2.25rem] leading-none" periodClassName="text-base" />
        <p className="text-ink-soft first-letter:uppercase">
          {formatDate(appointment.start)}, hasta las {formatTime(appointment.end)}
        </p>
        <StatusChip status={status} className="mt-2 self-start" />
      </div>

      <div className="flex flex-col gap-2">
        <Link href={`/clientes/${client._id}`} className="self-start text-[1.125rem] font-medium text-plum underline-offset-4 hover:underline">
          {clientName}
        </Link>
        <p className="text-ink-soft tabular-nums">{formatPhone(client.phone)}</p>
        <AlertChips client={client} />
      </div>

      {appointment.contactEmail && appointment.contactEmail !== client.email && (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-ink-soft">Correo de la solicitud</p>
            <p className="[overflow-wrap:anywhere]">{appointment.contactEmail}</p>
            {client.email && <p className="text-sm text-ink-soft">En la ficha: {client.email}</p>}
          </div>
          <Button
            variant="secondary"
            className="self-start"
            disabled={pending}
            onClick={() => void run(() => saveContactEmail({ appointmentId }), "Correo guardado en la ficha")}
          >
            Guardar en la ficha
          </Button>
        </div>
      )}

      <dl className="divide-y divide-line rounded-card border border-line bg-surface">
        <Row label="Tratamiento">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: STAFF_COLORS[treatment.color].strong }} />
            {treatment.name}
          </span>
        </Row>
        {isSalon && <Row label="Profesional">{member.name}</Row>}
        <Row label="Precio">
          <span className="tabular-nums">{formatMoney(appointment.price)}</span>
        </Row>
        {payments.map((payment) => (
          <Row key={payment._id} label={`${beforeSession ? "Abono" : "Pago"} ${formatShortDate(payment.paidAt)}`}>
            <span className="tabular-nums">
              {formatMoney(payment.amount)}{" "}
              <span className="text-ink-soft">{PAYMENT_METHOD_LABELS[payment.method]}</span>
            </span>
          </Row>
        ))}
        <Row label="Saldo">
          {balance > 0 ? (
            <span className="font-medium text-amber tabular-nums">{formatMoney(balance)}</span>
          ) : (
            <span className="font-medium text-sage">Pagado</span>
          )}
        </Row>
        {appointment.notes && <Row label="Notas">{appointment.notes}</Row>}
        {appointment.cancelReason && <Row label="Motivo">{appointment.cancelReason}</Row>}
      </dl>

      <div className="flex flex-col">
        {open && <ActionRow icon={CalendarClock} label="Reprogramar" onClick={actions.onReschedule} />}
        {balance > 0 && status !== "cancelled" && (
          <ActionRow icon={Wallet} label={beforeSession ? "Registrar abono" : "Registrar pago"} onClick={actions.onPay} />
        )}
        {status === "scheduled" && (
          <ActionRow icon={MessageCircle} label="Enviar confirmación por WhatsApp" href={whatsapp} />
        )}
        {status === "scheduled" && appointment.start <= now && (
          <ActionRow
            icon={UserX}
            label="Marcar no asistió"
            disabled={pending}
            onClick={() => void run(() => markNoShow({ appointmentId }), "Marcada como no asistió")}
          />
        )}
        {open && status !== "requested" && <ActionRow icon={Ban} label="Cancelar cita" tone="rose" onClick={actions.onCancel} />}
      </div>

      {(status === "requested" || status === "scheduled" || status === "in_progress") && (
        <SheetActions>
          {status === "requested" ? (
            <>
              <Button variant="secondary" onClick={actions.onReject} disabled={pending}>
                Rechazar
              </Button>
              <Button onClick={() => void run(() => confirm({ appointmentId }), "Cita confirmada")} disabled={pending}>
                Confirmar cita
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link href={`/atencion/${appointmentId}`}>{status === "in_progress" ? "Continuar atención" : "Iniciar atención"}</Link>
            </Button>
          )}
        </SheetActions>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  tone,
}: {
  icon: typeof Ban;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "rose";
}) {
  const className = `-mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 text-left font-medium hover:bg-lilac disabled:opacity-50 ${tone === "rose" ? "text-rose hover:bg-rose-soft" : "text-ink"}`;
  const content = (
    <>
      <Icon aria-hidden className={`size-5 ${tone === "rose" ? "" : "text-plum"}`} />
      {label}
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-6 w-44" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
