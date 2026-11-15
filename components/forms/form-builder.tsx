"use client";

import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  CircleDot,
  Copy,
  GripVertical,
  Hash,
  Heading,
  ListChecks,
  Plus,
  SlidersHorizontal,
  ToggleLeft,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type DragEvent } from "react";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FORM_FIELD_TYPES, type FormAnswers, type FormField, type FormFieldType } from "@/convex/lib/validators";
import { FORM_FIELD_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChoiceChip, SingleChoice } from "./choice-chips";
import { FormRenderer } from "./form-renderer";
import { Segmented } from "./segmented";
import { StringListEditor } from "./string-list-editor";

export const FIELD_TYPE_ICONS: Record<FormFieldType, LucideIcon> = {
  section: Heading,
  text: Type,
  longtext: AlignLeft,
  number: Hash,
  single: CircleDot,
  multi: ListChecks,
  yesno: ToggleLeft,
  scale: SlidersHorizontal,
  date: Calendar,
};

const UNIT_SUGGESTIONS = ["%", "pH", "min", "capas", "J/cm²", "mm"];

/** Problems that block saving a form definition, as Spanish messages. */
export function formFieldsError(fields: FormField[]): string | null {
  for (const [index, field] of fields.entries()) {
    const position = `El campo ${index + 1}`;
    if (!field.label.trim()) return `${position} no tiene título. Escríbelo o elimina el campo.`;
    if ((field.type === "single" || field.type === "multi") && !field.options?.some((o) => o.trim())) {
      return `"${field.label}" necesita al menos una opción.`;
    }
    if (field.type === "number" && field.min !== undefined && field.max !== undefined && field.min > field.max) {
      return `En "${field.label}", el mínimo no puede ser mayor que el máximo.`;
    }
  }
  return null;
}

function newField(type: FormFieldType): FormField {
  const field: FormField = { id: newFieldId(), type, label: "" };
  if (type === "single" || type === "multi") field.options = [];
  if (type === "scale") Object.assign(field, { min: 1, max: 5 });
  return field;
}

function newFieldId() {
  return `campo-${crypto.randomUUID().slice(0, 8)}`;
}

export type FormBuilderProps = {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  /** Read-only: shows the preview only (staff). */
  disabled?: boolean;
};

/**
 * Editor for a treatment's procedure form: a vertical list of fields with inline
 * editing, up/down reordering (and drag on desktop), duplicate, delete, and a
 * live "Vista previa" rendered with `FormRenderer`.
 */
