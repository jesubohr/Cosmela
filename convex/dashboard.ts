import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { memberQuery, unguardedAdminMutation, unguardedMemberMutation } from "./lib/authz";
import { hasPurpose } from "./lib/clientAuthorization";
import { addDaysToDateKey, bogotaDateKey, bogotaToEpoch } from "./lib/time";
import { owesBalance } from "./payments";
import { invalid } from "./treatments";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function fullName(client: Doc<"clients">) {
  return `${client.firstName} ${client.lastName}`.trim();
}

/**
 * Everything Hoy shows for a Bogotá day ("YYYY-MM-DD") except follow-ups and
 * attentions in progress, which have their own queries.
 * The client sends the date so the page rolls over at midnight without new data.
 */
export const today = memberQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    if (!DATE.test(date)) invalid("Elige una fecha válida.");
    const dayStart = bogotaToEpoch(date);
    const dayEnd = bogotaToEpoch(addDaysToDateKey(date, 1));
    const isAdmin = ctx.member.role === "admin";

    const [org, members, dayAppointments, blocks, requested, owing, birthdays] = await Promise.all([
      ctx.db.get(ctx.orgId),
      ctx.db.query("members").withIndex("by_org", (q) => q.eq("orgId", ctx.orgId)).collect(),
      ctx.db
        .query("appointments")
        .withIndex("by_org_start", (q) => q.eq("orgId", ctx.orgId).gte("start", dayStart).lt("start", dayEnd))
        .collect(),
      ctx.db
        .query("timeBlocks")
        .withIndex("by_org_start", (q) => q.eq("orgId", ctx.orgId).gte("start", dayStart).lt("start", dayEnd))
        .collect(),
      ctx.db.query("appointments").withIndex("by_org_status", (q) => q.eq("orgId", ctx.orgId).eq("status", "requested")).collect(),
      ctx.db.query("appointments").withIndex("by_org_balance", (q) => q.eq("orgId", ctx.orgId).eq("hasBalance", true)).collect(),
      ctx.db
        .query("clients")
        .withIndex("by_org_birthday", (q) => q.eq("orgId", ctx.orgId).eq("birthdayKey", date.slice(5)))
        .collect(),
    ]);
    if (!org) invalid("No encontramos tu negocio.");

    const clients = new Map<Id<"clients">, Doc<"clients"> | null>();
    const treatments = new Map<Id<"treatments">, Doc<"treatments"> | null>();
    async function parts(a: Doc<"appointments">) {
      if (!clients.has(a.clientId)) clients.set(a.clientId, await ctx.db.get(a.clientId));
      if (!treatments.has(a.treatmentId)) treatments.set(a.treatmentId, await ctx.db.get(a.treatmentId));
      return { client: clients.get(a.clientId) ?? null, treatment: treatments.get(a.treatmentId) ?? null };
    }

    const appointments = [];
    for (const a of dayAppointments.sort((x, y) => x.start - y.start)) {
      if (a.status === "cancelled") continue;
      const { client, treatment } = await parts(a);
      if (!client) continue;
      const healthAllowed = await hasPurpose(ctx, ctx.orgId, client._id, "health");
      appointments.push({
        _id: a._id,
        memberId: a.memberId,
        start: a.start,
        end: a.end,
        status: a.status,
        treatmentName: treatment?.name ?? "",
        color: treatment?.color ?? "plum",
        client: {
          _id: client._id,
          name: fullName(client),
          phone: client.phone,
          health: healthAllowed ? client.health : { conditions: [], allergies: [], skinConditions: [], none: { conditions: false, allergies: false, skin: false } },
          sex: client.sex,
          lastPregnancy: healthAllowed ? client.lastPregnancy : undefined,
        },
      });
    }

    // Requests for past days are stale; the agenda still shows them.
    const requests = [];
    for (const a of requested.filter((r) => r.start >= dayStart).sort((x, y) => x.start - y.start)) {
      const { client, treatment } = await parts(a);
      if (!client || client.isArchived) continue;
      requests.push({ _id: a._id, memberId: a.memberId, start: a.start, clientName: fullName(client), treatmentName: treatment?.name ?? "" });
    }

    const pending = [];
    for (const a of owing.sort((x, y) => y.start - x.start)) {
      const { client } = await parts(a);
      if (!client || client.isArchived) continue;
      pending.push({ _id: a._id, start: a.start, clientName: fullName(client), balance: a.price - a.paidTotal });
    }

    let checklist = null;
    if (isAdmin && !org.checklistDismissedAt) {
      const [anyClient, anyAppointment, anyInvitation] = await Promise.all([
        ctx.db.query("clients").withIndex("by_org", (q) => q.eq("orgId", ctx.orgId)).first(),
        ctx.db.query("appointments").withIndex("by_org_start", (q) => q.eq("orgId", ctx.orgId)).first(),
        ctx.db.query("invitations").withIndex("by_org", (q) => q.eq("orgId", ctx.orgId)).first(),
      ]);
      checklist = {
        client: anyClient !== null,
        appointment: anyAppointment !== null,
        consent: org.consentReviewedAt !== undefined,
        signature: ctx.member.signatureKey !== undefined,
        booking: org.bookingSharedAt !== undefined,
        team: org.kind === "salon" ? members.length > 1 || anyInvitation !== null : null,
      };
    }

    return {
      members: members.map((m) => ({ _id: m._id, name: m.name, color: m.color })),
      appointments,
      blocks: blocks
        .sort((x, y) => x.start - y.start)
        .map((b) => ({ _id: b._id, memberId: b.memberId, start: b.start, end: b.end, allDay: b.allDay, title: b.title, kind: b.kind })),
      requests,
      pendingPayments: { total: pending.reduce((sum, p) => sum + p.balance, 0), rows: pending },
      birthdays: birthdays
        .filter((c) => !c.isArchived)
        .map((c) => ({ _id: c._id, name: fullName(c), firstName: c.firstName, phone: c.phone })),
      bookingEnabled: org.booking.enabled,
      checklist,
    };
  },
});

