import { ConvexError } from "convex/values";
import { ACCOUNT_PRIVACY_LABEL, ACCOUNT_TERMS_LABEL, ADULT_LABEL, LEGAL_DOCUMENTS, LEGAL_VERSION } from "../../lib/legal-documents";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { sha256Hex } from "./consent";

export function legalRequired(message = "Revisa y acepta los documentos legales para continuar."): never {
  throw new ConvexError({ code: "LEGAL_REQUIRED", message });
}

export async function identityUserId(ctx: Pick<QueryCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Ingresa de nuevo." });
  return identity.subject;
}

export async function currentDocument(ctx: MutationCtx, type: keyof typeof LEGAL_DOCUMENTS) {
  const document = LEGAL_DOCUMENTS[type];
  const hash = await sha256Hex(document.content);
  const stored = await ctx.db.query("legalDocuments").withIndex("by_type_version", q => q.eq("type", type).eq("version", LEGAL_VERSION)).unique();
  if (stored) {
    if (stored.hash !== hash) throw new Error("Published legal content changed without a new version");
    return stored._id;
  }
  return ctx.db.insert("legalDocuments", { type, version: LEGAL_VERSION, language: "es-CO", content: document.content, hash,
    effectiveAt: Date.UTC(2026, 10, 16), material: true });
}

export async function hasAccountAcceptance(ctx: Pick<QueryCtx, "db">, userId: string) {
  for (const type of ["terms", "privacy"] as const) {
    const latest = await ctx.db.query("accountLegalAcceptances")
      .withIndex("by_user_type_version", q => q.eq("userId", userId).eq("type", type).eq("version", LEGAL_VERSION)).order("desc").first();
    if (latest?.action !== "accepted") return false;
    const document = await ctx.db.get(latest.documentId);
    if (!document || document.hash !== await sha256Hex(LEGAL_DOCUMENTS[type].content)) return false;
  }
  return true;
}

export async function requireAccountAcceptance(ctx: Pick<QueryCtx, "db">, userId: string) {
  if (!await hasAccountAcceptance(ctx, userId)) legalRequired();
}

export async function hasProcessingAcceptance(ctx: Pick<QueryCtx, "db">, orgId: Id<"orgs">) {
  const accepted = await ctx.db.query("processingAcceptances")
    .withIndex("by_org_version", q => q.eq("orgId", orgId).eq("version", LEGAL_VERSION)).first();
  if (!accepted) return false;
  const document = await ctx.db.get(accepted.documentId);
  return document?.hash === await sha256Hex(LEGAL_DOCUMENTS.processing.content);
}

export async function recordAccountAcceptance(ctx: MutationCtx, userId: string, method: "verified_otp" | "account_checkbox") {
  if (await hasAccountAcceptance(ctx, userId)) return;
  for (const type of ["terms", "privacy"] as const) {
    await ctx.db.insert("accountLegalAcceptances", {
      userId, type, version: LEGAL_VERSION, documentId: await currentDocument(ctx, type), action: "accepted",
      label: type === "terms" ? ACCOUNT_TERMS_LABEL : ACCOUNT_PRIVACY_LABEL,
      adultLabel: ADULT_LABEL, at: Date.now(), method,
    });
  }
}
