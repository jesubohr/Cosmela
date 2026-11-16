import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { at, setupOrgs } from "./lib/fixtures.testing";
import { reminderTime } from "./notifications";

const SUNDAY = "2030-01-06";
const TUESDAY = "2030-01-08";
const MINUTE = 60_000;

describe("reminderTime", () => {
  test("is 24 h before inside 07:00–20:00 Bogotá", () => {
    expect(reminderTime(at("15:00", TUESDAY), at("08:00"))).toBe(at("15:00"));
  });

  test("moves night times to 19:00 the evening before", () => {
    expect(reminderTime(at("21:00", TUESDAY), at("08:00"))).toBe(at("19:00"));
    expect(reminderTime(at("06:00", TUESDAY), at("12:00", SUNDAY))).toBe(at("19:00", SUNDAY));
  });

  test("uses 07:00 when the evening has passed", () => {
    expect(reminderTime(at("09:00", TUESDAY), at("22:00"))).toBe(at("07:00", TUESDAY));
  });

  test("is never earlier than now + 5 minutes", () => {
    expect(reminderTime(at("17:00"), at("10:00"))).toBe(at("10:05"));
  });

  test("skips reminders that cannot go out 1 hour before", () => {
    expect(reminderTime(at("07:30", TUESDAY), at("22:00"))).toBeNull();
    expect(reminderTime(at("10:30"), at("10:00"))).toBeNull();
  });
});

describe("reminder scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at("08:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function setup() {
    const s = await setupOrgs();
    await s.t.run((ctx) => ctx.db.patch(s.ids.clientA, { email: "laura@example.com" }));
    const job = (id: Id<"appointments">) =>
      s.t.run(async (ctx) => {
        const appointment = (await ctx.db.get(id))!;
        const job = appointment.reminderJobId ? await ctx.db.system.get(appointment.reminderJobId) : null;
        return { appointment, job };
      });
    const book = (start: number) =>
      s.asAna.mutation(api.appointments.create, {
        clientId: s.ids.clientA,
        treatmentId: s.ids.treatmentA,
        memberId: s.ids.ana,
        start,
        durationMin: 60,
        price: 100000,
      });
    const deliveries = () =>
      s.t.run(async (ctx) =>
        (await ctx.db.system.query("_scheduled_functions").collect())
          .filter((j) => j.name.includes("deliver"))
          .map((j) => j.args[0] as { to: string; subject: string }),
      );
    return { ...s, job, book, deliveries };
  }

  test("create schedules the reminder and sends the confirmation", async () => {
    const { book, job, deliveries } = await setup();
    const id = await book(at("15:00", TUESDAY));
    const { job: reminder } = await job(id);
    expect(reminder?.state.kind).toBe("pending");
    expect(reminder?.scheduledTime).toBe(at("15:00"));
    expect(await deliveries()).toEqual([
      expect.objectContaining({ to: "laura@example.com", subject: "Tu cita en Alba está confirmada" }),
    ]);
  });

  test("cancel cancels the reminder", async () => {
    const { t, book, job, asAna } = await setup();
    const id = await book(at("15:00", TUESDAY));
    const before = await job(id);
    await asAna.mutation(api.appointments.cancel, { appointmentId: id });
    const after = await job(id);
    expect(after.appointment.reminderJobId).toBeUndefined();
    const old = await t.run((ctx) => ctx.db.system.get(before.appointment.reminderJobId!));
    expect(old?.state.kind).toBe("canceled");
  });

  test("rescheduling replaces the reminder", async () => {
    const { t, book, job, asAna, ids } = await setup();
    const id = await book(at("15:00", TUESDAY));
    const before = await job(id);
    await asAna.mutation(api.appointments.update, {
      appointmentId: id,
      clientId: ids.clientA,
      treatmentId: ids.treatmentA,
      memberId: ids.ana,
      start: at("16:00", TUESDAY),
      durationMin: 60,
      price: 100000,
    });
    const after = await job(id);
    expect(after.job?.scheduledTime).toBe(at("16:00"));
    const old = await t.run((ctx) => ctx.db.system.get(before.appointment.reminderJobId!));
    expect(old?.state.kind).toBe("canceled");
  });

  test("a request gets its reminder only when confirmed", async () => {
    const { t, ids, job, asAna } = await setup();
    const id = await t.run((ctx) =>
      ctx.db.insert("appointments", {
        orgId: ids.orgA,
        clientId: ids.clientA,
        memberId: ids.ana,
        treatmentId: ids.treatmentA,
        start: at("15:00", TUESDAY),
        end: at("16:00", TUESDAY),
        status: "requested",
        source: "online",
        price: 100000,
        paidTotal: 0,
      }),
    );
    await t.mutation(internal.notifications.scheduleReminder, { appointmentId: id });
    expect((await job(id)).job).toBeNull();
    await asAna.mutation(api.appointments.confirm, { appointmentId: id });
    expect((await job(id)).job?.state.kind).toBe("pending");
  });

  test("rejecting emails the client with the reason", async () => {
    const { t, ids, asAna, deliveries } = await setup();
    const id = await t.run((ctx) =>
      ctx.db.insert("appointments", {
        orgId: ids.orgA,
        clientId: ids.clientA,
        memberId: ids.ana,
        treatmentId: ids.treatmentA,
        start: at("15:00", TUESDAY),
        end: at("16:00", TUESDAY),
        status: "requested",
        source: "online",
        price: 100000,
        paidTotal: 0,
      }),
    );
    await asAna.mutation(api.appointments.reject, { appointmentId: id, reason: "Ese día no abrimos" });
    const emails = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect())
        .filter((j) => j.name.includes("deliver"))
        .map((j) => j.args[0] as { subject: string; text: string }),
    );
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe("Sobre tu solicitud de cita en Alba");
    expect(emails[0].text).toContain("Motivo: Ese día no abrimos");
    expect((await deliveries()).map((e) => e.to)).toEqual(["laura@example.com"]);
  });

  test("sendReminder re-checks status, setting, and email", async () => {
    const { t, ids, book, deliveries } = await setup();
    const id = await book(at("15:00", TUESDAY));
    const sent = async () => (await deliveries()).filter((e) => e.subject.startsWith("Recordatorio")).length;

    await t.run((ctx) => ctx.db.patch(ids.orgA, { reminders: { email: false } }));
    await t.mutation(internal.notifications.sendReminder, { appointmentId: id });
    expect(await sent()).toBe(0);

    await t.run((ctx) => ctx.db.patch(ids.orgA, { reminders: { email: true } }));
    await t.run((ctx) => ctx.db.patch(ids.clientA, { email: undefined }));
    await t.mutation(internal.notifications.sendReminder, { appointmentId: id });
    expect(await sent()).toBe(0);

    await t.run((ctx) => ctx.db.patch(ids.clientA, { email: "laura@example.com" }));
    await t.mutation(internal.notifications.sendReminder, { appointmentId: id });
    await t.mutation(internal.notifications.sendReminder, { appointmentId: id });
    expect(await sent()).toBe(1);
    expect((await t.run((ctx) => ctx.db.get(id)))?.reminderSentAt).toBeGreaterThanOrEqual(at("08:00"));
  });
});

