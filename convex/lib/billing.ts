import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Cosmela subscription rules (PRODUCT §10). Pure helpers, shared by the server
// and the Plan page. See docs/BILLING.md.

export const TRIAL_DAYS = 14;
export const SALON_STAFF_LIMIT = 5;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const PLANS = ["solo", "salon"] as const;
export type Plan = (typeof PLANS)[number];
export const PLAN_LIMITS: Record<Plan, number> = { solo: 1, salon: SALON_STAFF_LIMIT };

export type BillingState = "beta" | "trial" | "active" | "canceling" | "past_due" | "expired";

type Subscription = Pick<Doc<"subscriptions">, "productId" | "status" | "currentPeriodEnd" | "cancelAtPeriodEnd" | "modifiedAt">;

/** The billing switch (Convex env `BILLING_ENFORCED`). Off means a free beta without limits. */
export function billingEnforced(): boolean {
  return process.env.BILLING_ENFORCED === "true";
}

export function productIdFor(plan: Plan): string | undefined {
  return (plan === "solo" ? process.env.POLAR_PRODUCT_SOLO_ID : process.env.POLAR_PRODUCT_SALON_ID) || undefined;
}

/** The plan of a Polar product. Unknown products count as Solo, the smaller plan. */
export function planOf(productId: string): Plan {
  return productId === process.env.POLAR_PRODUCT_SALON_ID ? "salon" : "solo";
}

const LIVE = ["active", "trialing", "past_due"];

/** The subscription that decides access: active or trialing first, then past due; newest wins. */
export function currentSubscription<T extends Subscription>(subscriptions: T[]): T | undefined {
  const rank = (s: T) => (s.status === "past_due" ? 1 : 2);
  return subscriptions
    .filter((s) => LIVE.includes(s.status))
    .sort((a, b) => rank(b) - rank(a) || b.modifiedAt - a.modifiedAt)[0];
}

export type BillingSummary = {
  state: BillingState;
  /** The subscribed plan; none during beta, trial, or after the subscription ended. */
  plan?: Plan;
  /** Most active professionals allowed; none when nothing is limited (beta, read-only). */
  limit?: number;
  trialEndsAt?: number;
  /** Days left in the trial, rounded up. */
  trialDaysLeft?: number;
  /** Next charge, or the end of a canceled subscription. */
  periodEnd?: number;
  /** The org paid before: its trial message changes to "Tu suscripción terminó". */
  hadSubscription: boolean;
};

export function billingSummary(input: {
  enforced: boolean;
  trialEndsAt?: number;
  subscriptions: Subscription[];
  now: number;
}): BillingSummary {
  const { enforced, trialEndsAt, subscriptions, now } = input;
  const subscription = currentSubscription(subscriptions);
  const plan = subscription ? planOf(subscription.productId) : undefined;
  const trialDaysLeft = trialEndsAt !== undefined ? Math.max(0, Math.ceil((trialEndsAt - now) / DAY_MS)) : undefined;

  let state: BillingState;
  if (!enforced) state = "beta";
  else if (subscription?.status === "past_due") state = "past_due";
  else if (subscription) state = subscription.cancelAtPeriodEnd ? "canceling" : "active";
  // A business without a trial end (created before billing) keeps working until the migration runs.
  else if (trialEndsAt === undefined || now < trialEndsAt) state = "trial";
  else state = "expired";

  const limit = state === "trial" ? SALON_STAFF_LIMIT : plan && (state === "active" || state === "canceling") ? PLAN_LIMITS[plan] : undefined;
  return {
    state,
    plan,
    limit,
    trialEndsAt,
    trialDaysLeft,
    periodEnd: subscription?.currentPeriodEnd,
    hadSubscription: subscriptions.length > 0,
  };
}

export function isReadOnly(state: BillingState): boolean {
  return state === "expired" || state === "past_due";
}

/** Why writes are blocked, in Spanish (server errors and the shell banner). */
export function readOnlyMessage(summary: Pick<BillingSummary, "state" | "hadSubscription">): string {
  if (summary.state === "past_due") return "Tu pago está pendiente. Actualiza tu tarjeta para seguir creando citas y fichas.";
  if (summary.hadSubscription) return "Tu suscripción terminó. Elige un plan para seguir creando citas y fichas.";
  return "Tu prueba terminó. Elige un plan para seguir creando citas y fichas.";
}

export function limitMessage(limit: number): string {
  return limit === 1
    ? "Tu plan permite hasta 1 profesional. Cambia al plan Salón para agregar más."
    : `Tu plan permite hasta ${limit} profesionales. Escríbenos si necesitas más.`;
}

/** The org's billing summary, read from the database and the env switch. */
export async function loadBilling(ctx: Pick<QueryCtx, "db">, orgId: Id<"orgs">): Promise<BillingSummary> {
  const [org, subscriptions] = await Promise.all([
    ctx.db.get(orgId),
    ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  ]);
  return billingSummary({ enforced: billingEnforced(), trialEndsAt: org?.trialEndsAt, subscriptions, now: Date.now() });
}

export async function countActiveMembers(ctx: Pick<QueryCtx, "db">, orgId: Id<"orgs">): Promise<number> {
  const members = await ctx.db
    .query("members")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  return members.filter((m) => m.active).length;
}
