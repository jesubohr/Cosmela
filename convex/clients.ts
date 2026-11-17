import { paginationOptsValidator } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getOwned, memberMutation, memberQuery } from "./lib/authz";
import { hasPurpose, recordAuthorization, requirePurpose } from "./lib/clientAuthorization";
import { requireOrgLegalReady } from "./lib/orgLegal";
import { isMinor } from "./lib/consent";
import { clientSearchText, normalizeText } from "./lib/text";
import { bogotaDateKey } from "./lib/time";
import { vClientHabits, vClientHealth, vClientSkin, vDocumentType, vSex } from "./lib/validators";
import { acceptedPolicyText } from "./orgs";
import { owesBalance } from "./payments";

/** Every editable permanent field of the ficha (PRODUCT §3.1). Empty strings mean "not set". */
export const vClientInput = v.object({
  firstName: v.string(),
  lastName: v.string(),
  phone: v.string(),
  documentType: v.optional(vDocumentType),
  documentNumber: v.optional(v.string()),
  birthDate: v.optional(v.string()),
  sex: v.optional(vSex),
  email: v.optional(v.string()),
  occupation: v.optional(v.string()),
  address: v.optional(v.string()),
  emergencyContact: v.optional(v.object({ name: v.string(), phone: v.string() })),
  // Omitted on quick create; the ficha is completed later.
  health: v.optional(vClientHealth),
  habits: v.optional(vClientHabits),
  skin: v.optional(vClientSkin),
  notes: v.optional(v.string()),
});
export type ClientInput = Infer<typeof vClientInput>;

const EMPTY_HEALTH: Doc<"clients">["health"] = {
  conditions: [],
  allergies: [],
  skinConditions: [],
  none: { conditions: false, allergies: false, skin: false },
};

/** Throws a ConvexError whose Spanish `message` the UI shows as is. */
function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const PHONE = /^\+57\d{10}$|^\+(?!57)\d{8,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Trims, validates, and maps the input to client fields (undefined clears a field on patch). */
function normalize(input: ClientInput) {
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName) ?? "";
  if (!firstName) invalid("Escribe el nombre del cliente.");
  if (!PHONE.test(input.phone)) invalid("Escribe un teléfono de 10 dígitos.");
  const email = clean(input.email)?.toLowerCase();
  if (email && !EMAIL.test(email)) invalid("Escribe un correo válido, como nombre@correo.com.");
  const birthDate = clean(input.birthDate);
  if (birthDate && (!DATE.test(birthDate) || Number.isNaN(Date.parse(birthDate)) || new Date(`${birthDate}T00:00:00Z`).toISOString().slice(0, 10) !== birthDate || birthDate > bogotaDateKey(Date.now()) || isMinor(birthDate))) {
    invalid("Revisa la fecha de nacimiento.");
  }
  const emergencyName = clean(input.emergencyContact?.name);
  const emergencyPhone = clean(input.emergencyContact?.phone);
  if (emergencyPhone && !PHONE.test(emergencyPhone)) invalid("Revisa el teléfono del contacto de emergencia.");
  const documentNumber = clean(input.documentNumber);
  if (documentNumber && input.documentType === "TI") invalid("Solo se pueden registrar personas mayores de edad.");

  return {
    firstName,
    lastName,
    phone: input.phone,
    searchText: clientSearchText({ firstName, lastName, phone: input.phone, documentNumber }),
    documentType: documentNumber ? input.documentType : undefined,
    documentNumber,
    birthDate,
    birthdayKey: birthDate?.slice(5),
    sex: input.sex,
    email,
    occupation: clean(input.occupation),
    address: clean(input.address),
    emergencyContact: emergencyName || emergencyPhone ? { name: emergencyName ?? "", phone: emergencyPhone ?? "" } : undefined,
    notes: clean(input.notes),
  };
}

async function assertPhoneFree(ctx: QueryCtx & { orgId: Id<"orgs"> }, phone: string, exceptId?: Id<"clients">) {
  const existing = await ctx.db
    .query("clients")
    .withIndex("by_org_phone", (q) => q.eq("orgId", ctx.orgId).eq("phone", phone))
    .first();
  if (existing && existing._id !== exceptId) {
    const name = `${existing.firstName} ${existing.lastName}`.trim();
    throw new ConvexError({
      code: "DUPLICATE_PHONE",
      message: existing.isArchived
        ? `Este teléfono ya pertenece a ${name}, que está archivado. Abre su ficha para restaurarlo o usa otro número.`
        : `Este teléfono ya pertenece a ${name}. Abre su ficha o usa otro número.`,
      clientId: existing._id,
      clientName: name,
    });
  }
}

/** Health fields of the client doc, plus clean-up of free text. */
function healthFields(input: ClientInput) {
  if (!input.health) return {};
  const health = input.health;
  return {
    health: {
      ...health,
      conditionsOther: clean(health.conditionsOther),
      allergiesDetail: clean(health.allergiesDetail),
      skinConditionsOther: clean(health.skinConditionsOther),
      dermNotes: clean(health.dermNotes),
    },
    habits: input.habits ? { ...input.habits, previousTreatments: clean(input.habits.previousTreatments) } : {},
    skin: input.skin ?? {},
  };
}

