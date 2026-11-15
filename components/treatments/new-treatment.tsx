"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SingleChoice } from "@/components/forms/choice-chips";
import { ColorPicker } from "@/components/forms/color-picker";
import { DurationInput } from "@/components/forms/duration-input";
import { errorMessage } from "@/components/forms/error-message";
import { EmptyState } from "@/components/shared/empty-state";
import { Segmented } from "@/components/forms/segmented";
import { MoneyInput } from "@/components/shared/money-input";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { TREATMENT_CATEGORIES, type StaffColor, type TreatmentCategory } from "@/convex/lib/validators";
import { TREATMENT_CATEGORY_LABELS } from "@/lib/constants";
import { picksError, picksToArgs, TemplateList, type TemplatePicks } from "./template-list";

type Mode = "templates" | "scratch";

/** "Nuevo tratamiento": add from templates or create from scratch. Admin only. */
export function NewTreatment() {
  const isAdmin = useViewer().member.role === "admin";
  const [mode, setMode] = useState<Mode>("templates");

  return (
    <>
      <PageHeader title="Nuevo tratamiento" backHref="/tratamientos" />
      <PageBody className="flex max-w-[760px] flex-col gap-6">
        {!isAdmin ? (
          <EmptyState message="Solo un administrador puede agregar tratamientos." />
        ) : (
          <>
            <Segmented
              label="Cómo crear el tratamiento"
              options={[
                ["templates", "Desde plantillas"],
                ["scratch", "Desde cero"],
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === "templates" ? <FromTemplates /> : <FromScratch />}
          </>
        )}
      </PageBody>
    </>
  );
}

function FromTemplates() {
  const router = useRouter();
  const add = useMutation(api.templates.add);
  const treatments = useQuery(api.treatments.list);
  const ownedKeys = useMemo(
    () => new Set((treatments ?? []).flatMap((t) => (t.templateKey ? [t.templateKey] : []))),
    [treatments],
  );
  const [picks, setPicks] = useState<TemplatePicks>({});
  const [saving, setSaving] = useState(false);
  const count = Object.keys(picks).length;

  async function submit() {
    const message = picksError(picks);
    if (message) {
      toast.error(message);
      return;
    }
    setSaving(true);
    try {
      await add({ picks: picksToArgs(picks) });
      toast.success(count === 1 ? "Tratamiento agregado" : "Tratamientos agregados");
      router.push("/tratamientos");
    } catch (error) {
      toast.error(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <>
      <p className="text-ink-soft">Elige uno o varios. Se copian a tu catálogo y puedes editarlos después.</p>
      <TemplateList picks={picks} onChange={setPicks} ownedKeys={ownedKeys} />
      {count > 0 && (
        <div className="sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+12px)] lg:bottom-6">
          <Button size="lg" className="shadow-float" disabled={saving} onClick={() => void submit()}>
            {count === 1 ? "Agregar 1 tratamiento" : `Agregar ${count} tratamientos`}
          </Button>
        </div>
      )}
    </>
  );
}

function FromScratch() {
  const router = useRouter();
  const create = useMutation(api.treatments.create);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TreatmentCategory>("facial");
  const [durationMin, setDurationMin] = useState<number | null>(60);
  const [price, setPrice] = useState<number | null>(null);
  const [color, setColor] = useState<StaffColor>("plum");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = !name.trim()
      ? "Escribe el nombre del tratamiento."
      : durationMin === null || durationMin < 5
        ? "La duración debe ser de al menos 5 minutos."
        : price === null
          ? "Escribe el precio."
          : null;
    setError(message);
    if (message) return;
    setSaving(true);
    try {
      const id = await create({ name, category, durationMin: durationMin!, price: price!, color });
      toast.success("Tratamiento creado");
      router.replace(`/tratamientos/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-name" className="text-base">
          Nombre
        </Label>
        <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <span id="new-category" className="font-medium">
          Categoría
        </span>
        <SingleChoice
          labelledBy="new-category"
          required
          options={TREATMENT_CATEGORIES.map((c) => ({ value: c, label: TREATMENT_CATEGORY_LABELS[c] }))}
          value={category}
          onChange={(value) => value && setCategory(value)}
        />
      </div>
      <div className="grid max-w-sm grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-duration" className="text-base">
            Duración
          </Label>
          <DurationInput id="new-duration" value={durationMin} onChange={setDurationMin} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-price" className="text-base">
            Precio
          </Label>
          <MoneyInput id="new-price" value={price} onChange={setPrice} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span id="new-color" className="font-medium">
          Color en la agenda
        </span>
        <ColorPicker value={color} onChange={setColor} labelledBy="new-color" />
      </div>
      {error && (
        <p role="alert" className="text-rose">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="self-start" disabled={saving}>
        {saving ? "Creando…" : "Crear tratamiento"}
      </Button>
    </form>
  );
}
