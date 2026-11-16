import { Baby, HeartPulse, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { ALLERGY_LABELS, CONDITION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** The client fields alerts are computed from; pass the whole client doc or a projection. */
export type AlertSource = Pick<Doc<"clients">, "health"> & Partial<Pick<Doc<"clients">, "sex" | "lastPregnancy">>;

export type ClientAlert = { key: string; label: string; tone: "rose" | "amber"; icon: LucideIcon };

/** Allergies (rose), chronic conditions and pregnancy or lactation (amber), in that order. */
export function getClientAlerts(client: AlertSource): ClientAlert[] {
  const { health } = client;
  const alerts: ClientAlert[] = [];
  // The detail answers "¿A qué?" for all marked allergies, so it names what to avoid better than the categories.
  const detail = health.allergiesDetail?.trim();
  if (detail && health.allergies.length > 0) {
    alerts.push({ key: "allergy-detail", label: `Alergia: ${detail}`, tone: "rose", icon: TriangleAlert });
  } else {
    for (const allergy of health.allergies) {
      const what = allergy === "other" ? "otra" : ALLERGY_LABELS[allergy].toLowerCase();
      alerts.push({ key: `allergy-${allergy}`, label: `Alergia: ${what}`, tone: "rose", icon: TriangleAlert });
    }
  }
  for (const condition of health.conditions) {
    alerts.push({ key: `condition-${condition}`, label: CONDITION_LABELS[condition], tone: "amber", icon: HeartPulse });
  }
  if (health.conditionsOther?.trim()) {
    alerts.push({ key: "condition-other", label: health.conditionsOther.trim(), tone: "amber", icon: HeartPulse });
  }
  if (client.sex !== "male" && client.lastPregnancy?.pregnant) {
    alerts.push({ key: "pregnant", label: "Embarazo", tone: "amber", icon: Baby });
  }
  if (client.sex !== "male" && client.lastPregnancy?.lactating) {
    alerts.push({ key: "lactating", label: "Lactancia", tone: "amber", icon: Baby });
  }
  return alerts;
}

export type AlertChipsProps = {
  client: AlertSource;
  /** Show at most this many chips, then "+N". Shows all by default. */
  max?: number;
  className?: string;
};

const TONES = {
  rose: "bg-rose-soft text-rose",
  amber: "bg-amber-soft text-amber",
} as const;

/** Health alert chips for a client, shown wherever the client appears. Renders nothing without alerts. */
export function AlertChips({ client, max, className }: AlertChipsProps) {
  const alerts = getClientAlerts(client);
  if (alerts.length === 0) return null;
  const visible = max === undefined ? alerts : alerts.slice(0, max);
  const hidden = alerts.length - visible.length;

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Alertas de salud">
      {visible.map(({ key, label, tone, icon: Icon }) => (
        <li key={key} className={cn("inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-sm font-medium", TONES[tone])}>
          <Icon aria-hidden className="size-4" strokeWidth={1.75} />
          {label}
        </li>
      ))}
      {hidden > 0 && (
        <li className="inline-flex min-h-7 items-center rounded-full bg-porcelain px-2.5 text-sm font-medium text-ink-soft">
          +{hidden}
        </li>
      )}
    </ul>
  );
}