/** Creates the basic record and its authorization together; health comes later. */
export const create = memberMutation({
  args: { client: vClientInput, adult: v.optional(v.boolean()), evidence: v.optional(v.string()), policyHash: v.optional(v.string()), requestKey: v.optional(v.string()) },
  handler: async (ctx, { client, adult, evidence, policyHash, requestKey }) => {
    requireOrgLegalReady((await ctx.db.get(ctx.orgId))!);
    if (!adult || !evidence || evidence.trim().length < 5 || evidence.length > 500 || !policyHash || !requestKey || requestKey.length > 100) invalid("Registra la mayoría de edad y la evidencia de autorización del cliente.");
    const fields = normalize(client);
    await assertPhoneFree(ctx, fields.phone);
    if (client.health || client.habits || client.skin || client.notes) invalid("Registra primero la autorización para datos de salud.");
    const clientId = await ctx.db.insert("clients", {
      orgId: ctx.orgId,
      ...fields,
      health: EMPTY_HEALTH,
      habits: {},
      skin: {},
      createdBy: ctx.member._id,
      isArchived: false,
    });
    await recordAuthorization(ctx, { orgId: ctx.orgId, clientId, purpose: "basic", action: "accepted", method: "external_evidence", evidence: evidence.trim(), recordedBy: ctx.member._id, requestKey, policyHash, adult });
    return clientId;
  },
});

/** Saves the ficha. Fields left empty are cleared; health stays as is when omitted. */
export const update = memberMutation({
  args: { clientId: v.id("clients"), client: vClientInput },
  handler: async (ctx, { clientId, client }) => {
    const existing = await getOwned(ctx, "clients", clientId);
    if (client.health || client.habits || client.skin || client.notes) await requirePurpose(ctx, ctx.orgId, clientId, "health");
    const fields = normalize(client);
    if (fields.phone !== existing.phone) await assertPhoneFree(ctx, fields.phone, clientId);
    const now = Date.now();
    await ctx.db.patch(clientId, {
      ...fields,
      ...healthFields(client),
      ...(client.health ? { healthReviewedAt: now, fichaCompletedAt: existing.fichaCompletedAt ?? now } : {}),
    });
  },
});

export const archive = memberMutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await getOwned(ctx, "clients", clientId);
    await ctx.db.patch(clientId, { isArchived: true, archivedAt: Date.now() });
  },
});

export const restore = memberMutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await getOwned(ctx, "clients", clientId);
    await ctx.db.patch(clientId, { isArchived: false, archivedAt: undefined });
  },
});

/** One row of the clients list. Alert fields feed `getClientAlerts` for the alert dot. */
function toRow(client: Doc<"clients">, allowed: boolean) {
  return {
    _id: client._id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    birthDate: client.birthDate,
    lastVisitAt: client.lastVisitAt,
    health: allowed ? client.health : EMPTY_HEALTH,
    sex: client.sex,
    lastPregnancy: allowed ? client.lastPregnancy : undefined,
  };
}
export type ClientRow = ReturnType<typeof toRow>;

/** "300 123" → "300123": phone digits are one token in `searchText`. */
function searchTerm(search: string) {
  const term = normalizeText(search);
  if (/^[\d\s+()-]+$/.test(term)) return term.replace(/\D/g, "").replace(/^57(?=\d{10})/, "");
  return term;
}

/**
 * Active clients, A–Z, or by relevance when searching (name, phone, document).
 * `birthdayMonth` ("MM") lists birthdays of that month by day instead.
 */
export const list = memberQuery({
  args: {
    search: v.optional(v.string()),
    birthdayMonth: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { search, birthdayMonth, paginationOpts }) => {
    const term = search ? searchTerm(search) : "";
    let page;
    if (term) {
      page = await ctx.db
        .query("clients")
        .withSearchIndex("search_text", (q) =>
          q.search("searchText", term).eq("orgId", ctx.orgId).eq("isArchived", false),
        )
        .paginate(paginationOpts);
    } else if (birthdayMonth) {
      page = await ctx.db
        .query("clients")
        .withIndex("by_org_birthday", (q) =>
          q.eq("orgId", ctx.orgId).gte("birthdayKey", `${birthdayMonth}-01`).lte("birthdayKey", `${birthdayMonth}-31`),
        )
        .filter((q) => q.eq(q.field("isArchived"), false))
        .paginate(paginationOpts);
    } else {
      page = await ctx.db
        .query("clients")
        .withIndex("by_org_archived_name", (q) => q.eq("orgId", ctx.orgId).eq("isArchived", false))
        .paginate(paginationOpts);
    }
    return { ...page, page: await Promise.all(page.page.map(async client => toRow(client, await hasPurpose(ctx, ctx.orgId, client._id, "health")))) };
  },
});

