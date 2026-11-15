import { ConvexError, v } from "convex/values";
import { TREATMENT_TEMPLATES } from "../data/treatment-templates";
import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { clientSearchText } from "./lib/text";
import { bogotaDateKey, bogotaToEpoch } from "./lib/time";
import type { ScheduleRange } from "./lib/validators";

// Demo data for the LOCAL backend only:
//   pnpm exec convex run seed:run '{"email":"delivered+ana@resend.dev"}'
// The user must have signed in once at /ingresar and must not have a business yet.

const WEEKDAYS: ScheduleRange[] = [1, 2, 3, 4, 5].flatMap((day) => [
  { day, start: "08:00", end: "12:30" },
  { day, start: "14:00", end: "18:00" },
]);
const SCHEDULE: ScheduleRange[] = [...WEEKDAYS, { day: 6, start: "08:00", end: "13:00" }];

const NO_HEALTH: Doc<"clients">["health"] = {
  conditions: [],
  allergies: [],
  skinConditions: [],
  none: { conditions: true, allergies: true, skin: true },
};
const UNKNOWN_HEALTH: Doc<"clients">["health"] = {
  conditions: [],
  allergies: [],
  skinConditions: [],
  none: { conditions: false, allergies: false, skin: false },
};

type ClientSeed = Partial<Omit<Doc<"clients">, "_id" | "_creationTime" | "orgId">> & {
  firstName: string;
  lastName: string;
  phone: string;
};

const CLIENTS: ClientSeed[] = [
  {
    firstName: "Laura",
    lastName: "Gómez",
    phone: "+573001112233",
    birthDate: "1990-11-21",
    sex: "female",
    email: "delivered+laura@resend.dev",
    documentType: "CC",
    documentNumber: "1020304050",
    health: {
      conditions: ["herpes"],
      allergies: ["medication"],
      allergiesDetail: "Penicilina",
      skinConditions: ["sensitive"],
      none: { conditions: false, allergies: false, skin: false },
    },
    habits: { dailyCleansing: true, sunscreen: "daily", exfoliants: "sometimes" },
    skin: { type: "combination", fitzpatrick: 3 },
    notes: "Prefiere música suave.",
  },
  {
    firstName: "María",
    lastName: "Rodríguez",
    phone: "+573014445566",
    birthDate: "1985-03-02",
    sex: "female",
    health: NO_HEALTH,
    habits: { dailyCleansing: true, sunscreen: "sometimes", exfoliants: "never" },
    skin: { type: "dry", fitzpatrick: 2 },
  },
  {
    firstName: "Sofía",
    lastName: "Pérez",
    phone: "+573027778899",
    birthDate: "1998-11-05",
    sex: "female",
    health: {
      conditions: [],
      allergies: ["cosmetics"],
      allergiesDetail: "Fragancias",
      skinConditions: ["rosacea"],
      none: { conditions: true, allergies: false, skin: false },
    },
    skin: { type: "sensitive", fitzpatrick: 2 },
    lastPregnancy: { pregnant: false, lactating: true, at: 0 },
  },
  { firstName: "Valentina", lastName: "Castro", phone: "+573101234567", birthDate: "2001-07-14", sex: "female", health: NO_HEALTH, skin: { type: "oily", fitzpatrick: 4 } },
  {
    firstName: "Camila",
    lastName: "Herrera",
    phone: "+573112345678",
    sex: "female",
    health: { ...UNKNOWN_HEALTH, conditions: ["diabetes", "hypertension"], none: { conditions: false, allergies: true, skin: true } },
    skin: { fitzpatrick: 5 },
  },
  { firstName: "Daniela", lastName: "Moreno", phone: "+573123456789", birthDate: "1993-11-30", health: UNKNOWN_HEALTH },
  { firstName: "Andrés", lastName: "Suárez", phone: "+573134567890", sex: "male", health: NO_HEALTH, skin: { type: "oily", fitzpatrick: 3 } },
  { firstName: "Isabella", lastName: "Ramírez", phone: "+573145678901", birthDate: "1979-01-19", sex: "female", health: { ...NO_HEALTH, conditions: ["thyroid"], none: { conditions: false, allergies: true, skin: true } } },
  { firstName: "Natalia", lastName: "Vargas", phone: "+573156789012", sex: "female", health: UNKNOWN_HEALTH },
  { firstName: "Paula", lastName: "Jiménez", phone: "+573167890123", birthDate: "1995-05-08", sex: "female", health: NO_HEALTH, skin: { type: "normal", fitzpatrick: 3 } },
  { firstName: "Juliana", lastName: "Torres", phone: "+573178901234", sex: "female", health: { ...UNKNOWN_HEALTH, allergies: ["food"], allergiesDetail: "Mariscos", none: { conditions: true, allergies: false, skin: true } } },
  { firstName: "Carolina", lastName: "Ortiz", phone: "+573189012345", birthDate: "1988-11-15", sex: "female", health: NO_HEALTH, skin: { type: "combination", fitzpatrick: 4 } },
  { firstName: "Mariana", lastName: "Ruiz", phone: "+573190123456", sex: "undisclosed", health: UNKNOWN_HEALTH },
  { firstName: "Gabriela", lastName: "Mejía", phone: "+573201112233", birthDate: "1991-09-27", sex: "female", health: NO_HEALTH, skin: { type: "dry", fitzpatrick: 6 } },
  { firstName: "Luisa", lastName: "Fernández", phone: "+573212223344", sex: "female", health: NO_HEALTH },
];

