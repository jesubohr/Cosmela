import { ConvexError, v } from "convex/values";
import { composeConsent } from "../data/treatment-templates";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { adminMutation, getOwned, memberQuery } from "./lib/authz";
import {
  TREATMENT_CATEGORIES,
  vFormField,
  vStaffColor,
  vTreatmentCategory,
  type FormField,
} from "./lib/validators";

/** Throws a user-facing validation error. */
export function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}

export function checkPriceAndDuration(price: number, durationMin: number) {
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 600) {
    invalid("La duración debe estar entre 5 y 600 minutos.");
  }
  if (!Number.isInteger(price) || price < 0 || price > 100_000_000) invalid("Escribe un precio válido.");
}

function checkFormFields(fields: FormField[]) {
  if (fields.length > 100) invalid("El formulario tiene demasiados campos.");
  const ids = new Set<string>();
  for (const field of fields) {
    if (!field.id || ids.has(field.id)) invalid("El formulario tiene campos repetidos. Recarga la página e intenta de nuevo.");
    ids.add(field.id);
    if (!field.label.trim()) invalid("Todos los campos del formulario necesitan un título.");
    if ((field.type === "single" || field.type === "multi") && !field.options?.some((o) => o.trim())) {
      invalid(`"${field.label}" necesita al menos una opción.`);
    }
  }
}

const cleanList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);

function optionalCount(value: number | undefined, max: number, message: string) {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > max) invalid(message);
}

/** Catalog for lists and pickers, grouped by category order, then name. Includes inactive treatments. */
export const list = memberQuery({
  args: {},
  handler: async (ctx) => {
    const treatments = await ctx.db
      .query("treatments")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect();
    return treatments
      .sort(
        (a, b) =>
          TREATMENT_CATEGORIES.indexOf(a.category) - TREATMENT_CATEGORIES.indexOf(b.category) ||
          a.name.localeCompare(b.name, "es"),
      )
      .map((t) => ({
        _id: t._id,
        name: t.name,
        category: t.category,
        description: t.description,
        durationMin: t.durationMin,
        price: t.price,
        color: t.color,
        active: t.active,
        bookableOnline: t.bookableOnline,
        templateKey: t.templateKey,
      }));
  },
});

/** Full treatment plus `inUse` (has appointments, so it can only be deactivated). */
export const get = memberQuery({
  args: { id: v.id("treatments") },
  handler: async (ctx, { id }) => {
    const treatment = await getOwned(ctx, "treatments", id);
    return { ...treatment, inUse: await isInUse(ctx, treatment) };
  },
});

async function isInUse(ctx: Pick<QueryCtx, "db">, treatment: Doc<"treatments">) {
  const appointment = await ctx.db
    .query("appointments")
    .withIndex("by_treatment", (q) => q.eq("treatmentId", treatment._id))
    .first();
  return appointment !== null;
}

/** "Crear desde cero": a treatment with an empty form and the base consent text. */
export const create = adminMutation({
  args: {
    name: v.string(),
    category: vTreatmentCategory,
    durationMin: v.number(),
    price: v.number(),
    color: vStaffColor,
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) invalid("Escribe el nombre del tratamiento.");
    checkPriceAndDuration(args.price, args.durationMin);
    return await ctx.db.insert("treatments", {
      orgId: ctx.orgId,
      name,
      category: args.category,
      durationMin: args.durationMin,
      price: args.price,
      color: args.color,
      active: true,
      bookableOnline: true,
      consentText: composeConsent(
        "Escribe aquí los beneficios esperados.",
        "Escribe aquí los posibles riesgos y reacciones.",
      ),
      contraindications: [],
      aftercare: [],
      formFields: [],
    });
  },
});

export const update = adminMutation({
  args: {
    id: v.id("treatments"),
    name: v.string(),
    category: vTreatmentCategory,
    description: v.optional(v.string()),
    durationMin: v.number(),
    price: v.number(),
    color: vStaffColor,
    bookableOnline: v.boolean(),
    consentText: v.string(),
    contraindications: v.array(v.string()),
    aftercare: v.array(v.string()),
    followUpDays: v.optional(v.number()),
    suggestedSessions: v.optional(v.number()),
    formFields: v.array(vFormField),
  },
  handler: async (ctx, { id, ...fields }) => {
    await getOwned(ctx, "treatments", id);
    const name = fields.name.trim();
    if (!name) invalid("Escribe el nombre del tratamiento.");
    checkPriceAndDuration(fields.price, fields.durationMin);
    if (!fields.consentText.trim()) invalid("El consentimiento no puede quedar vacío.");
    optionalCount(fields.followUpDays, 365, "El seguimiento debe estar entre 1 y 365 días.");
    optionalCount(fields.suggestedSessions, 50, "Las sesiones sugeridas deben estar entre 1 y 50.");
    checkFormFields(fields.formFields);

    await ctx.db.patch(id, {
      ...fields,
      name,
      description: fields.description?.trim() || undefined,
      consentText: fields.consentText.trim(),
      contraindications: cleanList(fields.contraindications),
      aftercare: cleanList(fields.aftercare),
    });
  },
});

export const setActive = adminMutation({
  args: { id: v.id("treatments"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    await getOwned(ctx, "treatments", id);
    await ctx.db.patch(id, { active });
  },
});

export const duplicate = adminMutation({
  args: { id: v.id("treatments") },
  handler: async (ctx, { id }) => {
    const source = await getOwned(ctx, "treatments", id);
    return await ctx.db.insert("treatments", {
      orgId: source.orgId,
      name: `${source.name} (copia)`,
      category: source.category,
      description: source.description,
      durationMin: source.durationMin,
      price: source.price,
      color: source.color,
      active: source.active,
      bookableOnline: source.bookableOnline,
      templateKey: source.templateKey,
      consentText: source.consentText,
      contraindications: source.contraindications,
      aftercare: source.aftercare,
      followUpDays: source.followUpDays,
      suggestedSessions: source.suggestedSessions,
      formFields: source.formFields,
    });
  },
});

/** Deletes a treatment that was never used; a used one must be deactivated instead. */
export const remove = adminMutation({
  args: { id: v.id("treatments") },
  handler: async (ctx, { id }) => {
    const treatment = await getOwned(ctx, "treatments", id);
    if (await isInUse(ctx, treatment)) {
      throw new ConvexError({
        code: "IN_USE",
        message: "Este tratamiento ya tiene citas, así que no se puede eliminar. Desactívalo para que no aparezca al agendar.",
      });
    }
    await ctx.db.delete(id);
  },
});
