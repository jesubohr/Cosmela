import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { at, errorCode, MONDAY, setupOrgs } from "./lib/fixtures.testing";

async function setup() {
  const s = await setupOrgs();
  const book = (start: number, extra: Partial<{ allowConflicts: boolean; memberId: Id<"members"> }> = {}) =>
    s.asAna.mutation(api.appointments.create, {
      clientId: s.ids.clientA,
      treatmentId: s.ids.treatmentA,
      memberId: s.ids.ana,
      start,
      durationMin: 60,
      price: 100000,
      ...extra,
    });
  const status = async (id: Id<"appointments">) => (await s.t.run((ctx) => ctx.db.get(id)))?.status;
  return { ...s, book, status };
}

describe("appointments", () => {
  test("create books a scheduled appointment with an optional abono", async () => {
    const { asAna, ids, t } = await setup();
    const id = await asAna.mutation(api.appointments.create, {
      clientId: ids.clientA,
      treatmentId: ids.treatmentA,
      memberId: ids.ana,
      start: at("09:00"),
      durationMin: 60,
      price: 100000,
      deposit: { amount: 30000, method: "nequi" },
    });
    const appointment = await t.run((ctx) => ctx.db.get(id));
    expect(appointment).toMatchObject({ status: "scheduled", source: "staff", end: at("10:00"), paidTotal: 30000 });
    const detail = await asAna.query(api.appointments.detail, { appointmentId: id });
    expect(detail.payments.map((p) => p.amount)).toEqual([30000]);
  });

  test("overlaps need an explicit override", async () => {
    const { book, ids, asAna } = await setup();
    await book(at("09:00"));
    expect(await errorCode(book(at("09:30")))).toBe("CONFLICT");
    await expect(book(at("09:30"), { allowConflicts: true })).resolves.toBeDefined();
    // Back-to-back and other members do not conflict.
    await expect(book(at("10:30"))).resolves.toBeDefined();
    await expect(book(at("09:00"), { memberId: ids.sofi })).resolves.toBeDefined();

    await asAna.mutation(api.timeBlocks.create, {
      memberId: ids.ana,
      start: at("12:00"),
      end: at("13:00"),
      allDay: false,
      kind: "personal",
      title: "Almuerzo",
    });
    expect(await errorCode(book(at("12:30")))).toBe("CONFLICT");
    const check = await asAna.query(api.appointments.conflicts, { memberId: ids.ana, start: at("12:30"), end: at("13:30") });
    expect(check.conflicts.map((c) => c.kind)).toEqual(["block"]);
    expect(check.outsideHours).toBe(false);
  });

  test("cancelled appointments free their slot", async () => {
    const { book, asAna } = await setup();
    const id = await book(at("09:00"));
    await asAna.mutation(api.appointments.cancel, { appointmentId: id, reason: "Viaje" });
    await expect(book(at("09:00"))).resolves.toBeDefined();
  });

  test("conflicts flag times outside working hours", async () => {
    const { asAna, ids } = await setup();
    const evening = await asAna.query(api.appointments.conflicts, { memberId: ids.ana, start: at("18:00"), end: at("19:00") });
    expect(evening.outsideHours).toBe(true);
    const sunday = await asAna.query(api.appointments.conflicts, {
      memberId: ids.ana,
      start: at("10:00", "2030-01-06"),
      end: at("11:00", "2030-01-06"),
    });
    expect(sunday.outsideHours).toBe(true);
  });

  test("free slots skip busy time", async () => {
    const { book, asAna, ids } = await setup();
    await book(at("08:00"));
    const slots = await asAna.query(api.appointments.freeSlots, { memberId: ids.ana, date: MONDAY, durationMin: 60 });
    expect(slots[0]).toBe(at("09:00"));
    expect(slots.at(-1)).toBe(at("17:00"));
  });

  test("status transitions", async () => {
    const { book, asAna, t, ids, status } = await setup();
    const scheduled = await book(at("09:00"));

    // A scheduled appointment cannot be confirmed or rejected.
    expect(await errorCode(asAna.mutation(api.appointments.confirm, { appointmentId: scheduled }))).toBe("INVALID");
    await asAna.mutation(api.appointments.markNoShow, { appointmentId: scheduled });
    expect(await status(scheduled)).toBe("no_show");
    // No-shows cannot be cancelled or edited.
    expect(await errorCode(asAna.mutation(api.appointments.cancel, { appointmentId: scheduled }))).toBe("INVALID");

    const request = () =>
      t.run((ctx) =>
        ctx.db.insert("appointments", {
          orgId: ids.orgA,
          clientId: ids.clientA,
          memberId: ids.ana,
          treatmentId: ids.treatmentA,
          start: at("14:00"),
          end: at("15:00"),
          status: "requested",
          source: "online",
          price: 100000,
          paidTotal: 0,
        }),
      );
    const confirmed = await request();
    await asAna.mutation(api.appointments.confirm, { appointmentId: confirmed });
    expect(await status(confirmed)).toBe("scheduled");

    const rejected = await request();
    await asAna.mutation(api.appointments.reject, { appointmentId: rejected });
    const doc = await t.run((ctx) => ctx.db.get(rejected));
    expect(doc).toMatchObject({ status: "cancelled", cancelReason: "Solicitud rechazada" });
    expect(await errorCode(asAna.mutation(api.appointments.confirm, { appointmentId: rejected }))).toBe("INVALID");

    // A requested appointment cannot be marked as no-show.
    const pending = await request();
    expect(await errorCode(asAna.mutation(api.appointments.markNoShow, { appointmentId: pending }))).toBe("INVALID");
  });

  test("update reschedules and keeps the price above what was paid", async () => {
    const { book, asAna, ids, t } = await setup();
    const id = await book(at("09:00"));
    await asAna.mutation(api.payments.record, { appointmentId: id, amount: 50000, method: "cash", paidAt: at("08:00") });
    const base = { appointmentId: id, clientId: ids.clientA, treatmentId: ids.treatmentA, memberId: ids.ana, durationMin: 30 };
    await asAna.mutation(api.appointments.update, { ...base, start: at("11:00"), price: 100000 });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ start: at("11:00"), end: at("11:30") });
    expect(await errorCode(asAna.mutation(api.appointments.update, { ...base, start: at("11:00"), price: 40000 }))).toBe(
      "INVALID",
    );
  });

  test("walk-in starts now with the treatment price", async () => {
    const { asAna, ids, t } = await setup();
    const before = Date.now();
    const id = await asAna.mutation(api.appointments.startWalkIn, {
      clientId: ids.clientA,
      treatmentId: ids.treatmentA,
      memberId: ids.sofi,
    });
    const appointment = await t.run((ctx) => ctx.db.get(id));
    expect(appointment!.start).toBeLessThanOrEqual(before);
    expect(appointment!.start).toBeGreaterThan(before - 60_000);
    expect(appointment).toMatchObject({ status: "scheduled", price: 100000, memberId: ids.sofi });
  });
});

