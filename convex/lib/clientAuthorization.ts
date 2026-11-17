import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isMinor } from "./consent";
import { currentPolicyId } from "../orgs";

export type ClientPurpose = "basic" | "booking" | "health" | "record_photos";
export const LABELS: Record<ClientPurpose, string> = {
  basic: "Autorizo el tratamiento de mis datos de contacto para gestionar mis citas.",
  booking: "Autorizo el tratamiento de mis datos de contacto para gestionar esta reserva y sus comunicaciones de servicio.",
  health: "Autorizo expresamente el tratamiento de los datos de salud que decida proporcionar para valorar y registrar mis tratamientos.",
  record_photos: "Autorizo fotografías de la zona tratada para documentar y comparar mi evolución en la ficha privada.",
};
export async function requirePurpose(ctx: QueryCtx, orgId: Id<"orgs">, clientId: Id<"clients">, purpose: ClientPurpose) {
  const client = await ctx.db.get(clientId);
  if (!client || client.orgId !== orgId || client.documentType === "TI" || isMinor(client.birthDate)) throw new ConvexError({ code: "AUTHORIZATION_REQUIRED", message: "Este registro requiere revisión antes de continuar." });
  const latest = await ctx.db.query("clientAuthorizations").withIndex("by_client_purpose_sequence", q => q.eq("clientId", clientId).eq("purpose", purpose)).order("desc").first();
  if (latest?.orgId !== orgId || latest.action !== "accepted") throw new ConvexError({ code: "AUTHORIZATION_REQUIRED", message: "Primero registra la autorización correspondiente." });
}
export async function recordAuthorization(ctx: MutationCtx, input: { orgId: Id<"orgs">; clientId: Id<"clients">; purpose: ClientPurpose; action: "accepted" | "rejected" | "withdrawn"; method: "online_checkbox" | "external_evidence"; evidence?: string; recordedBy?: Id<"members">; requestKey: string; policyHash: string; adult?: boolean; appointmentId?: Id<"appointments"> }) {
  const prior = await ctx.db.query("clientAuthorizations").withIndex("by_org_request", q => q.eq("orgId", input.orgId).eq("requestKey", input.requestKey)).unique();
  if (prior) {
    if (prior.clientId !== input.clientId || prior.purpose !== input.purpose || prior.action !== input.action || prior.policyHash !== input.policyHash) throw new ConvexError({ code: "INVALID", message: "Esta solicitud ya fue utilizada." });
    return prior._id;
  }
  const policyId = await currentPolicyId(ctx, input.orgId);
  const policy = (await ctx.db.get(policyId))!;
  if (policy.hash !== input.policyHash) throw new ConvexError({ code: "STALE_POLICY", message: "La política cambió. Revísala antes de continuar." });
  const previous = await ctx.db.query("clientAuthorizations").withIndex("by_client_purpose_sequence", q => q.eq("clientId", input.clientId).eq("purpose", input.purpose)).order("desc").first();
  const sequence = (previous?.sequence ?? 0) + 1;
  return await ctx.db.insert("clientAuthorizations", { ...input, policyId, label: LABELS[input.purpose], at: Date.now(), sequence });
}

export async function hasPurpose(ctx: QueryCtx, orgId: Id<"orgs">, clientId: Id<"clients">, purpose: ClientPurpose) {
  try { await requirePurpose(ctx, orgId, clientId, purpose); return true; } catch { return false; }
}