// `template` copies the consent, contraindications, aftercare, and procedure form of a library template.
const TREATMENTS = [
  { name: "Limpieza facial profunda", category: "facial", durationMin: 60, price: 90000, color: "teal", template: "limpieza-facial" },
  { name: "Peeling químico", category: "facial", durationMin: 45, price: 120000, color: "plum", template: "peeling-quimico" },
  { name: "Lifting de pestañas", category: "lashes_brows", durationMin: 60, price: 80000, color: "coral", template: "lifting-pestanas" },
  { name: "Depilación de cejas", category: "hair_removal", durationMin: 15, price: 25000, color: "olive", template: "depilacion-cera" },
] as const;

export const run = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email.toLowerCase() }],
    });
    if (!user) throw new ConvexError(`No user with email ${email}. Sign in once at /ingresar first.`);
    const userId: string = user._id;
    const existing = await ctx.db.query("userSettings").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (existing) throw new ConvexError(`${email} already has a business.`);

    const orgId = await ctx.db.insert("orgs", {
      name: "Estética Alba",
      slug: `estetica-alba-${Math.random().toString(36).slice(2, 6)}`,
      kind: "salon",
      ownerId: userId,
      city: "Medellín",
      whatsapp: "+573000000000",
      booking: { enabled: true, minNoticeHours: 2, maxDaysAhead: 30, slotMinutes: 30 },
      reminders: { email: true },
    });
    const adminId = await ctx.db.insert("members", {
      orgId,
      userId,
      email: email.toLowerCase(),
      role: "admin",
      name: "Ana Restrepo",
      title: "Cosmetóloga",
      color: "plum",
      schedule: SCHEDULE,
      bookable: true,
      active: true,
    });
    const staffId = await ctx.db.insert("members", {
      orgId,
      userId: `seed-staff-${orgId}`,
      email: "delivered+sara@resend.dev",
      role: "staff",
      name: "Sara López",
      title: "Esteticista",
      color: "teal",
      schedule: WEEKDAYS.map((range) => ({ ...range, start: range.start === "08:00" ? "09:00" : range.start })),
      bookable: true,
      active: true,
    });
    await ctx.db.insert("userSettings", { userId, activeOrgId: orgId });

    const treatmentIds: Id<"treatments">[] = [];
    for (const { template: key, ...treatment } of TREATMENTS) {
      const template = TREATMENT_TEMPLATES.find((t) => t.key === key)!;
      treatmentIds.push(
        await ctx.db.insert("treatments", {
          orgId,
          ...treatment,
          active: true,
          bookableOnline: true,
          templateKey: key,
          consentText: template.consentText,
          contraindications: template.contraindications,
          aftercare: template.aftercare,
          followUpDays: template.followUpDays,
          suggestedSessions: template.suggestedSessions,
          formFields: template.formFields,
        }),
      );
    }

    const now = Date.now();
    const clientIds: Id<"clients">[] = [];
    for (const [index, client] of CLIENTS.entries()) {
      clientIds.push(
        await ctx.db.insert("clients", {
          orgId,
          ...client,
          health: client.health ?? UNKNOWN_HEALTH,
          habits: client.habits ?? {},
          skin: client.skin ?? {},
          searchText: clientSearchText(client),
          birthdayKey: client.birthDate?.slice(5),
          lastPregnancy: client.lastPregnancy ? { ...client.lastPregnancy, at: now } : undefined,
          fichaCompletedAt: client.health && client.health !== UNKNOWN_HEALTH ? now : undefined,
          lastVisitAt: index % 3 === 0 ? now - (index + 2) * 86_400_000 : undefined,
          createdBy: adminId,
          isArchived: false,
        }),
      );
    }

    // This week, Monday to Saturday (Bogotá).
    const today = bogotaDateKey(now);
    const [y, m, d] = today.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const dayKey = (offset: number) =>
      new Date(Date.UTC(y, m - 1, d - ((weekday + 6) % 7) + offset)).toISOString().slice(0, 10);

    type Plan = [day: number, time: string, client: number, treatment: number, member: Id<"members">, status: Doc<"appointments">["status"], paid?: number];
    const plans: Plan[] = [
      [0, "08:00", 0, 1, adminId, "completed", 120000],
      [0, "10:00", 1, 0, adminId, "completed", 40000],
      [0, "09:00", 3, 2, staffId, "completed"],
      [1, "09:00", 2, 0, adminId, "no_show"],
      [1, "11:00", 4, 3, adminId, "completed", 25000],
      [1, "14:30", 5, 2, staffId, "cancelled"],
      [2, "08:30", 6, 0, adminId, "completed"],
      [2, "15:00", 7, 1, staffId, "scheduled", 50000],
      [3, "10:00", 8, 2, adminId, "scheduled"],
      [3, "10:30", 9, 0, staffId, "scheduled"],
      [3, "16:00", 10, 3, adminId, "requested"],
      [4, "08:00", 11, 1, adminId, "scheduled", 60000],
      [4, "09:30", 12, 0, staffId, "requested"],
      [4, "14:00", 13, 2, adminId, "scheduled"],
      [5, "09:00", 14, 0, adminId, "scheduled"],
      [5, "10:30", 0, 3, staffId, "scheduled"],
    ];
    for (const [day, time, client, treatment, memberId, status, paid] of plans) {
      const start = bogotaToEpoch(dayKey(day), time);
      const t = TREATMENTS[treatment];
      const appointmentId = await ctx.db.insert("appointments", {
        orgId,
        clientId: clientIds[client],
        memberId,
        treatmentId: treatmentIds[treatment],
        start,
        end: start + t.durationMin * 60_000,
        status,
        source: status === "requested" ? "online" : "staff",
        price: t.price,
        paidTotal: paid ?? 0,
        cancelReason: status === "cancelled" ? "La clienta tuvo un viaje." : undefined,
        createdBy: adminId,
      });
      if (paid) {
        await ctx.db.insert("payments", {
          orgId,
          appointmentId,
          clientId: clientIds[client],
          amount: paid,
          method: paid === 40000 ? "nequi" : "cash",
          paidAt: status === "completed" ? start + 3_600_000 : start - 2 * 86_400_000,
          recordedBy: adminId,
        });
      }
    }

    for (const day of [0, 1, 2, 3, 4]) {
      await ctx.db.insert("timeBlocks", {
        orgId,
        memberId: adminId,
        start: bogotaToEpoch(dayKey(day), "12:30"),
        end: bogotaToEpoch(dayKey(day), "14:00"),
        allDay: false,
        kind: "personal",
        title: "Almuerzo",
      });
    }
    await ctx.db.insert("timeBlocks", {
      orgId,
      memberId: staffId,
      start: bogotaToEpoch(dayKey(2), "08:00"),
      end: bogotaToEpoch(dayKey(2), "11:00"),
      allDay: false,
      kind: "professional",
      title: "Capacitación",
    });

    return { orgId, clients: clientIds.length, appointments: plans.length };
  },
});
