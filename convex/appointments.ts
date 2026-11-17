import { hasPurpose } from "./lib/clientAuthorization";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail, getOwned, memberMutation, memberQuery } from "./lib/authz";
import { freeSlots as computeFreeSlots, overlaps, rangesForDate, type Interval } from "./lib/slots";
import { bogotaDateKey, bogotaToEpoch } from "./lib/time";
import { vPaymentMethod, type AppointmentStatus } from "./lib/validators";
import { addPayment } from "./payments";

type OrgCtx = QueryCtx & { orgId: Id<"orgs"> };
type MemberCtx = MutationCtx & { orgId: Id<"orgs">; member: Doc<"members"> };

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Statuses that hold the time slot. */
const ACTIVE: AppointmentStatus[] = ["requested", "scheduled", "in_progress"];

function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}

/** Statuses each action starts from. Phase 2 moves scheduled → in_progress → completed. */
const ALLOWED_FROM = {
  edit: ["requested", "scheduled"],
  confirm: ["requested"],
  reject: ["requested"],
  cancel: ["requested", "scheduled"],
  noShow: ["scheduled"],
} satisfies Record<string, AppointmentStatus[]>;

/**
 * An appointment left `in_progress` without a session (nothing was recorded) can be
 * rescheduled, cancelled, or marked as a no-show like a scheduled one.
 */
async function assertStatus(ctx: OrgCtx, appointment: Doc<"appointments">, action: keyof typeof ALLOWED_FROM) {
  if ((ALLOWED_FROM[action] as AppointmentStatus[]).includes(appointment.status)) return;
  if (appointment.status === "in_progress" && action !== "confirm" && action !== "reject") {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", appointment._id))
      .first();
    if (!session) return;
  }
  invalid("Esta cita ya no se puede cambiar así. Revisa su estado.");
}

async function activeMember(ctx: OrgCtx, memberId: Id<"members">) {
  const member = await getOwned(ctx, "members", memberId);
  if (!member.active) invalid(`${member.name} ya no está activo en el equipo.`);
  return member;
}

function validateTimes(start: number, durationMin: number) {
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 12 * 60) {
    invalid("La duración debe estar entre 5 minutos y 12 horas.");
  }
  if (start % MINUTE !== 0) invalid("Revisa la hora de la cita.");
  return { start, end: start + durationMin * MINUTE };
}

function validatePrice(price: number) {
  if (!Number.isInteger(price) || price < 0) invalid("Revisa el precio.");
}

export type Conflict = { kind: "appointment" | "block"; id: string; label: string; start: number; end: number };

/** Active appointments and blocks of the member that overlap `[start, end)`. */
async function findConflicts(
  ctx: OrgCtx,
  memberId: Id<"members">,
  interval: Interval,
  exclude?: { appointmentId?: Id<"appointments">; blockId?: Id<"timeBlocks"> },
): Promise<Conflict[]> {
  // Appointments and blocks never exceed a day, so a day of look-back finds every overlap.
  const [appointments, blocks] = await Promise.all([
    ctx.db
      .query("appointments")
      .withIndex("by_member_start", (q) =>
        q.eq("memberId", memberId).gt("start", interval.start - DAY).lt("start", interval.end),
      )
      .collect(),
    ctx.db
      .query("timeBlocks")
      .withIndex("by_member_start", (q) =>
        q.eq("memberId", memberId).gt("start", interval.start - DAY).lt("start", interval.end),
      )
      .collect(),
  ]);
  const conflicts: Conflict[] = [];
  for (const a of appointments) {
    if (a._id === exclude?.appointmentId || !ACTIVE.includes(a.status) || !overlaps(a, interval)) continue;
    const client = await ctx.db.get(a.clientId);
    conflicts.push({ kind: "appointment", id: a._id, label: client ? `${client.firstName} ${client.lastName}`.trim() : "", start: a.start, end: a.end });
  }
  for (const b of blocks) {
    if (b._id === exclude?.blockId || !overlaps(b, interval)) continue;
    conflicts.push({ kind: "block", id: b._id, label: b.title ?? "", start: b.start, end: b.end });
  }
  return conflicts.sort((a, b) => a.start - b.start);
}

