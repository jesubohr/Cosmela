import { ConvexError, v } from "convex/values";
import { LEGAL_VERSION, PROCESSING_LABEL } from "../lib/legal-documents";
import { internalMutation, mutation, query } from "./_generated/server";
import { currentDocument, hasAccountAcceptance, hasProcessingAcceptance, identityUserId, legalRequired, recordAccountAcceptance, requireAccountAcceptance } from "./lib/legal";
import { rateLimiter } from "./rateLimits";

export const status = query({ args: {}, handler: async ctx => {
  const userId = await identityUserId(ctx);
  const accountAccepted = await hasAccountAcceptance(ctx, userId);
  const settings = await ctx.db.query("userSettings").withIndex("by_user", q => q.eq("userId", userId)).unique();
  const member = settings ? await ctx.db.query("members").withIndex("by_org_user", q => q.eq("orgId", settings.activeOrgId).eq("userId", userId)).unique() : null;
  const org = member?.active ? await ctx.db.get(member.orgId) : null;
  return { version: LEGAL_VERSION, accountAccepted,
    processingAccepted: org ? await hasProcessingAcceptance(ctx, org._id) : true,
    isAdmin: member?.active && member.role === "admin", closed: org?.closureConfirmedAt !== undefined };
} });

export const acceptAccount = mutation({
  args: { version: v.string(), terms: v.boolean(), privacy: v.boolean(), adult: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await identityUserId(ctx);
    if (args.version !== LEGAL_VERSION || !args.terms || !args.privacy || !args.adult) legalRequired();
    await recordAccountAcceptance(ctx, userId, "account_checkbox");
  },
});

// Called only by the successful OTP hook, after Better Auth verified the address.
export const activateVerifiedAccount = internalMutation({
  args: { userId: v.string(), version: v.string() },
  handler: async (ctx, { userId, version }) => {
    if (version !== LEGAL_VERSION) legalRequired();
    await recordAccountAcceptance(ctx, userId, "verified_otp");
  },
});

export const acceptProcessing = mutation({
  args: { version: v.string(), authorized: v.boolean() },
  handler: async (ctx, { version, authorized }) => {
    const userId = await identityUserId(ctx);
    await requireAccountAcceptance(ctx, userId);
    if (version !== LEGAL_VERSION || !authorized) legalRequired();
    const settings = await ctx.db.query("userSettings").withIndex("by_user", q => q.eq("userId", userId)).unique();
    const member = settings ? await ctx.db.query("members").withIndex("by_org_user", q => q.eq("orgId", settings.activeOrgId).eq("userId", userId)).unique() : null;
    if (!member?.active || member.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "Solo un administrador puede aceptar el acuerdo del negocio." });
    if (await hasProcessingAcceptance(ctx, member.orgId)) return;
    await ctx.db.insert("processingAcceptances", { orgId: member.orgId, userId, version, documentId: await currentDocument(ctx, "processing"), label: PROCESSING_LABEL, at: Date.now() });
  },
});

export const withdrawAccount = mutation({ args: {}, handler: async ctx => {
  const userId = await identityUserId(ctx);
  const latest = await ctx.db.query("accountLegalAcceptances").withIndex("by_user_type_version", q => q.eq("userId", userId).eq("type", "privacy").eq("version", LEGAL_VERSION)).order("desc").first();
  if (latest?.action === "accepted") {
    await ctx.db.insert("accountLegalAcceptances", { userId, type: latest.type, version: latest.version,
      documentId: latest.documentId, label: latest.label, adultLabel: latest.adultLabel,
      action: "withdrawn", at: Date.now(), method: "account_checkbox" });
  }
} });

export const recordCookieChoice = mutation({
  args: { receiptId: v.string(), version: v.string(), choice: v.union(v.literal("accepted"), v.literal("rejected"), v.literal("withdrawn")) },
  handler: async (ctx, args) => {
    if (!/^[0-9a-f-]{36}$/i.test(args.receiptId) || args.version !== LEGAL_VERSION) throw new ConvexError({ code: "INVALID", message: "Actualiza las preferencias de cookies." });
    const existing = await ctx.db.query("cookieChoices").withIndex("by_receipt", q => q.eq("receiptId", args.receiptId)).first();
    if (existing) return;
    const { ok } = await rateLimiter.limit(ctx, "cookieReceipts", { key: "global" });
    if (!ok) throw new ConvexError({ code: "RATE_LIMITED", message: "No pudimos registrar la preferencia todavía. Se volverá a intentar." });
    await ctx.db.insert("cookieChoices", { ...args, documentId: await currentDocument(ctx, "cookies"), at: Date.now() });
  },
});

export const sweepExpiredEvidence = internalMutation({ args: {}, handler: async ctx => {
  const cookieLimit = new Date(); cookieLimit.setUTCFullYear(cookieLimit.getUTCFullYear() - 1);
  const cookies = await ctx.db.query("cookieChoices").withIndex("by_at", q => q.lt("at", cookieLimit.getTime())).take(100);
  for (const receipt of cookies) await ctx.db.delete(receipt._id);
  const accounts = await ctx.db.query("accountEvidenceExpiry").withIndex("by_retention", q => q.lte("retainUntil", Date.now())).take(25);
  for (const account of accounts) {
    const evidence = await ctx.db.query("accountLegalAcceptances").withIndex("by_user", q => q.eq("userId", account.userId)).take(100);
    for (const row of evidence) await ctx.db.delete(row._id);
    if (evidence.length < 100) await ctx.db.delete(account._id);
  }
} });
