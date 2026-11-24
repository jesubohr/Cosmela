"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useId, useState, type FormEvent } from "react";
import { ClientPicker, type PickedClient } from "@/components/clients/client-picker";
import { errorText } from "@/components/forms/error-message";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FieldBlock, FormError, MemberSelect, SheetActions, useFocusFirstError, useFormOptions } from "./parts";

/** "Atención sin cita": creates an appointment that starts now and opens the attention flow. */
export function WalkInForm({ clientId }: { clientId?: Id<"clients"> }) {
  const options = useFormOptions();
  const prefill = useQuery(api.clients.get, clientId ? { clientId } : "skip");
  if (!options || (clientId && prefill === undefined)) return <Skeleton className="h-64 w-full" />;
  if (options.treatments.length === 0) {
    return <p className="text-ink-soft">Aún no tienes tratamientos. Créalos en Tratamientos para poder atender.</p>;
  }
  const initial = prefill ? { _id: prefill._id, name: `${prefill.firstName} ${prefill.lastName}`.trim(), phone: prefill.phone } : null;
  return <Fields options={options} initialClient={initial} />;
}

function Fields({ options, initialClient }: { options: NonNullable<ReturnType<typeof useFormOptions>>; initialClient: PickedClient | null }) {
  const router = useRouter();
  const viewer = useViewer();
  const startWalkIn = useMutation(api.appointments.startWalkIn);
  const ids = { treatment: useId(), member: useId() };
  const [client, setClient] = useState(initialClient);
  const [treatmentId, setTreatmentId] = useState<Id<"treatments">>();
  const own = options.members.find((m) => m._id === viewer.member._id);
  const [memberId, setMemberId] = useState(own?._id ?? options.members[0]?._id);
  const [errors, setErrors] = useState<{ client?: string; treatment?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const formRef = useFocusFirstError(errors);
  const isSalon = viewer.org.kind === "salon" && options.members.length > 1;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      client: client ? undefined : "Elige un cliente o crea uno nuevo.",
      treatment: treatmentId ? undefined : "Elige un tratamiento.",
    };
    setErrors(next);
    if (!client || !treatmentId || !memberId) return;
    setPending(true);
    try {
      const id = await startWalkIn({ clientId: client._id, treatmentId, memberId });
      router.push(`/atencion/${id}`);
    } catch (error) {
      setErrors({ form: errorText(error) });
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-6">
      <FieldBlock label="Cliente">
        <ClientPicker value={client} onChange={setClient} error={errors.client} createFor="atencion" />
      </FieldBlock>
      <FieldBlock label="Tratamiento" htmlFor={ids.treatment} error={errors.treatment}>
        <Select value={treatmentId ?? ""} onValueChange={(v) => setTreatmentId(v as Id<"treatments">)}>
          <SelectTrigger
            id={ids.treatment}
            className="w-full"
            aria-invalid={errors.treatment ? true : undefined}
            aria-describedby={errors.treatment ? `${ids.treatment}-error` : undefined}
          >
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
      <FormError>{errors.form}</FormError>
      <SheetActions>
        <Button type="submit" disabled={pending}>
          {pending ? "Abriendo…" : "Iniciar atención"}
        </Button>
      </SheetActions>
    </form>
  );
}
