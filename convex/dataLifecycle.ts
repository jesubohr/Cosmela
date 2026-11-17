import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { action, internalMutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { polarConfigured, polarRequest, toSubscriptionRow, type PolarSubscription } from "./lib/polar";
import { fail } from "./lib/authz";
import { r2 } from "./files";
import { queueFileDeletion } from "./fileDeletion";

const DAY = 24 * 60 * 60_000;
function yearsAfter(time: number, years: number) {
  const date = new Date(time);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.getTime();
}
const tables = ["members", "invitations", "clients", "treatments", "appointments", "timeBlocks", "cases", "sessions", "followUps", "payments", "uploads", "policies", "clientAuthorizations", "processingAcceptances", "checkoutAcceptances", "subscriptions"] as const;
const tableValidator = v.union(...tables.map((table) => v.literal(table)));

async function admin(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED");
  const userId = identity.subject;
  const settings = await ctx.db.query("userSettings").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  if (!settings) fail("NO_ORG");
  const member = await ctx.db.query("members").withIndex("by_org_user", (q) => q.eq("orgId", settings.activeOrgId).eq("userId", userId)).unique();
  if (!member?.active || member.role !== "admin") fail("FORBIDDEN");
  const org = await ctx.db.get(member.orgId);
  if (!org) fail("NO_ORG");
  return { member, org };
}

export const status = query({
  args: {},
  handler: async (ctx) => {
    const { org } = await admin(ctx);
    return { org, closureConfirmedAt: org.closureConfirmedAt, exportUntil: org.exportUntil };
  },
});

export const exportPage = query({
  args: { table: tableValidator, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { table, paginationOpts }) => {
    const { org } = await admin(ctx);
    if (org.exportUntil && Date.now() > org.exportUntil) fail("FORBIDDEN", "El plazo de exportación terminó. Contacta a ayuda@cosmela.app.");
    if (paginationOpts.numItems < 1 || paginationOpts.numItems > 100) fail("FORBIDDEN");
    return await ctx.db.query(table).withIndex("by_org", (q) => q.eq("orgId", org._id)).paginate(paginationOpts);
  },
});

export const fileUrls = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    const { org } = await admin(ctx);
    if (org.exportUntil && Date.now() > org.exportUntil) fail("FORBIDDEN");
    if (keys.length > 50) fail("FORBIDDEN");
    const urls: Record<string, string> = {};
    for (const key of keys) {
      const upload = await ctx.db.query("uploads").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (!upload || upload.orgId !== org._id) fail("NOT_FOUND");
      urls[key] = await r2.getUrl(key, { expiresIn: 300 });
    }
    return urls;
  },
});

export const beginClosure = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { org } = await admin(ctx);
    if (org.closureConfirmedAt) return { orgId: org._id, closed: true, hasPaidHistory: false, checkouts: [], requestedAt: 0 };
    if (org.closureRequestedAt !== undefined) fail("FORBIDDEN", "Ya hay una verificación de cierre en curso.");
    const requestedAt = Date.now();
    await ctx.db.patch(org._id, { closureRequestedAt: requestedAt });
    const subscriptions = await ctx.db.query("subscriptions").withIndex("by_org", (q) => q.eq("orgId", org._id)).collect();
    const checkouts = await ctx.db.query("checkoutAcceptances").withIndex("by_org", (q) => q.eq("orgId", org._id)).collect();
    return { orgId: org._id, closed: false, hasPaidHistory: subscriptions.length > 0, checkouts: checkouts.map((c) => ({ state: c.checkoutState, id: c.polarCheckoutId })), requestedAt };
  },
});

export const releaseClosure = internalMutation({
  args: { orgId: v.id("orgs"), requestedAt: v.number() },
  handler: async (ctx, { orgId, requestedAt }) => {
    const org = await ctx.db.get(orgId);
    if (org && !org.closureConfirmedAt && org.closureRequestedAt === requestedAt) await ctx.db.patch(orgId, { closureRequestedAt: undefined });
  },
});

