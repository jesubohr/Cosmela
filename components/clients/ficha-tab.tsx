"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ClientDoc } from "@/convex/clients";
import { FichaForm, fichaFromClient, useSaveFicha, withoutFixedErrors, type FichaErrors, type FichaValue } from "./ficha-form";
import { FichaSummary } from "./ficha-summary";
import { SheetBar } from "./sheet-bar";

/** Ficha tab: read view, and "Editar ficha" with the full `FichaForm`. */
export function FichaTab({ client }: { client: ClientDoc }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <Button variant="secondary" className="self-start" onClick={() => setEditing(true)}>
          Editar ficha
        </Button>
        <FichaSummary client={client} />
      </div>
    );
  }
  return <FichaEditor client={client} onClose={() => setEditing(false)} />;
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
