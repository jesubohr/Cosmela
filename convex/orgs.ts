import { format } from "date-fns";
import { es } from "date-fns/locale";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { adminMutation, adminQuery, authedMutation, fail, getOwned, memberQuery } from "./lib/authz";
import { normalizeText } from "./lib/text";
import { inBogota } from "./lib/time";
import { vOrgKind, vScheduleRange, vStaffColor } from "./lib/validators";
import { checkPersonName, checkSchedule } from "./members";
import { insertFromTemplates, vTemplatePick } from "./templates";
import { invalid } from "./treatments";

const E164 = /^\+\d{8,15}$/;

function checkBusinessName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) invalid("Escribe el nombre de tu negocio.");
  if (trimmed.length > 80) invalid("El nombre del negocio es demasiado largo.");
  return trimmed;
}

function optionalText(value: string | undefined, max = 200): string | undefined {
  return value?.trim().slice(0, max) || undefined;
}

function optionalPhone(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!E164.test(value)) invalid("Escribe un WhatsApp de 10 dígitos.");
  return value;
}

/** "Estética Ana María" → "estetica-ana-maria". */
export function slugify(name: string): string {
  return (
    normalizeText(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "negocio"
  );
}

async function uniqueSlug(ctx: Pick<QueryCtx, "db">, name: string): Promise<string> {
  const base = slugify(name);
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const taken = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!taken) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Onboarding: creates the org, the caller as admin member, userSettings, and the chosen treatments. */
export const create = authedMutation({
  args: {
    kind: vOrgKind,
    name: v.string(),
    city: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    profile: v.object({ name: v.string(), title: v.optional(v.string()), color: vStaffColor }),
    schedule: v.array(vScheduleRange),
    treatments: v.array(vTemplatePick),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .unique();
    if (settings) {
      const current = await ctx.db
        .query("members")
        .withIndex("by_org_user", (q) => q.eq("orgId", settings.activeOrgId).eq("userId", ctx.userId))
        .unique();
      if (current?.active) fail("FORBIDDEN", "Ya tienes un negocio en Cosmela.");
    }

    const name = checkBusinessName(args.name);
    const memberName = checkPersonName(args.profile.name);
    checkSchedule(args.schedule);
    const identity = await ctx.auth.getUserIdentity();

    const orgId = await ctx.db.insert("orgs", {
      name,
      slug: await uniqueSlug(ctx, name),
      kind: args.kind,
      ownerId: ctx.userId,
      city: optionalText(args.city, 80),
      whatsapp: optionalPhone(args.whatsapp),
      booking: { enabled: true, minNoticeHours: 2, maxDaysAhead: 30, slotMinutes: 30 },
      reminders: { email: true },
    });
    await ctx.db.insert("members", {
      orgId,
      userId: ctx.userId,
      email: identity?.email?.toLowerCase() ?? "",
      role: "admin",
      name: memberName,
      title: optionalText(args.profile.title, 40),
      color: args.profile.color,
      schedule: args.schedule,
      bookable: true,
      active: true,
    });
    if (settings) await ctx.db.patch(settings._id, { activeOrgId: orgId });
    else await ctx.db.insert("userSettings", { userId: ctx.userId, activeOrgId: orgId });
    await insertFromTemplates(ctx, orgId, args.treatments);

    return orgId;
  },
});

async function ownerEmail(ctx: Pick<QueryCtx, "db">, org: Doc<"orgs">) {
  const owner = await ctx.db
    .query("members")
    .withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", org.ownerId))
    .unique();
  return owner?.email;
}

/** The active org with its effective privacy policy (the custom text or the generated default). */
export const get = memberQuery({
  args: {},
  handler: async (ctx) => {
    const org = (await ctx.db.get(ctx.orgId))!;
    const defaultPolicy = defaultPrivacyPolicy(org, await ownerEmail(ctx, org));
    return { ...org, defaultPrivacyPolicy: defaultPolicy };
  },
});

export const update = adminMutation({
  args: {
    name: v.string(),
    kind: vOrgKind,
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    legalName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    /** Omit to use the generated default text. */
    privacyPolicy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.orgId, {
      name: checkBusinessName(args.name),
      kind: args.kind,
      city: optionalText(args.city, 80),
      address: optionalText(args.address),
      whatsapp: optionalPhone(args.whatsapp),
      legalName: optionalText(args.legalName, 120),
      taxId: optionalText(args.taxId, 40),
      privacyPolicy: optionalText(args.privacyPolicy, 50_000),
    });
  },
});

