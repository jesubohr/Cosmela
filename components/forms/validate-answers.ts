// Pure validation for treatment form answers. Used by `FormRenderer` callers in the
// browser and by Convex functions on the server, so only relative imports here.
import type { FormAnswer, FormAnswers, FormField } from "../../convex/lib/validators";

/** Error message per field id. Empty when every answer is valid. */
export type AnswerErrors = Record<string, string>;

/** A scale field's range; defaults to 1–5. `options[0]` and `options[1]` are the optional end labels. */
export function scaleRange(field: Pick<FormField, "min" | "max">): { min: number; max: number } {
  return { min: field.min ?? 1, max: field.max ?? 5 };
}

export function isEmptyAnswer(answer: FormAnswer | undefined): boolean {
  if (answer === undefined || answer === null) return true;
  if (typeof answer === "string") return answer.trim() === "";
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

const REQUIRED_MESSAGES: Record<FormField["type"], string> = {
  section: "",
  text: "Completa este campo.",
  longtext: "Completa este campo.",
  number: "Escribe un número.",
  single: "Elige una opción.",
  multi: "Elige al menos una opción.",
  yesno: "Elige sí o no.",
  scale: "Elige un valor de la escala.",
  date: "Elige una fecha.",
};

/**
 * Checks answers against their fields: required answers, number ranges, choices
 * that exist in the options, scale bounds, and valid dates. Answers for unknown
 * field ids are ignored. Messages are Spanish and safe to show next to the field.
 */
export function validateAnswers(fields: FormField[], answers: FormAnswers): AnswerErrors {
  const errors: AnswerErrors = {};
  for (const field of fields) {
    if (field.type === "section") continue;
    const message = answerError(field, answers[field.id]);
    if (message) errors[field.id] = message;
  }
  return errors;
}

function answerError(field: FormField, answer: FormAnswer | undefined): string | null {
  if (isEmptyAnswer(answer)) return field.required ? REQUIRED_MESSAGES[field.type] : null;

  switch (field.type) {
    case "text":
    case "longtext":
      return typeof answer === "string" ? null : REQUIRED_MESSAGES.text;
    case "number":
      if (typeof answer !== "number" || !Number.isFinite(answer)) return REQUIRED_MESSAGES.number;
      return rangeError(answer, field.min, field.max);
    case "single":
      return typeof answer === "string" && (field.options ?? []).includes(answer) ? null : "Elige una opción de la lista.";
    case "multi":
      return Array.isArray(answer) && answer.every((item) => (field.options ?? []).includes(item))
        ? null
        : "Elige opciones de la lista.";
    case "yesno":
      return typeof answer === "boolean" ? null : REQUIRED_MESSAGES.yesno;
    case "scale": {
      const { min, max } = scaleRange(field);
      return typeof answer === "number" && Number.isInteger(answer) && answer >= min && answer <= max
        ? null
        : REQUIRED_MESSAGES.scale;
    }
    case "date":
      return typeof answer === "string" && isCalendarDate(answer) ? null : "Escribe una fecha válida.";
    default:
      return null;
  }
}

function rangeError(value: number, min: number | undefined, max: number | undefined): string | null {
  if (min !== undefined && max !== undefined && (value < min || value > max)) {
    return `Escribe un número entre ${formatNumber(min)} y ${formatNumber(max)}.`;
  }
  if (min !== undefined && value < min) return `Escribe un número igual o mayor que ${formatNumber(min)}.`;
  if (max !== undefined && value > max) return `Escribe un número igual o menor que ${formatNumber(max)}.`;
  return null;
}

/** Decimal comma, as read in Colombia: 2.5 → "2,5". */
export function formatNumber(value: number): string {
  return String(value).replace(".", ",");
}

function isCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
