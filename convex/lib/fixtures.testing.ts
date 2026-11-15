/// <reference types="vite/client" />
// Shared convex-test setup for the clients, appointments, and payments tests.
// The double extension keeps Convex from deploying this file.
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { bogotaToEpoch } from "./time";

export const modules = import.meta.glob("../**/*.ts");

const SCHEDULE = [1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "08:00", end: "18:00" }));

/** Two orgs: A (admin Ana, staff Sofi) and B (admin Bea), each with a treatment and a client. */
export async function setupOrgs() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
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
    async function member(orgId: Id<"orgs">, userId: string, role: "admin" | "staff") {
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
      return ctx.db.insert("clients", {
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

/** A Monday far in the future, so "now" never interferes. */
export const MONDAY = "2030-01-07";
export const at = (time: string, date = MONDAY) => bogotaToEpoch(date, time);

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