export const updateBooking = adminMutation({
  args: {
    enabled: v.boolean(),
    minNoticeHours: v.number(),
    maxDaysAhead: v.number(),
    slotMinutes: v.number(),
    welcome: v.optional(v.string()),
    /** Members who accept online bookings; the rest stop accepting them. */
    bookableMemberIds: v.array(v.id("members")),
  },
  handler: async (ctx, { bookableMemberIds, ...booking }) => {
    if (!Number.isInteger(booking.minNoticeHours) || booking.minNoticeHours < 0 || booking.minNoticeHours > 168) {
      invalid("La anticipación mínima debe estar entre 0 y 168 horas.");
    }
    if (!Number.isInteger(booking.maxDaysAhead) || booking.maxDaysAhead < 1 || booking.maxDaysAhead > 365) {
      invalid("Los días a futuro deben estar entre 1 y 365.");
    }
    if (![15, 30, 60].includes(booking.slotMinutes)) invalid("Elige un intervalo de 15, 30 o 60 minutos.");
    for (const id of bookableMemberIds) await getOwned(ctx, "members", id);

    await ctx.db.patch(ctx.orgId, { booking: { ...booking, welcome: optionalText(booking.welcome, 500) } });
    const members = await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect();
    for (const member of members) {
      const bookable = bookableMemberIds.includes(member._id);
      if (member.bookable !== bookable) await ctx.db.patch(member._id, { bookable });
    }
  },
});

export const updateReminders = adminMutation({
  args: { email: v.boolean() },
  handler: async (ctx, { email }) => {
    await ctx.db.patch(ctx.orgId, { reminders: { email } });
  },
});

/** Client rows for the CSV export (Configuración → Datos). Identification and contact data only. */
export const exportClients = adminQuery({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect();
    return clients.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      documentType: c.documentType,
      documentNumber: c.documentNumber,
      birthDate: c.birthDate,
      sex: c.sex,
      phone: c.phone,
      email: c.email,
      occupation: c.occupation,
      address: c.address,
      emergencyContact: c.emergencyContact,
      createdAt: c._creationTime,
      lastVisitAt: c.lastVisitAt,
      isArchived: c.isArchived,
    }));
  },
});

