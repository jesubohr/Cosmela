"use client";

import { useMutation, useQuery } from "convex/react";
import { TriangleAlert } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ClientPicker, type PickedClient } from "@/components/clients/client-picker";
import { Chip, SingleChips } from "@/components/clients/chips";
import { MoneyInput } from "@/components/shared/money-input";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { bogotaDateKey, bogotaToEpoch } from "@/convex/lib/time";
import { PAYMENT_METHODS, type PaymentMethod } from "@/convex/lib/validators";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { MINUTE, timeOf, todayKey } from "./dates";
import { confirmationMessage } from "./messages";
import { errorText, FieldBlock, FormError, formatDuration, MemberSelect, SheetActions, useFormOptions, type FormOptions } from "./parts";

export type AppointmentPrefill = {
  clientId?: Id<"clients">;
  memberId?: Id<"members">;
  date?: string;
  time?: string;
  durationMin?: number;
};

const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

type Initial = {
  client: PickedClient | null;
  treatmentId?: Id<"treatments">;
  memberId?: Id<"members">;
  date: string;
  time?: string;
  durationMin?: number;
  price: number | null;
  notes: string;
};

/** "Nueva cita" (prefill) or "Reprogramar cita" (appointmentId). Calls `onDone` after saving. */
export function AppointmentForm(
  props: { onDone: (appointmentId: Id<"appointments">) => void } & (
    | { mode: "create"; prefill: AppointmentPrefill }
    | { mode: "edit"; appointmentId: Id<"appointments"> }
  ),
) {
  const options = useFormOptions();
  const viewer = useViewer();
  const detail = useQuery(api.appointments.detail, props.mode === "edit" ? { appointmentId: props.appointmentId } : "skip");
  const prefillClient = useQuery(
    api.clients.get,
    props.mode === "create" && props.prefill.clientId ? { clientId: props.prefill.clientId } : "skip",
  );

  const waitingClient = props.mode === "create" && props.prefill.clientId && prefillClient === undefined;
  if (!options || (props.mode === "edit" && !detail) || waitingClient) return <FormSkeleton />;

  if (options.treatments.length === 0) {
    return (
      <p className="text-ink-soft">
        Aún no tienes tratamientos. Créalos en Tratamientos para poder agendar citas.
      </p>
    );
  }

  let initial: Initial;
  if (props.mode === "edit" && detail) {
    const { appointment, client } = detail;
    initial = {
      client: { _id: client._id, name: `${client.firstName} ${client.lastName}`.trim(), phone: client.phone },
      treatmentId: appointment.treatmentId,
      memberId: appointment.memberId,
      date: bogotaDateKey(appointment.start),
      time: timeOf(appointment.start),
      durationMin: Math.round((appointment.end - appointment.start) / MINUTE),
      price: appointment.price,
      notes: appointment.notes ?? "",
    };
  } else {
    const prefill = props.mode === "create" ? props.prefill : {};
    const ownMember = options.members.find((m) => m._id === viewer.member._id);
    initial = {
      client: prefillClient
        ? { _id: prefillClient._id, name: `${prefillClient.firstName} ${prefillClient.lastName}`.trim(), phone: prefillClient.phone }
        : null,
      memberId: prefill.memberId ?? ownMember?._id ?? options.members[0]?._id,
      date: prefill.date ?? todayKey(),
      time: prefill.time,
      durationMin: prefill.durationMin,
      price: null,
      notes: "",
    };
  }

  return (
    <Fields
      options={options}
      initial={initial}
      appointmentId={props.mode === "edit" ? props.appointmentId : undefined}
      paidTotal={detail?.appointment.paidTotal ?? 0}
      onDone={props.onDone}
    />
  );
}

