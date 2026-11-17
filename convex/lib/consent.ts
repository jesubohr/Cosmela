// Consent rendering and evidence, shared by the attention flow (live preview) and
// `sessions.signConsent` (the stored snapshot). Only relative imports here.
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { renderConsent } from "../../data/treatment-templates";
import { bogotaDateKey, inBogota } from "./time";
import type { DocumentType, Guardian, PhotoUse } from "./validators";

const DOCUMENT_NAMES: Record<DocumentType, string> = {
  CC: "cédula de ciudadanía",
  CE: "cédula de extranjería",
  TI: "tarjeta de identidad",
  PA: "pasaporte",
  PPT: "permiso por protección temporal",
  NIT: "NIT",
};

export const NO_DOCUMENT = "documento no registrado";

/** "1020304050" → "1.020.304.050"; numbers with letters stay as typed. */
function formatDocumentNumber(number: string) {
  return /^\d+$/.test(number) ? number.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : number;
}

/** The `{documento}` placeholder: "cédula de ciudadanía 1.020.304.050", or `NO_DOCUMENT`. */
export function renderDocument(type: DocumentType | undefined, number: string | undefined) {
  const trimmed = number?.trim();
  if (!trimmed) return NO_DOCUMENT;
  return `${type ? DOCUMENT_NAMES[type] : "documento"} ${formatDocumentNumber(trimmed)}`;
}

/** "15 de noviembre de 2026" (Bogotá). */
export function consentDate(ms: number) {
  return format(inBogota(ms), "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Without a document, the "con {documento}" clause is dropped so the sentence still
 * reads naturally ("Yo, Laura Gómez, autorizo…"); other uses fall back to `NO_DOCUMENT`.
 */
export function renderConsentText(
  template: string,
  values: { clientName: string; documentText: string; treatmentName: string; orgName: string; at: number },
) {
  const text =
    values.documentText === NO_DOCUMENT ? template.replace(/,\s*(?:identificad[oa]\s+)?con \{documento\}/g, "") : template;
  return renderConsent(text, {
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

export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Version of the `consentHash` payload, stored as `consent.hashVersion`. */
export const CONSENT_HASH_VERSION = 3;
export const SIGNATURE_AGREEMENT_LABEL = "Acepto usar la firma en pantalla para dejar constancia de mi decisión. Puedo leer el documento y pedir una copia.";

/**
 * SHA-256 (hex) over the rendered text, the signature keys, the signing time, the
 * guardian, photo use, and signature agreement in a fixed-order JSON array, so any later change
 * to the stored consent is detectable.
 */
export async function consentHash(input: {
  text: string;
  clientSignatureKey: string;
  professionalSignatureKey?: string;
  signedAt: number;
  guardian?: Guardian;
  photoUse: PhotoUse;
  signatureAgreement?: { label: string; version: number; acceptedAt: number };
}) {
  const guardian = input.guardian ? [input.guardian.name, input.guardian.document, input.guardian.relationship] : null;
  return await sha256Hex(
    JSON.stringify([
      CONSENT_HASH_VERSION,
      input.text,
      input.clientSignatureKey,
      input.professionalSignatureKey ?? "",
      input.signedAt,
      guardian,
      input.photoUse,
      input.signatureAgreement ? [input.signatureAgreement.version, input.signatureAgreement.label, input.signatureAgreement.acceptedAt] : null,
    ]),
  );
}

/** First 16 hex digits in groups of four, uppercase: "3F2A 9C1B 77D0 E4A2". */
export function verificationCode(hash: string) {
  return hash.slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}