/** True when `[start, end)` fits inside one of the member's working ranges that day. */
function withinSchedule(member: Doc<"members">, { start, end }: Interval) {
  const date = bogotaDateKey(start);
  return rangesForDate(member.schedule, date).some(
    (range) => bogotaToEpoch(date, range.start) <= start && end <= bogotaToEpoch(date, range.end),
  );
}

async function assertNoConflicts(ctx: OrgCtx, member: Doc<"members">, interval: Interval, excludeId?: Id<"appointments">) {
  const conflicts = await findConflicts(ctx, member._id, interval, { appointmentId: excludeId });
  if (conflicts.length > 0) {
    throw new ConvexError({
      code: "CONFLICT",
      message: `Este horario se cruza con otra cita o un bloqueo de ${member.name}. Elige otra hora o confirma que quieres agendar de todas formas.`,
    });
  }
}

/** Members and treatments for pickers and the agenda (columns, schedules, colors). */
export const formOptions = memberQuery({
  args: {},
  handler: async (ctx) => {
    const [org, members, treatments] = await Promise.all([
      ctx.db.get(ctx.orgId),
      ctx.db.query("members").withIndex("by_org", (q) => q.eq("orgId", ctx.orgId)).collect(),
      ctx.db.query("treatments").withIndex("by_org_active", (q) => q.eq("orgId", ctx.orgId).eq("active", true)).collect(),
    ]);
    return {
      orgName: org?.name ?? "",
      slotMinutes: org?.booking.slotMinutes ?? 30,
      members: members
        .filter((m) => m.active)
        .map((m) => ({ _id: m._id, name: m.name, color: m.color, schedule: m.schedule, role: m.role })),
      treatments: treatments
        .map((t) => ({ _id: t._id, name: t.name, durationMin: t.durationMin, price: t.price, color: t.color }))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    };
  },
});

/** Appointments (with client and treatment names) and blocks that start in `[start, end)`. */
export const agenda = memberQuery({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, { start, end }) => {
    const [appointments, blocks] = await Promise.all([
      ctx.db
        .query("appointments")
        .withIndex("by_org_start", (q) => q.eq("orgId", ctx.orgId).gte("start", start).lt("start", end))
        .collect(),
      ctx.db
        .query("timeBlocks")
        .withIndex("by_org_start", (q) => q.eq("orgId", ctx.orgId).gte("start", start).lt("start", end))
        .collect(),
    ]);
    const clients = new Map<Id<"clients">, Doc<"clients"> | null>();
    const treatments = new Map<Id<"treatments">, Doc<"treatments"> | null>();
    const rows = [];
    for (const a of appointments) {
      if (!clients.has(a.clientId)) clients.set(a.clientId, await ctx.db.get(a.clientId));
      if (!treatments.has(a.treatmentId)) treatments.set(a.treatmentId, await ctx.db.get(a.treatmentId));
      const client = clients.get(a.clientId);
      const treatment = treatments.get(a.treatmentId);
      rows.push({
        _id: a._id,
        memberId: a.memberId,
        start: a.start,
        end: a.end,
        status: a.status,
        clientName: client ? `${client.firstName} ${client.lastName}`.trim() : "",
        treatmentName: treatment?.name ?? "",
        color: treatment?.color ?? "plum",
      });
    }
    return {
      appointments: rows,
      blocks: blocks.map((b) => ({
        _id: b._id,
        memberId: b.memberId,
        start: b.start,
        end: b.end,
        allDay: b.allDay,
        kind: b.kind,
        title: b.title,
      })),
    };
  },
});

