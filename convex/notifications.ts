import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { whatsappLink } from "../lib/whatsapp";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import {
  aftercareEmail,
  appointmentConfirmedEmail,
  emailDate,
  emailTime,
  newRequestEmail,
  reminderEmail,
  requestRejectedEmail,
  type AppointmentInfo,
  type Email,
} from "./lib/emails";
import { addDaysToDateKey, bogotaDateKey, bogotaToEpoch, inBogota } from "./lib/time";

// Appointment, session, and booking mutations call these hooks in their own
// transaction (`ctx.runMutation`). Emails go out from `deliver`, an action
// scheduled right after the transaction commits.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
// The local backend runs with SITE_URL=http://localhost:3000.
const isDevelopment = siteUrl.startsWith("http://localhost");

// In development only Resend test addresses (delivered@resend.dev) are sent.
const mailer = new Resend(components.resend, { testMode: isDevelopment });

/**
 * When to send the reminder of an appointment that starts at `start`: 24 h before,
 * at least 5 minutes from now, moved out of the night (20:00–07:00 Bogotá) to
 * 19:00 the evening before or, when that has passed, 07:00 the next morning.
 * Null when the reminder could not go out at least 1 hour before the appointment.
 */
export function reminderTime(start: number, now: number): number | null {
  const earliest = now + 5 * MINUTE;
  let at = Math.max(start - 24 * HOUR, earliest);
  const hour = inBogota(at).getHours();
  if (hour >= 20 || hour < 7) {
    const eveningDay = hour >= 20 ? bogotaDateKey(at) : addDaysToDateKey(bogotaDateKey(at), -1);
    const evening = bogotaToEpoch(eveningDay, "19:00");
    at = evening >= earliest ? evening : bogotaToEpoch(addDaysToDateKey(eveningDay, 1), "07:00");
  }
  return at <= start - HOUR ? at : null;
}

