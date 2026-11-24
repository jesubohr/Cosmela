import { v } from "convex/values";
import { fail, getOwned, memberMutation, memberQuery } from "./lib/authz";
import { LABELS, recordAuthorization, requirePurpose } from "./lib/clientAuthorization";
import { privacyPolicyText } from "./orgs";
import { sha256Hex } from "./lib/consent";
import { organizationLegalReady, requireOrgLegalReady } from "./lib/orgLegal";

export const notice = memberQuery({ args: { clientId: v.id("clients") }, handler: async (ctx, { clientId }) => {
  await getOwned(ctx, "clients", clientId);
  const policy = await privacyPolicyText(ctx, ctx.orgId);
  return { policy, policyHash: await sha256Hex(policy), labels: LABELS };
} });
export const status = memberQuery({ args: { clientId: v.id("clients") }, handler: async (ctx, { clientId }) => {
  await getOwned(ctx, "clients", clientId);
  const allowed = async (purpose: "health" | "record_photos") => { try { await requirePurpose(ctx, ctx.orgId, clientId, purpose); return true; } catch { return false; } };
  return { health: await allowed("health"), recordPhotos: await allowed("record_photos") };
} });
export const record = memberMutation({ args: { clientId: v.id("clients"), purpose: v.union(v.literal("health"), v.literal("record_photos")), action: v.union(v.literal("accepted"), v.literal("rejected"), v.literal("withdrawn")), policyHash: v.string(), evidence: v.string(), requestKey: v.string(), adult: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  await getOwned(ctx, "clients", args.clientId);
  if (args.action === "accepted") requireOrgLegalReady((await ctx.db.get(ctx.orgId))!);
  const evidence = args.evidence.trim();
  if (args.action === "accepted" && !args.adult) fail("FORBIDDEN", "Confirma la mayoría de edad del cliente.");
  if (evidence.length < 5 || evidence.length > 500 || !args.requestKey || args.requestKey.length > 100) fail("FORBIDDEN", "Elige cómo recibiste la decisión del cliente.");
  return await recordAuthorization(ctx, { ...args, evidence, orgId: ctx.orgId, method: "external_evidence", recordedBy: ctx.member._id });
} });

export const photoSession = memberQuery({ args: { sessionId: v.id("sessions") }, handler: async (ctx, { sessionId }) => {
  const session = await getOwned(ctx, "sessions", sessionId);
  const policy = await privacyPolicyText(ctx, ctx.orgId);
  let allowed = true;
  try { await requirePurpose(ctx, ctx.orgId, session.clientId, "record_photos"); } catch { allowed = false; }
  return { clientId: session.clientId, allowed, policy, policyHash: await sha256Hex(policy), label: LABELS.record_photos };
} });

export const registrationNotice = memberQuery({ args: {}, handler: async (ctx) => {
  const policy = await privacyPolicyText(ctx, ctx.orgId);
  const legalReady = organizationLegalReady((await ctx.db.get(ctx.orgId))!);
  return { policy, policyHash: await sha256Hex(policy), label: LABELS.basic, legalReady };
} });