/** Everything the detail sheet shows. */
export const detail = memberQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    const [client, treatment, member, payments, session] = await Promise.all([
      ctx.db.get(appointment.clientId),
      ctx.db.get(appointment.treatmentId),
      ctx.db.get(appointment.memberId),
      ctx.db.query("payments").withIndex("by_appointment", (q) => q.eq("appointmentId", appointmentId)).collect(),
      ctx.db.query("sessions").withIndex("by_appointment", (q) => q.eq("appointmentId", appointmentId)).first(),
    ]);
    if (!client || !treatment || !member) fail("NOT_FOUND");
    return {
      appointment: {
        _id: appointment._id,
        start: appointment.start,
        end: appointment.end,
        status: appointment.status,
        source: appointment.source,
        price: appointment.price,
        paidTotal: appointment.paidTotal,
        notes: appointment.notes,
        cancelReason: appointment.cancelReason,
        /** "Correo de la solicitud": shown with "Guardar en la ficha" (`saveContactEmail`). */
        contactEmail: appointment.contactEmail,
        clientId: appointment.clientId,
        treatmentId: appointment.treatmentId,
        memberId: appointment.memberId,
      },
      client: {
        _id: client._id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        health: await hasPurpose(ctx, ctx.orgId, client._id, "health") ? client.health : { conditions: [], allergies: [], skinConditions: [], none: { conditions: false, allergies: false, skin: false } },
        sex: client.sex,
        lastPregnancy: await hasPurpose(ctx, ctx.orgId, client._id, "health") ? client.lastPregnancy : undefined,
      },
      treatment: { name: treatment.name, color: treatment.color, durationMin: treatment.durationMin },
      member: { name: member.name, color: member.color },
      payments: payments
        .sort((a, b) => a.paidAt - b.paidAt)
        .map((p) => ({ _id: p._id, amount: p.amount, method: p.method, paidAt: p.paidAt, note: p.note })),
      sessionStatus: session?.status ?? null,
    };
  },
});

/** Citas tab of a client, newest first. */
export const listByClient = memberQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await getOwned(ctx, "clients", clientId);
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .order("desc")
      .collect();
    const rows = [];
    for (const a of appointments) {
      const [treatment, member] = await Promise.all([ctx.db.get(a.treatmentId), ctx.db.get(a.memberId)]);
      rows.push({
        _id: a._id,
        start: a.start,
        end: a.end,
        status: a.status,
        price: a.price,
        paidTotal: a.paidTotal,
        treatmentName: treatment?.name ?? "",
        memberName: member?.name ?? "",
        color: treatment?.color ?? "plum",
      });
    }
    return rows;
  },
});

/** Free start times for a member on a Bogotá day (staff booking: no minimum notice). */
export const freeSlots = memberQuery({
  args: {
    memberId: v.id("members"),
    date: v.string(),
    durationMin: v.number(),
    excludeAppointmentId: v.optional(v.id("appointments")),
  },
  handler: async (ctx, { memberId, date, durationMin, excludeAppointmentId }) => {
    const member = await getOwned(ctx, "members", memberId);
    const org = await ctx.db.get(ctx.orgId);
    const dayStart = bogotaToEpoch(date);
    const [appointments, blocks] = await Promise.all([
      ctx.db
        .query("appointments")
        .withIndex("by_member_start", (q) => q.eq("memberId", memberId).gt("start", dayStart - DAY).lt("start", dayStart + DAY))
        .collect(),
      ctx.db
        .query("timeBlocks")
        .withIndex("by_member_start", (q) => q.eq("memberId", memberId).gt("start", dayStart - DAY).lt("start", dayStart + DAY))
        .collect(),
    ]);
    const busy = [
      ...appointments.filter((a) => ACTIVE.includes(a.status) && a._id !== excludeAppointmentId),
      ...blocks,
    ];
    return computeFreeSlots({
      date,
      ranges: rangesForDate(member.schedule, date),
      busy,
      durationMin,
      stepMin: org?.booking.slotMinutes ?? 30,
      minNoticeMin: 0,
      now: Date.now(),
    });
  },
});

