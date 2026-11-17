import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { at, errorCode, errorMessage, setupOrgs } from "./lib/fixtures.testing";

// Sunday noon in Bogotá: the members work Monday to Saturday, 08:00–18:00.
const NOW = at("12:00", "2030-01-06");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

async function setup() {
  const s = await setupOrgs();
  await s.t.run(async (ctx) => {
    const org = (await ctx.db.get(s.ids.orgA))!;
    await ctx.db.patch(s.ids.orgA, { booking: { ...org.booking, enabled: true }, city: "Medellín", legalName: "Alba SAS", taxId: "123", address: "Calle 1", whatsapp: "+573001234567" });
    await ctx.db.patch(s.ids.clientA, {
      health: { conditions: ["herpes"], allergies: ["medication"], allergiesDetail: "Penicilina", skinConditions: [], none: { conditions: false, allergies: false, skin: false } },
    });
  });
  const bookingPage = (await s.t.query(api.booking.page, { slug: "alba" }))!;
  const request = (extra: Partial<{ start: number; phone: string; memberId: Id<"members">; firstName: string; authorized: boolean; adult: boolean; policyHash: string; requestKey: string; slug: string; website: string }> = {}) =>
    s.t.mutation(api.booking.create, {
      slug: "alba",
      treatmentId: s.ids.treatmentA,
      start: at("09:00"),
      firstName: "Valentina",
      lastName: "Ríos",
      phone: "+573110000000",
      email: "Vale@Example.com",
      authorized: true, adult: true, policyHash: bookingPage.policyHash, requestKey: crypto.randomUUID(),
      ...extra,
    });
  const deliveries = () =>
    s.t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect())
        .filter((job) => job.name.includes("deliver"))
        .map((job) => job.args[0] as { to: string; subject: string; html: string }),
    );
  return { ...s, request, deliveries };
}

describe("booking page", () => {
  test("returns only public fields", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("treatments", {
        orgId: ids.orgA,
        name: "Solo en el salón",
        category: "facial",
        durationMin: 30,
        price: 50000,
        color: "plum",
        active: true,
        bookableOnline: false,
        consentText: "",
        contraindications: [],
        aftercare: [],
        formFields: [],
      });
      await ctx.db.patch(ids.sofi, { bookable: false });
    });

    const page = await t.query(api.booking.page, { slug: "alba" });
    expect(page).toEqual({
      name: "Alba",
      bookingLabel: expect.any(String),
      bookingNotice: expect.any(String),
      policyHash: expect.any(String),
      city: "Medellín",
      whatsapp: "+573001234567",
      hasLogo: false,
      enabled: true,
      welcome: undefined,
      treatments: [{ _id: ids.treatmentA, name: "Limpieza facial", description: undefined, durationMin: 60, price: 100000 }],
      members: [{ _id: ids.ana, name: "ana", color: "plum" }],
    });
    const json = JSON.stringify(page);
    for (const secret of ["Penicilina", "example.com", "consentText", "schedule"]) {
      expect(json).not.toContain(secret);
    }
    expect(await t.query(api.booking.page, { slug: "nadie" })).toBeNull();
  });

  test("a disabled business shows no treatments or times", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      const org = (await ctx.db.get(ids.orgA))!;
      await ctx.db.patch(ids.orgA, { booking: { ...org.booking, enabled: false } });
    });
    expect(await t.query(api.booking.page, { slug: "alba" })).toMatchObject({ enabled: false, treatments: [], members: [] });
    expect(await t.query(api.booking.availability, { slug: "alba", treatmentId: ids.treatmentA })).toEqual({ days: [], nextFrom: null });
  });

  test("the privacy page shows the business policy", async () => {
    const { t } = await setup();
    const privacy = await t.query(api.booking.privacy, { slug: "alba" });
    expect(privacy?.name).toBe("Alba");
    expect(privacy?.policy).toContain("Política de tratamiento de datos personales de Alba");
  });
});

