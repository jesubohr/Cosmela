"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthorizationInputs } from "./authorization-inputs";
import { SheetBar } from "./sheet-bar";
import { emptyFicha, FichaForm, useSaveFicha, withoutFixedErrors, type FichaErrors, type FichaValue } from "./ficha-form";

/** What to open on the new client's page once it is saved. */
export type AfterCreate = "cita" | "atencion";

/** Collect basic authorization before opening the health record. */
export function ClientCreateForm({ after }: { after?: AfterCreate }) {
  const notice = useQuery(api.clientAuthorizations.registrationNotice, {});
  if (!notice) return <Skeleton className="h-64 w-full max-w-2xl" />;
  if (!notice.legalReady) return <LegalIdentityMissing />;
  return <CreateForm notice={notice} after={after} />;
}

function CreateForm({ notice, after }: { notice: { policy: string; policyHash: string; label: string }; after?: AfterCreate }) {
  const router = useRouter();
  const saveFicha = useSaveFicha();
  const [ficha, setFicha] = useState(emptyFicha);
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
    if (evidence.trim().length < 5) return void toast.error("Elige o describe cómo recibiste la autorización (mínimo 5 letras).");
    if (!adult) return void toast.error("Confirma que el cliente tiene 18 años o más.");
    setPending(true);
    const result = await saveFicha({ value: ficha, includeHealth: false, authorization: { adult, evidence, policyHash: notice.policyHash, requestKey: crypto.randomUUID() }, after });
    setPending(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast.success("Cliente guardado");
    // Replace, so "back" from the client returns to where the appointment started.
    if (after) router.replace(`/clientes/${result.clientId}?nueva=${after}`);
    else router.push(`/clientes/${result.clientId}`);
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-8">
      <FichaForm value={ficha} onChange={change} errors={errors} sections={["identity"]} />
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
      <SheetBar>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cliente"}
        </Button>
      </SheetBar>
    </form>
  );
}

function LegalIdentityMissing() {
  const viewer = useViewer();
  return (
    <div className="flex max-w-[70ch] flex-col gap-4">
      <p>
        Antes de registrar clientes, completa la razón social, el NIT o cédula, la dirección, la ciudad y el WhatsApp de tu
        negocio. La ley de protección de datos exige que tus clientes sepan quién guarda su información.
      </p>
      {viewer.member.role === "admin" ? (
        <Button asChild className="self-start">
          <Link href="/configuracion/negocio">Completar datos del negocio</Link>
        </Button>
      ) : (
        <p className="text-ink-soft">Pide a quien administra el negocio que los complete en Configuración.</p>
      )}
    </div>
  );
}