export const close = action({
  args: { confirmation: v.string() },
  handler: async (ctx, { confirmation }): Promise<void> => {
    if (confirmation !== "CERRAR") fail("FORBIDDEN", "Escribe CERRAR para confirmar.");
    const state = await ctx.runMutation(internal.dataLifecycle.beginClosure, {});
    if (state.closed) return;
    try {
      for (const checkout of state.checkouts) {
        if (checkout.state === "failed") continue;
        if (checkout.state !== "created" || !checkout.id || !polarConfigured()) fail("FORBIDDEN", "Hay un pago pendiente de verificar. Contacta a ayuda@cosmela.app.");
        const result = await polarRequest<{ id: string; status: string; subscription_id?: string | null }>("GET", `/v1/checkouts/${encodeURIComponent(checkout.id)}`);
        if (result.id !== checkout.id) fail("FORBIDDEN");
        if (result.status === "succeeded" && result.subscription_id) {
          const subscription = await polarRequest<PolarSubscription>("GET", `/v1/subscriptions/${encodeURIComponent(result.subscription_id)}`);
          if (subscription.id !== result.subscription_id || subscription.customer?.external_id !== state.orgId || typeof subscription.cancel_at_period_end !== "boolean" || (!['canceled', 'incomplete_expired'].includes(subscription.status) && !subscription.cancel_at_period_end)) fail("FORBIDDEN", "Cancela la renovación antes de cerrar el negocio.");
          const row = toSubscriptionRow(subscription);
          if (!Number.isFinite(row.modifiedAt)) fail("FORBIDDEN");
          await ctx.runMutation(internal.billing.saveSubscription, { orgId: state.orgId, subscription: row });
        } else if (!["expired", "failed"].includes(result.status)) {
          fail("FORBIDDEN", "Hay un pago pendiente de verificar. Contacta a ayuda@cosmela.app.");
        }
      }
    if (!polarConfigured()) {
      if (state.hasPaidHistory) fail("FORBIDDEN", "No pudimos verificar la facturación. Contacta a ayuda@cosmela.app.");
    } else {
      try {
        let pageNumber = 1;
        while (true) {
          const page: { items: PolarSubscription[]; pagination?: { max_page?: number } } = await polarRequest("GET", `/v1/subscriptions/?external_customer_id=${encodeURIComponent(state.orgId)}&limit=100&page=${pageNumber}`);
          if (!Array.isArray(page.items)) throw new Error("Invalid Polar response");
          for (const item of page.items) {
            if (!item.id || !item.status || typeof item.cancel_at_period_end !== "boolean" || (item.customer?.external_id && item.customer.external_id !== state.orgId)) throw new Error("Invalid subscription");
            const subscription = toSubscriptionRow(item);
            if (!Number.isFinite(subscription.modifiedAt)) throw new Error("Invalid subscription date");
            await ctx.runMutation(internal.billing.saveSubscription, { orgId: state.orgId, subscription });
            if (!['canceled', 'incomplete_expired'].includes(item.status) && !item.cancel_at_period_end) fail("FORBIDDEN", "Cancela la renovación en el portal de pagos antes de cerrar el negocio.");
          }
          if (page.pagination?.max_page !== undefined) {
            if (!Number.isInteger(page.pagination.max_page) || page.pagination.max_page > 100) throw new Error("Invalid pagination");
            if (pageNumber >= page.pagination.max_page) break;
          } else if (page.items.length < 100) break;
          if (++pageNumber > 100) throw new Error("Too many subscription pages");
        }
      } catch (error) {
        if (error instanceof Error && error.name === "ConvexError") throw error;
        fail("FORBIDDEN", "No pudimos verificar la facturación. Contacta a ayuda@cosmela.app.");
      }
    }
    await ctx.runMutation(internal.dataLifecycle.confirmClosure, { orgId: state.orgId, requestedAt: state.requestedAt });
    } catch (error) {
      if (error instanceof Error && error.name === "ConvexError") throw error;
      fail("FORBIDDEN", "No pudimos verificar la facturación. Contacta a ayuda@cosmela.app.");
    } finally {
      await ctx.runMutation(internal.dataLifecycle.releaseClosure, { orgId: state.orgId, requestedAt: state.requestedAt });
    }
  },
});