/** Sends one email. Never throws: a failed send is logged (without the body) and dropped. */
export const deliver = internalAction({
  args: {
    to: v.string(),
    fromName: v.string(),
    replyTo: v.optional(v.string()),
    subject: v.string(),
    html: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { to, fromName, replyTo, subject, html, text }) => {
    try {
      const from = process.env.RESEND_FROM;
      if (!from) throw new Error("RESEND_FROM is not set");
      await mailer.sendEmail(ctx, {
        from: withDisplayName(from, fromName),
        to,
        replyTo: replyTo ? [replyTo] : undefined,
        subject,
        html,
        text,
      });
      if (isDevelopment) console.log(`[dev] Email "${subject}" queued for ${to}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (isDevelopment) console.warn(`[dev] Email "${subject}" to ${to} not sent: ${reason}`);
      else console.error(`Email not sent: ${reason}`);
    }
  },
});

/** "Cosmela <hola@x.co>" + "Estética Ana" → "Estética Ana <hola@x.co>". */
function withDisplayName(from: string, name: string) {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  const safeName = name.replace(/["<>\r\n]/g, "").trim();
  return safeName ? `${safeName} <${address}>` : address;
}

async function queue(ctx: MutationCtx, to: string, email: Email, from: { name: string; replyTo?: string }) {
  await ctx.scheduler.runAfter(0, internal.notifications.deliver, {
    to,
    fromName: from.name,
    replyTo: from.replyTo,
    ...email,
  });
}

/** The owner's email, so client replies reach the business. */
async function ownerEmail(ctx: MutationCtx, org: Doc<"orgs">) {
  const owner = await ctx.db
    .query("members")
    .withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", org.ownerId))
    .unique();
  return owner?.email || undefined;
}

async function loadAppointment(ctx: MutationCtx, appointmentId: Id<"appointments">) {
  const appointment = await ctx.db.get(appointmentId);
  if (!appointment) return null;
  const [org, client, treatment, member] = await Promise.all([
    ctx.db.get(appointment.orgId),
    ctx.db.get(appointment.clientId),
    ctx.db.get(appointment.treatmentId),
    ctx.db.get(appointment.memberId),
  ]);
  if (!org || !client || !treatment || !member) return null;
  return { appointment, org, client, treatment, member };
}
type Loaded = NonNullable<Awaited<ReturnType<typeof loadAppointment>>>;

/** Where this appointment's emails go: the client's email, else the email typed in the online request. */
function recipient(client: Doc<"clients">, appointment: Doc<"appointments"> | null) {
  return client.email ?? appointment?.contactEmail;
}

function fullName(client: Doc<"clients">) {
  return `${client.firstName} ${client.lastName}`.trim();
}

function orgAddress(org: Doc<"orgs">) {
  const address = org.address?.trim();
  return address ? [address, org.city?.trim()].filter(Boolean).join(", ") : undefined;
}

function appointmentInfo({ appointment, org, client, treatment, member }: Loaded, whatsappText: string): AppointmentInfo {
  return {
    orgName: org.name,
    clientFirstName: client.firstName,
    treatmentName: treatment.name,
    start: appointment.start,
    memberName: org.kind === "salon" ? member.name : undefined,
    address: orgAddress(org),
    whatsappUrl: org.whatsapp ? whatsappLink(org.whatsapp, whatsappText) : undefined,
  };
}

/** "de las 10:30 a. m. del martes 17 de noviembre" (ends with a word, so a period can follow). */
function when(start: number) {
  return `de las ${emailTime(start)} del ${emailDate(start)}`;
}

async function cancelPendingJob(ctx: MutationCtx, appointment: Doc<"appointments">) {
  if (!appointment.reminderJobId) return;
  const job = await ctx.db.system.get(appointment.reminderJobId);
  if (job?.state.kind === "pending") await ctx.scheduler.cancel(appointment.reminderJobId);
}

/** Replaces any pending reminder of the appointment with a new one. Returns whether one was scheduled. */
async function scheduleFor(ctx: MutationCtx, appointment: Doc<"appointments">) {
  await cancelPendingJob(ctx, appointment);
  const at = reminderTime(appointment.start, Date.now());
  const reminderJobId = at === null
    ? undefined
    : await ctx.scheduler.runAt(at, internal.notifications.sendReminder, { appointmentId: appointment._id });
  await ctx.db.patch(appointment._id, { reminderJobId, reminderSentAt: undefined });
  return reminderJobId !== undefined;
}

/** Schedules the reminder email ~24 h before a scheduled appointment and stores `reminderJobId`. */
export const scheduleReminder = internalMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const appointment = await ctx.db.get(appointmentId);
    if (appointment?.status === "scheduled") await scheduleFor(ctx, appointment);
    return null;
  },
});

/** Cancels the scheduled reminder of an appointment, if any. */
export const cancelReminder = internalMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const appointment = await ctx.db.get(appointmentId);
    if (!appointment?.reminderJobId) return null;
    await cancelPendingJob(ctx, appointment);
    await ctx.db.patch(appointmentId, { reminderJobId: undefined });
    return null;
  },
});

/** "Recordatorio de cita". Re-checks everything, since it runs up to a day after scheduling. */
export const sendReminder = internalMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const loaded = await loadAppointment(ctx, appointmentId);
    if (!loaded) return null;
    const { appointment, org, client } = loaded;
    const due = appointment.status === "scheduled" && !appointment.reminderSentAt && appointment.start > Date.now();
    const to = recipient(client, appointment);
    if (!due || !org.reminders.email || !to) return null;

    const text = `Hola, soy ${fullName(client)}. Necesito reprogramar mi cita ${when(appointment.start)}.`;
    await queue(ctx, to, reminderEmail(appointmentInfo(loaded, text)), {
      name: org.name,
      replyTo: await ownerEmail(ctx, org),
    });
    await ctx.db.patch(appointmentId, { reminderSentAt: Date.now() });
    return null;
  },
});

/**
 * Cron: schedules reminders that were missed (e.g. the setting or the client's email
 * was added later) for scheduled appointments in the next 26 h. Scans every org,
 * which is fine while orgs are few.
 */
export const sweepReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let scheduled = 0;
    for (const org of await ctx.db.query("orgs").collect()) {
      if (!org.reminders.email) continue;
      const upcoming = await ctx.db
        .query("appointments")
        .withIndex("by_org_start", (q) => q.eq("orgId", org._id).gt("start", now).lt("start", now + 26 * HOUR))
        .collect();
      for (const appointment of upcoming) {
        if (appointment.status !== "scheduled" || appointment.reminderSentAt) continue;
        if (appointment.reminderJobId) {
          const job = await ctx.db.system.get(appointment.reminderJobId);
          if (job?.state.kind === "pending" || job?.state.kind === "inProgress") continue;
        }
        const client = await ctx.db.get(appointment.clientId);
        if (!client || !recipient(client, appointment)) continue;
        if (await scheduleFor(ctx, appointment)) scheduled++;
      }
    }
    return scheduled;
  },
});

/** "Cita confirmada" to the client, when the client has an email. */
export const sendAppointmentConfirmed = internalMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const loaded = await loadAppointment(ctx, appointmentId);
    const to = loaded && recipient(loaded.client, loaded.appointment);
    if (!loaded || !to) return null;
    const { appointment, org, client } = loaded;
    const text = `Hola, soy ${fullName(client)}. Te escribo por mi cita ${when(appointment.start)}.`;
    await queue(ctx, to, appointmentConfirmedEmail(appointmentInfo(loaded, text)), {
      name: org.name,
      replyTo: await ownerEmail(ctx, org),
    });
    return null;
  },
});

const DEFAULT_REJECT_REASON = "Solicitud rechazada";

/** "Solicitud rechazada" to the client, with the reason when the team wrote one. */
export const sendRequestRejected = internalMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const loaded = await loadAppointment(ctx, appointmentId);
    const to = loaded && recipient(loaded.client, loaded.appointment);
    if (!loaded || !to) return null;
    const { appointment, org, client, treatment } = loaded;
    const reason = appointment.cancelReason === DEFAULT_REJECT_REASON ? undefined : appointment.cancelReason;
    const email = requestRejectedEmail({
      orgName: org.name,
      clientFirstName: client.firstName,
      treatmentName: treatment.name,
      start: appointment.start,
      reason,
      bookingUrl: org.booking.enabled ? `${siteUrl}/reservar/${org.slug}` : undefined,
    });
    await queue(ctx, to, email, { name: org.name, replyTo: await ownerEmail(ctx, org) });
    return null;
  },
});

/** "Nueva solicitud de cita" to every admin and the professional of the request, one email each. */
export const notifyNewRequest = internalMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const loaded = await loadAppointment(ctx, appointmentId);
    if (!loaded) return null;
    const { appointment, org, client, treatment, member } = loaded;
    const team = await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    const recipients = new Set(
      team.filter((m) => m.active && m.email && (m.role === "admin" || m._id === member._id)).map((m) => m.email),
    );
    const email = newRequestEmail({
      orgName: org.name,
      clientName: fullName(client),
      clientPhone: client.phone,
      // The email typed in this request, which may differ from the one in the ficha.
      clientEmail: appointment.contactEmail ?? client.email ?? "",
      treatmentName: treatment.name,
      start: appointment.start,
      memberName: org.kind === "salon" ? member.name : undefined,
      url: `${siteUrl}/hoy`,
    });
    for (const to of recipients) await queue(ctx, to, email, { name: "Cosmela" });
    return null;
  },
});

/** "Indicaciones posteriores": the aftercare of a closed session, to the client. */
export const sendAftercare = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session?.aftercare) return null;
    const [org, client, treatment, appointment] = await Promise.all([
      ctx.db.get(session.orgId),
      ctx.db.get(session.clientId),
      ctx.db.get(session.treatmentId),
      ctx.db.get(session.appointmentId),
    ]);
    const to = client && recipient(client, appointment);
    if (!org || !client || !to || !treatment) return null;
    const email = aftercareEmail({
      orgName: org.name,
      clientFirstName: client.firstName,
      treatmentName: treatment.name,
      date: session.closedAt ?? session.startedAt,
      items: session.aftercare.items,
      notes: session.aftercare.notes,
      whatsappUrl: org.whatsapp
        ? whatsappLink(org.whatsapp, `Hola, soy ${fullName(client)}. Tengo una pregunta sobre mis cuidados.`)
        : undefined,
    });
    await queue(ctx, to, email, { name: org.name, replyTo: await ownerEmail(ctx, org) });
    return null;
  },
});
