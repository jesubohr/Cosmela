/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { adminMutation, getOwned, memberMutation, memberQuery } from "./lib/authz";
import schema from "./schema";
import { currentDocument, recordAccountAcceptance } from "./lib/legal";
import { LEGAL_VERSION, PROCESSING_LABEL } from "../lib/legal-documents";

// Probe functions built with the real wrappers, mounted as a virtual module.
const probe = {
  whoami: memberQuery({ args: {}, handler: async (ctx) => ({ orgId: ctx.orgId, role: ctx.member.role }) }),
  getClient: memberQuery({
    args: { id: v.id("clients") },
    handler: async (ctx, { id }) => (await getOwned(ctx, "clients", id)).firstName,
  }),
  renameClient: memberMutation({
    args: { id: v.id("clients"), firstName: v.string() },
    handler: async (ctx, { id, firstName }) => {
      await getOwned(ctx, "clients", id);
      await ctx.db.patch(id, { firstName });
    },
  }),
  getSession: memberQuery({
    args: { id: v.id("sessions") },
    handler: async (ctx, { id }) => (await getOwned(ctx, "sessions", id)).number,
  }),
  adminPing: adminMutation({ args: {}, handler: async (ctx) => ctx.orgId }),
};

const modules = {
  ...import.meta.glob("./**/*.ts"),
  "./authzProbe.ts": async () => probe,
};

const fn = {
  whoami: makeFunctionReference<"query", Record<string, never>, { orgId: Id<"orgs">; role: string }>("authzProbe:whoami"),
  getClient: makeFunctionReference<"query", { id: Id<"clients"> }, string>("authzProbe:getClient"),
  renameClient: makeFunctionReference<"mutation", { id: Id<"clients">; firstName: string }>("authzProbe:renameClient"),
  getSession: makeFunctionReference<"query", { id: Id<"sessions"> }, number>("authzProbe:getSession"),
  adminPing: makeFunctionReference<"mutation", Record<string, never>, Id<"orgs">>("authzProbe:adminPing"),
};

const HEALTH = {
  conditions: [],
  allergies: [],
  skinConditions: [],
  none: { conditions: true, allergies: true, skin: true },
};

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await recordAccountAcceptance(ctx, "nuevo", "account_checkbox");
    await recordAccountAcceptance(ctx, "intrusa", "account_checkbox");
    async function org(name: string, ownerId: string) {
      return ctx.db.insert("orgs", {
        name,
        slug: name.toLowerCase(),
        kind: "salon",
        ownerId,
        booking: { enabled: false, minNoticeHours: 2, maxDaysAhead: 30, slotMinutes: 30 },
        reminders: { email: true },
      });
    }
    async function member(orgId: Id<"orgs">, userId: string, role: "admin" | "staff", active = true) {
      await recordAccountAcceptance(ctx, userId, "account_checkbox");
      if (role === "admin") await ctx.db.insert("processingAcceptances", { orgId, userId,
        version: LEGAL_VERSION, documentId: await currentDocument(ctx, "processing"), label: PROCESSING_LABEL, at: Date.now() });
      const memberId = await ctx.db.insert("members", {
        orgId,
        userId,
        email: `${userId}@example.com`,
        role,
        name: userId,
        color: "plum",
        schedule: [],
        bookable: true,
        active,
      });
      await ctx.db.insert("userSettings", { userId, activeOrgId: orgId });
      return memberId;
    }
    async function client(orgId: Id<"orgs">, createdBy: Id<"members">, firstName: string) {
      return ctx.db.insert("clients", {
        orgId,
        firstName,
        lastName: "Prueba",
        searchText: `${firstName.toLowerCase()} prueba`,
        phone: "+573001234567",
        health: HEALTH,
        habits: {},
        skin: {},
        createdBy,
        isArchived: false,
      });
    }

    const orgA = await org("Alba", "ana");
    const orgB = await org("Brisa", "bea");
    const anaId = await member(orgA, "ana", "admin");
    await member(orgA, "sofi", "staff");
    await member(orgA, "lina", "staff", false);
    const beaId = await member(orgB, "bea", "admin");
    const clientA = await client(orgA, anaId, "Laura");
    const clientB = await client(orgB, beaId, "María");

    const treatmentB = await ctx.db.insert("treatments", {
      orgId: orgB,
      name: "Peeling químico",
      category: "facial",
      durationMin: 60,
      price: 120000,
      color: "plum",
      active: true,
      bookableOnline: false,
      consentText: "",
      contraindications: [],
      aftercare: [],
      formFields: [],
    });
    const caseB = await ctx.db.insert("cases", {
      orgId: orgB,
      clientId: clientB,
      treatmentId: treatmentB,
      reasons: ["melasma"],
      status: "open",
      openedAt: 0,
      sessionCount: 1,
    });
    const appointmentB = await ctx.db.insert("appointments", {
      orgId: orgB,
      clientId: clientB,
      memberId: beaId,
      treatmentId: treatmentB,
      start: 0,
      end: 3_600_000,
      status: "in_progress",
      source: "staff",
      price: 120000,
      paidTotal: 0,
    });
    const sessionB = await ctx.db.insert("sessions", {
      orgId: orgB,
      caseId: caseB,
      clientId: clientB,
      appointmentId: appointmentB,
      memberId: beaId,
      treatmentId: treatmentB,
      number: 1,
      status: "draft",
      step: 0,
      startedAt: 0,
      photos: [],
      addenda: [],
    });
    return { orgA, orgB, clientA, clientB, sessionB };
  });

  return {
    t,
    ids,
    ana: t.withIdentity({ subject: "ana" }),
    sofi: t.withIdentity({ subject: "sofi" }),
    lina: t.withIdentity({ subject: "lina" }),
    bea: t.withIdentity({ subject: "bea" }),
    newcomer: t.withIdentity({ subject: "nuevo" }),
  };
}

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return (error.data as { code: string }).code;
    throw error;
  }
  throw new Error("Expected the call to fail");
}

