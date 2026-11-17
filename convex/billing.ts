import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, httpAction, internalMutation, internalQuery } from "./_generated/server";
import { LEGAL_VERSION } from "../lib/legal-documents";
import { checkoutAuthorizationLabel } from "../lib/legal-checkout";
import { currentDocument, identityUserId, legalRequired } from "./lib/legal";
import { fail, memberQuery, requireAdmin, requireMember } from "./lib/authz";
import {
  DAY_MS,
  PLANS,
  TRIAL_DAYS,
  billingEnforced,
  countActiveMembers,
  currentSubscription,
  loadBilling,
  productIdFor,
  type Plan,
} from "./lib/billing";
import { trialEndingEmail } from "./lib/emails";
import {
  PolarError,
  copPrice,
  orgIdOf,
  polarConfigured,
  polarRequest,
  toSubscriptionRow,
  verifyWebhook,
  type PolarProduct,
  type PolarSubscription,
} from "./lib/polar";

// Cosmela subscription billing with Polar (PRODUCT §10, docs/BILLING.md). The org is
// the Polar customer: its id is the customer's external id.

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
const PLAN_URL = `${siteUrl}/configuracion/plan`;

const vPlan = v.union(...PLANS.map((plan) => v.literal(plan)));

function unavailable(message: string): never {
  throw new ConvexError({ code: "UNAVAILABLE", message });
}

/** The caller's billing state, for the Plan page and the read-only banner. */
export const status = memberQuery({
  args: {},
  handler: async (ctx) => await loadBilling(ctx, ctx.orgId),
});

export const memberOrg = internalQuery({
  args: {},
  handler: async (ctx) => (await requireMember(ctx)).orgId,
});

export const adminOrg = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await identityUserId(ctx);
    const settings = await ctx.db.query("userSettings").withIndex("by_user", q => q.eq("userId", userId)).unique();
    const member = settings ? await ctx.db.query("members").withIndex("by_org_user", q => q.eq("orgId", settings.activeOrgId).eq("userId", userId)).unique() : null;
    if (!member?.active || member.role !== "admin") fail("FORBIDDEN");
    return member.orgId;
  },
});

export const recordCheckoutAcceptance = internalMutation({
  args: { orgId: v.id("orgs"), plan: vPlan, amount: v.number(), version: v.string() },
  handler: async (ctx, { orgId: expectedOrgId, plan, amount, version }) => {
    const { orgId, userId } = await requireAdmin(ctx);
    if ((await ctx.db.get(orgId))?.closureRequestedAt !== undefined) fail("FORBIDDEN", "Hay una solicitud de cierre en curso.");
    if (orgId !== expectedOrgId) fail("FORBIDDEN", "El negocio cambió. Revisa la compra antes de continuar.");
    const billing = await loadBilling(ctx, orgId);
    if (!billingEnforced() || ["active", "canceling", "past_due"].includes(billing.state)) fail("FORBIDDEN", "Revisa el estado de tu suscripción antes de comprar.");
    if (plan === "solo" && await countActiveMembers(ctx, orgId) > 1) fail("PLAN_LIMIT", "El plan Solo permite 1 profesional.");
    if (version !== LEGAL_VERSION || !Number.isFinite(amount) || amount < 0) legalRequired();
    return ctx.db.insert("checkoutAcceptances", { orgId, userId, version, plan, amount, currency: "COP", interval: "month",
      termsId: await currentDocument(ctx, "terms"), refundsId: await currentDocument(ctx, "refunds"),
      label: checkoutAuthorizationLabel(plan, amount), at: Date.now(), checkoutState: "requested" });
  },
});

export const finishCheckoutRequest = internalMutation({
  args: { id: v.id("checkoutAcceptances"), polarCheckoutId: v.optional(v.string()), failed: v.boolean() },
  handler: async (ctx, { id, polarCheckoutId, failed }) => {
    await ctx.db.patch(id, { polarCheckoutId, checkoutState: failed ? "failed" : "created" });
  },
});

