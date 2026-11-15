import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { r2 } from "./files";
import { freeSlots, rangesForDate, type Interval } from "./lib/slots";
import { clientSearchText } from "./lib/text";
import { addDaysToDateKey, bogotaDateKey, bogotaToEpoch } from "./lib/time";
import type { AppointmentStatus } from "./lib/validators";
import { privacyPolicyText } from "./orgs";

// Public functions for /reservar/[slug]. No sign-in: they take the business slug
// and return only public fields (never health data, never other clients).

const DAY = 24 * 60 * 60_000;
const ACTIVE: AppointmentStatus[] = ["requested", "scheduled", "in_progress"];
const MAX_OPEN_REQUESTS = 2;
const LOGO_URL_TTL_SECONDS = 60 * 60;
const PHONE = /^\+57\d{10}$|^\+(?!57)\d{8,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}

function clean(value: string | undefined, max: number) {
  return value?.trim().slice(0, max) || undefined;
}

async function orgBySlug(ctx: QueryCtx, slug: string) {
  return await ctx.db
    .query("orgs")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

async function bookableTreatment(ctx: QueryCtx, org: Doc<"orgs">, treatmentId: Id<"treatments">) {
  const treatment = await ctx.db.get(treatmentId);
  return treatment?.orgId === org._id && treatment.active && treatment.bookableOnline ? treatment : null;
}

/** Members who take online bookings, oldest first; only `memberId` when given. */
async function bookableMembers(ctx: QueryCtx, org: Doc<"orgs">, memberId?: Id<"members">) {
  const members = await ctx.db
    .query("members")
    .withIndex("by_org", (q) => q.eq("orgId", org._id))
    .collect();
  return members.filter((m) => m.active && m.bookable && (!memberId || m._id === memberId));
}

/** Active appointments and blocks of a member that start in `(from, to)`. */
async function busyIntervals(ctx: QueryCtx, memberId: Id<"members">, from: number, to: number): Promise<Interval[]> {
  const [appointments, blocks] = await Promise.all([
    ctx.db
      .query("appointments")
      .withIndex("by_member_start", (q) => q.eq("memberId", memberId).gt("start", from).lt("start", to))
      .collect(),
    ctx.db
      .query("timeBlocks")
      .withIndex("by_member_start", (q) => q.eq("memberId", memberId).gt("start", from).lt("start", to))
      .collect(),
  ]);
  return [...appointments.filter((a) => ACTIVE.includes(a.status)), ...blocks].map(({ start, end }) => ({ start, end }));
}

function memberSlots(org: Doc<"orgs">, treatment: Doc<"treatments">, member: Doc<"members">, date: string, busy: Interval[], now: number) {
  return freeSlots({
    date,
    ranges: rangesForDate(member.schedule, date),
    busy,
    durationMin: treatment.durationMin,
    stepMin: org.booking.slotMinutes,
    minNoticeMin: org.booking.minNoticeHours * 60,
    now,
  });
}

async function logoUrl(org: Doc<"orgs">) {
  if (!org.logoKey) return null;
  try {
    return await r2.getUrl(org.logoKey, { expiresIn: LOGO_URL_TTL_SECONDS });
  } catch {
    return null;
  }
}

/** The business header, bookable treatments, and bookable professionals. Null for an unknown slug. */
export const page = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const org = await orgBySlug(ctx, slug);
    if (!org) return null;
    const enabled = org.booking.enabled;
    const [treatments, members] = enabled
      ? await Promise.all([
          ctx.db
            .query("treatments")
            .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
            .collect(),
          bookableMembers(ctx, org),
        ])
      : [[], []];
    return {
      name: org.name,
      city: org.city,
      // Already public: the business's privacy policy shows it as its contact channel.
      whatsapp: org.whatsapp,
      logoUrl: await logoUrl(org),
      enabled,
      welcome: enabled ? org.booking.welcome : undefined,
      treatments: treatments
        .filter((t) => t.bookableOnline)
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((t) => ({ _id: t._id, name: t.name, description: t.description, durationMin: t.durationMin, price: t.price })),
      members: members.map((m) => ({ _id: m._id, name: m.name, color: m.color })),
    };
  },
});

/**
 * Days with free times for a treatment, from today to `maxDaysAhead`, as
 * `{ date: "YYYY-MM-DD", slots: epoch ms[] }`. Without `memberId`, the union over
 * every bookable professional ("Cualquiera disponible").
 */
export const availability = query({
  args: { slug: v.string(), treatmentId: v.id("treatments"), memberId: v.optional(v.id("members")) },
  handler: async (ctx, { slug, treatmentId, memberId }) => {
    const org = await orgBySlug(ctx, slug);
    if (!org?.booking.enabled) return [];
    const treatment = await bookableTreatment(ctx, org, treatmentId);
    if (!treatment) return [];

    const now = Date.now();
    const today = bogotaDateKey(now);
    const dates = Array.from({ length: org.booking.maxDaysAhead + 1 }, (_, i) => addDaysToDateKey(today, i));
    const from = bogotaToEpoch(today) - DAY;
    const to = bogotaToEpoch(dates[dates.length - 1]) + 2 * DAY;
    const members = await bookableMembers(ctx, org, memberId);
    const busy = await Promise.all(members.map((m) => busyIntervals(ctx, m._id, from, to)));

    const days = [];
    for (const date of dates) {
      const slots = new Set<number>();
      members.forEach((member, i) => {
        for (const start of memberSlots(org, treatment, member, date, busy[i], now)) slots.add(start);
      });
      if (slots.size > 0) days.push({ date, slots: [...slots].sort((a, b) => a - b) });
    }
    return days;
  },
});

