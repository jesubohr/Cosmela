"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SheetBar } from "./sheet-bar";
import { emptyFicha, FichaForm, useSaveFicha, type FichaErrors } from "./ficha-form";

/** Quick create (name + phone) with "Completar ficha ahora" to fill the whole ficha. */
export function ClientCreateForm() {
  const router = useRouter();
  const saveFicha = useSaveFicha();
  const [ficha, setFicha] = useState(emptyFicha);
  const [complete, setComplete] = useState(false);
  const [errors, setErrors] = useState<FichaErrors>({});
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await saveFicha({ value: ficha, includeHealth: complete });
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
      <FichaForm value={ficha} onChange={setFicha} errors={errors} sections={complete ? undefined : ["identity"]} />
      {!complete && (
        <div className="flex items-center gap-3">
          <Switch id="complete-ficha" checked={complete} onCheckedChange={setComplete} />
          <Label htmlFor="complete-ficha" className="text-base">
            Completar ficha ahora
          </Label>
        </div>
      )}
      <SheetBar>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cliente"}
        </Button>
      </SheetBar>
    </form>
  );
}
