"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormAnswer, FormAnswers, FormField } from "@/convex/lib/validators";
import { cn } from "@/lib/utils";
import { MultiChoice, SingleChoice } from "./choice-chips";
import { formatNumber, scaleRange, type AnswerErrors } from "./validate-answers";

export { validateAnswers, isEmptyAnswer, type AnswerErrors } from "./validate-answers";

export type FormRendererProps = {
  /** The treatment's form definition (or the snapshot stored with a session). */
  fields: FormField[];
  /** Answers by field id. Missing ids render empty. */
  value: FormAnswers;
  /** Receives the whole answers object with the changed field replaced. */
  onChange: (value: FormAnswers) => void;
  /** Messages by field id, e.g. from `validateAnswers(fields, value)`. */
  errors?: AnswerErrors;
  /** Read-only, e.g. a closed session. */
  disabled?: boolean;
  className?: string;
};

/**
 * Renders a treatment's custom form as a controlled component.
 *
 * Answer types by field type: `text`, `longtext`, `single`, and `date` ("YYYY-MM-DD")
 * are strings; `number` and `scale` are numbers; `multi` is a string array; `yesno`
 * is a boolean; an empty answer is `null` or missing. `section` fields render a
 * heading and have no answer.
 *
 * Validate before saving with `validateAnswers(fields, value)`; it returns Spanish
 * messages by field id, ready for `errors`. The same function runs on the server.
 */
export function FormRenderer({ fields, value, onChange, errors = {}, disabled, className }: FormRendererProps) {
  const baseId = useId();
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {fields.map((field) => (
        <FieldView
          key={field.id}
          id={`${baseId}-${field.id}`}
          field={field}
          answer={value[field.id] ?? null}
          error={errors[field.id]}
          disabled={disabled}
          onChange={(answer) => onChange({ ...value, [field.id]: answer })}
        />
      ))}
    </div>
  );
}

type FieldViewProps = {
  id: string;
  field: FormField;
  answer: FormAnswer;
  error?: string;
  disabled?: boolean;
  onChange: (answer: FormAnswer) => void;
};

