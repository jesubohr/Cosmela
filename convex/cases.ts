import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { fail, getOwned, memberMutation, memberQuery } from "./lib/authz";
import type { AppointmentStatus } from "./lib/validators";
import { followUpsOfCase } from "./followUps";
import { keyValues, NOT_PERFORMED_REASON } from "./sessions";
import { invalid } from "./treatments";

type OrgCtx = QueryCtx & { orgId: Id<"orgs"> };

const UPCOMING: AppointmentStatus[] = ["scheduled", "requested"];

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

/** Casos list. `memberId` keeps cases with at least one closed or postponed session by that professional. */
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

    // One read each for upcoming appointments and pending follow-ups, grouped by case.
    const [future, pendingFollowUps] = await Promise.all([
      ctx.db
        .query("appointments")
        .withIndex("by_org_start", (q) => q.eq("orgId", ctx.orgId).gt("start", Date.now()))
        .collect(),
      ctx.db
        .query("followUps")
        .withIndex("by_org_status_due", (q) => q.eq("orgId", ctx.orgId).eq("status", "pending"))
        .collect(),
    ]);
    const nextStart = new Map<Id<"cases">, number>();
    for (const a of future) {
      if (a.caseId && UPCOMING.includes(a.status) && !nextStart.has(a.caseId)) nextStart.set(a.caseId, a.start);
    }
    const nextDue = new Map<Id<"cases">, string>();
    for (const f of pendingFollowUps) {
      if (f.caseId && !nextDue.has(f.caseId)) nextDue.set(f.caseId, f.dueDate);
    }

    const clients = new Map<Id<"clients">, Doc<"clients"> | null>();
    const treatments = new Map<Id<"treatments">, Doc<"treatments"> | null>();

    const rows = [];
    for (const c of cases) {
      if (memberId && !c.memberIds?.includes(memberId)) continue;
      if (!clients.has(c.clientId)) clients.set(c.clientId, await ctx.db.get(c.clientId));
      if (!treatments.has(c.treatmentId)) treatments.set(c.treatmentId, await ctx.db.get(c.treatmentId));
      const client = clients.get(c.clientId);
      const treatment = treatments.get(c.treatmentId);
      if (!client || client.isArchived) continue;
      const appointmentStart = nextStart.get(c._id);
      const dueDate = nextDue.get(c._id);
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
        next:
          appointmentStart !== undefined
            ? { kind: "appointment" as const, start: appointmentStart }
            : dueDate !== undefined
              ? { kind: "followUp" as const, dueDate }
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
        reason: s.reason,
        startedAt: s.startedAt,
        closedAt: s.closedAt,
        memberId: s.memberId,
        memberName: await memberName(s.memberId),
        keyValues: keyValues(s.procedure),
        notes: s.procedure?.notes,
        evolution: s.intake?.evolution,
        contraindications: s.status === "postponed" && s.reason !== NOT_PERFORMED_REASON ? s.contraindications?.present : undefined,
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
