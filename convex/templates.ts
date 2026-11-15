import { v, type Infer } from "convex/values";
import { findTemplate } from "../data/treatment-templates";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { adminMutation } from "./lib/authz";
import { checkPriceAndDuration, invalid } from "./treatments";

/** A chosen template with the price and duration the user set for it. */
export const vTemplatePick = v.object({
  key: v.string(),
  price: v.number(),
  durationMin: v.number(),
});

export type TemplatePick = Infer<typeof vTemplatePick>;

/** Copies templates into the org's catalog. The copies are independent and fully editable. */
export async function insertFromTemplates(ctx: MutationCtx, orgId: Id<"orgs">, picks: TemplatePick[]) {
  const ids: Id<"treatments">[] = [];
  for (const pick of picks) {
    const template = findTemplate(pick.key);
    if (!template) invalid("Una de las plantillas elegidas ya no existe.");
    checkPriceAndDuration(pick.price, pick.durationMin);
    ids.push(
      await ctx.db.insert("treatments", {
        orgId,
        name: template.name,
        category: template.category,
        description: template.description,
        durationMin: pick.durationMin,
        price: pick.price,
        color: template.color,
        active: true,
        bookableOnline: true,
        templateKey: template.key,
        consentText: template.consentText,
        contraindications: template.contraindications,
        aftercare: template.aftercare,
        followUpDays: template.followUpDays,
        suggestedSessions: template.suggestedSessions,
        formFields: template.formFields,
      }),
    );
  }
  return ids;
}

/** "Agregar desde plantillas". Returns the new treatment ids in the given order. */
export const add = adminMutation({
  args: { picks: v.array(vTemplatePick) },
  handler: async (ctx, { picks }) => {
    if (picks.length === 0) invalid("Elige al menos una plantilla.");
    return await insertFromTemplates(ctx, ctx.orgId, picks);
  },
});