export function FormBuilder({ fields, onChange, disabled }: FormBuilderProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (disabled) {
    return fields.length ? (
      <FormRenderer fields={fields} value={answers} onChange={setAnswers} />
    ) : (
      <p className="text-ink-soft">Este tratamiento no tiene formulario.</p>
    );
  }

  function update(index: number, next: FormField) {
    onChange(fields.map((field, i) => (i === index ? next : field)));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= fields.length || from === to) return;
    const next = [...fields];
    const [field] = next.splice(from, 1);
    next.splice(to, 0, field);
    onChange(next);
  }

  function add(type: FormFieldType) {
    const field = newField(type);
    onChange([...fields, field]);
    setExpandedId(field.id);
    setAdding(false);
  }

  function duplicate(index: number) {
    const copy = { ...fields[index], id: newFieldId(), label: `${fields[index].label} (copia)` };
    const next = [...fields];
    next.splice(index + 1, 0, copy);
    onChange(next);
    setExpandedId(copy.id);
  }

  function remove(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Modo del formulario"
        options={[
          ["edit", "Editar"],
          ["preview", "Vista previa"],
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === "preview" ? (
        fields.length ? (
          <div className="rounded-card border border-line bg-surface p-4 lg:p-6">
            <FormRenderer fields={fields} value={answers} onChange={setAnswers} />
          </div>
        ) : (
          <p className="text-ink-soft">Agrega campos para ver cómo se verá el formulario.</p>
        )
      ) : (
        <>
          {fields.length === 0 && (
            <p className="max-w-[60ch] text-ink-soft">
              Este tratamiento aún no tiene formulario. Agrega los campos que quieres registrar en cada sesión.
            </p>
          )}
          <ol className="flex flex-col gap-2">
            {fields.map((field, index) => (
              <FieldItem
                key={field.id}
                field={field}
                index={index}
                count={fields.length}
                expanded={expandedId === field.id}
                onToggle={() => setExpandedId(expandedId === field.id ? null : field.id)}
                onChange={(next) => update(index, next)}
                onMove={(delta) => move(index, index + delta)}
                onDuplicate={() => duplicate(index)}
                onRemove={() => remove(index)}
                dropTarget={dropIndex === index && dragIndex !== null && dragIndex !== index}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => {
                  if (dragIndex === null) return;
                  event.preventDefault();
                  setDropIndex(index);
                }}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
              />
            ))}
          </ol>
          <Button type="button" variant="secondary" className="self-start" onClick={() => setAdding(true)}>
            <Plus />
            Agregar campo
          </Button>
        </>
      )}

      <ResponsiveDialog open={adding} onOpenChange={setAdding} title="Agregar campo">
        <ul className="-mx-2 flex flex-col">
          {FORM_FIELD_TYPES.map((type) => {
            const Icon = FIELD_TYPE_ICONS[type];
            const { label, description } = FORM_FIELD_TYPE_LABELS[type];
            return (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => add(type)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-lilac"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-porcelain text-plum">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium">{label}</span>
                    <span className="text-sm text-ink-soft">{description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </ResponsiveDialog>
    </div>
  );
}

type FieldItemProps = {
  field: FormField;
  index: number;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (field: FormField) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  dropTarget: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
};

function FieldItem(props: FieldItemProps) {
  const { field, index, count, expanded, onToggle, dropTarget } = props;
  // Only the grip starts a drag, so text inside the editor stays selectable.
  const [dragArmed, setDragArmed] = useState(false);
  const Icon = FIELD_TYPE_ICONS[field.type];
  const panelId = useId();

  return (
    <li
      draggable={dragArmed}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        props.onDragStart();
      }}
      onDragOver={props.onDragOver}
      onDrop={(event) => {
        event.preventDefault();
        props.onDrop();
      }}
      onDragEnd={() => {
        setDragArmed(false);
        props.onDragEnd();
      }}
      className={cn(
        "rounded-card border bg-surface",
        expanded ? "border-plum/40" : "border-line",
        dropTarget && "border-plum ring-2 ring-plum/20",
      )}
    >
      <div className="flex items-center">
        <span
          aria-hidden
          onPointerDown={() => setDragArmed(true)}
          onPointerUp={() => setDragArmed(false)}
          className="hidden h-14 w-8 shrink-0 cursor-grab items-center justify-center text-ink-soft lg:flex"
        >
          <GripVertical className="size-4" strokeWidth={1.75} />
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left lg:pl-1"
        >
          <Icon className="size-5 shrink-0 text-plum" strokeWidth={1.75} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn("truncate font-medium", !field.label && "text-ink-soft")}>
              {field.label || "Sin título"}
            </span>
            <span className="flex flex-wrap gap-x-3 text-sm text-ink-soft">
              <span>{FORM_FIELD_TYPE_LABELS[field.type].label}</span>
              {field.unit && <span>{field.unit}</span>}
              {field.required && <span>Obligatorio</span>}
            </span>
          </span>
          <ChevronDown
            className={cn("size-5 shrink-0 text-ink-soft transition-transform", expanded && "rotate-180")}
            strokeWidth={1.75}
          />
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="flex flex-col gap-5 border-t border-line px-4 pt-4 pb-3">
          <FieldEditor field={field} onChange={props.onChange} />
          <div className="-mx-2 flex flex-wrap items-center gap-1">
            <IconAction label="Subir" icon={ArrowUp} disabled={index === 0} onClick={() => props.onMove(-1)} />
            <IconAction label="Bajar" icon={ArrowDown} disabled={index === count - 1} onClick={() => props.onMove(1)} />
            <IconAction label="Duplicar" icon={Copy} onClick={props.onDuplicate} />
            <IconAction label="Eliminar" icon={Trash2} onClick={props.onRemove} destructive />
            <Button type="button" variant="ghost" className="ml-auto" onClick={onToggle}>
              Listo
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function IconAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(destructive && "text-rose hover:bg-rose-soft")}
    >
      <Icon strokeWidth={1.75} />
    </Button>
  );
}