/** Checks that the admin may open a checkout for `plan` and returns what Polar needs. */
export const checkoutContext = internalQuery({
  args: { plan: vPlan },
  handler: async (ctx, { plan }) => {
    const { orgId, member } = await requireAdmin(ctx);
    if ((await ctx.db.get(orgId))?.closureRequestedAt !== undefined) fail("FORBIDDEN", "Hay una solicitud de cierre en curso.");
    if (!billingEnforced()) fail("FORBIDDEN", "Durante la beta todo es gratis. Aún no necesitas un plan.");
    const billing = await loadBilling(ctx, orgId);
    if (billing.state === "active" || billing.state === "canceling" || billing.state === "past_due") {
      fail("FORBIDDEN", "Ya tienes una suscripción. Cámbiala en Administrar suscripción.");
    }
    if (plan === "solo" && (await countActiveMembers(ctx, orgId)) > 1) {
      fail("PLAN_LIMIT", "El plan Solo permite 1 profesional. Desactiva a los demás en Equipo para elegirlo.");
    }
    return { orgId, email: member.email };
  },
});

/** Monthly COP price of each plan, read from Polar. Null when Polar is not set up. */
export const plans = action({
  args: {},
  handler: async (ctx): Promise<Record<Plan, number | null> | null> => {
    await ctx.runQuery(internal.billing.memberOrg, {});
    if (!polarConfigured()) return null;
    try {
      const prices = await Promise.all(
        PLANS.map(async (plan) => {
          const id = productIdFor(plan);
          return id ? (copPrice(await polarRequest<PolarProduct>("GET", `/v1/products/${id}`)) ?? null) : null;
        }),
      );
      return { solo: prices[0], salon: prices[1] };
    } catch (error) {
      console.error(`Polar prices not loaded: ${String(error)}`);
      return null;
    }
  },
});

/** Opens a Polar checkout for the admin's org. Returns the checkout URL. */
export const checkout = action({
  args: { plan: vPlan, accepted: v.optional(v.boolean()), version: v.optional(v.string()), expectedPrice: v.optional(v.number()) },
  handler: async (ctx, { plan, accepted, version, expectedPrice }): Promise<string> => {
    if (!accepted || version !== LEGAL_VERSION) legalRequired("Confirma las condiciones de la suscripción antes de pagar.");
    const { orgId, email } = await ctx.runQuery(internal.billing.checkoutContext, { plan });
    const productId = productIdFor(plan);
    if (!polarConfigured() || !productId) unavailable("Los pagos aún no están disponibles. Intenta más tarde.");
    const price = copPrice(await polarRequest<PolarProduct>("GET", `/v1/products/${productId}`));
    if (price === undefined || expectedPrice !== price) throw new ConvexError({ code: "PRICE_CHANGED", message: "El precio cambió. Actualiza la página y revisa el valor antes de continuar." });
    const acceptanceId = await ctx.runMutation(internal.billing.recordCheckoutAcceptance, { orgId, plan, amount: price, version: LEGAL_VERSION });
    try {
      const session = await polarRequest<{ id: string; url: string }>("POST", "/v1/checkouts/", {
        products: [productId],
        external_customer_id: orgId,
        customer_email: email || undefined,
        metadata: { orgId, acceptanceId, legalVersion: LEGAL_VERSION },
        customer_metadata: { orgId },
        success_url: `${PLAN_URL}?checkout={CHECKOUT_ID}`,
        return_url: PLAN_URL,
        locale: "es",
      });
      await ctx.runMutation(internal.billing.finishCheckoutRequest, { id: acceptanceId, polarCheckoutId: session.id, failed: false });
      return session.url;
    } catch (error) {
      // An ambiguous network failure may still have created a payable checkout.
      // Leave the request unresolved so closure fails closed until reconciled.
      console.error(`Polar checkout failed: ${String(error)}`);
      unavailable("No pudimos abrir el pago. Intenta de nuevo en unos minutos.");
    }
  },
});

/** A Polar customer portal session (card, invoices, plan, cancel). Returns its URL. */
export const portal = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const orgId = await ctx.runQuery(internal.billing.adminOrg, {});
    if (!polarConfigured()) unavailable("Los pagos aún no están disponibles. Intenta más tarde.");
    try {
      const session = await polarRequest<{ customer_portal_url: string }>("POST", "/v1/customer-sessions/", {
        external_customer_id: orgId,
        return_url: PLAN_URL,
      });
      return session.customer_portal_url;
    } catch (error) {
      console.error(`Polar portal failed: ${String(error)}`);
      if (error instanceof PolarError && (error.status === 404 || error.status === 422)) {
        unavailable("Aún no tienes una suscripción para administrar.");
      }
      unavailable("No pudimos abrir tu suscripción. Intenta de nuevo en unos minutos.");
    }
  },
});