/** Overlaps and the outside-working-hours warning for a proposed time. */
export const conflicts = memberQuery({
  args: {
    memberId: v.id("members"),
    start: v.number(),
    end: v.number(),
    excludeAppointmentId: v.optional(v.id("appointments")),
    excludeBlockId: v.optional(v.id("timeBlocks")),
  },
  handler: async (ctx, { memberId, start, end, excludeAppointmentId, excludeBlockId }) => {
    const member = await getOwned(ctx, "members", memberId);
    return {
      conflicts: await findConflicts(ctx, memberId, { start, end }, { appointmentId: excludeAppointmentId, blockId: excludeBlockId }),
      outsideHours: !withinSchedule(member, { start, end }),
    };
  },
});

const appointmentFields = {
  clientId: v.id("clients"),
  treatmentId: v.id("treatments"),
  memberId: v.id("members"),
  start: v.number(),
  durationMin: v.number(),
  price: v.number(),
  notes: v.optional(v.string()),
  /** Set after the user saw the conflict warning and chose to book anyway. */
  allowConflicts: v.optional(v.boolean()),
};

async function loadParts(ctx: MemberCtx, args: { clientId: Id<"clients">; treatmentId: Id<"treatments">; memberId: Id<"members"> }) {
  const [client, treatment, member] = await Promise.all([
    getOwned(ctx, "clients", args.clientId),
    getOwned(ctx, "treatments", args.treatmentId),
    activeMember(ctx, args.memberId),
  ]);
  if (client.isArchived) invalid("Este cliente está archivado. Restáuralo para agendarle citas.");
  return { client, treatment, member };
}

function cleanNotes(notes: string | undefined) {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : undefined;
}

/** "Nueva cita" from the team. Optional abono is recorded as a payment. */
export const create = memberMutation({
  args: {
    ...appointmentFields,
    deposit: v.optional(v.object({ amount: v.number(), method: vPaymentMethod })),
    /** "Agendar siguiente sesión": the case this appointment continues. */
    caseId: v.optional(v.id("cases")),
  },
  handler: async (ctx, args) => {
    const { member } = await loadParts(ctx, args);
    const interval = validateTimes(args.start, args.durationMin);
    validatePrice(args.price);
    if (args.caseId) {
      const caseDoc = await getOwned(ctx, "cases", args.caseId);
      if (caseDoc.clientId !== args.clientId || caseDoc.treatmentId !== args.treatmentId || caseDoc.status !== "open") {
        invalid("Ese caso no corresponde a este cliente y tratamiento.");
      }
    }
    if (!args.allowConflicts) await assertNoConflicts(ctx, member, interval);

    const appointmentId = await ctx.db.insert("appointments", {
      orgId: ctx.orgId,
      clientId: args.clientId,
      memberId: args.memberId,
      treatmentId: args.treatmentId,
      ...interval,
      status: "scheduled",
      source: "staff",
      price: args.price,
      paidTotal: 0,
      notes: cleanNotes(args.notes),
      caseId: args.caseId,
      createdBy: ctx.member._id,
    });
    if (args.deposit) {
      const appointment = (await ctx.db.get(appointmentId))!;
      await addPayment(ctx, appointment, { ...args.deposit, paidAt: Date.now() });
    }
    await ctx.runMutation(internal.notifications.scheduleReminder, { appointmentId });
    await ctx.runMutation(internal.notifications.sendAppointmentConfirmed, { appointmentId });
    return appointmentId;
  },
});

