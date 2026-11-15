import type { ReasonKey } from "@/convex/lib/validators";
import { REASON_LABELS } from "@/lib/constants";

/** Motivo de consulta as text: "Melasma, Hiperpigmentación". Empty when not answered. */
export function reasonsText(reasons: ReasonKey[], reasonOther?: string) {
  return reasons.map((r) => (r === "other" ? reasonOther?.trim() || REASON_LABELS.other : REASON_LABELS[r])).join(", ");
}

/** "2 de 4 sesiones", or "2 sesiones" without a plan. */
export function sessionsProgress(done: number, planned?: number) {
  if (planned) return `${done} de ${planned} ${planned === 1 ? "sesión" : "sesiones"}`;
  return done === 1 ? "1 sesión" : `${done} sesiones`;
}
