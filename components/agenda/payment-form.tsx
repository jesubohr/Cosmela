"use client";

import { useMutation, useQuery } from "convex/react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SingleChips } from "@/components/clients/chips";
import { errorText } from "@/components/forms/error-message";
import { MoneyInput } from "@/components/shared/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { bogotaToEpoch } from "@/convex/lib/time";
import { PAYMENT_METHODS, type PaymentMethod } from "@/convex/lib/validators";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { todayKey } from "./dates";
import { FieldBlock, FormError, SheetActions } from "./parts";

/** "Registrar pago": amount (prefilled with the balance), method, date, note. */
export function PaymentForm({ appointmentId, onDone }: { appointmentId: Id<"appointments">; onDone: () => void }) {
  const detail = useQuery(api.appointments.detail, { appointmentId });
  if (!detail) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  const balance = detail.appointment.price - detail.appointment.paidTotal;
  const clientName = `${detail.client.firstName} ${detail.client.lastName}`.trim();
  return <Fields appointmentId={appointmentId} balance={balance} clientName={clientName} treatmentName={detail.treatment.name} onDone={onDone} />;
}

function Fields({
  appointmentId,
  balance,
  clientName,
  treatmentName,
  onDone,
}: {
  appointmentId: Id<"appointments">;
  balance: number;
  clientName: string;
  treatmentName: string;
  onDone: () => void;
}) {
  const record = useMutation(api.payments.record);
  const ids = { amount: useId(), date: useId(), note: useId() };
  const [amount, setAmount] = useState<number | null>(balance > 0 ? balance : null);
  const [method, setMethod] = useState<PaymentMethod | undefined>("cash");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!amount) return setError("Escribe el valor del pago.");
    if (amount > balance) return setError(`El pago supera el saldo de ${formatMoney(balance)}.`);
    if (!method) return setError("Elige cómo pagó.");
    setError(null);
    setPending(true);
    try {
      // Today keeps the exact time; another day is recorded at noon.
      const paidAt = date === todayKey() ? Date.now() : bogotaToEpoch(date, "12:00");
      await record({ appointmentId, amount, method, paidAt, note });
      toast.success("Pago guardado");
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <p className="text-[1.125rem] font-medium">{clientName}</p>
        <p className="text-ink-soft">{treatmentName}</p>
        <p className="text-ink-soft">
          Saldo <span className="font-medium text-ink tabular-nums">{formatMoney(balance)}</span>
        </p>
      </div>
      <FieldBlock label="Valor" htmlFor={ids.amount}>
        <MoneyInput id={ids.amount} value={amount} onChange={setAmount} className="max-w-48" />
      </FieldBlock>
      <FieldBlock label="Medio de pago">
        <SingleChips
          label="Medio de pago"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
          value={method}
          onChange={setMethod}
          required
        />
      </FieldBlock>
      <FieldBlock label="Fecha" htmlFor={ids.date}>
        <Input id={ids.date} type="date" max={todayKey()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="max-w-48" />
      </FieldBlock>
      <FieldBlock label="Nota" htmlFor={ids.note}>
        <Input id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
      </FieldBlock>
      <FormError>{error}</FormError>
      <SheetActions>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar pago"}
        </Button>
      </SheetActions>
    </form>
  );
}
