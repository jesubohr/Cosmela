"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SheetBar } from "./sheet-bar";
import { emptyFicha, FichaForm, useSaveFicha, withoutFixedErrors, type FichaErrors, type FichaValue } from "./ficha-form";

/** Collect basic authorization before opening the health record. */
export function ClientCreateForm() {
  const router = useRouter();
  const saveFicha = useSaveFicha();
  const [ficha, setFicha] = useState(emptyFicha);
  const notice = useQuery(api.clientAuthorizations.registrationNotice, {});
  const [adult, setAdult] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [errors, setErrors] = useState<FichaErrors>({});
  const [pending, setPending] = useState(false);

  function change(next: FichaValue) {
    setErrors((current) => withoutFixedErrors(current, ficha, next));
    setFicha(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!adult || evidence.trim().length < 5 || !notice) { toast.error("Confirma la mayoría de edad y describe la autorización recibida."); return; }
    setPending(true);
    const result = await saveFicha({ value: ficha, includeHealth: false, authorization: { adult, evidence, policyHash: notice.policyHash, requestKey: crypto.randomUUID() } });
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast.success("Cliente guardado");
    router.push(`/clientes/${result.clientId}`);
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-8">
      <FichaForm value={ficha} onChange={change} errors={errors} sections={["identity"]} />
      {notice && <div className="flex flex-col gap-3">
        <p>{notice.label}</p>
        <details><summary>Leer la política del negocio</summary><p className="whitespace-pre-line">{notice.policy}</p></details>
        <label>Cómo recibiste la autorización <input className="rounded border p-2" value={evidence} onChange={e => setEvidence(e.target.value)} /></label>
        <label><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} /> Confirmé que el cliente tiene 18 años o más.</label>
      </div>}
      <SheetBar>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cliente"}
        </Button>
      </SheetBar>
    </form>
  );
}
