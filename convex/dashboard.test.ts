import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addDaysToDateKey } from "./lib/time";
import { at, errorCode, MONDAY, setupOrgs } from "./lib/fixtures.testing";

async function setup() {
  const s = await setupOrgs();
  const book = (start: number, memberId: Id<"members"> = s.ids.ana) =>
    s.asAna.mutation(api.appointments.create, {
      clientId: s.ids.clientA,
      treatmentId: s.ids.treatmentA,
      memberId,
      start,
      durationMin: 30,
      price: 100000,
      allowConflicts: true,
    });
  const setStatus = (id: Id<"appointments">, status: "requested" | "completed") =>
    s.t.run((ctx) => ctx.db.patch(id, { status }));
  return { ...s, book, setStatus };
}

describe("dashboard.today", () => {
  test("lists the appointments and blocks of the Bogotá day only", async () => {
    const { asAna, book, ids } = await setup();
    const previousDay = addDaysToDateKey(MONDAY, -1);
    const nextDay = addDaysToDateKey(MONDAY, 1);
    await book(at("23:30", previousDay));
    const first = await book(at("00:00"));
    const last = await book(at("23:30"));
    await book(at("00:00", nextDay));
    const cancelled = await book(at("10:00"));
    await asAna.mutation(api.appointments.cancel, { appointmentId: cancelled });
    await asAna.mutation(api.timeBlocks.create, {
      memberId: ids.ana,
      start: at("12:30"),
      end: at("14:00"),
      allDay: false,
      kind: "personal",
      title: "Almuerzo",
    });

    const day = await asAna.query(api.dashboard.today, { date: MONDAY });
    expect(day.appointments.map((a) => a._id)).toEqual([first, last]);
    expect(day.appointments[0].client.name).toBe("Laura Prueba");
    expect(day.blocks.map((b) => b.title)).toEqual(["Almuerzo"]);
  });

  test("never shows another org's data", async () => {
    const { asBea, book, setStatus, t, ids } = await setup();
    const requested = await book(at("09:00"));
    await setStatus(requested, "requested");
    const owed = await book(at("11:00"));
    await setStatus(owed, "completed");
    await t.run((ctx) => ctx.db.patch(ids.clientA, { birthdayKey: MONDAY.slice(5) }));

    const day = await asBea.query(api.dashboard.today, { date: MONDAY });
    expect(day.appointments).toEqual([]);
    expect(day.requests).toEqual([]);
    expect(day.pendingPayments).toEqual({ total: 0, rows: [] });
    expect(day.birthdays).toEqual([]);
    expect(day.members.map((m) => m._id)).toEqual([ids.bea]);
  });

  test("requests from today on, pending payments, and birthdays", async () => {
    const { asSofi, book, setStatus, t, ids } = await setup();
    const stale = await book(at("09:00", addDaysToDateKey(MONDAY, -1)));
    await setStatus(stale, "requested");
    const request = await book(at("15:00", addDaysToDateKey(MONDAY, 3)));
    await setStatus(request, "requested");
    const owed = await book(at("09:00"));
    await setStatus(owed, "completed");
    await asSofi.mutation(api.payments.record, { appointmentId: owed, amount: 40000, method: "cash", paidAt: at("10:00") });
    const paid = await book(at("11:00"));
    await setStatus(paid, "completed");
    await asSofi.mutation(api.payments.record, { appointmentId: paid, amount: 100000, method: "nequi", paidAt: at("12:00") });
    await t.run((ctx) => ctx.db.patch(ids.clientA, { birthdayKey: MONDAY.slice(5) }));

    const day = await asSofi.query(api.dashboard.today, { date: MONDAY });
    expect(day.requests.map((r) => r._id)).toEqual([request]);
    expect(day.pendingPayments).toEqual({ total: 60000, rows: [expect.objectContaining({ _id: owed, balance: 60000 })] });
    expect(day.birthdays.map((b) => b.firstName)).toEqual(["Laura"]);

    const tomorrow = await asSofi.query(api.dashboard.today, { date: addDaysToDateKey(MONDAY, 1) });
    expect(tomorrow.birthdays).toEqual([]);
  });

  test("rejects a malformed date", async () => {
    const { asAna } = await setup();
    expect(await errorCode(asAna.query(api.dashboard.today, { date: "07/01/2030" }))).toBe("INVALID");
  });
});

describe("Primeros pasos", () => {
  test("auto-checks, marks steps, and dismisses for admins only", async () => {
    const { asAna, asSofi, asBea } = await setup();
    const checklist = async () => (await asAna.query(api.dashboard.today, { date: MONDAY })).checklist;

    expect(await checklist()).toEqual({
      client: true,
      appointment: false,
      consent: false,
      signature: false,
      booking: false,
      team: true,
    });
    expect((await asSofi.query(api.dashboard.today, { date: MONDAY })).checklist).toBeNull();
    expect((await asBea.query(api.dashboard.today, { date: MONDAY })).checklist?.team).toBe(false);

    await asSofi.mutation(api.dashboard.markChecklist, { step: "consent" });
    await asAna.mutation(api.dashboard.markChecklist, { step: "booking" });
    expect(await checklist()).toMatchObject({ consent: true, booking: true });

    expect(await errorCode(asSofi.mutation(api.dashboard.dismissChecklist, {}))).toBe("FORBIDDEN");
    await asAna.mutation(api.dashboard.dismissChecklist, {});
    expect(await checklist()).toBeNull();
  });
});