function FieldView({ id, field, answer, error, disabled, onChange }: FieldViewProps) {
  const labelId = `${id}-label`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  if (field.type === "section") {
    return (
      <div className="flex flex-col gap-1 pt-2 first:pt-0">
        <h3 className="text-lg font-medium">{field.label || "Sección"}</h3>
        {field.help && <p className="text-sm text-ink-soft">{field.help}</p>}
      </div>
    );
  }

  const describedBy = [field.help && helpId, error && errorId].filter(Boolean).join(" ") || undefined;
  const control = { id, describedBy, invalid: Boolean(error), disabled };
  // Chip groups and the scale are labelled by id; inputs use a real <label>.
  const isGroup = field.type === "single" || field.type === "multi" || field.type === "yesno" || field.type === "scale";

  return (
    <div className="flex flex-col gap-2">
      {isGroup ? (
        <span id={labelId} className="font-medium">
          <FieldLabelText field={field} />
        </span>
      ) : (
        <label htmlFor={id} className="font-medium">
          <FieldLabelText field={field} />
        </label>
      )}
      {field.help && (
        <p id={helpId} className="-mt-1 text-sm text-ink-soft">
          {field.help}
        </p>
      )}
      <FieldControl field={field} answer={answer} onChange={onChange} labelId={labelId} {...control} />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-rose">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldLabelText({ field }: { field: FormField }) {
  return (
    <>
      {field.label || "Sin título"}
      {field.required && (
        <>
          <span aria-hidden className="ml-0.5 text-rose">
            *
          </span>
          <span className="sr-only"> (obligatorio)</span>
        </>
      )}
    </>
  );
}

type ControlProps = FieldViewProps & { labelId: string; describedBy?: string; invalid: boolean };

function FieldControl({ id, field, answer, onChange, labelId, describedBy, invalid, disabled }: ControlProps) {
  const aria = { "aria-describedby": describedBy, "aria-invalid": invalid || undefined };
  const options = (field.options ?? []).map((option) => ({ value: option, label: option }));

  switch (field.type) {
    case "text":
      return (
        <Input id={id} value={asString(answer)} onChange={(e) => onChange(e.target.value)} disabled={disabled} {...aria} />
      );
    case "longtext":
      return (
        <Textarea id={id} value={asString(answer)} onChange={(e) => onChange(e.target.value)} disabled={disabled} {...aria} />
      );
    case "number":
      return (
        <NumberInput
          id={id}
          value={typeof answer === "number" ? answer : null}
          onChange={onChange}
          unit={field.unit}
          disabled={disabled}
          {...aria}
        />
      );
    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={asString(answer)}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className="w-fit min-w-44"
          {...aria}
        />
      );
    case "single":
      return (
        <SingleChoice
          options={options}
          value={typeof answer === "string" ? answer : null}
          onChange={onChange}
          labelledBy={labelId}
          describedBy={describedBy}
          invalid={invalid}
          disabled={disabled}
        />
      );
    case "multi":
      return (
        <MultiChoice
          options={options}
          value={Array.isArray(answer) ? answer : []}
          onChange={(next) => onChange(next.length ? next : null)}
          labelledBy={labelId}
          describedBy={describedBy}
          invalid={invalid}
          disabled={disabled}
        />
      );
    case "yesno":
      return (
        <SingleChoice
          options={[
            { value: true, label: "Sí" },
            { value: false, label: "No" },
          ]}
          value={typeof answer === "boolean" ? answer : null}
          onChange={onChange}
          labelledBy={labelId}
          describedBy={describedBy}
          invalid={invalid}
          disabled={disabled}
        />
      );
    case "scale":
      return (
        <ScaleInput
          field={field}
          value={typeof answer === "number" ? answer : null}
          onChange={onChange}
          labelId={labelId}
          describedBy={describedBy}
          invalid={invalid}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}

function asString(answer: FormAnswer): string {
  return typeof answer === "string" ? answer : "";
}

type NumberInputProps = {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/** Accepts a decimal comma or point. Keeps the typed text so "2," can become "2,5". */
function NumberInput({ id, value, onChange, unit, disabled, ...aria }: NumberInputProps) {
  const [text, setText] = useState(value === null ? "" : formatNumber(value));
  const [syncedValue, setSyncedValue] = useState(value);
  // Follow outside changes (e.g. a reset) without fighting the user's typing.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (parseNumber(text) !== value) setText(value === null ? "" : formatNumber(value));
  }

  return (
    <div className="relative w-full max-w-56">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d.,-]/g, "");
          setText(raw);
          onChange(parseNumber(raw));
        }}
        className={cn("tabular-nums", unit && "pr-16")}
        {...aria}
      />
      {unit && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-soft">
          {unit}
        </span>
      )}
      {unit && <span className="sr-only">{`en ${unit}`}</span>}
    </div>
  );
}

function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "" || normalized === "-" || normalized.endsWith(".")) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

type ScaleInputProps = {
  field: FormField;
  value: number | null;
  onChange: (value: number | null) => void;
  labelId: string;
  describedBy?: string;
  invalid: boolean;
  disabled?: boolean;
};

/** Tappable 1–5 or 1–10 row; wraps to two rows of five on narrow screens. */
function ScaleInput({ field, value, onChange, labelId, describedBy, invalid, disabled }: ScaleInputProps) {
  const { min, max } = scaleRange(field);
  const steps = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
  const [minLabel, maxLabel] = field.options ?? [];

  return (
    <div className="flex max-w-xl flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cn("grid gap-2", steps.length > 5 ? "grid-cols-5 sm:grid-cols-10" : "grid-cols-5")}
      >
        {steps.map((step) => {
          const selected = step === value;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(selected ? null : step)}
              className={cn(
                "h-11 rounded-lg border text-base tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "border-plum bg-plum font-medium text-white" : "border-line bg-surface hover:bg-porcelain",
              )}
            >
              {step}
            </button>
          );
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between gap-4 text-sm text-ink-soft">
          <span>{minLabel}</span>
          <span className="text-right">{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