export const confirmClosure = internalMutation({
  args: { orgId: v.id("orgs"), requestedAt: v.number() },
  handler: async (ctx, { orgId, requestedAt }) => {
    const { org } = await admin(ctx);
    if (org._id !== orgId || org.closureRequestedAt !== requestedAt) fail("FORBIDDEN");
    if (org.closureConfirmedAt) return;
    const subscriptions = await ctx.db.query("subscriptions").withIndex("by_org", (q) => q.eq("orgId", org._id)).collect();
    if (subscriptions.some((s) => !["canceled", "incomplete_expired"].includes(s.status) && !s.cancelAtPeriodEnd)) fail("FORBIDDEN", "Cancela la renovación antes de cerrar el negocio.");
    const now = Date.now();
    await ctx.db.patch(org._id, { booking: { ...org.booking, enabled: false }, closureRequestedAt: undefined, closureConfirmedAt: now, exportUntil: now + 30 * DAY, activeDeletionDueAt: now + 60 * DAY, lifecycleNextRunAt: now + 30 * DAY + 1, evidenceNextRunAt: yearsAfter(now, 5), lifecycleStage: "pending" });
    await ctx.db.insert("deletionLedger", { orgId: org._id, closureConfirmedAt: now, activeDeletionDueAt: now + 60 * DAY });
  },
});

// Process one bounded batch per organization per run. A hold pauses the whole
// organization so referenced files cannot be removed ahead of held records.
export const sweepDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const due = await ctx.db.query("orgs").withIndex("by_lifecycle_next", (q) => q.gt("lifecycleNextRunAt", undefined).lte("lifecycleNextRunAt", Date.now())).take(50);
    let progressed = false;
    for (const org of due) {
      if (!org.closureConfirmedAt || !org.exportUntil || Date.now() <= org.exportUntil) continue;
      if (!org.closureConfirmedAt || org.lifecycleStage === "complete") continue;
      const holds = await ctx.db.query("lifecycleHolds").withIndex("by_org_record", (q) => q.eq("orgId", org._id)).collect();
      if (holds.some((hold) => !hold.releasedAt)) { await ctx.db.patch(org._id, { lifecycleNextRunAt: Date.now() + DAY }); continue; }
      progressed = true;
      const sessions = await ctx.db.query("sessions").withIndex("by_org_status", (q) => q.eq("orgId", org._id)).take(25);
      if (sessions.length) {
        for (const session of sessions) {
          if (session.consent) {
            const existing = await ctx.db.query("retainedSessionConsents").withIndex("by_org_session", (q) => q.eq("orgId", org._id).eq("sessionId", session._id)).unique();
            if (!existing) await ctx.db.insert("retainedSessionConsents", { orgId: org._id, sessionId: session._id, clientId: session.clientId, consent: session.consent, retainUntil: yearsAfter(org.closureConfirmedAt, 5) });
          }
          if (session.consent) {
            for (const key of [session.consent.clientSignatureKey, session.consent.professionalSignatureKey]) {
              if (!key) continue;
              const upload = await ctx.db.query("uploads").withIndex("by_key", (q) => q.eq("key", key)).unique();
              if (upload?.orgId === org._id) await ctx.db.patch(upload._id, { attachedTo: "retained-evidence" });
            }
          }
          await ctx.db.delete(session._id);
        }
        continue;
      }
      const uploads = await ctx.db.query("uploads").withIndex("by_org", (q) => q.eq("orgId", org._id)).filter((q) => q.neq(q.field("attachedTo"), "retained-evidence")).take(25);
      if (uploads.length) {
        for (const upload of uploads) await queueFileDeletion(ctx, upload);
        await ctx.db.patch(org._id, { lifecycleNextRunAt: Date.now() + 5 * 60_000 });
        continue;
      }
      const purgeTables = ["invitations", "clients", "treatments", "appointments", "timeBlocks", "cases", "followUps", "subscriptions"] as const;
      let removed = false;
      for (const table of purgeTables) {
        const rows = await ctx.db.query(table).withIndex("by_org", (q) => q.eq("orgId", org._id)).take(25);
        if (rows.length) {
          for (const row of rows) await ctx.db.delete(row._id);
          removed = true;
          break;
        }
      }
      if (removed) continue;
      const members = await ctx.db.query("members").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(25);
      if (members.length) {
        for (const member of members) {
          const settings = await ctx.db.query("userSettings").withIndex("by_user", (q) => q.eq("userId", member.userId)).unique();
          if (settings?.activeOrgId === org._id) {
            const other = (await ctx.db.query("members").withIndex("by_user", (q) => q.eq("userId", member.userId)).collect()).find((item) => item.orgId !== org._id && item.active);
            if (other) await ctx.db.patch(settings._id, { activeOrgId: other.orgId });
            else await ctx.db.delete(settings._id);
          }
          await ctx.db.delete(member._id);
          const remaining = await ctx.db.query("members").withIndex("by_user", (q) => q.eq("userId", member.userId)).collect();
          if (!remaining.some((item) => item.active)) await ctx.scheduler.runAfter(0, internal.auth.eraseUnlinkedAuth, { userId: member.userId });
        }
        continue;
      }
      const pendingFile = await ctx.db.query("fileDeletionRequests").withIndex("by_org_verified", q => q.eq("orgId", org._id).eq("verifiedAt", undefined)).first();
      await ctx.db.patch(org._id, { name: "Negocio cerrado", slug: `closed-${org._id}`, ownerId: "", city: undefined, address: undefined, whatsapp: undefined, logoKey: undefined, legalName: undefined, taxId: undefined, privacyPolicy: undefined, lifecycleStage: pendingFile ? "provider_verification" : "complete", lifecycleNextRunAt: pendingFile ? Date.now() + DAY : undefined });
      const ledger = await ctx.db.query("deletionLedger").withIndex("by_org", (q) => q.eq("orgId", org._id)).unique();
      if (ledger) await ctx.db.patch(ledger._id, { completedAt: pendingFile ? undefined : Date.now(), note: pendingFile ? "Private file deletion remains pending verification." : "Operational records removed; legal evidence and provider backups follow separate retention schedules." });
    }
    if (progressed) await ctx.scheduler.runAfter(0, internal.dataLifecycle.sweepDue, {});
  },
});

