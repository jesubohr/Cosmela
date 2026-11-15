/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { findTemplate } from "../data/treatment-templates";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return (error.data as { code: string }).code;
    throw error;
  }
  throw new Error("Expected the call to fail");
}

async function setup() {
  const t = convexTest(schema, modules);
  const ana = t.withIdentity({ subject: "ana", email: "ana@example.com" });
  const orgId = await ana.mutation(api.orgs.create, {
    kind: "salon",
    name: "Salón Brisa",
    profile: { name: "Ana", color: "plum" },
    schedule: [],
    treatments: [{ key: "lifting-pestanas", price: 100000, durationMin: 60 }],
  });
  const { sofiId, clientId } = await t.run(async (ctx) => {
    const sofiId = await ctx.db.insert("members", {
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
    const clientId = await ctx.db.insert("clients", {
      orgId,
      firstName: "Laura",
      lastName: "Gómez",
      searchText: "laura gomez",
      phone: "+573001112233",
      health: { conditions: [], allergies: [], skinConditions: [], none: { conditions: true, allergies: true, skin: true } },
      habits: {},
      skin: {},
      createdBy: sofiId,
      isArchived: false,
    });
    return { sofiId, clientId };
  });
  const [lifting] = await ana.query(api.treatments.list, {});
  return { t, ana, sofi: t.withIdentity({ subject: "sofi" }), orgId, sofiId, clientId, liftingId: lifting._id };
}

async function book(
  t: Awaited<ReturnType<typeof setup>>["t"],
  ids: { orgId: Id<"orgs">; clientId: Id<"clients">; sofiId: Id<"members">; treatmentId: Id<"treatments"> },
) {
  await t.run((ctx) =>
    ctx.db.insert("appointments", {
      orgId: ids.orgId,
      clientId: ids.clientId,
      memberId: ids.sofiId,
      treatmentId: ids.treatmentId,
      start: Date.now(),
      end: Date.now() + 3_600_000,
      status: "scheduled",
      source: "staff",
      price: 100000,
      paidTotal: 0,
    }),
  );
}

function editable(treatment: Awaited<ReturnType<typeof getTreatment>>) {
  return {
    id: treatment._id,
    name: treatment.name,
    category: treatment.category,
    description: treatment.description,
    durationMin: treatment.durationMin,
    price: treatment.price,
    color: treatment.color,
    bookableOnline: treatment.bookableOnline,
    consentText: treatment.consentText,
    contraindications: treatment.contraindications,
    aftercare: treatment.aftercare,
    followUpDays: treatment.followUpDays,
    suggestedSessions: treatment.suggestedSessions,
    formFields: treatment.formFields,
  };
}

async function getTreatment(ctx: Awaited<ReturnType<typeof setup>>["ana"], id: Id<"treatments">) {
  return await ctx.query(api.treatments.get, { id });
}

describe("staff", () => {
  test("can view treatments but not edit them", async () => {
    const { sofi, liftingId, ana } = await setup();
    const treatment = await getTreatment(sofi, liftingId);
    expect(treatment.name).toBe("Lifting de pestañas");
    expect(await sofi.query(api.treatments.list, {})).toHaveLength(1);

    expect(await errorCode(sofi.mutation(api.treatments.update, { ...editable(treatment), name: "Otro" }))).toBe("FORBIDDEN");
    expect(await errorCode(sofi.mutation(api.treatments.setActive, { id: liftingId, active: false }))).toBe("FORBIDDEN");
    expect(await errorCode(sofi.mutation(api.treatments.duplicate, { id: liftingId }))).toBe("FORBIDDEN");
    expect(await errorCode(sofi.mutation(api.treatments.remove, { id: liftingId }))).toBe("FORBIDDEN");
    expect(
      await errorCode(
        sofi.mutation(api.treatments.create, { name: "Nuevo", category: "other", durationMin: 30, price: 0, color: "plum" }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(sofi.mutation(api.templates.add, { picks: [{ key: "hidrafacial", price: 1, durationMin: 60 }] })),
    ).toBe("FORBIDDEN");
    expect((await getTreatment(ana, liftingId)).name).toBe("Lifting de pestañas");
  });
});

describe("delete or deactivate", () => {
  test("a treatment that was never used can be deleted", async () => {
    const { ana, t, liftingId } = await setup();
    expect((await getTreatment(ana, liftingId)).inUse).toBe(false);
    await ana.mutation(api.treatments.remove, { id: liftingId });
    expect(await t.run((ctx) => ctx.db.get(liftingId))).toBeNull();
  });

  test("a treatment with appointments cannot be deleted, only deactivated", async () => {
    const { ana, t, orgId, clientId, sofiId, liftingId } = await setup();
    await book(t, { orgId, clientId, sofiId, treatmentId: liftingId });
    expect((await getTreatment(ana, liftingId)).inUse).toBe(true);

    expect(await errorCode(ana.mutation(api.treatments.remove, { id: liftingId }))).toBe("IN_USE");
    expect(await t.run((ctx) => ctx.db.get(liftingId))).not.toBeNull();

    await ana.mutation(api.treatments.setActive, { id: liftingId, active: false });
    expect((await getTreatment(ana, liftingId)).active).toBe(false);
  });

  test("another org cannot touch the treatment", async () => {
    const { t, liftingId } = await setup();
    const bea = t.withIdentity({ subject: "bea" });
    await bea.mutation(api.orgs.create, {
      kind: "solo",
      name: "Bea",
      profile: { name: "Bea", color: "blue" },
      schedule: [],
      treatments: [],
    });
    expect(await errorCode(bea.query(api.treatments.get, { id: liftingId }))).toBe("NOT_FOUND");
    expect(await errorCode(bea.mutation(api.treatments.remove, { id: liftingId }))).toBe("NOT_FOUND");
  });
});

describe("admin editing", () => {
  test("creates from scratch, updates, and duplicates", async () => {
    const { ana } = await setup();
    const id = await ana.mutation(api.treatments.create, {
      name: " Masaje relajante ",
      category: "body",
      durationMin: 50,
      price: 80000,
      color: "sand",
    });
    const created = await getTreatment(ana, id);
    expect(created).toMatchObject({ name: "Masaje relajante", formFields: [], active: true });
    expect(created.consentText).toContain("{cliente}");

    await ana.mutation(api.treatments.update, {
      ...editable(created),
      aftercare: [" Beber agua ", ""],
      formFields: [{ id: "presion", type: "single", label: "Presión", options: ["Suave", "Firme"], required: true }],
    });
    const updated = await getTreatment(ana, id);
    expect(updated.aftercare).toEqual(["Beber agua"]);
    expect(updated.formFields).toHaveLength(1);

    const copyId = await ana.mutation(api.treatments.duplicate, { id });
    expect(await getTreatment(ana, copyId)).toMatchObject({ name: "Masaje relajante (copia)", formFields: updated.formFields });
  });

  test("rejects form fields without a title or options", async () => {
    const { ana, liftingId } = await setup();
    const treatment = editable(await getTreatment(ana, liftingId));
    expect(
      await errorCode(ana.mutation(api.treatments.update, { ...treatment, formFields: [{ id: "a", type: "text", label: " " }] })),
    ).toBe("INVALID");
    expect(
      await errorCode(
        ana.mutation(api.treatments.update, { ...treatment, formFields: [{ id: "a", type: "multi", label: "Zonas", options: [] }] }),
      ),
    ).toBe("INVALID");
  });

  test("adds templates as independent copies", async () => {
    const { ana } = await setup();
    const [id] = await ana.mutation(api.templates.add, { picks: [{ key: "hidrafacial", price: 240000, durationMin: 60 }] });
    const treatment = await getTreatment(ana, id);
    expect(treatment).toMatchObject({ templateKey: "hidrafacial", price: 240000, aftercare: findTemplate("hidrafacial")!.aftercare });
    expect(await errorCode(ana.mutation(api.templates.add, { picks: [{ key: "no-existe", price: 1, durationMin: 30 }] }))).toBe(
      "INVALID",
    );
  });
});