describe("availability", () => {
  test("lists days with free times up to maxDaysAhead", async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      const org = (await ctx.db.get(ids.orgA))!;
      await ctx.db.patch(ids.orgA, { booking: { ...org.booking, maxDaysAhead: 3 } });
    });
    const { days } = await t.query(api.booking.availability, { slug: "alba", treatmentId: ids.treatmentA });
    // Sunday has no schedule; Monday to Wednesday are within 3 days.
    expect(days.map((d) => d.date)).toEqual(["2030-01-07", "2030-01-08", "2030-01-09"]);
    expect(days[0].slots[0]).toBe(at("08:00"));
    expect(days[0].slots.at(-1)).toBe(at("17:00"));
  });

  test("'Cualquiera disponible' is the union of the professionals' times", async () => {
    const { t, ids, asAna } = await setup();
    await asAna.mutation(api.appointments.create, {
      clientId: ids.clientA,
      treatmentId: ids.treatmentA,
      memberId: ids.ana,
      start: at("08:00"),
      durationMin: 60,
      price: 100000,
    });
    const { days: anyone } = await t.query(api.booking.availability, { slug: "alba", treatmentId: ids.treatmentA });
    const { days: ana } = await t.query(api.booking.availability, { slug: "alba", treatmentId: ids.treatmentA, memberId: ids.ana });
    expect(anyone[0].slots).toContain(at("08:00"));
    expect(ana[0].slots).not.toContain(at("08:00"));
    expect(ana[0].slots).not.toContain(at("08:30"));
    expect(ana[0].slots).toContain(at("09:00"));
  });

  test("respects the minimum notice", async () => {
    const { t, ids } = await setup();
    vi.setSystemTime(at("09:10"));
    const { days } = await t.query(api.booking.availability, { slug: "alba", treatmentId: ids.treatmentA });
    // 2 h notice from 09:10 → 11:30 is the first 30-minute step.
    expect(days[0].slots[0]).toBe(at("11:30"));
  });

  test("returns one window of 14 days at a time, up to maxDaysAhead", async () => {
    const { t, ids } = await setup();
    const query = (from?: string) => t.query(api.booking.availability, { slug: "alba", treatmentId: ids.treatmentA, from });
    const first = await query();
    // Today (Sunday Jan 6) through Saturday Jan 19: 14 days, 12 of them working days.
    expect(first.days).toHaveLength(12);
    expect(first.nextFrom).toBe("2030-01-20");
    const second = await query(first.nextFrom!);
    expect(second.days[0].date).toBe("2030-01-21");
    // maxDaysAhead is 30, so the third window ends on Feb 5.
    const third = await query(second.nextFrom!);
    expect(third.days.at(-1)?.date).toBe("2030-02-05");
    expect(third.nextFrom).toBeNull();
    // A start in the past reads as today; beyond the horizon there is nothing.
    expect((await query("2020-01-01")).nextFrom).toBe("2030-01-20");
    expect((await query("2030-03-01")).days).toEqual([]);
  });
});