describe("membership", () => {
  test("rejects calls without identity", async () => {
    const { t } = await setup();
    expect(await errorCode(t.query(fn.whoami, {}))).toBe("UNAUTHENTICATED");
  });

  test("rejects users without an org", async () => {
    const { newcomer } = await setup();
    expect(await errorCode(newcomer.query(fn.whoami, {}))).toBe("NO_ORG");
  });

  test("rejects deactivated members", async () => {
    const { lina } = await setup();
    expect(await errorCode(lina.query(fn.whoami, {}))).toBe("FORBIDDEN");
  });

  test("injects the active org and role", async () => {
    const { ana, sofi, ids } = await setup();
    expect(await ana.query(fn.whoami, {})).toEqual({ orgId: ids.orgA, role: "admin" });
    expect(await sofi.query(fn.whoami, {})).toEqual({ orgId: ids.orgA, role: "staff" });
  });

  test("a stale active org without membership counts as no org", async () => {
    const { t, ids } = await setup();
    await t.run((ctx) => ctx.db.insert("userSettings", { userId: "intrusa", activeOrgId: ids.orgB }));
    expect(await errorCode(t.withIdentity({ subject: "intrusa" }).query(fn.whoami, {}))).toBe("NO_ORG");
  });
});

describe("cross-org isolation", () => {
  test("members read their own clients", async () => {
    const { ana, sofi, ids } = await setup();
    expect(await ana.query(fn.getClient, { id: ids.clientA })).toBe("Laura");
    expect(await sofi.query(fn.getClient, { id: ids.clientA })).toBe("Laura");
  });

  test("a member of org A cannot read a client of org B", async () => {
    const { ana, ids } = await setup();
    expect(await errorCode(ana.query(fn.getClient, { id: ids.clientB }))).toBe("NOT_FOUND");
  });

  test("a member of org A cannot write a client of org B", async () => {
    const { ana, t, ids } = await setup();
    expect(await errorCode(ana.mutation(fn.renameClient, { id: ids.clientB, firstName: "Hackeada" }))).toBe("NOT_FOUND");
    const client = await t.run((ctx) => ctx.db.get(ids.clientB));
    expect(client?.firstName).toBe("María");
  });

  test("a member of org A cannot read a session of org B", async () => {
    const { ana, bea, ids } = await setup();
    expect(await errorCode(ana.query(fn.getSession, { id: ids.sessionB }))).toBe("NOT_FOUND");
    expect(await bea.query(fn.getSession, { id: ids.sessionB })).toBe(1);
  });

  test("ids from another table are rejected", async () => {
    const { ana, ids } = await setup();
    const wrongTable = ids.sessionB as unknown as Id<"clients">;
    await expect(ana.query(fn.getClient, { id: wrongTable })).rejects.toThrow();
  });

  test("files: signed URLs only for keys of the caller's org", async () => {
    const { ana, ids } = await setup();
    const foreignKey = `orgs/${ids.orgB}/photo/${crypto.randomUUID()}`;
    expect(await errorCode(ana.query(api.files.getUrls, { keys: [foreignKey], bucket: 1 }))).toBe("NOT_FOUND");
    // Keys must have the exact shape, so a path cannot climb into another org.
    const climbing = `orgs/${ids.orgA}/../${ids.orgB}/photo/${crypto.randomUUID()}`;
    expect(await errorCode(ana.query(api.files.getUrls, { keys: [climbing], bucket: 1 }))).toBe("NOT_FOUND");
  });

  test("files: cannot attach a key or a session of another org", async () => {
    const { ana, ids } = await setup();
    const foreignKey = `orgs/${ids.orgB}/signature/abc`;
    expect(
      await errorCode(ana.mutation(api.files.attach, { key: foreignKey, target: { kind: "memberSignature" } })),
    ).toBe("NOT_FOUND");
    const ownKey = `orgs/${ids.orgA}/photo/abc`;
    expect(
      await errorCode(
        ana.mutation(api.files.attach, {
          key: ownKey,
          target: { kind: "sessionPhoto", sessionId: ids.sessionB, photoKind: "before" },
        }),
      ),
    ).toBe("NOT_FOUND");
  });
});

describe("roles", () => {
  test("staff cannot call admin mutations", async () => {
    const { sofi } = await setup();
    expect(await errorCode(sofi.mutation(fn.adminPing, {}))).toBe("FORBIDDEN");
  });

  test("admins can call admin mutations", async () => {
    const { ana, ids } = await setup();
    expect(await ana.mutation(fn.adminPing, {})).toBe(ids.orgA);
  });

  test("staff cannot change the org logo", async () => {
    const { sofi, ids } = await setup();
    const key = `orgs/${ids.orgA}/logo/abc`;
    expect(await errorCode(sofi.mutation(api.files.attach, { key, target: { kind: "orgLogo" } }))).toBe("FORBIDDEN");
  });
});
