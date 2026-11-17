import terms from "../content/legal/es-CO/2026-11-16/terms";
import privacy from "../content/legal/es-CO/2026-11-16/privacy";
import cookies from "../content/legal/es-CO/2026-11-16/cookies";
import refunds from "../content/legal/es-CO/2026-11-16/refunds";
import processing from "../content/legal/es-CO/2026-11-16/processing";

export const LEGAL_VERSION = "2026-11-16";
export const ACCOUNT_TERMS_LABEL = "Acepto los Términos y condiciones de Cosmela.";
export const ACCOUNT_PRIVACY_LABEL = "Autorizo a Cosmela S.A. a tratar mis datos para administrar mi cuenta y prestar el servicio según la Política de tratamiento de datos.";
export const ADULT_LABEL = "Confirmo que tengo 18 años o más.";
export const PROCESSING_LABEL = "Acepto el Acuerdo de tratamiento de datos por encargo en nombre del negocio y confirmo que tengo facultad para hacerlo.";

export const LEGAL_DOCUMENTS = {
  terms: { title: "Términos y condiciones de Cosmela", content: terms, href: "/terminos", version: LEGAL_VERSION },
  privacy: { title: "Política de tratamiento de datos personales", content: privacy, href: "/privacidad", version: LEGAL_VERSION },
  cookies: { title: "Política de cookies y almacenamiento del navegador", content: cookies, href: "/cookies", version: LEGAL_VERSION },
  refunds: { title: "Cancelaciones, retracto y reembolsos", content: refunds, href: "/reembolsos", version: LEGAL_VERSION },
  processing: { title: "Acuerdo de tratamiento de datos por encargo", content: processing, href: "/acuerdo-datos", version: LEGAL_VERSION },
} as const;
