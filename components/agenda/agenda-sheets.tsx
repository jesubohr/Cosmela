"use client";

import { useMutation } from "convex/react";
import { CalendarOff, CalendarPlus } from "lucide-react";
import { createContext, useCallback, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { bogotaToEpoch } from "@/convex/lib/time";
import { formatTime } from "@/lib/format";
import { AppointmentDetail } from "./appointment-detail";
import { AppointmentForm, type AppointmentPrefill } from "./appointment-form";
import { BlockForm, type BlockData, type BlockPrefill } from "./block-form";
import { formatDayKey, toMinutes, toTime } from "./dates";
import { errorText, FormError, SheetActions } from "./parts";
import { PaymentForm } from "./payment-form";
import { WalkInForm } from "./walk-in-form";

export type Sheet =
  | { kind: "slot"; date: string; startTime: string; endTime?: string; memberId?: Id<"members"> }
  | { kind: "create"; prefill: AppointmentPrefill }
  | { kind: "edit"; appointmentId: Id<"appointments"> }
  | { kind: "detail"; appointmentId: Id<"appointments"> }
  | { kind: "walkIn"; clientId?: Id<"clients"> }
  | { kind: "block"; prefill?: BlockPrefill; block?: BlockData }
  | { kind: "payment"; appointmentId: Id<"appointments">; backToDetail?: boolean }
  | { kind: "cancel"; appointmentId: Id<"appointments"> }
  | { kind: "reject"; appointmentId: Id<"appointments"> };

type Kind = Sheet["kind"];
type SheetOf<K extends Kind> = Extract<Sheet, { kind: K }>;

const SheetsContext = createContext<((sheet: Sheet) => void) | null>(null);

/** Opens an agenda sheet (appointment, block, payment…) from anywhere under `AgendaSheets`. */
export function useAgendaSheets() {
  const open = useContext(SheetsContext);
  if (!open) throw new Error("useAgendaSheets must be used inside <AgendaSheets>");
  return open;
}

/**
 * Hosts every agenda sheet. One is open at a time; the last payload of each kind
 * stays mounted while it animates out, and a new open remounts it fresh.
 */
export function AgendaSheets({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Kind | null>(null);
  const [payloads, setPayloads] = useState<Partial<{ [K in Kind]: SheetOf<K> & { nonce: number } }>>({});

  const open = useCallback((sheet: Sheet) => {
    setPayloads((previous) => ({ ...previous, [sheet.kind]: { ...sheet, nonce: (previous[sheet.kind]?.nonce ?? 0) + 1 } }));
    setCurrent(sheet.kind);
  }, []);
  const close = useCallback(() => setCurrent(null), []);
  const onOpenChange = (value: boolean) => {
    if (!value) close();
  };

  const p = payloads;
  const toDetail = (appointmentId: Id<"appointments">) => open({ kind: "detail", appointmentId });

  return (
    <SheetsContext.Provider value={open}>
      {children}

      {p.slot && (
        <ResponsiveDialog
          key={`slot-${p.slot.nonce}`}
          open={current === "slot"}
          onOpenChange={onOpenChange}
          title={slotTitle(p.slot)}
        >
          <SlotChooser slot={p.slot} open={open} />
        </ResponsiveDialog>
      )}

      {p.create && (
        <ResponsiveDialog key={`create-${p.create.nonce}`} open={current === "create"} onOpenChange={onOpenChange} title="Nueva cita" desktop="sheet" bodyClassName="pb-0">
          <AppointmentForm mode="create" prefill={p.create.prefill} onDone={close} />
        </ResponsiveDialog>
      )}

      {p.edit && (
        <ResponsiveDialog key={`edit-${p.edit.nonce}`} open={current === "edit"} onOpenChange={onOpenChange} title="Reprogramar cita" desktop="sheet" bodyClassName="pb-0">
          <AppointmentForm mode="edit" appointmentId={p.edit.appointmentId} onDone={toDetail} />
        </ResponsiveDialog>
      )}

      {p.detail && (
        <ResponsiveDialog key={`detail-${p.detail.nonce}`} open={current === "detail"} onOpenChange={onOpenChange} title="Cita" desktop="sheet" bodyClassName="pb-0">
          <AppointmentDetail
            appointmentId={p.detail.appointmentId}
            actions={{
              onReschedule: () => open({ kind: "edit", appointmentId: p.detail!.appointmentId }),
              onPay: () => open({ kind: "payment", appointmentId: p.detail!.appointmentId, backToDetail: true }),
              onCancel: () => open({ kind: "cancel", appointmentId: p.detail!.appointmentId }),
              onReject: () => open({ kind: "reject", appointmentId: p.detail!.appointmentId }),
            }}
          />
        </ResponsiveDialog>
      )}

      {p.walkIn && (
        <ResponsiveDialog key={`walkIn-${p.walkIn.nonce}`} open={current === "walkIn"} onOpenChange={onOpenChange} title="Atención sin cita" desktop="sheet" bodyClassName="pb-0">
          <WalkInForm clientId={p.walkIn.clientId} />
        </ResponsiveDialog>
      )}

      {p.block && (
        <ResponsiveDialog
          key={`block-${p.block.nonce}`}
          open={current === "block"}
          onOpenChange={onOpenChange}
          title={p.block.block ? "Editar bloqueo" : "Bloquear horario"}
          bodyClassName="pb-0"
        >
          <BlockForm prefill={p.block.prefill} block={p.block.block} onDone={close} />
        </ResponsiveDialog>
      )}

      {p.payment && (
        <ResponsiveDialog key={`payment-${p.payment.nonce}`} open={current === "payment"} onOpenChange={onOpenChange} title="Registrar pago" bodyClassName="pb-0">
          <PaymentForm
            appointmentId={p.payment.appointmentId}
            onDone={() => (p.payment!.backToDetail ? toDetail(p.payment!.appointmentId) : close())}
          />
        </ResponsiveDialog>
      )}

      {p.cancel && (
        <ResponsiveDialog key={`cancel-${p.cancel.nonce}`} open={current === "cancel"} onOpenChange={onOpenChange} title="Cancelar cita" bodyClassName="pb-0">
          <ReasonForm appointmentId={p.cancel.appointmentId} action="cancel" onBack={() => toDetail(p.cancel!.appointmentId)} onDone={close} />
        </ResponsiveDialog>
      )}

      {p.reject && (
        <ResponsiveDialog key={`reject-${p.reject.nonce}`} open={current === "reject"} onOpenChange={onOpenChange} title="Rechazar solicitud" bodyClassName="pb-0">
          <ReasonForm appointmentId={p.reject.appointmentId} action="reject" onBack={() => toDetail(p.reject!.appointmentId)} onDone={close} />
        </ResponsiveDialog>
      )}
    </SheetsContext.Provider>
  );
}

function slotTitle(slot: SheetOf<"slot">) {
  const day = formatDayKey(slot.date);
  const start = formatTime(bogotaToEpoch(slot.date, slot.startTime));
  const range = slot.endTime ? `${start} a ${formatTime(bogotaToEpoch(slot.date, slot.endTime))}` : start;
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${range}`;
}

function SlotChooser({ slot, open }: { slot: SheetOf<"slot">; open: (sheet: Sheet) => void }) {
  const durationMin = slot.endTime ? toMinutes(slot.endTime) - toMinutes(slot.startTime) : undefined;
  return (
    <div className="flex flex-col gap-2 pb-2">
      <Button
        size="lg"
        className="justify-start"
        onClick={() =>
          open({ kind: "create", prefill: { date: slot.date, time: slot.startTime, durationMin, memberId: slot.memberId } })
        }
      >
        <CalendarPlus />
        Nueva cita
      </Button>
      <Button
        size="lg"
        variant="secondary"
        className="justify-start"
        onClick={() =>
          open({
            kind: "block",
            prefill: {
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime ?? toTime(Math.min(toMinutes(slot.startTime) + 60, 23 * 60 + 45)),
              memberId: slot.memberId,
            },
          })
        }
      >
        <CalendarOff />
        Bloquear horario
      </Button>
    </div>
  );
}

function ReasonForm({
  appointmentId,
  action,
  onBack,
  onDone,
}: {
  appointmentId: Id<"appointments">;
  action: "cancel" | "reject";
  onBack: () => void;
  onDone: () => void;
}) {
  const cancel = useMutation(api.appointments.cancel);
  const reject = useMutation(api.appointments.reject);
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const copy = useMemo(
    () =>
      action === "cancel"
        ? { label: "Motivo", help: undefined, button: "Cancelar cita", done: "Cita cancelada" }
        : { label: "Motivo", help: "Se lo enviamos por correo.", button: "Rechazar solicitud", done: "Solicitud rechazada" },
    [action],
  );

  async function submit() {
    setPending(true);
    try {
      await (action === "cancel" ? cancel({ appointmentId, reason }) : reject({ appointmentId, reason }));
      toast.success(copy.done);
      onDone();
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-base">
          {copy.label}
        </Label>
        <Textarea
          id={id}
          rows={2}
          className="min-h-20"
          placeholder="Opcional"
          aria-describedby={copy.help ? `${id}-help` : undefined}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {copy.help && (
          <p id={`${id}-help`} className="text-sm text-ink-soft">
            {copy.help}
          </p>
        )}
      </div>
      <FormError>{error}</FormError>
      <SheetActions>
        <Button variant="secondary" onClick={onBack} disabled={pending}>
          Volver
        </Button>
        <Button variant="destructive" onClick={() => void submit()} disabled={pending}>
          {pending ? "Guardando…" : copy.button}
        </Button>
      </SheetActions>
    </div>
  );
}
