// Consent rendering and evidence, shared by the attention flow (live preview) and
// `sessions.signConsent` (the stored snapshot). Only relative imports here.
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { renderConsent } from "../../data/treatment-templates";
import { bogotaDateKey, inBogota } from "./time";
import type { DocumentType, Guardian } from "./validators";

const DOCUMENT_NAMES: Record<DocumentType, string> = {
  CC: "cédula de ciudadanía",
  CE: "cédula de extranjería",
  TI: "tarjeta de identidad",
  PA: "pasaporte",
  PPT: "permiso por protección temporal",
  NIT: "NIT",
};

/** "1020304050" → "1.020.304.050"; numbers with letters stay as typed. */
function formatDocumentNumber(number: string) {
  return /^\d+$/.test(number) ? number.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : number;
}

/** The `{documento}` placeholder: "cédula de ciudadanía 1.020.304.050", or "documento no registrado". */
export function renderDocument(type: DocumentType | undefined, number: string | undefined) {
  const trimmed = number?.trim();
  if (!trimmed) return "documento no registrado";
  return `${type ? DOCUMENT_NAMES[type] : "documento"} ${formatDocumentNumber(trimmed)}`;
}

/** "15 de noviembre de 2026" (Bogotá). */
export function consentDate(ms: number) {
  return format(inBogota(ms), "d 'de' MMMM 'de' yyyy", { locale: es });
}

export function renderConsentText(
  template: string,
  values: { clientName: string; documentText: string; treatmentName: string; orgName: string; at: number },
) {
  return renderConsent(template, {
    cliente: values.clientName,
    documento: values.documentText,
    tratamiento: values.treatmentName,
    negocio: values.orgName,
    fecha: consentDate(values.at),
  });
}

/** True when the client is under 18 on `now` (Bogotá). Unknown birth dates count as adults. */
export function isMinor(birthDate: string | undefined, now = Date.now()) {
  if (!birthDate) return false;
  const [year, month, day] = birthDate.split("-").map(Number);
  const [nowYear, nowMonth, nowDay] = bogotaDateKey(now).split("-").map(Number);
  const hadBirthday = nowMonth > month || (nowMonth === month && nowDay >= day);
  return nowYear - year - (hadBirthday ? 0 : 1) < 18;
}

/**
 * SHA-256 (hex) over the rendered text, the signature keys, the signing time, and
 * the guardian, so any later change to the stored consent is detectable.
 */
export async function consentHash(input: {
  text: string;
  clientSignatureKey: string;
  professionalSignatureKey?: string;
  signedAt: number;
  guardian?: Guardian;
}) {
  const payload = [
    input.text,
    input.clientSignatureKey,
    input.professionalSignatureKey ?? "",
    String(input.signedAt),
    input.guardian ? [input.guardian.name, input.guardian.document, input.guardian.relationship].join("|") : "",
  ].join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** First 16 hex digits in groups of four, uppercase: "3F2A 9C1B 77D0 E4A2". */
export function verificationCode(hash: string) {
  return hash.slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}