/** Edit or reschedule ("Reprogramar") a requested or scheduled appointment. */
export const update = memberMutation({
  args: { appointmentId: v.id("appointments"), ...appointmentFields },
  handler: async (ctx, { appointmentId, ...args }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    await assertStatus(ctx, appointment, "edit");
    const { member } = await loadParts(ctx, args);
    const interval = validateTimes(args.start, args.durationMin);
    validatePrice(args.price);
    if (args.price < appointment.paidTotal) {
      invalid("El precio no puede ser menor a lo que ya se pagó.");
    }
    if (!args.allowConflicts) await assertNoConflicts(ctx, member, interval, appointmentId);

    const clientChanged = args.clientId !== appointment.clientId;
    await ctx.db.patch(appointmentId, {
      clientId: args.clientId,
      treatmentId: args.treatmentId,
      memberId: args.memberId,
      ...interval,
      price: args.price,
      notes: cleanNotes(args.notes),
      // An attention that never got a session goes back to the agenda.
      ...(appointment.status === "in_progress" && { status: "scheduled" as const }),
      // The request email belonged to the previous client.
      ...(clientChanged && { contactEmail: undefined }),
    });
    if (clientChanged) {
      // Abonos follow the appointment, so both clients' Pagos and Resumen agree.
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_appointment", (q) => q.eq("appointmentId", appointmentId))
        .collect();
      for (const payment of payments) await ctx.db.patch(payment._id, { clientId: args.clientId });
    }
    const moved = interval.start !== appointment.start || args.memberId !== appointment.memberId;
    if (appointment.status === "in_progress" || (moved && appointment.status === "scheduled")) {
      await ctx.runMutation(internal.notifications.cancelReminder, { appointmentId });
      await ctx.runMutation(internal.notifications.scheduleReminder, { appointmentId });
    }
  },
});

/** "Atención sin cita": an appointment that starts now, ready for the attention flow. */
export const startWalkIn = memberMutation({
  args: { clientId: v.id("clients"), treatmentId: v.id("treatments"), memberId: v.id("members") },
  handler: async (ctx, args) => {
    const { treatment } = await loadParts(ctx, args);
    const start = Math.floor(Date.now() / MINUTE) * MINUTE;
    return await ctx.db.insert("appointments", {
      orgId: ctx.orgId,
      ...args,
      start,
      end: start + treatment.durationMin * MINUTE,
      status: "scheduled",
      source: "staff",
      price: treatment.price,
      paidTotal: 0,
      createdBy: ctx.member._id,
    });
  },
});

/** Accepts an online request ("Confirmar"). */
export const confirm = memberMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    await assertStatus(ctx, appointment, "confirm");
    await ctx.db.patch(appointmentId, { status: "scheduled" });
    await ctx.runMutation(internal.notifications.scheduleReminder, { appointmentId });
    await ctx.runMutation(internal.notifications.sendAppointmentConfirmed, { appointmentId });
  },
});

/** Declines an online request ("Rechazar"). */
export const reject = memberMutation({
  args: { appointmentId: v.id("appointments"), reason: v.optional(v.string()) },
  handler: async (ctx, { appointmentId, reason }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    await assertStatus(ctx, appointment, "reject");
    await ctx.db.patch(appointmentId, { status: "cancelled", cancelReason: cleanNotes(reason) ?? "Solicitud rechazada" });
    await ctx.runMutation(internal.notifications.sendRequestRejected, { appointmentId });
  },
});

export const cancel = memberMutation({
  args: { appointmentId: v.id("appointments"), reason: v.optional(v.string()) },
  handler: async (ctx, { appointmentId, reason }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    await assertStatus(ctx, appointment, "cancel");
    await ctx.db.patch(appointmentId, { status: "cancelled", cancelReason: cleanNotes(reason) });
    await ctx.runMutation(internal.notifications.cancelReminder, { appointmentId });
  },
});

/** "Guardar en la ficha": the email of an online request becomes the client's email. */
export const saveContactEmail = memberMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    if (!appointment.contactEmail) invalid("Esta cita no tiene un correo de solicitud.");
    await getOwned(ctx, "clients", appointment.clientId);
    await ctx.db.patch(appointment.clientId, { email: appointment.contactEmail });
    await ctx.db.patch(appointmentId, { contactEmail: undefined });
  },
});

export const markNoShow = memberMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    await assertStatus(ctx, appointment, "noShow");
    await ctx.db.patch(appointmentId, { status: "no_show" });
    await ctx.runMutation(internal.notifications.cancelReminder, { appointmentId });
  },
});
