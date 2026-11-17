/// <reference types="vite/client" />
// Shared convex-test setup for the clients, appointments, and payments tests.
// The double extension keeps Convex from deploying this file.
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { UploadKind } from "./validators";
import schema from "../schema";
import { bogotaToEpoch } from "./time";
import { currentPolicyId } from "../orgs";
import { LABELS } from "./clientAuthorization";
import { currentDocument, recordAccountAcceptance } from "./legal";
import { LEGAL_VERSION, PROCESSING_LABEL } from "../../lib/legal-documents";

export const modules = import.meta.glob("../**/*.ts");

const SCHEDULE = [1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "08:00", end: "18:00" }));

/** Two orgs: A (admin Ana, staff Sofi) and B (admin Bea), each with a treatment and a client. */
export async function setupOrgs() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const ids = await t.run(async (ctx) => {
    async function org(name: string, ownerId: string) {
      return ctx.db.insert("orgs", {
        name,
        slug: name.toLowerCase(),
        kind: "salon",
        ownerId,
        legalName: name,
        taxId: "900000000-0",
        address: "Calle de prueba 1",
        city: "Bogotá",
        whatsapp: "+573001234567",
        booking: { enabled: false, minNoticeHours: 2, maxDaysAhead: 30, slotMinutes: 30 },
        reminders: { email: true },
      });
    }
    async function member(orgId: Id<"orgs">, userId: string, role: "admin" | "staff") {
      await recordAccountAcceptance(ctx, userId, "account_checkbox");
      if (role === "admin") await ctx.db.insert("processingAcceptances", {
        orgId, userId, version: LEGAL_VERSION, documentId: await currentDocument(ctx, "processing"),
        label: PROCESSING_LABEL, at: Date.now(),
      });
      const memberId = await ctx.db.insert("members", {
        orgId,
        userId,
        email: `${userId}@example.com`,
        role,
        name: userId,
        color: "plum",
        schedule: SCHEDULE,
        bookable: true,
        active: true,
      });
      await ctx.db.insert("userSettings", { userId, activeOrgId: orgId });
      return memberId;
    }
    async function treatment(orgId: Id<"orgs">) {
      return ctx.db.insert("treatments", {
        orgId,
        name: "Limpieza facial",
        category: "facial",
        durationMin: 60,
        price: 100000,
        color: "teal",
        active: true,
        bookableOnline: true,
        consentText: "",
        contraindications: [],
        aftercare: [],
        formFields: [],
      });
    }
    async function client(orgId: Id<"orgs">, createdBy: Id<"members">, firstName: string, phone: string) {
      const clientId = await ctx.db.insert("clients", {
        orgId,
        firstName,
        lastName: "Prueba",
        searchText: `${firstName.toLowerCase()} prueba ${phone.slice(3)}`,
        phone,
        health: { conditions: [], allergies: [], skinConditions: [], none: { conditions: false, allergies: false, skin: false } },
        habits: {},
        skin: {},
        createdBy,
        isArchived: false,
      });
      const policyId = await currentPolicyId(ctx, orgId);
      const policy = (await ctx.db.get(policyId))!;
      for (const purpose of ["health", "record_photos"] as const) await ctx.db.insert("clientAuthorizations", {
        orgId, clientId, purpose, action: "accepted", policyId, policyHash: policy.hash, label: LABELS[purpose],
        method: "external_evidence", evidence: "Fixture authorization", recordedBy: createdBy, requestKey: `${clientId}:${purpose}`, at: Date.now(), sequence: 1,
      });
      return clientId;
    }

    const orgA = await org("Alba", "ana");
    const orgB = await org("Brisa", "bea");
    const ana = await member(orgA, "ana", "admin");
    const sofi = await member(orgA, "sofi", "staff");
    const bea = await member(orgB, "bea", "admin");
    return {
      orgA,
      orgB,
      ana,
      sofi,
      bea,
      treatmentA: await treatment(orgA),
      treatmentB: await treatment(orgB),
      clientA: await client(orgA, ana, "Laura", "+573001234567"),
      clientB: await client(orgB, bea, "María", "+573009876543"),
    };
  });

  return {
    t,
    ids,
    asAna: t.withIdentity({ subject: "ana" }),
    asSofi: t.withIdentity({ subject: "sofi" }),
    asBea: t.withIdentity({ subject: "bea" }),
  };
}

/** An unclaimed upload, as `files.generateUploadUrl` records it (without calling R2). Returns the key. */
export async function upload(t: TestConvex<typeof schema>, orgId: Id<"orgs">, uploadedBy: Id<"members">, kind: UploadKind, sessionId?: Id<"sessions">) {
  const key = `orgs/${orgId}/${kind}/${crypto.randomUUID()}`;
  await t.run((ctx) => ctx.db.insert("uploads", { orgId, key, kind, uploadedBy, sessionId }));
  return key;
}

/** A Monday far in the future, so "now" never interferes. */
export const MONDAY = "2030-01-07";
export const at = (time: string, date = MONDAY) => bogotaToEpoch(date, time);

/**
 * Fake timers at Sunday 07:00 before `MONDAY`, so reminders scheduled for test
 * appointments stay within timer range. Call it at the top of a test file.
 */
export function withTestClock() {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at("07:00", "2030-01-06"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/** The `code` of a ConvexError thrown by `promise`. */
export async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return (error.data as { code: string }).code;
    throw error;
  }
  throw new Error("Expected the call to fail");
}

/** The Spanish message of a ConvexError thrown by `promise`. */
export async function errorMessage(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return (error.data as { message: string }).message;
    throw error;
  }
  throw new Error("Expected the call to fail");
}
