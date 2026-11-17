/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { DEFAULT_SCHEDULE } from "../components/settings/schedule";
import { findTemplate } from "../data/treatment-templates";
import { api } from "./_generated/api";
import { slugify } from "./orgs";
import schema from "./schema";
import { recordAccountAcceptance } from "./lib/legal";
import { LEGAL_VERSION } from "../lib/legal-documents";

const modules = import.meta.glob("./**/*.ts");

const ONBOARDING = {
  kind: "solo" as const,
  name: "Estética Ana María",
  city: "Medellín",
  whatsapp: "+573001234567",
  profile: { name: "Ana María Ríos", title: "Cosmetóloga", color: "teal" as const },
  schedule: DEFAULT_SCHEDULE,
  treatments: [
    { key: "limpieza-facial", price: 110000, durationMin: 60 },
    { key: "peeling-quimico", price: 180000, durationMin: 40 },
  ],
};

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return (error.data as { code: string }).code;
    throw error;
  }
  throw new Error("Expected the call to fail");
}

describe("onboarding", () => {
  test("creates the org, the admin member, userSettings, and the chosen treatments", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => { for (const id of ["ana", "bea", "caro", "sofi", "otra", "intrusa"]) await recordAccountAcceptance(ctx, id, "account_checkbox"); });
    const ana = t.withIdentity({ subject: "ana", email: "Ana@Example.com" });
    const orgId = await ana.mutation(api.orgs.create, ONBOARDING);

    await ana.mutation(api.legal.acceptProcessing, { version: LEGAL_VERSION, authorized: true });
    const docs = await t.run(async (ctx) => ({
      org: await ctx.db.get(orgId),
      members: await ctx.db.query("members").collect(),
      settings: await ctx.db.query("userSettings").collect(),
      treatments: await ctx.db.query("treatments").collect(),
    }));

    expect(docs.org).toMatchObject({
      name: "Estética Ana María",
      slug: "estetica-ana-maria",
      kind: "solo",
      ownerId: "ana",
      city: "Medellín",
      whatsapp: "+573001234567",
      reminders: { email: true },
    });
    expect(docs.members).toHaveLength(1);
    expect(docs.members[0]).toMatchObject({
      orgId,
      userId: "ana",
      email: "ana@example.com",
      role: "admin",
      name: "Ana María Ríos",
      color: "teal",
      active: true,
      bookable: true,
      schedule: DEFAULT_SCHEDULE,
    });
    expect(docs.settings).toEqual([expect.objectContaining({ userId: "ana", activeOrgId: orgId })]);

    expect(docs.treatments.map((t) => t.templateKey).sort()).toEqual(["limpieza-facial", "peeling-quimico"]);
    const limpieza = docs.treatments.find((t) => t.templateKey === "limpieza-facial")!;
    const template = findTemplate("limpieza-facial")!;
    expect(limpieza).toMatchObject({
      orgId,
      name: template.name,
      price: 110000,
      durationMin: 60,
      active: true,
      consentText: template.consentText,
      formFields: template.formFields,
    });

    const viewer = await ana.query(api.members.me, {});
    expect(viewer.role).toBe("admin");
  });

  test("gives every business a unique slug", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => { for (const id of ["ana", "bea", "caro", "sofi", "otra", "intrusa"]) await recordAccountAcceptance(ctx, id, "account_checkbox"); });
    const first = await t.withIdentity({ subject: "ana" }).mutation(api.orgs.create, ONBOARDING);
    const second = await t.withIdentity({ subject: "bea" }).mutation(api.orgs.create, ONBOARDING);
    const third = await t.withIdentity({ subject: "caro" }).mutation(api.orgs.create, { ...ONBOARDING, name: "  " + ONBOARDING.name.toUpperCase() });
    const slugs = await t.run((ctx) => Promise.all([first, second, third].map(async (id) => (await ctx.db.get(id))!.slug)));
    expect(slugs).toEqual(["estetica-ana-maria", "estetica-ana-maria-2", "estetica-ana-maria-3"]);
  });

  test("slugify strips accents and symbols", () => {
    expect(slugify("Spa & Belleza Ñoño's")).toBe("spa-belleza-nono-s");
    expect(slugify("¡¡!!")).toBe("negocio");
  });

  test("a user with an active business cannot create another one", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => { for (const id of ["ana", "bea", "caro", "sofi", "otra", "intrusa"]) await recordAccountAcceptance(ctx, id, "account_checkbox"); });
    const ana = t.withIdentity({ subject: "ana" });
    await ana.mutation(api.orgs.create, ONBOARDING);
    expect(await errorCode(ana.mutation(api.orgs.create, ONBOARDING))).toBe("FORBIDDEN");
  });

  test("rejects an invalid schedule or name", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => { for (const id of ["ana", "bea", "caro", "sofi", "otra", "intrusa"]) await recordAccountAcceptance(ctx, id, "account_checkbox"); });
    const ana = t.withIdentity({ subject: "ana" });
    expect(
      await errorCode(ana.mutation(api.orgs.create, { ...ONBOARDING, schedule: [{ day: 1, start: "18:00", end: "08:00" }] })),
    ).toBe("INVALID");
    expect(await errorCode(ana.mutation(api.orgs.create, { ...ONBOARDING, name: " " }))).toBe("INVALID");
  });

  test("requires a signed-in user", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => { for (const id of ["ana", "bea", "caro", "sofi", "otra", "intrusa"]) await recordAccountAcceptance(ctx, id, "account_checkbox"); });
    expect(await errorCode(t.mutation(api.orgs.create, ONBOARDING))).toBe("UNAUTHENTICATED");
  });
});