export const sweepEvidence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("orgs").withIndex("by_evidence_next", (q) => q.gt("evidenceNextRunAt", undefined).lte("evidenceNextRunAt", Date.now())).take(25);
    for (const org of orgs) {
      const holds = await ctx.db.query("lifecycleHolds").withIndex("by_org_record", (q) => q.eq("orgId", org._id)).collect();
      if (holds.some((hold) => !hold.releasedAt)) { await ctx.db.patch(org._id, { evidenceNextRunAt: Date.now() + DAY }); continue; }
      let removed = false;
      for (const table of ["clientAuthorizations", "policies", "processingAcceptances", "checkoutAcceptances"] as const) {
        const rows = await ctx.db.query(table).withIndex("by_org", (q) => q.eq("orgId", org._id)).take(25);
        if (rows.length) {
          for (const row of rows) await ctx.db.delete(row._id);
          removed = true;
          break;
        }
      }
      if (removed) continue;
      const payment = await ctx.db.query("payments").withIndex("by_org_paidAt", (q) => q.eq("orgId", org._id)).order("asc").first();
      if (payment && yearsAfter(payment.paidAt, 10) <= Date.now()) { await ctx.db.delete(payment._id); continue; }
      await ctx.db.patch(org._id, { evidenceNextRunAt: payment ? yearsAfter(payment.paidAt, 10) : undefined });
    }
    const rows = await ctx.db.query("retainedSessionConsents").withIndex("by_retention", (q) => q.lte("retainUntil", Date.now())).take(25);
    for (const row of rows) {
      const holds = await ctx.db.query("lifecycleHolds").withIndex("by_org_record", (q) => q.eq("orgId", row.orgId)).collect();
      if (holds.some((hold) => !hold.releasedAt)) { await ctx.db.patch(row._id, { retainUntil: Date.now() + DAY }); continue; }
      for (const key of [row.consent.clientSignatureKey, row.consent.professionalSignatureKey]) {
        if (!key) continue;
        const [clientReference, professionalReference] = await Promise.all([
          ctx.db.query("retainedSessionConsents").withIndex("by_client_signature", q => q.eq("orgId", row.orgId).eq("consent.clientSignatureKey", key)).filter(q => q.neq(q.field("_id"), row._id)).first(),
          ctx.db.query("retainedSessionConsents").withIndex("by_professional_signature", q => q.eq("orgId", row.orgId).eq("consent.professionalSignatureKey", key)).filter(q => q.neq(q.field("_id"), row._id)).first(),
        ]);
        if (clientReference || professionalReference) continue;
        const upload = await ctx.db.query("uploads").withIndex("by_key", (q) => q.eq("key", key)).unique();
        if (upload?.orgId === row.orgId && upload.attachedTo === "retained-evidence") {
          await queueFileDeletion(ctx, upload);
        }
      }
      await ctx.db.delete(row._id);
    }
  },
});
