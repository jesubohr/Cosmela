import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DAY_MS, billingSummary } from "./lib/billing";
import { at, errorCode, errorMessage, setupOrgs } from "./lib/fixtures.testing";
import type { PolarSubscription } from "./lib/polar";

// Sunday noon in Bogotá: the members work Monday to Saturday, 08:00–18:00.
const NOW = at("12:00", "2030-01-06");
const SOLO = "prod_solo";
const SALON = "prod_salon";
const SECRET = `whsec_${btoa("cosmela-webhook-secret-for-tests")}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("POLAR_PRODUCT_SOLO_ID", SOLO);
  vi.stubEnv("POLAR_PRODUCT_SALON_ID", SALON);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const enforce = () => vi.stubEnv("BILLING_ENFORCED", "true");

type Setup = Awaited<ReturnType<typeof setupOrgs>>;

async function setTrialEnd(s: Setup, trialEndsAt: number, orgId: Id<"orgs"> = s.ids.orgA) {
  await s.t.run((ctx) => ctx.db.patch(orgId, { trialEndsAt }));
}

async function subscribe(s: Setup, fields: { productId?: string; status?: string; cancelAtPeriodEnd?: boolean } = {}) {
  await s.t.mutation(internal.billing.saveSubscription, {
    orgId: s.ids.orgA,
    subscription: {
      polarId: "sub_1",
      productId: fields.productId ?? SALON,
      status: fields.status ?? "active",
      currentPeriodEnd: NOW + 30 * DAY_MS,
      cancelAtPeriodEnd: fields.cancelAtPeriodEnd ?? false,
      modifiedAt: NOW,
    },
  });
}

function polarSubscription(fields: Partial<PolarSubscription> = {}): PolarSubscription {
  return {
    id: "sub_1",
    status: "active",
    product_id: SALON,
    current_period_end: new Date(NOW + 30 * DAY_MS).toISOString(),
    cancel_at_period_end: false,
    created_at: new Date(NOW - DAY_MS).toISOString(),
    modified_at: new Date(NOW).toISOString(),
    metadata: {},
    customer: { external_id: null },
    ...fields,
  };
}

async function signedRequest(body: string, secret = SECRET) {
  const id = "msg_1";
  const timestamp = Math.floor(Date.now() / 1000);
  const keyBytes = Uint8Array.from(atob(secret.slice("whsec_".length)), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return {
    method: "POST",
    body,
    headers: { "webhook-id": id, "webhook-timestamp": String(timestamp), "webhook-signature": `v1,${signature}` },
  };
}

describe("billing state", () => {
  const base = { enforced: true, subscriptions: [], now: NOW };
  const sub = (fields: Partial<{ productId: string; status: string; cancelAtPeriodEnd: boolean; modifiedAt: number }> = {}) => ({
    productId: SOLO,
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: NOW + 10 * DAY_MS,
    modifiedAt: NOW,
    ...fields,
  });

  test("covers beta, trial, active, canceling, past due, and expired", () => {
    expect(billingSummary({ ...base, enforced: false, trialEndsAt: NOW - DAY_MS }).state).toBe("beta");

    const trial = billingSummary({ ...base, trialEndsAt: NOW + 9 * DAY_MS - 1000 });
    expect(trial).toMatchObject({ state: "trial", trialDaysLeft: 9, limit: 5, plan: undefined });

    const expired = billingSummary({ ...base, trialEndsAt: NOW - 1 });
    expect(expired).toMatchObject({ state: "expired", limit: undefined, hadSubscription: false });

    const active = billingSummary({ ...base, trialEndsAt: NOW - 1, subscriptions: [sub()] });
    expect(active).toMatchObject({ state: "active", plan: "solo", limit: 1, periodEnd: NOW + 10 * DAY_MS });
    expect(billingSummary({ ...base, subscriptions: [sub({ status: "trialing", productId: SALON })] })).toMatchObject({
      state: "active",
      plan: "salon",
      limit: 5,
    });

    expect(billingSummary({ ...base, subscriptions: [sub({ cancelAtPeriodEnd: true })] }).state).toBe("canceling");
    expect(billingSummary({ ...base, subscriptions: [sub({ status: "past_due" })] }).state).toBe("past_due");

    const ended = billingSummary({ ...base, trialEndsAt: NOW - 1, subscriptions: [sub({ status: "canceled" })] });
    expect(ended).toMatchObject({ state: "expired", hadSubscription: true, plan: undefined });
  });

  test("an active subscription wins over an older past-due one", () => {
    const summary = billingSummary({
      ...base,
      subscriptions: [sub({ status: "active", modifiedAt: NOW - DAY_MS }), sub({ status: "past_due", modifiedAt: NOW })],
    });
    expect(summary.state).toBe("active");
  });

  test("a business created before billing keeps working until the migration runs", () => {
    expect(billingSummary({ ...base, trialEndsAt: undefined }).state).toBe("trial");
  });
});

describe("write guard", () => {
  test("off: an expired trial changes nothing", async () => {
    const s = await setupOrgs();
    await setTrialEnd(s, NOW - DAY_MS);
    await s.asAna.mutation(api.clients.create, { client: { firstName: "Eva", lastName: "Paz", phone: "+573104445566" } });
    expect((await s.asAna.query(api.billing.status, {})).state).toBe("beta");
  });

  test("on: an expired trial blocks business writes but not reads, own profile, or public booking", async () => {
    const s = await setupOrgs();
    enforce();
    await setTrialEnd(s, NOW - DAY_MS);
    await s.t.run(async (ctx) => {
      const org = (await ctx.db.get(s.ids.orgA))!;
      await ctx.db.patch(s.ids.orgA, { booking: { ...org.booking, enabled: true } });
    });

    const blocked = "Tu prueba terminó. Elige un plan para seguir creando citas y fichas.";
    const createClient = s.asAna.mutation(api.clients.create, { client: { firstName: "Eva", lastName: "Paz", phone: "+573104445566" } });
    expect(await errorMessage(createClient)).toBe(blocked);
    const block = { memberId: s.ids.sofi, start: at("12:00", "2030-01-07"), end: at("13:00", "2030-01-07"), allDay: false, kind: "personal" as const };
    expect(await errorCode(s.asSofi.mutation(api.timeBlocks.create, block))).toBe("READ_ONLY");
    expect(await errorCode(s.asAna.mutation(api.treatments.setActive, { id: s.ids.treatmentA, active: false }))).toBe("READ_ONLY");
    expect(await errorCode(s.asAna.mutation(api.invitations.create, { email: "eva@example.com", role: "staff" }))).toBe("READ_ONLY");

    // Public requests keep arriving, but the team cannot confirm them.
    await s.t.mutation(api.booking.create, {
      slug: "alba",
      treatmentId: s.ids.treatmentA,
      start: at("09:00", "2030-01-07"),
      firstName: "Valentina",
      lastName: "Ríos",
      phone: "+573110000000",
      email: "vale@example.com",
      authorized: true,
    });
    const appointmentId = (await s.t.run((ctx) => ctx.db.query("appointments").first()))!._id;
    expect(await errorCode(s.asAna.mutation(api.appointments.confirm, { appointmentId }))).toBe("READ_ONLY");

    await s.asSofi.mutation(api.members.updateProfile, { name: "Sofía", color: "teal" });
    expect(await s.asAna.query(api.clients.get, { clientId: s.ids.clientA })).toBeTruthy();
    // Org B still has its trial.
    await s.asBea.mutation(api.clients.create, { client: { firstName: "Eva", lastName: "Paz", phone: "+573104445566" } });
  });

  test("on: a past-due subscription blocks writes with its own message; an active one allows them", async () => {
    const s = await setupOrgs();
    enforce();
    await setTrialEnd(s, NOW - DAY_MS);
    await subscribe(s, { status: "past_due" });
    const create = () => s.asAna.mutation(api.clients.create, { client: { firstName: "Eva", lastName: "Paz", phone: "+573104445566" } });
    expect(await errorMessage(create())).toBe("Tu pago está pendiente. Actualiza tu tarjeta para seguir creando citas y fichas.");

    await s.t.mutation(internal.billing.saveSubscription, {
      orgId: s.ids.orgA,
      subscription: { polarId: "sub_1", productId: SALON, status: "active", cancelAtPeriodEnd: false, modifiedAt: NOW + 1 },
    });
    await create();
  });
});

describe("plan limits", () => {
  test("Solo allows one active professional; Salón during the trial allows five", async () => {
    const s = await setupOrgs();
    enforce();
    await setTrialEnd(s, NOW + 5 * DAY_MS, s.ids.orgB);
    // Org B (1 member) on trial: room for more.
    await s.asBea.mutation(api.invitations.create, { email: "eva@example.com", role: "staff" });

    await s.t.mutation(internal.billing.saveSubscription, {
      orgId: s.ids.orgB,
      subscription: { polarId: "sub_b", productId: SOLO, status: "active", cancelAtPeriodEnd: false, modifiedAt: NOW },
    });
    expect(await errorMessage(s.asBea.mutation(api.invitations.create, { email: "luz@example.com", role: "staff" }))).toBe(
      "Tu plan permite hasta 1 profesional. Cambia al plan Salón para agregar más.",
    );

    // The invitation sent during the trial cannot be accepted beyond the limit.
    const token = (await s.t.run((ctx) => ctx.db.query("invitations").collect())).find((i) => i.email === "eva@example.com")!.token;
    const eva = s.t.withIdentity({ subject: "eva", email: "eva@example.com" });
    expect(await errorCode(eva.mutation(api.invitations.accept, { token }))).toBe("PLAN_LIMIT");
  });

  test("reactivating a professional counts against the limit", async () => {
    const s = await setupOrgs();
    enforce();
    await s.asAna.mutation(api.members.update, { id: s.ids.sofi, active: false });
    await subscribe(s, { productId: SOLO });
    expect(await errorCode(s.asAna.mutation(api.members.update, { id: s.ids.sofi, active: true }))).toBe("PLAN_LIMIT");

    await s.t.mutation(internal.billing.saveSubscription, {
      orgId: s.ids.orgA,
      subscription: { polarId: "sub_1", productId: SALON, status: "active", cancelAtPeriodEnd: false, modifiedAt: NOW + 1 },
    });
    await s.asAna.mutation(api.members.update, { id: s.ids.sofi, active: true });
  });

  test("off: no limits", async () => {
    const s = await setupOrgs();
    await subscribe(s, { productId: SOLO });
    await s.asAna.mutation(api.invitations.create, { email: "eva@example.com", role: "staff" });
  });
});

describe("checkout and portal", () => {
  test("staff cannot open a checkout or the portal", async () => {
    const s = await setupOrgs();
    enforce();
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await errorCode(s.asSofi.action(api.billing.checkout, { plan: "salon" }))).toBe("FORBIDDEN");
    expect(await errorCode(s.asSofi.action(api.billing.portal, {}))).toBe("FORBIDDEN");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("an admin gets a checkout for the org, with the admin's email and the Plan page as return", async () => {
    const s = await setupOrgs();
    enforce();
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    const fetchMock = vi.fn(async () => Response.json({ url: "https://sandbox.polar.sh/checkout/abc" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await s.asAna.action(api.billing.checkout, { plan: "salon" })).toBe("https://sandbox.polar.sh/checkout/abc");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sandbox-api.polar.sh/v1/checkouts/");
    expect(JSON.parse(init.body as string)).toMatchObject({
      products: [SALON],
      external_customer_id: s.ids.orgA,
      customer_email: "ana@example.com",
      success_url: "http://localhost:3000/configuracion/plan?checkout={CHECKOUT_ID}",
    });
  });

  test("downgrading to Solo is blocked while more than one professional is active", async () => {
    const s = await setupOrgs();
    enforce();
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn());
    expect(await errorCode(s.asAna.action(api.billing.checkout, { plan: "solo" }))).toBe("PLAN_LIMIT");
  });

  test("beta and existing subscriptions have no checkout", async () => {
    const s = await setupOrgs();
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn());
    expect(await errorCode(s.asAna.action(api.billing.checkout, { plan: "salon" }))).toBe("FORBIDDEN");
    enforce();
    await subscribe(s);
    expect(await errorCode(s.asAna.action(api.billing.checkout, { plan: "salon" }))).toBe("FORBIDDEN");
  });
});

describe("sync and webhook", () => {
  test("sync pulls the org's subscriptions from Polar", async () => {
    const s = await setupOrgs();
    enforce();
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    const fetchMock = vi.fn(async () => Response.json({ items: [polarSubscription({ customer: { external_id: s.ids.orgA } })] }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await s.asAna.action(api.billing.sync, {})).toBe(true);
    expect(fetchMock.mock.calls[0][0 as never]).toContain(`external_customer_id=${s.ids.orgA}`);
    expect(await s.asAna.query(api.billing.status, {})).toMatchObject({ state: "active", plan: "salon", hadSubscription: true });
  });

  test("a signed webhook updates the state; a bad signature is rejected; stale events are ignored", async () => {
    const s = await setupOrgs();
    enforce();
    vi.stubEnv("POLAR_WEBHOOK_SECRET", SECRET);
    await setTrialEnd(s, NOW - DAY_MS);
    const event = (type: string, data: PolarSubscription) => JSON.stringify({ type, timestamp: new Date().toISOString(), data });
    const state = async () => (await s.asAna.query(api.billing.status, {})).state;

    const created = event("subscription.created", polarSubscription({ customer: { external_id: s.ids.orgA } }));
    const forged = await signedRequest(created, `whsec_${btoa("another-secret")}`);
    expect((await s.t.fetch("/polar/events", forged)).status).toBe(403);
    expect(await state()).toBe("expired");

    expect((await s.t.fetch("/polar/events", await signedRequest(created))).status).toBe(202);
    expect(await state()).toBe("active");

    const canceled = polarSubscription({
      metadata: { orgId: s.ids.orgA },
      cancel_at_period_end: true,
      modified_at: new Date(NOW + 1000).toISOString(),
    });
    await s.t.fetch("/polar/events", await signedRequest(event("subscription.canceled", canceled)));
    expect(await state()).toBe("canceling");

    // An older copy arriving late changes nothing.
    await s.t.fetch("/polar/events", await signedRequest(created));
    expect(await state()).toBe("canceling");

    const revoked = { ...canceled, status: "canceled", modified_at: new Date(NOW + 2000).toISOString() };
    await s.t.fetch("/polar/events", await signedRequest(event("subscription.revoked", revoked)));
    expect(await state()).toBe("expired");
    expect(await errorMessage(s.asAna.mutation(api.clients.create, { client: { firstName: "Eva", lastName: "Paz", phone: "+573104445566" } }))).toBe(
      "Tu suscripción terminó. Elige un plan para seguir creando citas y fichas.",
    );
  });
});

describe("trials", () => {
  test("a new business gets 14 days; the migration gives existing ones 14 days from now", async () => {
    const s = await setupOrgs();
    const ana = s.t.withIdentity({ subject: "nueva", email: "nueva@example.com" });
    const orgId = await ana.mutation(api.orgs.create, {
      kind: "solo",
      name: "Nueva",
      profile: { name: "Nueva", color: "plum" },
      schedule: [],
      treatments: [],
    });
    expect((await s.t.run((ctx) => ctx.db.get(orgId)))?.trialEndsAt).toBe(NOW + 14 * DAY_MS);

    await setTrialEnd(s, NOW - 30 * DAY_MS);
    vi.setSystemTime(NOW + DAY_MS);
    expect(await s.t.mutation(internal.billing.startTrialsForExisting, {})).toBe(3);
    const orgs = await s.t.run((ctx) => ctx.db.query("orgs").collect());
    expect(orgs.map((o) => o.trialEndsAt)).toEqual([NOW + 15 * DAY_MS, NOW + 15 * DAY_MS, NOW + 15 * DAY_MS]);
  });

  test("admins get a reminder 3 days and 1 day before the trial ends, only when enforced", async () => {
    const s = await setupOrgs();
    await setTrialEnd(s, NOW + 3 * DAY_MS - 60_000);
    await setTrialEnd(s, NOW + DAY_MS - 60_000, s.ids.orgB);
    expect(await s.t.mutation(internal.billing.sendTrialReminders, {})).toBe(0);

    enforce();
    expect(await s.t.mutation(internal.billing.sendTrialReminders, {})).toBe(2);
    const emails = await s.t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).map((job) => job.args[0] as { to: string; subject: string }),
    );
    expect(emails.map((e) => [e.to, e.subject])).toEqual([
      ["ana@example.com", "Tu prueba de Cosmela termina en 3 días"],
      ["bea@example.com", "Tu prueba de Cosmela termina mañana"],
    ]);
  });
});
