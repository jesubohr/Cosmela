"use client";

import { useMutation } from "convex/react";
import { CalendarCheck, Check, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { AppointmentForm } from "@/components/agenda/appointment-form";
import { Chip, SingleChips } from "@/components/clients/chips";
import { MoneyInput } from "@/components/shared/money-input";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { addDaysToDateKey } from "@/convex/lib/time";
import { PAYMENT_METHODS, type PaymentMethod } from "@/convex/lib/validators";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatCalendarDate, formatDateTime, formatMoney, formatShortDate, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { errorText, StepBody, StepFooter, StepSection, type StepProps } from "./step-parts";

type AftercareItem = { text: string; included: boolean };

/** Paso 6: aftercare, price and payment, follow-up, then "Finalizar atención". */
export function ClosingStep({ data, onBack, registerDraft }: StepProps) {
  const { session, treatment, appointment, payments, nextAppointment } = data;
  const close = useMutation(api.sessions.close);
  const saveClosing = useMutation(api.sessions.saveClosing);
  const ids = { notes: useId(), price: useId(), amount: useId(), days: useId(), followNote: useId(), newItem: useId(), method: useId(), followUp: useId() };

  const [items, setItems] = useState<AftercareItem[]>(() => {
    const saved = session.aftercare?.items;
    const base = treatment.aftercare.map((text) => ({ text, included: saved ? saved.includes(text) : true }));
    const custom = (saved ?? []).filter((text) => !treatment.aftercare.includes(text)).map((text) => ({ text, included: true }));
    return [...base, ...custom];
  });
  const [newItem, setNewItem] = useState("");
  const [aftercareNotes, setAftercareNotes] = useState(session.aftercare?.notes ?? "");
  const [price, setPrice] = useState<number | null>(appointment.price);
  const [payNow, setPayNow] = useState<boolean | undefined>();
  const [method, setMethod] = useState<PaymentMethod | undefined>("cash");
  const [amount, setAmount] = useState<number | null>(null);
  const [recommended, setRecommended] = useState<boolean | undefined>(session.followUp?.recommended);
  const [inDays, setInDays] = useState<number | undefined>(session.followUp?.inDays ?? treatment.followUpDays ?? 30);
  const [followNote, setFollowNote] = useState(session.followUp?.note ?? "");
  const [reminder, setReminder] = useState(false);
  const [booking, setBooking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = (price ?? 0) - appointment.paidTotal;
  const amountDue = amount ?? balance;
  const aftercare = { items: items.filter((i) => i.included).map((i) => i.text), notes: aftercareNotes };
  const followUp = recommended ? { recommended: true, inDays, note: followNote } : { recommended: false };

  const blocked =
    price === null
      ? "Escribe el precio para continuar."
      : price < appointment.paidTotal
        ? `El precio no puede ser menor a lo ya abonado (${formatMoney(appointment.paidTotal)}).`
        : balance > 0 && payNow === undefined
          ? "Elige si paga ahora o queda pendiente."
          : balance > 0 && payNow && (!method || amountDue <= 0 || amountDue > balance)
            ? `Escribe un pago entre $ 1 y ${formatMoney(balance)}.`
            : recommended === undefined
              ? "Elige si recomiendas seguimiento."
              : recommended && !inDays
                ? "Escribe en cuántos días recomiendas el seguimiento."
                : recommended && !nextAppointment && !reminder
                  ? "Elige «Agendar ahora» o «Crear recordatorio»."
                  : null;

  useEffect(() => {
    registerDraft(() => saveClosing({ sessionId: session._id, aftercare, followUp }));
    return () => registerDraft(null);
  });

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    setItems((current) => [...current, { text, included: true }]);
    setNewItem("");
  }

  async function finish() {
    if (price === null) return;
    setPending(true);
    setError(null);
    try {
      await close({
        sessionId: session._id,
        aftercare,
        followUp,
        reminder: Boolean(recommended && reminder && !nextAppointment),
        price,
        payment: balance > 0 && payNow && method ? { amount: amountDue, method } : undefined,
      });
      toast.success("Atención finalizada");
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  }

  return (
    <>
      <StepBody>
        <StepSection title="Indicaciones posteriores" description="Quita las que no apliquen o agrega otras para este cliente.">
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((item, index) => (
              <li key={`${item.text}-${index}`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.included}
                  onClick={() => setItems((current) => current.map((i, n) => (n === index ? { ...i, included: !i.included } : i)))}
                  className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-porcelain"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                      item.included ? "border-plum bg-plum text-white" : "border-ink-soft/50 bg-surface",
                    )}
                  >
                    {item.included && <Check className="size-4" strokeWidth={2.5} />}
                  </span>
                  <span className={cn(!item.included && "text-ink-soft line-through")}>{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addItem();
            }}
          >
            <Input aria-label="Nueva indicación" placeholder="Otra indicación" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!newItem.trim()}>
              <Plus />
              Agregar
            </Button>
          </form>
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.notes} className="text-base">
              Notas para el cliente
            </Label>
            <Textarea id={ids.notes} rows={2} className="min-h-20" value={aftercareNotes} onChange={(e) => setAftercareNotes(e.target.value)} />
          </div>
        </StepSection>

        <StepSection title="Pago">
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.price} className="text-base">
              Precio
            </Label>
            <MoneyInput id={ids.price} value={price} onChange={setPrice} className="max-w-48" />
          </div>
          {payments.length > 0 && (
            <ul className="flex flex-col gap-1 text-ink-soft">
              {payments.map((p) => (
                <li key={p._id} className="tabular-nums">
                  Abono de {formatMoney(p.amount)} por {PAYMENT_METHOD_LABELS[p.method]}, el {formatShortDate(p.paidAt)}
                </li>
              ))}
            </ul>
          )}
          {price !== null && balance <= 0 ? (
            <p className="flex items-center gap-2 font-medium text-sage">
              <Check className="size-5" strokeWidth={2} />
              Pagada
            </p>
          ) : (
            price !== null && (
              <div className="flex flex-col gap-4">
                <p className="text-lg tabular-nums">
                  Saldo <span className="font-medium">{formatMoney(balance)}</span>
                </p>
                <div role="radiogroup" aria-label="Pago" className="grid grid-cols-2 gap-2">
                  <Chip role="radio" aria-checked={payNow === true} selected={payNow === true} onClick={() => setPayNow(true)} className="min-h-12 justify-center">
                    Paga ahora
                  </Chip>
                  <Chip role="radio" aria-checked={payNow === false} selected={payNow === false} onClick={() => setPayNow(false)} className="min-h-12 justify-center">
                    Queda pendiente
                  </Chip>
                </div>
                {payNow && (
                  <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
                    <SingleChips
                      label="Medio de pago"
                      options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
                      value={method}
                      onChange={setMethod}
                      required
                    />
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={ids.amount} className="text-base">
                        Valor
                      </Label>
                      <MoneyInput id={ids.amount} value={amountDue} onChange={setAmount} className="max-w-48" />
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </StepSection>

        <StepSection title="Seguimiento">
          <div className="flex flex-col gap-3">
            <span id={ids.followUp} className="text-base font-medium">
              ¿Recomiendas seguimiento?
            </span>
            <SingleChips
              labelledBy={ids.followUp}
              options={[
                { value: false, label: "No" },
                { value: true, label: "Sí" },
              ]}
              value={recommended}
              onChange={setRecommended}
              required
            />
          </div>
          {recommended && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={ids.days} className="text-base">
                  En cuántos días
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id={ids.days}
                    inputMode="numeric"
                    className="w-24 tabular-nums"
                    value={inDays ?? ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                      setInDays(digits ? Number(digits) : undefined);
                    }}
                  />
                  {inDays ? <span className="text-ink-soft">el {formatCalendarDate(addDaysToDateKey(todayKey(), inDays))}</span> : null}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={ids.followNote} className="text-base">
                  Nota del seguimiento
                </Label>
                <Input id={ids.followNote} placeholder="Revisar manchas, segunda sesión…" value={followNote} onChange={(e) => setFollowNote(e.target.value)} />
              </div>
              {nextAppointment ? (
                <p className="flex items-center gap-2 rounded-xl bg-sage-soft px-4 py-3 text-sage">
                  <CalendarCheck className="size-5 shrink-0" strokeWidth={1.75} />
                  Próxima cita: {formatDateTime(nextAppointment.start)}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="secondary" size="lg" onClick={() => setBooking(true)} disabled={!inDays}>
                    Agendar ahora
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    aria-pressed={reminder}
                    onClick={() => setReminder((value) => !value)}
                    className={cn(reminder && "border-plum/30 bg-lilac text-plum hover:bg-lilac")}
                  >
                    {reminder && <Check />}
                    Crear recordatorio
                  </Button>
                </div>
              )}
            </div>
          )}
        </StepSection>
      </StepBody>
      <StepFooter onBack={onBack} onContinue={() => void finish()} label="Finalizar atención" pending={pending} blocked={blocked} error={error} />

      {booking && inDays && (
        <ResponsiveDialog open={booking} onOpenChange={setBooking} title="Nueva cita" desktop="sheet" bodyClassName="pb-0">
          <AppointmentForm
            mode="create"
            prefill={{
              clientId: data.client._id,
              treatmentId: treatment._id,
              memberId: appointment.memberId,
              caseId: session.caseId,
              date: addDaysToDateKey(todayKey(), inDays),
            }}
            onDone={() => setBooking(false)}
          />
        </ResponsiveDialog>
      )}
    </>
  );
}
