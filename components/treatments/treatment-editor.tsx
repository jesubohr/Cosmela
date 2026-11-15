"use client";

import { useMutation, useQuery } from "convex/react";
import { Copy, EllipsisVertical, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SingleChoice } from "@/components/forms/choice-chips";
import { ColorPicker } from "@/components/forms/color-picker";
import { DurationInput } from "@/components/forms/duration-input";
import { errorMessage } from "@/components/forms/error-message";
import { FormBuilder, formFieldsError } from "@/components/forms/form-builder";
import { StringListEditor } from "@/components/forms/string-list-editor";
import { MoneyInput } from "@/components/shared/money-input";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { TREATMENT_CATEGORIES } from "@/convex/lib/validators";
import { findTemplate } from "@/data/treatment-templates";
import { GENERAL_CONTRAINDICATION_LABELS, STAFF_COLORS, TREATMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { ConsentEditor, ConsentPreview, sampleConsentValues } from "./consent-editor";
import { GrayNotice } from "./gray-notice";

type Treatment = Doc<"treatments"> & { inUse: boolean };

/** The editable part of a treatment. Numbers are null while their input is empty. */
type Draft = Omit<
  Doc<"treatments">,
  "_id" | "_creationTime" | "orgId" | "active" | "templateKey" | "durationMin" | "price" | "followUpDays" | "suggestedSessions"
> & {
  durationMin: number | null;
  price: number | null;
  followUpDays: number | null;
  suggestedSessions: number | null;
};

type Tab = "general" | "formulario" | "consentimiento" | "cuidados";

function toDraft(t: Doc<"treatments">): Draft {
  return {
    name: t.name,
    category: t.category,
    description: t.description ?? "",
    durationMin: t.durationMin,
    price: t.price,
    color: t.color,
    bookableOnline: t.bookableOnline,
    consentText: t.consentText,
    contraindications: t.contraindications,
    aftercare: t.aftercare,
    followUpDays: t.followUpDays ?? null,
    suggestedSessions: t.suggestedSessions ?? null,
    formFields: t.formFields,
  };
}

/** The first problem that blocks saving, with the tab where it is. */
function draftError(draft: Draft): { tab: Tab; message: string } | null {
  if (!draft.name.trim()) return { tab: "general", message: "Escribe el nombre del tratamiento." };
  if (draft.durationMin === null || draft.durationMin < 5) {
    return { tab: "general", message: "La duración debe ser de al menos 5 minutos." };
  }
  if (draft.price === null) return { tab: "general", message: "Escribe el precio." };
  const formError = formFieldsError(draft.formFields);
  if (formError) return { tab: "formulario", message: formError };
  if (!draft.consentText.trim()) return { tab: "consentimiento", message: "El consentimiento no puede quedar vacío." };
  return null;
}

export function TreatmentEditor({ id }: { id: Id<"treatments"> }) {
  const treatment = useQuery(api.treatments.get, { id });

  if (treatment === undefined) {
    return (
      <>
        <PageHeader title="Tratamiento" backHref="/tratamientos" />
        <PageBody>
          <div aria-busy className="flex flex-col gap-4">
            <Skeleton className="h-11 w-full max-w-md" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </PageBody>
      </>
    );
  }
  // Remount on another treatment so the draft starts fresh.
  return <Editor key={treatment._id} treatment={treatment} />;
}

function Editor({ treatment }: { treatment: Treatment }) {
  const viewer = useViewer();
  const isAdmin = viewer.member.role === "admin";
  const update = useMutation(api.treatments.update);

  const [draft, setDraft] = useState<Draft>(() => toDraft(treatment));
  const [savedVersion, setSavedVersion] = useState(() => JSON.stringify(toDraft(treatment)));
  const [tab, setTab] = useState<Tab>("general");
  const [saving, setSaving] = useState(false);

  const serverVersion = JSON.stringify(toDraft(treatment));
  const dirty = JSON.stringify(draft) !== serverVersion;
  // Another admin saved while this one had no pending edits: follow the server.
  if (serverVersion !== savedVersion) {
    setSavedVersion(serverVersion);
    if (JSON.stringify(draft) === savedVersion) setDraft(toDraft(treatment));
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const template = findTemplate(treatment.templateKey);
  const previewValues = sampleConsentValues(draft.name, viewer.org.name);

  async function save() {
    const problem = draftError(draft);
    if (problem) {
      setTab(problem.tab);
      toast.error(problem.message);
      return;
    }
    setSaving(true);
    try {
      await update({
        id: treatment._id,
        name: draft.name,
        category: draft.category,
        description: draft.description || undefined,
        durationMin: draft.durationMin!,
        price: draft.price!,
        color: draft.color,
        bookableOnline: draft.bookableOnline,
        consentText: draft.consentText,
        contraindications: draft.contraindications,
        aftercare: draft.aftercare,
        followUpDays: draft.followUpDays ?? undefined,
        suggestedSessions: draft.suggestedSessions ?? undefined,
        formFields: draft.formFields.map(withoutEmpty),
      });
      toast.success("Tratamiento guardado");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={treatment.name}
        backHref="/tratamientos"
        actions={isAdmin && <TreatmentActions treatment={treatment} />}
      />
      <PageBody className="flex flex-col gap-6">
        {!treatment.active && (
          <p className="rounded-lg bg-porcelain px-3 py-2 text-ink-soft ring-1 ring-line">
            Este tratamiento está inactivo: no aparece al agendar ni en tu página de reservas.
          </p>
        )}
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="gap-6">
          <div className="-mx-4 overflow-x-auto border-b border-line px-4 lg:-mx-8 lg:px-8">
            <TabsList variant="line" className="h-auto gap-2 p-0 sm:gap-4">
              {(
                [
                  ["general", "General"],
                  ["formulario", "Formulario"],
                  ["consentimiento", "Consentimiento"],
                  ["cuidados", "Cuidados"],
                ] as const
              ).map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-11 flex-none px-1 text-[0.9375rem] text-ink-soft data-active:text-plum after:absolute after:inset-x-0 after:bottom-0! after:h-0.5 after:rounded-full after:bg-plum! data-active:after:opacity-100 sm:text-base"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="general" className="text-base">
            {isAdmin ? (
              <GeneralForm draft={draft} set={set} grayScope={template?.scope === "gray"} />
            ) : (
              <GeneralSummary treatment={treatment} grayScope={template?.scope === "gray"} />
            )}
          </TabsContent>

          <TabsContent value="formulario" className="max-w-3xl text-base">
            <FormBuilder fields={draft.formFields} onChange={(fields) => set("formFields", fields)} disabled={!isAdmin} />
          </TabsContent>

          <TabsContent value="consentimiento" className="text-base">
            {isAdmin ? (
              <ConsentEditor value={draft.consentText} onChange={(text) => set("consentText", text)} previewValues={previewValues} />
            ) : (
              <div className="rounded-card border border-line bg-surface p-4 leading-relaxed lg:p-6">
                <ConsentPreview text={treatment.consentText} values={previewValues} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="cuidados" className="text-base">
            {isAdmin ? <CareForm draft={draft} set={set} /> : <CareSummary treatment={treatment} />}
          </TabsContent>
        </Tabs>

        {isAdmin && dirty && (
          <div className="sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+12px)] flex gap-2 lg:bottom-6">
            <Button size="lg" className="shadow-float" disabled={saving} onClick={() => void save()}>
              {saving ? "Guardando…" : "Guardar tratamiento"}
            </Button>
            <Button size="lg" variant="secondary" className="shadow-float" disabled={saving} onClick={() => setDraft(toDraft(treatment))}>
              Descartar
            </Button>
          </div>
        )}
      </PageBody>
    </>
  );
}

/** Drops empty optional strings so the stored definition stays clean. */
function withoutEmpty(field: Draft["formFields"][number]) {
  return {
    ...field,
    help: field.help?.trim() || undefined,
    unit: field.unit?.trim() || undefined,
    options: field.options?.map((o) => o.trim()).filter(Boolean),
  };
}

type SetDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

function GeneralForm({ draft, set, grayScope }: { draft: Draft; set: SetDraft; grayScope: boolean }) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="treatment-name" className="text-base">
          Nombre
        </Label>
        <Input id="treatment-name" value={draft.name} onChange={(e) => set("name", e.target.value)} />
        {grayScope && <GrayNotice />}
      </div>
      <div className="flex flex-col gap-2">
        <span id="treatment-category" className="font-medium">
          Categoría
        </span>
        <SingleChoice
          labelledBy="treatment-category"
          required
          options={TREATMENT_CATEGORIES.map((c) => ({ value: c, label: TREATMENT_CATEGORY_LABELS[c] }))}
          value={draft.category}
          onChange={(value) => value && set("category", value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="treatment-description" className="text-base">
          Descripción <span className="font-normal text-ink-soft">(opcional)</span>
        </Label>
        <Textarea
          id="treatment-description"
          aria-describedby="treatment-description-help"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          className="min-h-20"
        />
        <p id="treatment-description-help" className="text-sm text-ink-soft">
          Se muestra en tu página de reservas.
        </p>
      </div>
      <div className="grid max-w-sm grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="treatment-duration" className="text-base">
            Duración
          </Label>
          <DurationInput id="treatment-duration" value={draft.durationMin} onChange={(v) => set("durationMin", v)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="treatment-price" className="text-base">
            Precio
          </Label>
          <MoneyInput id="treatment-price" value={draft.price} onChange={(v) => set("price", v)} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span id="treatment-color" className="font-medium">
          Color en la agenda
        </span>
        <ColorPicker value={draft.color} onChange={(color) => set("color", color)} labelledBy="treatment-color" />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3">
        <div className="flex flex-col">
          <Label htmlFor="treatment-online" className="text-base">
            Disponible para reserva en línea
          </Label>
          <span className="text-sm text-ink-soft">Tus clientes pueden pedirlo desde tu página de reservas.</span>
        </div>
        <Switch
          id="treatment-online"
          checked={draft.bookableOnline}
          onCheckedChange={(checked) => set("bookableOnline", checked)}
        />
      </div>
    </div>
  );
}

function GeneralSummary({ treatment, grayScope }: { treatment: Treatment; grayScope: boolean }) {
  const rows: [string, ReactNode][] = [
    ["Categoría", TREATMENT_CATEGORY_LABELS[treatment.category]],
    ["Duración", `${treatment.durationMin} min`],
    ["Precio", formatMoney(treatment.price)],
    [
      "Color en la agenda",
      <span key="color" className="inline-flex items-center gap-2">
        <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: STAFF_COLORS[treatment.color].strong }} />
        {STAFF_COLORS[treatment.color].label}
      </span>,
    ],
    ["Reserva en línea", treatment.bookableOnline ? "Disponible" : "No disponible"],
  ];
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {grayScope && <GrayNotice />}
      {treatment.description && <p className="max-w-[70ch]">{treatment.description}</p>}
      <dl className="divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const GENERAL_LIST_HELP = `Se suman a la lista general: ${Object.values(GENERAL_CONTRAINDICATION_LABELS)
  .slice(0, 4)
  .map((label) => label.toLowerCase())
  .join(", ")} y otras.`;

function CareForm({ draft, set }: { draft: Draft; set: SetDraft }) {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <StringListEditor
        legend="Contraindicaciones de este tratamiento"
        help={GENERAL_LIST_HELP}
        items={draft.contraindications}
        onChange={(items) => set("contraindications", items)}
        placeholder="Nueva contraindicación"
        itemLabel="Contraindicación"
      />
      <StringListEditor
        legend="Indicaciones posteriores"
        help="Se muestran al cerrar la atención y puedes enviarlas al cliente."
        items={draft.aftercare}
        onChange={(items) => set("aftercare", items)}
        placeholder="Nueva indicación"
        itemLabel="Indicación"
      />
      <div className="grid max-w-md gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="treatment-follow-up" className="text-base">
            Seguimiento sugerido
          </Label>
          <DurationInput
            id="treatment-follow-up"
            suffix="días"
            value={draft.followUpDays}
            onChange={(v) => set("followUpDays", v)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="treatment-sessions" className="text-base">
            Sesiones sugeridas
          </Label>
          <DurationInput
            id="treatment-sessions"
            suffix="sesiones"
            value={draft.suggestedSessions}
            onChange={(v) => set("suggestedSessions", v)}
            className="pr-20"
          />
        </div>
      </div>
    </div>
  );
}

function CareSummary({ treatment }: { treatment: Treatment }) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SummaryList title="Contraindicaciones de este tratamiento" items={treatment.contraindications} />
      <SummaryList title="Indicaciones posteriores" items={treatment.aftercare} />
      <dl className="flex flex-col gap-1">
        <div className="flex gap-2">
          <dt className="text-ink-soft">Seguimiento sugerido:</dt>
          <dd>{treatment.followUpDays ? `${treatment.followUpDays} días` : "Sin definir"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink-soft">Sesiones sugeridas:</dt>
          <dd>{treatment.suggestedSessions ?? "Sin definir"}</dd>
        </div>
      </dl>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium">{title}</h3>
      {items.length ? (
        <ul className="list-disc pl-5">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">Ninguna.</p>
      )}
    </section>
  );
}

function TreatmentActions({ treatment }: { treatment: Treatment }) {
  const router = useRouter();
  const duplicate = useMutation(api.treatments.duplicate);
  const setActive = useMutation(api.treatments.setActive);
  const remove = useMutation(api.treatments.remove);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const toggleActive = () =>
    run(async () => {
      await setActive({ id: treatment._id, active: !treatment.active });
      toast.success(treatment.active ? "Tratamiento desactivado" : "Tratamiento activado");
      setConfirming(false);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Más acciones">
            <EllipsisVertical strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            className="min-h-11 text-base"
            onSelect={() =>
              void run(async () => {
                const id = await duplicate({ id: treatment._id });
                toast.success("Tratamiento duplicado");
                router.push(`/tratamientos/${id}`);
              })
            }
          >
            <Copy className="size-5" strokeWidth={1.75} />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 text-base" onSelect={() => void toggleActive()}>
            <Power className="size-5" strokeWidth={1.75} />
            {treatment.active ? "Desactivar" : "Activar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-11 text-base text-rose focus:text-rose" onSelect={() => setConfirming(true)}>
            <Trash2 className="size-5 text-rose" strokeWidth={1.75} />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={treatment.inUse ? "No se puede eliminar" : `¿Eliminar ${treatment.name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            {treatment.inUse ? (
              treatment.active && (
                <Button disabled={busy} onClick={() => void toggleActive()}>
                  Desactivar tratamiento
                </Button>
              )
            ) : (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    // Leave first, so this page does not re-render a deleted treatment.
                    router.replace("/tratamientos");
                    await remove({ id: treatment._id });
                    toast.success("Tratamiento eliminado");
                  })
                }
              >
                Eliminar tratamiento
              </Button>
            )}
          </>
        }
      >
        <p className="text-ink-soft">
          {treatment.inUse
            ? treatment.active
              ? "Este tratamiento ya tiene citas. Desactívalo para que no aparezca al agendar; su historial se conserva."
              : "Este tratamiento ya tiene citas, así que se conserva desactivado para no perder su historial."
            : "Esta acción no se puede deshacer."}
        </p>
      </ResponsiveDialog>
    </>
  );
}