describe("settings", () => {
  async function salon() {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => { for (const id of ["ana", "bea", "caro", "sofi", "otra", "intrusa"]) await recordAccountAcceptance(ctx, id, "account_checkbox"); });
    const ana = t.withIdentity({ subject: "ana", email: "ana@example.com" });
    const orgId = await ana.mutation(api.orgs.create, { ...ONBOARDING, kind: "salon" });
    await ana.mutation(api.legal.acceptProcessing, { version: LEGAL_VERSION, authorized: true });
    const sofiId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("members", {
        orgId,
        userId: "sofi",
        email: "sofi@example.com",
        role: "staff",
        name: "Sofía",
        color: "coral",
        schedule: [],
        bookable: true,
        active: true,
      });
      await ctx.db.insert("userSettings", { userId: "sofi", activeOrgId: orgId });
      return id;
    });
    return { t, ana, sofi: t.withIdentity({ subject: "sofi" }), orgId, sofiId };
  }

  test("staff cannot edit business, booking, or reminder settings", async () => {
    const { ana, sofi, t, orgId } = await salon();
    expect(await errorCode(sofi.mutation(api.orgs.update, { name: "Otro", kind: "salon" }))).toBe("FORBIDDEN");
    expect(
      await errorCode(
        sofi.mutation(api.orgs.updateBooking, {
          enabled: false,
          minNoticeHours: 2,
          maxDaysAhead: 30,
          slotMinutes: 30,
          bookableMemberIds: [],
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(await errorCode(sofi.mutation(api.orgs.updateReminders, { email: false }))).toBe("FORBIDDEN");
    expect(await errorCode(sofi.action(api.orgs.exportClients, {}))).toBe("FORBIDDEN");
    expect(await ana.action(api.orgs.exportClients, {})).toEqual([]);
    const org = await t.run((ctx) => ctx.db.get(orgId));
    expect(org).toMatchObject({ name: ONBOARDING.name, booking: { enabled: false }, reminders: { email: true } });
  });

  test("staff cannot change team members but can edit their own profile and schedule", async () => {
    const { ana, sofi, sofiId } = await salon();
    const anaId = (await ana.query(api.members.me, {}))._id;
    expect(await errorCode(sofi.mutation(api.members.update, { id: anaId, active: false }))).toBe("FORBIDDEN");

    await sofi.mutation(api.members.updateProfile, { name: "Sofía Pérez", color: "olive" });
    await sofi.mutation(api.members.updateSchedule, { schedule: [{ day: 2, start: "09:00", end: "13:00" }] });
    expect(await sofi.query(api.members.me, {})).toMatchObject({
      _id: sofiId,
      name: "Sofía Pérez",
      color: "olive",
      schedule: [{ day: 2, start: "09:00", end: "13:00" }],
    });
  });

  test("admins update booking settings and who accepts online bookings", async () => {
    const { ana, t, orgId, sofiId } = await salon();
    await ana.mutation(api.orgs.update, { name: ONBOARDING.name, kind: "salon", legalName: "Ana", taxId: "123", address: "Calle 1", city: "Medellín", whatsapp: "+573001234567" });
    await ana.mutation(api.orgs.updateBooking, {
      enabled: true,
      minNoticeHours: 4,
      maxDaysAhead: 60,
      slotMinutes: 15,
      welcome: " Te esperamos ",
      bookableMemberIds: [sofiId],
    });
    const result = await t.run(async (ctx) => ({
      org: await ctx.db.get(orgId),
      members: await ctx.db.query("members").collect(),
    }));
    expect(result.org?.booking).toEqual({ enabled: true, minNoticeHours: 4, maxDaysAhead: 60, slotMinutes: 15, welcome: "Te esperamos" });
    expect(result.members.map((m) => [m.userId, m.bookable]).sort()).toEqual([
      ["ana", false],
      ["sofi", true],
    ]);
  });

  test("the owner cannot be demoted and admins cannot remove their own access", async () => {
    const { ana, t, orgId, sofiId } = await salon();
    const anaId = (await ana.query(api.members.me, {}))._id;
    expect(await errorCode(ana.mutation(api.members.update, { id: anaId, role: "staff" }))).toBe("FORBIDDEN");
    await ana.mutation(api.members.update, { id: sofiId, role: "admin" });
    const sofi = t.withIdentity({ subject: "sofi" });
    expect(await errorCode(sofi.mutation(api.members.update, { id: anaId, active: false }))).toBe("FORBIDDEN");
    await ana.mutation(api.members.update, { id: sofiId, active: false });
    expect(await errorCode(sofi.query(api.members.me, {}))).toBe("FORBIDDEN");
    expect((await t.run((ctx) => ctx.db.get(orgId)))?.ownerId).toBe("ana");
  });

  test("the default privacy policy uses the business data", async () => {
    const { ana } = await salon();
    await ana.mutation(api.orgs.update, {
      name: ONBOARDING.name,
      kind: "salon",
      city: "Medellín",
      address: "Calle 10 # 43-12",
      whatsapp: "+573001234567",
      legalName: "Ana María Ríos",
      taxId: "CC 43.123.456",
    });
    const org = await ana.query(api.orgs.get, {});
    expect(org.privacyPolicy).toBeUndefined();
    const policy = org.defaultPrivacyPolicy;
    expect(policy).toContain("Ana María Ríos, identificado con CC 43.123.456, que atiende con el nombre Estética Ana María, es responsable");
    expect(policy).toContain("Dirección: Calle 10 # 43-12, Medellín.");
    expect(policy).toContain("por WhatsApp al 300 123 4567 o al correo ana@example.com");
    expect(policy).toContain("Datos sensibles");
    expect(policy).toContain("Superintendencia de Industria y Comercio");
    expect(policy).toMatch(/Esta política rige desde el \d{1,2} de \w+ de \d{4}/);
  });
});