describe("appointments: cross-org isolation", () => {
  test("cannot book with another org's client, treatment, or member", async () => {
    const { asAna, ids } = await setup();
    const base = { clientId: ids.clientA, treatmentId: ids.treatmentA, memberId: ids.ana, start: at("09:00"), durationMin: 60, price: 0 };
    expect(await errorCode(asAna.mutation(api.appointments.create, { ...base, clientId: ids.clientB }))).toBe("NOT_FOUND");
    expect(await errorCode(asAna.mutation(api.appointments.create, { ...base, treatmentId: ids.treatmentB }))).toBe("NOT_FOUND");
    expect(await errorCode(asAna.mutation(api.appointments.create, { ...base, memberId: ids.bea }))).toBe("NOT_FOUND");
  });

  test("cannot see or change another org's appointments", async () => {
    const { book, asBea, ids, status } = await setup();
    const id = await book(at("09:00"));
    expect(await errorCode(asBea.query(api.appointments.detail, { appointmentId: id }))).toBe("NOT_FOUND");
    expect(await errorCode(asBea.mutation(api.appointments.cancel, { appointmentId: id }))).toBe("NOT_FOUND");
    expect(await errorCode(asBea.query(api.appointments.listByClient, { clientId: ids.clientA }))).toBe("NOT_FOUND");
    const agenda = await asBea.query(api.appointments.agenda, { start: at("00:00"), end: at("23:59") });
    expect(agenda.appointments).toHaveLength(0);
    expect(await status(id)).toBe("scheduled");
  });
});

describe("time blocks", () => {
  test("staff block only their own time; admins block anyone", async () => {
    const { asAna, asSofi, ids } = await setup();
    const block = { start: at("12:00"), end: at("13:00"), allDay: false, kind: "personal" as const };
    expect(await errorCode(asSofi.mutation(api.timeBlocks.create, { ...block, memberId: ids.ana }))).toBe("FORBIDDEN");
    await expect(asSofi.mutation(api.timeBlocks.create, { ...block, memberId: ids.sofi })).resolves.toBeDefined();
    const forSofi = await asAna.mutation(api.timeBlocks.create, { ...block, memberId: ids.sofi, title: " Capacitación " });
    await asSofi.mutation(api.timeBlocks.remove, { blockId: forSofi });
    const forAna = await asAna.mutation(api.timeBlocks.create, { ...block, memberId: ids.ana });
    expect(await errorCode(asSofi.mutation(api.timeBlocks.remove, { blockId: forAna }))).toBe("FORBIDDEN");
  });

  test("rejects an end before the start and other orgs' blocks", async () => {
    const { asAna, asBea, ids } = await setup();
    expect(
      await errorCode(
        asAna.mutation(api.timeBlocks.create, { memberId: ids.ana, start: at("13:00"), end: at("12:00"), allDay: false, kind: "personal" }),
      ),
    ).toBe("INVALID");
    const id = await asAna.mutation(api.timeBlocks.create, {
      memberId: ids.ana,
      start: at("12:00"),
      end: at("13:00"),
      allDay: false,
      kind: "personal",
    });
    expect(await errorCode(asBea.mutation(api.timeBlocks.remove, { blockId: id }))).toBe("NOT_FOUND");
  });
});