/** The business's data-processing policy for /reservar/[slug]/privacidad. */
export const privacy = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const org = await orgBySlug(ctx, slug);
    if (!org) return null;
    return { name: org.name, policy: await privacyPolicyText(ctx, org._id) };
  },
});

/**
 * "Enviar solicitud": re-checks the time against current availability, finds the
 * client by phone (or creates one), and creates a `requested` online appointment.
 * Without `memberId`, the first free professional takes it.
 */
export const create = mutation({
  args: {
    slug: v.string(),
    treatmentId: v.id("treatments"),
    memberId: v.optional(v.id("members")),
    start: v.number(),
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
    email: v.string(),
    note: v.optional(v.string()),
    authorized: v.boolean(),
  },
  handler: async (ctx, args) => {
    const org = await orgBySlug(ctx, args.slug);
    if (!org?.booking.enabled) invalid("Este negocio no está recibiendo reservas en línea en este momento.");
    const firstName = clean(args.firstName, 60);
    const lastName = clean(args.lastName, 80) ?? "";
    const email = args.email.trim().toLowerCase();
    if (!firstName) invalid("Escribe tu nombre.");
    if (!PHONE.test(args.phone)) invalid("Escribe un WhatsApp de 10 dígitos.");
    if (!EMAIL.test(email)) invalid("Escribe un correo válido, como nombre@correo.com.");
    if (!args.authorized) invalid("Para enviar la solicitud, autoriza el tratamiento de tus datos.");

    const treatment = await bookableTreatment(ctx, org, args.treatmentId);
    if (!treatment) invalid("Este tratamiento ya no está disponible. Elige otro.");

    const now = Date.now();
    const date = bogotaDateKey(args.start);
    let member: Doc<"members"> | undefined;
    if (date <= addDaysToDateKey(bogotaDateKey(now), org.booking.maxDaysAhead)) {
      const dayStart = bogotaToEpoch(date);
      for (const candidate of await bookableMembers(ctx, org, args.memberId)) {
        const busy = await busyIntervals(ctx, candidate._id, dayStart - DAY, dayStart + DAY);
        if (memberSlots(org, treatment, candidate, date, busy, now).includes(args.start)) {
          member = candidate;
          break;
        }
      }
    }
    if (!member) throw new ConvexError({ code: "SLOT_TAKEN", message: "Este horario ya no está disponible. Elige otro." });

    const existing = await ctx.db
      .query("clients")
      .withIndex("by_org_phone", (q) => q.eq("orgId", org._id).eq("phone", args.phone))
      .first();
    if (existing) {
      const upcoming = await ctx.db
        .query("appointments")
        .withIndex("by_client", (q) => q.eq("clientId", existing._id).gt("start", now))
        .collect();
      if (upcoming.filter((a) => a.status === "requested").length >= MAX_OPEN_REQUESTS) {
        invalid(`Ya tienes ${MAX_OPEN_REQUESTS} solicitudes pendientes en ${org.name}. Espera a que te confirmen o escríbeles por WhatsApp.`);
      }
    }

    const authorization = { at: now, method: "online_checkbox" as const, policyText: await privacyPolicyText(ctx, org._id) };
    let clientId: Id<"clients">;
    if (existing) {
      clientId = existing._id;
      // The business's data stays as it is; only missing pieces are filled in.
      await ctx.db.patch(clientId, {
        ...(existing.email ? {} : { email }),
        ...(existing.dataAuthorization ? {} : { dataAuthorization: authorization }),
      });
    } else {
      clientId = await ctx.db.insert("clients", {
        orgId: org._id,
        firstName,
        lastName,
        searchText: clientSearchText({ firstName, lastName, phone: args.phone }),
        phone: args.phone,
        email,
        health: { conditions: [], allergies: [], skinConditions: [], none: { conditions: false, allergies: false, skin: false } },
        habits: {},
        skin: {},
        dataAuthorization: authorization,
        // Online clients have no author; the professional who takes the request stands in.
        createdBy: member._id,
        isArchived: false,
      });
    }

    const appointmentId = await ctx.db.insert("appointments", {
      orgId: org._id,
      clientId,
      memberId: member._id,
      treatmentId: treatment._id,
      start: args.start,
      end: args.start + treatment.durationMin * 60_000,
      status: "requested",
      source: "online",
      price: treatment.price,
      paidTotal: 0,
      notes: clean(args.note, 500),
    });
    await ctx.runMutation(internal.notifications.notifyNewRequest, { appointmentId });
    return { memberName: member.name };
  },
});
