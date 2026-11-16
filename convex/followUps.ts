import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getOwned, memberMutation, memberQuery } from "./lib/authz";
import { bogotaDateKey } from "./lib/time";
import { invalid } from "./treatments";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkDate(dueDate: string) {
  if (!DATE.test(dueDate)) invalid("Elige una fecha válida.");
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** A pending follow-up of the caller's org. */
async function getPending(ctx: QueryCtx & { orgId: Id<"orgs"> }, followUpId: Id<"followUps">) {
  const followUp = await getOwned(ctx, "followUps", followUpId);
  if (followUp.status !== "pending") invalid("Este seguimiento ya se resolvió.");
  return followUp;
}

/** "Crear recordatorio" outside the attention flow (e.g. from a case). */
export const create = memberMutation({
  args: {
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    dueDate: v.string(),
    note: v.optional(v.string()),
    memberId: v.optional(v.id("members")),
  },
  handler: async (ctx, args) => {
    checkDate(args.dueDate);
    const client = await getOwned(ctx, "clients", args.clientId);
    if (args.caseId) {
      const caseDoc = await getOwned(ctx, "cases", args.caseId);
      if (caseDoc.clientId !== client._id) invalid("Ese caso no es de este cliente.");
    }
    const memberId = args.memberId ? (await getOwned(ctx, "members", args.memberId))._id : ctx.member._id;
    return await ctx.db.insert("followUps", {
      orgId: ctx.orgId,
      clientId: client._id,
      caseId: args.caseId,
      memberId,
      dueDate: args.dueDate,
      note: clean(args.note),
      status: "pending",
    });
  },
});

export type FollowUpRow = Awaited<ReturnType<typeof toRow>>;

async function toRow(ctx: QueryCtx, followUp: Doc<"followUps">, today: string, client: Doc<"clients"> | null) {
  const caseDoc = followUp.caseId ? await ctx.db.get(followUp.caseId) : null;
  const treatment = caseDoc ? await ctx.db.get(caseDoc.treatmentId) : null;
  return {
    _id: followUp._id,
    dueDate: followUp.dueDate,
    overdue: followUp.dueDate < today,
    note: followUp.note,
    status: followUp.status,
    outcome: followUp.outcome,
    doneAt: followUp.doneAt,
    memberId: followUp.memberId,
    caseId: followUp.caseId,
    treatmentId: caseDoc?.treatmentId,
    treatmentName: treatment?.name,
    client: {
      _id: followUp.clientId,
      name: client ? `${client.firstName} ${client.lastName}`.trim() : "",
      phone: client?.phone ?? "",
    },
  };
}

/** Hoy "Seguimientos": pending follow-ups due today or overdue (Bogotá), oldest first. */
export const listDue = memberQuery({
  args: {},
  handler: async (ctx) => {
    const today = bogotaDateKey(Date.now());
    const due = await ctx.db
      .query("followUps")
      .withIndex("by_org_status_due", (q) => q.eq("orgId", ctx.orgId).eq("status", "pending").lte("dueDate", today))
      .collect();
    const rows = [];
    for (const followUp of due) {
      const client = await ctx.db.get(followUp.clientId);
      if (client?.isArchived) continue;
      rows.push(await toRow(ctx, followUp, today, client));
    }
    return rows;
  },
});

/** Follow-ups of a case, pending first (by due date), then resolved (newest first). */
export async function followUpsOfCase(ctx: QueryCtx, clientId: Id<"clients">, caseId: Id<"cases">) {
  const today = bogotaDateKey(Date.now());
  const all = await ctx.db
    .query("followUps")
    .withIndex("by_client", (q) => q.eq("clientId", clientId))
    .collect();
  const ofCase = all.filter((f) => f.caseId === caseId);
  const pending = ofCase.filter((f) => f.status === "pending").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const resolved = ofCase.filter((f) => f.status !== "pending").sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  return await Promise.all([...pending, ...resolved].map(async (f) => toRow(ctx, f, today, await ctx.db.get(f.clientId))));
}

/** "Hecho", with an optional outcome note ("Agendó para el martes"). */
export const markDone = memberMutation({
  args: { followUpId: v.id("followUps"), outcome: v.optional(v.string()) },
  handler: async (ctx, { followUpId, outcome }) => {
    await getPending(ctx, followUpId);
    await ctx.db.patch(followUpId, { status: "done", outcome: clean(outcome), doneAt: Date.now() });
  },
});

export const dismiss = memberMutation({
  args: { followUpId: v.id("followUps") },
  handler: async (ctx, { followUpId }) => {
    await getPending(ctx, followUpId);
    await ctx.db.patch(followUpId, { status: "dismissed", doneAt: Date.now() });
  },
});

export const reschedule = memberMutation({
  args: { followUpId: v.id("followUps"), dueDate: v.string() },
  handler: async (ctx, { followUpId, dueDate }) => {
    checkDate(dueDate);
    await getPending(ctx, followUpId);
    await ctx.db.patch(followUpId, { dueDate });
  },
});
