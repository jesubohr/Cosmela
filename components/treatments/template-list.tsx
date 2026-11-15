"use client";

import { Check, Info } from "lucide-react";
import { DurationInput } from "@/components/forms/duration-input";
import { MoneyInput } from "@/components/shared/money-input";
import { Label } from "@/components/ui/label";
import { TREATMENT_CATEGORIES } from "@/convex/lib/validators";
import { TREATMENT_TEMPLATES, type TreatmentTemplate } from "@/data/treatment-templates";
import { TREATMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GrayNotice } from "./gray-notice";

/** Selected template keys with the price and duration the user set (null while a field is empty). */
export type TemplatePicks = Record<string, { price: number | null; durationMin: number | null }>;

export function picksFor(templates: TreatmentTemplate[]): TemplatePicks {
  return Object.fromEntries(templates.map((t) => [t.key, { price: t.price, durationMin: t.durationMin }]));
}

/** The first incomplete pick as a Spanish message, or null. */
export function picksError(picks: TemplatePicks): string | null {
  for (const [key, pick] of Object.entries(picks)) {
    const name = TREATMENT_TEMPLATES.find((t) => t.key === key)?.name ?? key;
    if (pick.price === null) return `Escribe el precio de ${name}.`;
    if (pick.durationMin === null || pick.durationMin < 5) return `La duración de ${name} debe ser de al menos 5 minutos.`;
  }
  return null;
}

/** Picks in library order, ready for `orgs.create` or `templates.add`. Call after `picksError`. */
export function picksToArgs(picks: TemplatePicks) {
  return TREATMENT_TEMPLATES.filter((t) => picks[t.key]).map((t) => ({
    key: t.key,
    price: picks[t.key].price ?? t.price,
    durationMin: picks[t.key].durationMin ?? t.durationMin,
  }));
}

/** Template library grouped by category. Tap to select; selected cards edit price and duration inline. */
export function TemplateList({
  picks,
  onChange,
  ownedKeys,
}: {
  picks: TemplatePicks;
  onChange: (picks: TemplatePicks) => void;
  /** Template keys already in the catalog. */
  ownedKeys?: Set<string>;
}) {
  function toggle(template: TreatmentTemplate) {
    const next = { ...picks };
    if (next[template.key]) delete next[template.key];
    else next[template.key] = { price: template.price, durationMin: template.durationMin };
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-8">
      {TREATMENT_CATEGORIES.map((category) => {
        const templates = TREATMENT_TEMPLATES.filter((t) => t.category === category);
        if (templates.length === 0) return null;
        return (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">{TREATMENT_CATEGORY_LABELS[category]}</h2>
            <ul className="flex flex-col gap-2">
              {templates.map((template) => (
                <TemplateItem
                  key={template.key}
                  template={template}
                  pick={picks[template.key]}
                  owned={ownedKeys?.has(template.key) ?? false}
                  onToggle={() => toggle(template)}
                  onChange={(pick) => onChange({ ...picks, [template.key]: pick })}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TemplateItem({
  template,
  pick,
  owned,
  onToggle,
  onChange,
}: {
  template: TreatmentTemplate;
  pick: TemplatePicks[string] | undefined;
  owned: boolean;
  onToggle: () => void;
  onChange: (pick: TemplatePicks[string]) => void;
}) {
  const selected = pick !== undefined;
  const priceId = `template-${template.key}-price`;
  const durationId = `template-${template.key}-duration`;

  return (
    <li className={cn("rounded-card border bg-surface transition-colors", selected ? "border-plum/40" : "border-line")}>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className="flex w-full items-start gap-3 rounded-card p-4 text-left hover:bg-porcelain/60"
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
            selected ? "border-plum bg-plum text-white" : "border-ink-soft/40 bg-surface",
          )}
        >
          {selected && <Check className="size-4" strokeWidth={2.5} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-medium">{template.name}</span>
          <span className="text-sm text-ink-soft">{template.description}</span>
          {!selected && (
            <span className="flex gap-4 text-sm text-ink-soft tabular-nums">
              <span>{template.durationMin} min</span>
              <span>{formatMoney(template.price)}</span>
            </span>
          )}
          {owned && <span className="text-sm text-ink-soft">Ya está en tu catálogo</span>}
          {template.scope === "gray" && !selected && (
            <span className="flex items-center gap-1.5 text-sm text-amber">
              <Info aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
              Revisa la normativa antes de ofrecerlo
            </span>
          )}
        </span>
      </button>

      {selected && (
        <div className="flex flex-col gap-3 px-4 pb-4 sm:pl-13">
          {template.scope === "gray" && <GrayNotice />}
          <div className="grid max-w-sm grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={priceId}>Precio</Label>
              <MoneyInput id={priceId} value={pick.price} onChange={(price) => onChange({ ...pick, price })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={durationId}>Duración</Label>
              <DurationInput
                id={durationId}
                value={pick.durationMin}
                onChange={(durationMin) => onChange({ ...pick, durationMin })}
              />
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