describe("booking.create", () => {
  test("creates the client and a requested online appointment", async () => {
    const { t, request } = await setup();
    const result = await request();
    expect(result).toEqual({ memberName: "ana" });
    const { appointment, client } = await t.run(async (ctx) => {
      const appointment = (await ctx.db.query("appointments").collect())[0];
      return { appointment, client: await ctx.db.get(appointment.clientId) };
    });
    expect(appointment).toMatchObject({ status: "requested", source: "online", start: at("09:00"), end: at("10:00"), price: 100000, paidTotal: 0 });
    expect(appointment.reminderJobId).toBeUndefined();
    expect(client).toMatchObject({ firstName: "Valentina", lastName: "Ríos", phone: "+573110000000", email: "vale@example.com" });
    expect(client?.dataAuthorization).toMatchObject({ method: "online_checkbox" });
    expect(appointment.contactEmail).toBeUndefined();
    // The accepted policy is stored once and referenced.
    const policy = await t.run((ctx) => ctx.db.get(client!.dataAuthorization!.policyId!));
    expect(policy?.text).toContain("Alba");
    await request({ phone: "+573110000001", start: at("11:00") });
    expect(await t.run(async (ctx) => (await ctx.db.query("policies").collect()).filter(p => p.orgId === policy?.orgId && p.text === policy?.text).length)).toBe(1);
  });

  test("never changes an existing client: the request email stays on the appointment", async () => {
    const { t, ids, request, asAna } = await setup();
    const before = await t.run((ctx) => ctx.db.get(ids.clientA));
    await request({ phone: "+573001234567", firstName: "Otra" });
    expect(await t.run((ctx) => ctx.db.get(ids.clientA))).toEqual(before);
    expect(await t.run(async (ctx) => (await ctx.db.query("clients").collect()).length)).toBe(2);
    const appointment = (await t.run((ctx) => ctx.db.query("appointments").first()))!;
    expect(appointment).toMatchObject({ clientId: ids.clientA, contactEmail: "vale@example.com" });

    // The team sees it and can save it to the ficha.
    const detail = await asAna.query(api.appointments.detail, { appointmentId: appointment._id });
    expect(detail.appointment.contactEmail).toBe("vale@example.com");
    await asAna.mutation(api.appointments.saveContactEmail, { appointmentId: appointment._id });
    expect((await t.run((ctx) => ctx.db.get(ids.clientA)))?.email).toBe("vale@example.com");
    expect((await t.run((ctx) => ctx.db.get(appointment._id)))?.contactEmail).toBeUndefined();
  });

  test("the request email is used only when the client has none", async () => {
    const { t, ids, request, asAna, deliveries } = await setup();
    const confirmations = async () => (await deliveries()).filter((e) => e.subject.includes("está confirmada")).map((e) => e.to);
    await t.run((ctx) => ctx.db.patch(ids.clientA, { email: "laura@example.com" }));
    await request({ phone: "+573001234567" });
    const [first] = await t.run((ctx) => ctx.db.query("appointments").collect());
    await asAna.mutation(api.appointments.confirm, { appointmentId: first._id });
    expect(await confirmations()).toEqual(["laura@example.com"]);

    await t.run((ctx) => ctx.db.patch(ids.clientA, { email: undefined }));
    await request({ phone: "+573001234567", start: at("11:00") });
    const [, second] = await t.run((ctx) => ctx.db.query("appointments").collect());
    await asAna.mutation(api.appointments.confirm, { appointmentId: second._id });
    expect(await confirmations()).toEqual(["laura@example.com", "vale@example.com"]);
  });

  test("an archived client with the same phone gets a fresh client", async () => {
    const { t, ids, request } = await setup();
    await t.run((ctx) => ctx.db.patch(ids.clientA, { isArchived: true }));
    await request({ phone: "+573001234567" });
    const appointment = (await t.run((ctx) => ctx.db.query("appointments").first()))!;
    expect(appointment.clientId).not.toBe(ids.clientA);
    expect(appointment.contactEmail).toBeUndefined();
  });

  test("rejects the honeypot field", async () => {
    const { t, request } = await setup();
    expect(await errorCode(request({ website: "https://spam.example" }))).toBe("INVALID");
    expect(await t.run(async (ctx) => (await ctx.db.query("appointments").collect()).length)).toBe(0);
  });

  test("limits online requests per business to 10 an hour", async () => {
    const { t, request } = await setup();
    // A different phone each time, so the per-phone limit does not apply.
    const starts = ["2030-01-07", "2030-01-08"].flatMap((date) => ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"].map((time) => at(time, date)));
    for (let i = 0; i < 10; i++) await request({ phone: `+5731100001${String(i).padStart(2, "0")}`, start: starts[i] });
    expect(await errorCode(request({ phone: "+573110000199", start: starts[10] }))).toBe("RATE_LIMITED");
    expect(await t.run(async (ctx) => (await ctx.db.query("appointments").collect()).length)).toBe(10);
    // The window resets after an hour.
    vi.setSystemTime(NOW + 61 * 60_000);
    await expect(request({ phone: "+573110000199", start: starts[10] })).resolves.toBeDefined();
  });

  test("assigns the first free professional for 'Cualquiera disponible'", async () => {
    const { t, ids, request } = await setup();
    await request({ phone: "+573110000001" });
    expect(await request({ phone: "+573110000002" })).toEqual({ memberName: "sofi" });
    expect(await errorCode(request({ phone: "+573110000003" }))).toBe("SLOT_TAKEN");
    const members = await t.run(async (ctx) => (await ctx.db.query("appointments").collect()).map((a) => a.memberId));
    expect(members).toEqual([ids.ana, ids.sofi]);
  });

  test("re-validates the time on the server", async () => {
    const { request, ids, asAna } = await setup();
    // Not a step of the slot grid, outside the schedule, beyond maxDaysAhead, inside the notice.
    expect(await errorCode(request({ start: at("09:10") }))).toBe("SLOT_TAKEN");
    expect(await errorCode(request({ start: at("19:00") }))).toBe("SLOT_TAKEN");
    expect(await errorCode(request({ start: at("09:00", "2030-03-04") }))).toBe("SLOT_TAKEN");
    vi.setSystemTime(at("08:30"));
    expect(await errorCode(request({ start: at("09:00") }))).toBe("SLOT_TAKEN");
    vi.setSystemTime(NOW);
    // A block taken after the page loaded.
    await asAna.mutation(api.timeBlocks.create, { memberId: ids.ana, start: at("09:00"), end: at("10:00"), allDay: false, kind: "personal" });
    expect(await errorCode(request({ memberId: ids.ana }))).toBe("SLOT_TAKEN");
    await expect(request()).resolves.toEqual({ memberName: "sofi" });
  });

  test("allows at most 2 open requests per phone", async () => {
    const { request } = await setup();
    await request({ start: at("09:00") });
    await request({ start: at("11:00") });
    expect(await errorMessage(request({ start: at("13:00") }))).toBe(
      "Ya hay solicitudes pendientes con este número. Espera a que Alba te confirme o escríbele por WhatsApp.",
    );
    await expect(request({ start: at("13:00"), phone: "+573110000009" })).resolves.toBeDefined();
  });

  test("rejects disabled booking, missing authorization, and other businesses' treatments", async () => {
    const { t, ids, request } = await setup();
    expect(await errorCode(request({ authorized: false }))).toBe("INVALID");
    expect(await errorCode(request({ slug: "brisa" }))).toBe("INVALID");
    expect(
      await errorCode(
        t.mutation(api.booking.create, {
          slug: "alba",
          treatmentId: ids.treatmentB,
          start: at("09:00"),
          firstName: "Vale",
          lastName: "",
          phone: "+573110000000",
          email: "vale@example.com",
          authorized: true, adult: true, policyHash: (await t.query(api.booking.page, { slug: "alba" }))!.policyHash, requestKey: crypto.randomUUID(),
        }),
      ),
    ).toBe("INVALID");
    expect(await errorCode(request({ memberId: ids.bea }))).toBe("SLOT_TAKEN");
    expect(await t.run(async (ctx) => (await ctx.db.query("appointments").collect()).length)).toBe(0);
  });

  test("requires the displayed policy and adult confirmation, and retries only once", async () => {
    const { t, request } = await setup();
    expect(await errorCode(request({ adult: false }))).toBe("INVALID");
    expect(await errorCode(request({ policyHash: "stale" }))).toBe("STALE_POLICY");
    const first = await request({ requestKey: "same-request" });
    const retry = await request({ requestKey: "same-request" });
    expect(retry).toEqual(first);
    expect(await t.run(async ctx => (await ctx.db.query("appointments").collect()).length)).toBe(1);
  });

  test("emails the admins and the professional, without health data", async () => {
    const { request, deliveries, ids } = await setup();
    await request({ memberId: ids.sofi });
    const emails = await deliveries();
    expect(emails.map((e) => e.to).sort()).toEqual(["ana@example.com", "sofi@example.com"]);
    expect(emails[0].subject).toBe("Nueva solicitud de cita de Valentina Ríos");
    expect(emails[0].html).toContain("lunes 7 de enero");
    expect(emails[0].html).not.toContain("Penicilina");
  });
});