describe("sweepReminders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at("10:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("schedules missed reminders for the next 26 hours", async () => {
    const { t, ids } = await setupOrgs();
    const created = await t.run(async (ctx) => {
      await ctx.db.patch(ids.clientA, { email: "laura@example.com" });
      await ctx.db.patch(ids.clientB, { email: "maria@example.com" });
      await ctx.db.patch(ids.orgB, { reminders: { email: false } });
      const pendingJob = await ctx.scheduler.runAt(at("15:00"), internal.notifications.sweepReminders, {});
      const insert = (fields: { start: number; status?: "scheduled" | "requested"; orgB?: boolean; reminderSentAt?: number; reminderJobId?: Id<"_scheduled_functions"> }) =>
        ctx.db.insert("appointments", {
          orgId: fields.orgB ? ids.orgB : ids.orgA,
          clientId: fields.orgB ? ids.clientB : ids.clientA,
          memberId: fields.orgB ? ids.bea : ids.ana,
          treatmentId: fields.orgB ? ids.treatmentB : ids.treatmentA,
          start: fields.start,
          end: fields.start + 60 * MINUTE,
          status: fields.status ?? "scheduled",
          source: "staff",
          price: 100000,
          paidTotal: 0,
          reminderSentAt: fields.reminderSentAt,
          reminderJobId: fields.reminderJobId,
        });
      return {
        missed: await insert({ start: at("11:30", TUESDAY) }),
        tomorrowMorning: await insert({ start: at("09:00", TUESDAY) }),
        sent: await insert({ start: at("09:30", TUESDAY), reminderSentAt: at("09:00") }),
        pending: await insert({ start: at("11:00", TUESDAY), reminderJobId: pendingJob }),
        tooFar: await insert({ start: at("13:00", TUESDAY) }),
        requested: await insert({ start: at("10:00", TUESDAY), status: "requested" }),
        remindersOff: await insert({ start: at("10:00", TUESDAY), orgB: true }),
      };
    });

    expect(await t.mutation(internal.notifications.sweepReminders, {})).toBe(2);
    const jobs = await t.run(async (ctx) => {
      const result: Record<string, number | null> = {};
      for (const [name, id] of Object.entries(created)) {
        const appointment = (await ctx.db.get(id))!;
        const job = appointment.reminderJobId ? await ctx.db.system.get(appointment.reminderJobId) : null;
        // The test clock moves 1 ms per transaction.
        result[name] = job && Math.floor(job.scheduledTime / MINUTE) * MINUTE;
      }
      return result;
    });
    expect(jobs).toEqual({
      missed: at("11:30"),
      tomorrowMorning: at("10:05"),
      sent: null,
      pending: at("15:00"),
      tooFar: null,
      requested: null,
      remindersOff: null,
    });
  });
});