/**
 * Pulls the org's subscriptions from Polar. The Plan page calls it on return from a
 * checkout, so the state updates even where webhooks cannot arrive (local development).
 * Returns whether the org has a live subscription.
 */
export const sync = action({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const orgId = await ctx.runQuery(internal.billing.memberOrg, {});
    if (!polarConfigured()) return false;
    try {
      const page = await polarRequest<{ items: PolarSubscription[] }>(
        "GET",
        `/v1/subscriptions/?external_customer_id=${encodeURIComponent(orgId)}&limit=20`,
      );
      const rows = page.items.map(toSubscriptionRow);
      for (const subscription of rows) {
        await ctx.runMutation(internal.billing.saveSubscription, { orgId, subscription });
      }
      return currentSubscription(rows) !== undefined;
    } catch (error) {
      console.error(`Polar sync failed: ${String(error)}`);
      return false;
    }
  },
});

/** Stores a Polar subscription unless a newer copy is already stored. Unknown orgs are ignored. */
export const saveSubscription = internalMutation({
  args: {
    orgId: v.string(),
    subscription: v.object({
      polarId: v.string(),
      productId: v.string(),
      status: v.string(),
      currentPeriodEnd: v.optional(v.number()),
      cancelAtPeriodEnd: v.boolean(),
      modifiedAt: v.number(),
    }),
  },
  handler: async (ctx, { orgId: rawOrgId, subscription }) => {
    const orgId = ctx.db.normalizeId("orgs", rawOrgId);
    if (!orgId || !(await ctx.db.get(orgId))) return;
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_polar_id", (q) => q.eq("polarId", subscription.polarId))
      .unique();
    if (!existing) await ctx.db.insert("subscriptions", { orgId, ...subscription });
    else if (existing.modifiedAt <= subscription.modifiedAt) await ctx.db.patch(existing._id, { orgId, ...subscription });
  },
});

/** Polar webhook (`/polar/events`). Every `subscription.*` event carries the full subscription. */
export const polarWebhook = httpAction(async (ctx, request) => {
  const body = await request.text();
  if (!(await verifyWebhook(body, request.headers, process.env.POLAR_WEBHOOK_SECRET ?? ""))) {
    return new Response("Invalid signature", { status: 403 });
  }
  const event = JSON.parse(body) as { type?: string; data?: PolarSubscription };
  if (event.type?.startsWith("subscription.") && event.data) {
    const orgId = orgIdOf(event.data);
    if (orgId) {
      await ctx.runMutation(internal.billing.saveSubscription, { orgId, subscription: toSubscriptionRow(event.data) });
    }
  }
  return new Response(null, { status: 202 });
});

/**
 * Gives every business a 14-day trial from now (or keeps a later end). Run it once,
 * right when BILLING_ENFORCED is turned on:
 *   pnpm exec convex run billing:startTrialsForExisting
 */
export const startTrialsForExisting = internalMutation({
  args: {},
  handler: async (ctx) => {
    const trialEndsAt = Date.now() + TRIAL_DAYS * DAY_MS;
    let updated = 0;
    for (const org of await ctx.db.query("orgs").collect()) {
      if ((org.trialEndsAt ?? 0) < trialEndsAt) {
        await ctx.db.patch(org._id, { trialEndsAt });
        updated++;
      }
    }
    return updated;
  },
});

/**
 * Daily: emails the admins of businesses whose trial ends in 3 days or in 1 day.
 * Each window is one day wide, so every trial gets each reminder once.
 */
export const sendTrialReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!billingEnforced()) return 0;
    const now = Date.now();
    let sent = 0;
    for (const daysLeft of [3, 1]) {
      const orgs = await ctx.db
        .query("orgs")
        .withIndex("by_trial_end", (q) => q.gt("trialEndsAt", now + (daysLeft - 1) * DAY_MS).lte("trialEndsAt", now + daysLeft * DAY_MS))
        .collect();
      for (const org of orgs) {
        if ((await loadBilling(ctx, org._id)).state !== "trial") continue;
        const admins = await ctx.db
          .query("members")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .collect();
        const email = trialEndingEmail({ orgName: org.name, daysLeft, endsAt: org.trialEndsAt!, url: PLAN_URL });
        for (const admin of admins.filter((m) => m.active && m.role === "admin" && m.email)) {
          await ctx.scheduler.runAfter(0, internal.notifications.deliver, { to: admin.email, fromName: "Cosmela", ...email });
          sent++;
        }
      }
    }
    return sent;
  },
});
