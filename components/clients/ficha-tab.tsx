"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { errorText } from "@/components/forms/error-message";
import { Button } from "@/components/ui/button";
import type { ClientDoc } from "@/convex/clients";
import { AuthorizationInputs } from "./authorization-inputs";
import { FichaForm, fichaFromClient, useSaveFicha, withoutFixedErrors, type FichaErrors, type FichaValue } from "./ficha-form";
import { FichaSummary } from "./ficha-summary";
import { SheetBar } from "./sheet-bar";

/** Ficha tab: read view, and "Editar ficha" with the full `FichaForm`. */
export function FichaTab({ client }: { client: ClientDoc }) {
  const [editing, setEditing] = useState(false);
  const status = useQuery(api.clientAuthorizations.status, { clientId: client._id });
  if (!status) return null;
  if (!editing || !status.health) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <Authorizations client={client} status={status} />
        <Button variant="secondary" disabled={!status.health} className="self-start" onClick={() => setEditing(true)}>
          Editar ficha
        </Button>
        <FichaSummary client={client} />
      </div>
    );
  }
  return <FichaEditor client={client} onClose={() => setEditing(false)} />;
}

function Authorizations({ client, status }: { client: ClientDoc; status: { health: boolean; recordPhotos: boolean } }) {
  const notice = useQuery(api.clientAuthorizations.notice, { clientId: client._id });
  const record = useMutation(api.clientAuthorizations.record);
  const [evidence, setEvidence] = useState("");
  const [adult, setAdult] = useState(false);
  const [pending, setPending] = useState(false);
  // Remounts the inputs after each decision, so the next one starts from an empty choice.
  const [round, setRound] = useState(0);
  async function decide(purpose: "health" | "record_photos", action: "accepted" | "rejected" | "withdrawn") {
    if (!notice) return;
    setPending(true);
    try {
      await record({ clientId: client._id, purpose, action, evidence, adult, policyHash: notice.policyHash, requestKey: crypto.randomUUID() });
      setEvidence("");
      setRound((n) => n + 1);
      toast.success("Decisión registrada");
    } catch (error) { toast.error(errorText(error)); } finally { setPending(false); }
  }
  if (!notice) return null;
  return (
    <section className="flex flex-col gap-4 rounded-card border border-transparent bg-surface p-4 shadow-border">
      <p className="max-w-[70ch]">Los datos de salud son sensibles. El cliente puede negarse a autorizarlos sin perder su reserva.</p>
      <AuthorizationInputs
        key={round}
        policy={notice.policy}
        evidenceLabel="Cómo recibiste la decisión"
        evidence={evidence}
        onEvidenceChange={setEvidence}
        adult={adult}
        onAdultChange={setAdult}
      />
      <p className="max-w-[70ch]">{notice.labels.health}</p>
      <div className="flex flex-wrap gap-2">
        {status.health ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => void decide("health", "withdrawn")}>
            Registrar retiro
          </Button>
        ) : (
          <>
            <Button type="button" disabled={pending} onClick={() => void decide("health", "accepted")}>
              Registrar autorización
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => void decide("health", "rejected")}>
              Registrar negativa
            </Button>
          </>
        )}
      </div>
      <p className="max-w-[70ch]">{notice.labels.record_photos}</p>
      {status.recordPhotos && (
        <Button type="button" variant="secondary" disabled={pending} className="self-start" onClick={() => void decide("record_photos", "withdrawn")}>
          Registrar retiro de fotos
        </Button>
      )}
    </section>
  );
}

function FichaEditor({ client, onClose }: { client: ClientDoc; onClose: () => void }) {
  const saveFicha = useSaveFicha();
  const [ficha, setFicha] = useState(() => fichaFromClient(client));
  const [errors, setErrors] = useState<FichaErrors>({});
  const [pending, setPending] = useState(false);

  function change(next: FichaValue) {
    setErrors((current) => withoutFixedErrors(current, ficha, next));
    setFicha(next);
  }

  async function save() {
    setPending(true);
    const result = await saveFicha({ clientId: client._id, value: ficha });
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast.success("Ficha guardada");
    onClose();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex max-w-3xl flex-col gap-8"
    >
      <FichaForm value={ficha} onChange={change} errors={errors} />
      <SheetBar>
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar ficha"}
        </Button>
      </SheetBar>
    </form>
  );
}
