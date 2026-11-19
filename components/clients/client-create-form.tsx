"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthorizationInputs } from "./authorization-inputs";
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
      {notice && (
        <section className="flex flex-col gap-4">
          <p className="max-w-[70ch]">{notice.label}</p>
          <AuthorizationInputs
            policy={notice.policy}
            evidenceLabel="Cómo recibiste la autorización"
            evidence={evidence}
            onEvidenceChange={setEvidence}
            adult={adult}
            onAdultChange={setAdult}
          />
        </section>
      )}
      <SheetBar>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cliente"}
        </Button>
      </SheetBar>
    </form>
  );
}