function FieldEditor({ field, onChange }: { field: FormField; onChange: (field: FormField) => void }) {
  const id = useId();
  const set = (patch: Partial<FormField>) => onChange({ ...field, ...patch });
  const optionalNumber = (value: string) => (value.trim() === "" ? undefined : Number(value));

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-label`} className="text-base">
          {field.type === "section" ? "Título de la sección" : "Pregunta"}
        </Label>
        <Input
          id={`${id}-label`}
          autoFocus={!field.label}
          value={field.label}
          onChange={(e) => set({ label: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-help`} className="text-base">
          Texto de ayuda <span className="font-normal text-ink-soft">(opcional)</span>
        </Label>
        <Input
          id={`${id}-help`}
          value={field.help ?? ""}
          onChange={(e) => set({ help: e.target.value || undefined })}
        />
      </div>

      {(field.type === "single" || field.type === "multi") && (
        <StringListEditor
          legend="Opciones"
          items={field.options ?? []}
          onChange={(options) => set({ options })}
          placeholder="Nueva opción"
          itemLabel="Opción"
        />
      )}

      {field.type === "number" && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-unit`} className="text-base">
              Unidad <span className="font-normal text-ink-soft">(opcional)</span>
            </Label>
            <Input
              id={`${id}-unit`}
              className="max-w-56"
              value={field.unit ?? ""}
              onChange={(e) => set({ unit: e.target.value || undefined })}
            />
            <div className="flex flex-wrap gap-2">
              {UNIT_SUGGESTIONS.map((unit) => (
                <ChoiceChip
                  key={unit}
                  selected={field.unit === unit}
                  aria-pressed={field.unit === unit}
                  onClick={() => set({ unit: field.unit === unit ? undefined : unit })}
                >
                  {unit}
                </ChoiceChip>
              ))}
            </div>
          </div>
          <div className="grid max-w-sm grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-min`} className="text-base">
                Mínimo
              </Label>
              <Input
                id={`${id}-min`}
                type="number"
                inputMode="decimal"
                step="any"
                value={field.min ?? ""}
                onChange={(e) => set({ min: optionalNumber(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-max`} className="text-base">
                Máximo
              </Label>
              <Input
                id={`${id}-max`}
                type="number"
                inputMode="decimal"
                step="any"
                value={field.max ?? ""}
                onChange={(e) => set({ max: optionalNumber(e.target.value) })}
              />
            </div>
          </div>
        </>
      )}

      {field.type === "scale" && <ScaleEditor field={field} onChange={onChange} />}

      {field.type !== "section" && (
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={`${id}-required`} className="text-base font-normal">
            Obligatorio
          </Label>
          <Switch
            id={`${id}-required`}
            checked={field.required ?? false}
            onCheckedChange={(required) => set({ required: required || undefined })}
          />
        </div>
      )}
    </>
  );
}

function ScaleEditor({ field, onChange }: { field: FormField; onChange: (field: FormField) => void }) {
  const id = useId();
  const max = field.max ?? 5;
  const [minLabel = "", maxLabel = ""] = field.options ?? [];
  const setLabels = (low: string, high: string) =>
    onChange({ ...field, options: low.trim() || high.trim() ? [low, high] : undefined });

  return (
    <>
      <div className="flex flex-col gap-2">
        <span id={`${id}-range`} className="font-medium">
          Rango
        </span>
        <SingleChoice
          labelledBy={`${id}-range`}
          required
          options={[
            { value: 5, label: "1 a 5" },
            { value: 10, label: "1 a 10" },
          ]}
          value={max}
          onChange={(value) => onChange({ ...field, min: 1, max: value ?? 5 })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-low`} className="text-base">
            Texto para el 1 <span className="font-normal text-ink-soft">(opcional)</span>
          </Label>
          <Input id={`${id}-low`} value={minLabel} onChange={(e) => setLabels(e.target.value, maxLabel)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-high`} className="text-base">
            Texto para el {max} <span className="font-normal text-ink-soft">(opcional)</span>
          </Label>
          <Input id={`${id}-high`} value={maxLabel} onChange={(e) => setLabels(minLabel, e.target.value)} />
        </div>
      </div>
    </>
  );
}
