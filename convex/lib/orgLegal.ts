import { ConvexError } from "convex/values";

type LegalIdentity = { legalName?: string; taxId?: string; address?: string; city?: string; whatsapp?: string };

export function organizationLegalReady(org: LegalIdentity) {
  return [org.legalName, org.taxId, org.address, org.city, org.whatsapp].every(value => Boolean(value?.trim()));
}

export function requireOrgLegalReady(org: LegalIdentity) {
  if (!organizationLegalReady(org)) {
    throw new ConvexError({ code: "LEGAL_IDENTITY_REQUIRED", message: "Completa la razón social, identificación, dirección, ciudad y contacto del negocio antes de recibir datos de clientes." });
  }
}