/** "Primeros pasos": the treatment consent tab was opened, or the booking link was copied or shared. */
export const markChecklist = unguardedMemberMutation({
  args: { step: v.union(v.literal("consent"), v.literal("booking")) },
  handler: async (ctx, { step }) => {
    const org = await ctx.db.get(ctx.orgId);
    if (!org) return;
    if (step === "consent" && org.consentReviewedAt === undefined) {
      await ctx.db.patch(ctx.orgId, { consentReviewedAt: Date.now() });
    }
    if (step === "booking" && org.bookingSharedAt === undefined) {
      await ctx.db.patch(ctx.orgId, { bookingSharedAt: Date.now() });
    }
  },
});

export const dismissChecklist = unguardedAdminMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.patch(ctx.orgId, { checklistDismissedAt: Date.now() });
  },
});

/**
 * Local demo only: fills today of an org made by `seed:run` so Hoy has something to show.
 *   pnpm exec convex run dashboard:seedToday '{"email":"delivered+ana@resend.dev"}'
 */
export const seedToday = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const admin = (await ctx.db.query("members").collect()).find((m) => m.email === email.toLowerCase());
    if (!admin) throw new ConvexError(`No member with email ${email}. Run seed:run first.`);
    const orgId = admin.orgId;
    const [members, treatments, clients] = await Promise.all([
      ctx.db.query("members").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect(),
      ctx.db.query("treatments").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect(),
      ctx.db.query("clients").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect(),
    ]);
    const staff = members.find((m) => m._id !== admin._id) ?? admin;
    const today = bogotaDateKey(Date.now());

    type Plan = [date: string, time: string, client: number, treatment: number, member: Doc<"members">, status: Doc<"appointments">["status"], paid?: number];
    const plans: Plan[] = [
      [today, "08:00", 1, 0, admin, "completed", 90000],
      [today, "09:30", 9, 2, staff, "completed"],
      [today, "10:30", 2, 3, admin, "no_show"],
      [today, "15:00", 3, 1, admin, "completed", 50000],
      [today, "17:45", 0, 1, admin, "scheduled"],
      [today, "19:00", 5, 0, staff, "scheduled"],
      [today, "19:30", 11, 2, admin, "scheduled"],
      [today, "20:00", 6, 3, staff, "requested"],
      [addDaysToDateKey(today, 1), "09:00", 7, 2, admin, "requested"],
    ];
    for (const [date, time, client, treatment, member, status, paid] of plans) {
      const start = bogotaToEpoch(date, time);
      const t = treatments[treatment];
      const appointmentId = await ctx.db.insert("appointments", {
        orgId,
        clientId: clients[client]._id,
        memberId: member._id,
        treatmentId: t._id,
        start,
        end: start + t.durationMin * 60_000,
        status,
        source: status === "requested" ? "online" : "staff",
        price: t.price,
        paidTotal: paid ?? 0,
        hasBalance: owesBalance({ status, price: t.price, paidTotal: paid ?? 0 }),
        createdBy: admin._id,
      });
      if (paid) {
        await ctx.db.insert("payments", {
          orgId,
          appointmentId,
          clientId: clients[client]._id,
          amount: paid,
          method: "transfer",
          paidAt: start + 3_600_000,
          recordedBy: admin._id,
        });
      }
    }
    await ctx.db.insert("timeBlocks", {
      orgId,
      memberId: admin._id,
      start: bogotaToEpoch(today, "12:30"),
      end: bogotaToEpoch(today, "14:00"),
      allDay: false,
      kind: "personal",
      title: "Almuerzo",
    });
    await ctx.db.patch(clients[4]._id, { birthDate: `1992-${today.slice(5)}`, birthdayKey: today.slice(5) });
    for (const [client, days, note] of [
      [8, -3, "Revisar cómo le fue con el lifting"],
      [10, 0, undefined],
    ] as const) {
      await ctx.db.insert("followUps", {
        orgId,
        clientId: clients[client]._id,
        memberId: admin._id,
        dueDate: addDaysToDateKey(today, days),
        note,
        status: "pending",
      });
    }
  },
});