function Fields({
  options,
  initial,
  appointmentId,
  paidTotal,
  onDone,
}: {
  options: FormOptions;
  initial: Initial;
  appointmentId?: Id<"appointments">;
  paidTotal: number;
  onDone: (appointmentId: Id<"appointments">) => void;
}) {
  const viewer = useViewer();
  const create = useMutation(api.appointments.create);
  const update = useMutation(api.appointments.update);
  const isSalon = viewer.org.kind === "salon" && options.members.length > 1;
  const ids = { treatment: useId(), member: useId(), date: useId(), time: useId(), duration: useId(), price: useId(), notes: useId(), deposit: useId() };

  const [client, setClient] = useState(initial.client);
  const [treatmentId, setTreatmentId] = useState(initial.treatmentId);
  const [memberId, setMemberId] = useState(initial.memberId);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [durationMin, setDurationMin] = useState(initial.durationMin);
  const [price, setPrice] = useState<number | null>(initial.price);
  const [notes, setNotes] = useState(initial.notes);
  const [depositOn, setDepositOn] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod | undefined>("cash");
  const [errors, setErrors] = useState<Partial<Record<"client" | "treatment" | "time" | "price" | "deposit" | "form", string>>>({});
  const [pending, setPending] = useState(false);

  const treatment = options.treatments.find((t) => t._id === treatmentId);
  const member = options.members.find((m) => m._id === memberId);
  const start = date && time ? bogotaToEpoch(date, time) : undefined;
  const end = start !== undefined && durationMin ? start + durationMin * MINUTE : undefined;

  const slots = useQuery(
    api.appointments.freeSlots,
    memberId && date && durationMin ? { memberId, date, durationMin, excludeAppointmentId: appointmentId } : "skip",
  );
  const check = useQuery(
    api.appointments.conflicts,
    memberId && start !== undefined && end !== undefined
      ? { memberId, start, end, excludeAppointmentId: appointmentId }
      : "skip",
  );
  const conflicts = check?.conflicts ?? [];
  const slotTimes = (slots ?? []).map(timeOf);
  const durationOptions = durationMin && !DURATIONS.includes(durationMin) ? [...DURATIONS, durationMin].sort((a, b) => a - b) : DURATIONS;

  function chooseTreatment(id: Id<"treatments">) {
    const next = options.treatments.find((t) => t._id === id);
    setTreatmentId(id);
    if (next) {
      setDurationMin(next.durationMin);
      setPrice(Math.max(next.price, paidTotal));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!client) next.client = "Elige un cliente o crea uno nuevo.";
    if (!treatmentId) next.treatment = "Elige un tratamiento.";
    if (!time) next.time = "Elige una hora.";
    if (price === null) next.price = "Escribe el precio.";
    if (depositOn && (!depositAmount || !depositMethod)) next.deposit = "Escribe el valor del abono y cómo lo pagó.";
    if (depositOn && depositAmount && price !== null && depositAmount > price) next.deposit = "El abono no puede superar el precio.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !client || !treatmentId || !memberId || start === undefined || !durationMin || price === null) return;

    const args = {
      clientId: client._id,
      treatmentId,
      memberId,
      start,
      durationMin,
      price,
      notes,
      allowConflicts: conflicts.length > 0,
    };
    setPending(true);
    try {
      if (appointmentId) {
        await update({ appointmentId, ...args });
        toast.success("Cita reprogramada");
        onDone(appointmentId);
      } else {
        const id = await create({
          ...args,
          deposit: depositOn && depositAmount && depositMethod ? { amount: depositAmount, method: depositMethod } : undefined,
        });
        const link = whatsappLink(
          client.phone,
          confirmationMessage({
            clientName: client.name,
            treatmentName: treatment?.name ?? "",
            start,
            memberName: isSalon ? member?.name : undefined,
            orgName: options.orgName,
          }),
        );
        toast.success("Cita guardada", {
          action: { label: "Enviar confirmación", onClick: () => window.open(link, "_blank", "noopener") },
          duration: 8000,
        });
        onDone(id);
      }
    } catch (error) {
      setErrors({ form: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <FieldBlock label="Cliente">
        <ClientPicker value={client} onChange={setClient} error={errors.client} />
      </FieldBlock>

      <FieldBlock label="Tratamiento" htmlFor={ids.treatment} error={errors.treatment}>
        <Select value={treatmentId ?? ""} onValueChange={(v) => chooseTreatment(v as Id<"treatments">)}>
          <SelectTrigger id={ids.treatment} className="w-full" aria-invalid={errors.treatment ? true : undefined}>
            <SelectValue placeholder="Elige un tratamiento" />
          </SelectTrigger>
          <SelectContent>
            {options.treatments.map((t) => (
              <SelectItem key={t._id} value={t._id} className="min-h-11 text-base">
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldBlock>

      {isSalon && (
        <FieldBlock label="Profesional" htmlFor={ids.member}>
          <MemberSelect id={ids.member} members={options.members} value={memberId} onChange={setMemberId} />
        </FieldBlock>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FieldBlock label="Fecha" htmlFor={ids.date}>
          <Input id={ids.date} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </FieldBlock>
        <FieldBlock label="Duración" htmlFor={ids.duration}>
          <Select value={durationMin ? String(durationMin) : ""} onValueChange={(v) => setDurationMin(Number(v))}>
            <SelectTrigger id={ids.duration} className="w-full">
              <SelectValue placeholder="Duración" />
            </SelectTrigger>
            <SelectContent>
              {durationOptions.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)} className="min-h-11 text-base">
                  {formatDuration(minutes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBlock>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-base font-medium">Hora</span>
        {!durationMin ? (
          <p className="text-sm text-ink-soft">Elige el tratamiento para ver los horarios libres.</p>
        ) : slots === undefined ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-24 rounded-full" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-ink-soft">
            {date < todayKey() ? "Este día ya pasó. Escribe la hora si quieres registrarla." : "No quedan horarios libres este día. Escribe otra hora."}
          </p>
        ) : (
          <div role="radiogroup" aria-label="Horarios libres" className="flex flex-wrap gap-2">
            {slots.map((slot, index) => (
              <Chip
                key={slot}
                role="radio"
                aria-checked={time === slotTimes[index]}
                selected={time === slotTimes[index]}
                onClick={() => setTime(slotTimes[index])}
                className="tabular-nums"
              >
                {formatTime(slot)}
              </Chip>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Label htmlFor={ids.time} className="shrink-0 text-base font-normal text-ink-soft">
            Otra hora
          </Label>
          <Input
            id={ids.time}
            type="time"
            step={900}
            value={time ?? ""}
            onChange={(e) => setTime(e.target.value || undefined)}
            aria-invalid={errors.time ? true : undefined}
            className="w-36 tabular-nums"
          />
        </div>
        {errors.time && (
          <p role="alert" className="text-sm text-rose">
            {errors.time}
          </p>
        )}
        {(conflicts.length > 0 || check?.outsideHours) && (
          <div role="status" className="flex gap-3 rounded-xl bg-amber-soft px-4 py-3 text-amber">
            <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
            <div className="flex flex-col gap-1">
              {conflicts.map((c) => (
                <p key={c.id}>
                  {c.kind === "appointment"
                    ? `Se cruza con la cita de ${c.label}`
                    : c.label
                      ? `Se cruza con el bloqueo «${c.label}»`
                      : "Se cruza con un bloqueo"}{" "}
                  ({formatTime(c.start)} a {formatTime(c.end)}).
                </p>
              ))}
              {check?.outsideHours && (
                <p>Está fuera del horario de trabajo{member && isSalon ? ` de ${member.name}` : ""}. Puedes agendarla igual.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <FieldBlock label="Precio" htmlFor={ids.price} error={errors.price}>
        <MoneyInput id={ids.price} value={price} onChange={setPrice} className="max-w-48" aria-invalid={errors.price ? true : undefined} />
      </FieldBlock>

      <FieldBlock label="Notas" htmlFor={ids.notes}>
        <Textarea id={ids.notes} rows={2} className="min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FieldBlock>

      {!appointmentId && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Switch id={ids.deposit} checked={depositOn} onCheckedChange={setDepositOn} />
            <Label htmlFor={ids.deposit} className="text-base">
              Registrar abono
            </Label>
          </div>
          {depositOn && (
            <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
              <MoneyInput aria-label="Valor del abono" value={depositAmount} onChange={setDepositAmount} className="max-w-48" />
              <SingleChips
                label="Medio de pago"
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
                value={depositMethod}
                onChange={setDepositMethod}
                required
              />
              {errors.deposit && (
                <p role="alert" className="text-sm text-rose">
                  {errors.deposit}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <FormError>{errors.form}</FormError>

      <SheetActions>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Guardando…"
            : conflicts.length > 0
              ? "Agendar de todas formas"
              : appointmentId
                ? "Guardar cambios"
                : "Guardar cita"}
        </Button>
      </SheetActions>
    </form>
  );
}

function FormSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