/** Completed appointments that still owe money, grouped by client. */
async function balancesByClient(ctx: QueryCtx & { orgId: Id<"orgs"> }) {
  const owing = await ctx.db
    .query("appointments")
    .withIndex("by_org_balance", (q) => q.eq("orgId", ctx.orgId).eq("hasBalance", true))
    .collect();
  const balances = new Map<Id<"clients">, number>();
  for (const appointment of owing) {
    balances.set(appointment.clientId, (balances.get(appointment.clientId) ?? 0) + appointment.price - appointment.paidTotal);
  }
  return balances;
}

/** "Con saldo pendiente": active clients who owe money, A–Z, with their balance. */
export const listWithBalance = memberQuery({
  args: {},
  handler: async (ctx) => {
    const balances = await balancesByClient(ctx);
    const rows = [];
    for (const [clientId, balance] of balances) {
      const client = await ctx.db.get(clientId);
      if (client && !client.isArchived) rows.push({ ...toRow(client, await hasPurpose(ctx, ctx.orgId, client._id, "health")), balance });
    }
    return rows.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "es"));
  },
});

/** Client picker: best matches for `search`, or the most recently created clients. */
export const pick = memberQuery({
  args: { search: v.string() },
  handler: async (ctx, { search }) => {
    const term = searchTerm(search);
    const clients = term
      ? await ctx.db
          .query("clients")
          .withSearchIndex("search_text", (q) =>
            q.search("searchText", term).eq("orgId", ctx.orgId).eq("isArchived", false),
          )
          .take(8)
      : (await ctx.db.query("clients").withIndex("by_org", (q) => q.eq("orgId", ctx.orgId)).order("desc").take(20))
          .filter((client) => !client.isArchived)
          .slice(0, 5);
    return clients.map((client) => ({
      _id: client._id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
    }));
  },
});

/** The whole client record (the ficha), with the text of the policy the client accepted. */
export const get = memberQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await getOwned(ctx, "clients", clientId);
    let allowed = true;
    try { await requirePurpose(ctx, ctx.orgId, clientId, "health"); } catch { allowed = false; }
    const safeClient = allowed ? client : { ...client, health: EMPTY_HEALTH, habits: {}, skin: {}, notes: undefined, lastMedications: undefined, lastPregnancy: undefined };
    const authorization = client.dataAuthorization;
    if (!authorization) return safeClient;
    return { ...safeClient, dataAuthorization: { ...authorization, policyText: await acceptedPolicyText(ctx, authorization) } };
  },
});
export type ClientDoc = Doc<"clients">;

/** Resumen tab: next appointment, open cases, and balance owed. */
export const summary = memberQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await getOwned(ctx, "clients", clientId);
    const now = Date.now();
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();

    const upcoming = appointments
      .filter((a) => a.end >= now && (a.status === "scheduled" || a.status === "requested" || a.status === "in_progress"))
      .sort((a, b) => a.start - b.start)[0];
    const balance = appointments.filter(owesBalance).reduce((sum, a) => sum + a.price - a.paidTotal, 0);
    // Abonos for appointments not attended (yet): upcoming, postponed, cancelled, or missed.
    const credit = appointments.filter((a) => a.status !== "completed").reduce((sum, a) => sum + a.paidTotal, 0);

    const healthAllowed = await hasPurpose(ctx, ctx.orgId, clientId, "health");
    const cases = (await ctx.db.query("cases").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect()).filter(
      (c) => c.status === "open",
    );

    return {
      nextAppointment: upcoming ? await describeAppointment(ctx, upcoming) : null,
      openCases: await Promise.all(
        (healthAllowed ? cases : []).map(async (c) => ({
          _id: c._id,
          treatmentName: (await ctx.db.get(c.treatmentId))?.name ?? "",
          reasons: c.reasons,
          reasonOther: c.reasonOther,
          sessionCount: c.sessionCount,
          plannedSessions: c.plannedSessions,
          lastSessionAt: c.lastSessionAt,
        })),
      ),
      balance,
      credit,
    };
  },
});

async function describeAppointment(ctx: QueryCtx, appointment: Doc<"appointments">) {
  const [treatment, member] = await Promise.all([ctx.db.get(appointment.treatmentId), ctx.db.get(appointment.memberId)]);
  return {
    _id: appointment._id,
    start: appointment.start,
    end: appointment.end,
    status: appointment.status,
    treatmentName: treatment?.name ?? "",
    memberName: member?.name ?? "",
  };
}

/** Adult-only quarantine inventory for administrators. Historical records remain untouched. */
export const legacyMinors = memberQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.member.role !== "admin") return [];
    const clients = await ctx.db.query("clients").withIndex("by_org", q => q.eq("orgId", ctx.orgId)).collect();
    return clients.filter(client => client.documentType === "TI" || isMinor(client.birthDate)).map(client => ({ _id: client._id, name: `${client.firstName} ${client.lastName}`.trim() }));
  },
});