function displayPhone(e164: string): string {
  const match = e164.match(/^\+57(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : e164;
}

/**
 * Default data-processing policy (Ley 1581 de 2012, Decreto 1377 de 2013) built from
 * the business data: who is responsible and how to reach them, purposes, sensitive
 * data, data subject rights, the procedure to exercise them, and the effective date.
 * Use `privacyPolicyText` to get the text that applies to an org.
 */
export function defaultPrivacyPolicy(
  org: Pick<Doc<"orgs">, "name" | "legalName" | "taxId" | "address" | "city" | "whatsapp" | "_creationTime">,
  email: string | undefined,
): string {
  const legalName = org.legalName?.trim();
  const taxId = org.taxId?.trim();
  const details = [
    taxId && `identificado con ${taxId}`,
    legalName && legalName !== org.name && `que atiende con el nombre ${org.name}`,
  ].filter(Boolean);
  const responsible = `${legalName || org.name}${details.length ? `, ${details.join(", ")},` : ""}`;
  const address = org.address?.trim();
  const city = org.city?.trim();
  const place = address ? `Dirección: ${[address, city].filter(Boolean).join(", ")}.` : city && `Ciudad: ${city}.`;
  const phone = org.whatsapp ? displayPhone(org.whatsapp) : undefined;
  const contactLines = [place, phone && `WhatsApp: ${phone}.`, email && `Correo: ${email}.`]
    .filter(Boolean)
    .join("\n");
  const channels = [phone && `por WhatsApp al ${phone}`, email && `al correo ${email}`].filter(Boolean);
  const write = channels.length ? `Escríbenos ${channels.join(" o ")}` : "Escríbenos por los canales de contacto del negocio";
  const effectiveDate = format(inBogota(org._creationTime), "d 'de' MMMM 'de' yyyy", { locale: es });

  return `Política de tratamiento de datos personales de ${org.name}

1. Responsable del tratamiento
${responsible} es responsable del tratamiento de los datos personales de sus clientes.
${contactLines}

2. Datos que recogemos
Datos de identificación y contacto (nombre, documento, fecha de nacimiento, teléfono, correo y dirección); datos de salud relacionados con los tratamientos estéticos (antecedentes, alergias, medicamentos, embarazo o lactancia, valoración de la piel y evolución); fotografías de la zona tratada; firmas; e información de citas y pagos.

3. Para qué usamos tus datos
• Agendar, confirmar y recordarte tus citas.
• Elaborar y conservar tu ficha y la historia de tus tratamientos.
• Valorar si un tratamiento es seguro para ti y registrar tu consentimiento informado.
• Hacer seguimiento a tu evolución y contactarte para tus próximas sesiones.
• Registrar pagos y saldos.
• Cumplir obligaciones legales.
Solo usaremos tus fotografías en las redes sociales del negocio si lo autorizas de forma expresa.

4. Datos sensibles
Los datos de salud, las fotografías y la firma son datos sensibles. No tienes la obligación de entregarlos ni de autorizar su tratamiento, pero sin la información de salud no podemos valorar si un tratamiento es seguro para ti. Los tratamos solo con tu autorización previa y expresa, y con medidas de seguridad reforzadas. Los datos de niñas, niños y adolescentes se tratan con la autorización de su representante legal y respetando sus derechos.

5. Tus derechos
Como titular de los datos tienes derecho a:
• Conocer, actualizar y rectificar tus datos.
• Pedir prueba de la autorización que nos diste.
• Saber cómo hemos usado tus datos.
• Presentar quejas ante la Superintendencia de Industria y Comercio.
• Revocar la autorización o pedir que eliminemos tus datos, cuando no exista un deber legal o contractual de conservarlos.
• Acceder gratis a tus datos.

6. Cómo ejercer tus derechos
${write}, con tu nombre completo, tu número de documento y tu solicitud. Respondemos las consultas en un máximo de 10 días hábiles y los reclamos en un máximo de 15 días hábiles. Si necesitamos más tiempo, te avisamos antes de que venza el plazo y te explicamos el motivo.

7. Seguridad, conservación y encargados
Guardamos tus datos en Cosmela, una plataforma tecnológica que actúa como encargada del tratamiento y los protege con acceso restringido y conexiones cifradas. Conservamos tus datos mientras seas cliente y durante el tiempo que exijan las normas aplicables. No vendemos tus datos ni los compartimos con terceros para fines comerciales.

8. Vigencia
Esta política rige desde el ${effectiveDate}, conforme a la Ley 1581 de 2012 y al Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015). Si la cambiamos de forma importante, te lo informaremos.`;
}

/** The privacy policy that applies to an org: its edited text, or the generated default. */
export async function privacyPolicyText(ctx: Pick<QueryCtx, "db">, orgId: Id<"orgs">): Promise<string> {
  const org = await ctx.db.get(orgId);
  if (!org) return "";
  return org.privacyPolicy ?? defaultPrivacyPolicy(org, await ownerEmail(ctx, org));
}
