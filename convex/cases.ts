import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { fail, getOwned, memberMutation, memberQuery } from "./lib/authz";
import { followUpsOfCase } from "./followUps";
import { keyValues } from "./sessions";
import { invalid } from "./treatments";

type OrgCtx = QueryCtx & { orgId: Id<"orgs"> };

const UPCOMING = ["scheduled", "requested"];

/** The next appointment booked for a case, if any. */
async function nextAppointment(ctx: OrgCtx, caseDoc: Doc<"cases">) {
  const future = await ctx.db
    .query("appointments")
    .withIndex("by_client", (q) => q.eq("clientId", caseDoc.clientId).gt("start", Date.now()))
    .collect();
  return future.filter((a) => a.caseId === caseDoc._id && UPCOMING.includes(a.status)).sort((a, b) => a.start - b.start)[0];
}

async function sessionsOf(ctx: OrgCtx, caseId: Id<"cases">) {
  return await ctx.db
    .query("sessions")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .collect();
}

/** Casos list. `memberId` keeps cases with at least one session by that professional. */
export const list = memberQuery({
  args: { status: v.union(v.literal("open"), v.literal("closed"), v.literal("all")), memberId: v.optional(v.id("members")) },
  handler: async (ctx, { status, memberId }) => {
    const statuses = status === "all" ? (["open", "closed"] as const) : [status];
    const cases: Doc<"cases">[] = [];
    for (const s of statuses) {
      cases.push(
        ...(await ctx.db
          .query("cases")
          .withIndex("by_org_status", (q) => q.eq("orgId", ctx.orgId).eq("status", s))
          .collect()),
      );
    }
    const rows = [];
    for (const c of cases) {
      const sessions = await sessionsOf(ctx, c._id);
      if (memberId && !sessions.some((s) => s.memberId === memberId)) continue;
      const [client, treatment, appointment] = await Promise.all([
        ctx.db.get(c.clientId),
        ctx.db.get(c.treatmentId),
        nextAppointment(ctx, c),
      ]);
      if (!client || client.isArchived) continue;
      const followUp = appointment
        ? undefined
        : (await ctx.db.query("followUps").withIndex("by_client", (q) => q.eq("clientId", c.clientId)).collect())
            .filter((f) => f.caseId === c._id && f.status === "pending")
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      rows.push({
        _id: c._id,
        status: c.status,
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        treatmentName: treatment?.name ?? "",
        color: treatment?.color ?? "plum",
        reasons: c.reasons,
        reasonOther: c.reasonOther,
        sessionCount: c.sessionCount,
        plannedSessions: c.plannedSessions,
        lastSessionAt: c.lastSessionAt,
        openedAt: c.openedAt,
        closedAt: c.closedAt,
        next: appointment
          ? { kind: "appointment" as const, start: appointment.start }
          : followUp
            ? { kind: "followUp" as const, dueDate: followUp.dueDate }
            : null,
      });
    }
    return rows.sort((a, b) => (b.lastSessionAt ?? b.openedAt) - (a.lastSessionAt ?? a.openedAt));
  },
});

/** Case detail: header, sessions timeline (oldest first), follow-ups, and the next appointment. */
export const get = memberQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const caseDoc = await getOwned(ctx, "cases", caseId);
    const [client, treatment, sessions, appointment, followUps] = await Promise.all([
      ctx.db.get(caseDoc.clientId),
      ctx.db.get(caseDoc.treatmentId),
      sessionsOf(ctx, caseId),
      nextAppointment(ctx, caseDoc),
      followUpsOfCase(ctx, caseDoc.clientId, caseId),
    ]);
    if (!client || !treatment) fail("NOT_FOUND");

    const memberNames = new Map<Id<"members">, string>();
    async function memberName(id: Id<"members">) {
      if (!memberNames.has(id)) memberNames.set(id, (await ctx.db.get(id))?.name ?? "");
      return memberNames.get(id)!;
    }
    const timeline = [];
    for (const s of sessions.sort((a, b) => a.startedAt - b.startedAt)) {
      timeline.push({
        _id: s._id,
        appointmentId: s.appointmentId,
        number: s.number,
        status: s.status,
        startedAt: s.startedAt,
        closedAt: s.closedAt,
        memberId: s.memberId,
        memberName: await memberName(s.memberId),
        keyValues: keyValues(s.procedure),
        notes: s.procedure?.notes,
        evolution: s.intake?.evolution,
        contraindications: s.status === "postponed" ? s.contraindications?.present : undefined,
        photos: s.photos,
      });
    }
    const last = timeline.findLast((s) => s.status === "closed");

    return {
      case: {
        _id: caseDoc._id,
        status: caseDoc.status,
        reasons: caseDoc.reasons,
        reasonOther: caseDoc.reasonOther,
        plannedSessions: caseDoc.plannedSessions,
        sessionCount: caseDoc.sessionCount,
        openedAt: caseDoc.openedAt,
        closedAt: caseDoc.closedAt,
        summary: caseDoc.summary,
        lastSessionAt: caseDoc.lastSessionAt,
      },
      client: {
        _id: client._id,
        name: `${client.firstName} ${client.lastName}`.trim(),
        phone: client.phone,
        health: client.health,
        sex: client.sex,
        lastPregnancy: client.lastPregnancy,
        isArchived: client.isArchived,
      },
      treatment: { _id: treatment._id, name: treatment.name, color: treatment.color, followUpDays: treatment.followUpDays },
      sessions: timeline,
      lastMemberId: last?.memberId,
      followUps,
      nextAppointment: appointment
        ? { _id: appointment._id, start: appointment.start, memberName: await memberName(appointment.memberId) }
        : null,
    };
  },
});

/** "Cerrar caso", with an optional closing summary. */
export const close = memberMutation({
  args: { caseId: v.id("cases"), summary: v.optional(v.string()) },
  handler: async (ctx, { caseId, summary }) => {
    const caseDoc = await getOwned(ctx, "cases", caseId);
    if (caseDoc.status === "closed") invalid("Este caso ya está cerrado.");
    const sessions = await sessionsOf(ctx, caseId);
    if (sessions.some((s) => s.status === "draft")) invalid("Este caso tiene una atención en curso. Finalízala antes de cerrar el caso.");
    const trimmed = summary?.trim();
    await ctx.db.patch(caseId, { status: "closed", closedAt: Date.now(), summary: trimmed ? trimmed : undefined });
  },
});

export const reopen = memberMutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const caseDoc = await getOwned(ctx, "cases", caseId);
    if (caseDoc.status === "open") invalid("Este caso ya está abierto.");
    await ctx.db.patch(caseId, { status: "open", closedAt: undefined });
  },
});
