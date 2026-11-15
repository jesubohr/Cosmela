import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { bogotaDateKey } from "./lib/time";
import { at, errorCode, setupOrgs } from "./lib/fixtures.testing";
import { nextMonthKey } from "./reports";

async function setup() {
  const s = await setupOrgs();
  const book = async (start: number, memberId: Id<"members">, completed = true) => {
    const id = await s.asAna.mutation(api.appointments.create, {
      clientId: s.ids.clientA,
      treatmentId: s.ids.treatmentA,
      memberId,
      start,
      durationMin: 60,
      price: 100000,
      allowConflicts: true,
    });
    if (completed) await s.t.run((ctx) => ctx.db.patch(id, { status: "completed" }));
    return id;
  };
  const pay = (appointmentId: Id<"appointments">, amount: number, method: "cash" | "nequi", paidAt: number) =>
    s.asAna.mutation(api.payments.record, { appointmentId, amount, method, paidAt });
  return { ...s, book, pay };
}

describe("reports.month", () => {
  test("sums payments by Bogotá month, method, treatment, and professional", async () => {
    const { asAna, book, pay, ids } = await setup();
    const first = await book(at("09:00", "2030-01-07"), ids.ana);
    const second = await book(at("10:00", "2030-01-08"), ids.sofi);
    const february = await book(at("09:00", "2030-02-04"), ids.ana);
    await book(at("11:00", "2030-01-09"), ids.ana, false);

    await pay(first, 60000, "cash", at("10:00", "2030-01-07"));
    await pay(first, 40000, "nequi", at("10:05", "2030-01-07"));
    await pay(second, 30000, "cash", at("11:00", "2030-01-08"));
    // 23:59 in Bogotá on Jan 31 is already Feb 1 in UTC.
    await pay(february, 20000, "nequi", at("23:59", "2030-01-31"));
    await pay(february, 50000, "cash", at("00:00", "2030-02-01"));

    const january = await asAna.query(api.reports.month, { month: "2030-01" });
    expect(january.income).toBe(150000);
    expect(january.completed).toBe(2);
    expect(january.byMethod).toEqual([
      { method: "cash", amount: 90000 },
      { method: "nequi", amount: 60000 },
    ]);
    expect(january.treatments).toEqual([
      { treatmentId: ids.treatmentA, name: "Limpieza facial", count: 2, revenue: 150000 },
    ]);
    expect(january.members.map((m) => [m.name, m.count, m.revenue])).toEqual([
      ["ana", 1, 120000],
      ["sofi", 1, 30000],
    ]);
    // Owed now: 0 + 70 000 + 30 000 (the scheduled one does not count).
    expect(january.balance).toBe(100000);

    const feb = await asAna.query(api.reports.month, { month: "2030-02" });
    expect(feb.income).toBe(50000);
    expect(feb.completed).toBe(1);
  });

  test("counts clients created in the month", async () => {
    const { asAna } = await setup();
    const thisMonth = bogotaDateKey(Date.now()).slice(0, 7);
    expect((await asAna.query(api.reports.month, { month: thisMonth })).newClients).toBe(1);
    expect((await asAna.query(api.reports.month, { month: nextMonthKey(thisMonth) })).newClients).toBe(0);
  });

  test("only admins of the same org see their numbers", async () => {
    const { asSofi, asBea, book, pay, ids } = await setup();
    const id = await book(at("09:00", "2030-01-07"), ids.ana);
    await pay(id, 100000, "cash", at("10:00", "2030-01-07"));
    expect(await errorCode(asSofi.query(api.reports.month, { month: "2030-01" }))).toBe("FORBIDDEN");
    const other = await asBea.query(api.reports.month, { month: "2030-01" });
    expect(other.income).toBe(0);
    expect(other.completed).toBe(0);
  });

  test("rejects a malformed month and rolls over December", async () => {
    const { asAna } = await setup();
    expect(await errorCode(asAna.query(api.reports.month, { month: "2030-13" }))).toBe("INVALID");
    expect(nextMonthKey("2030-12")).toBe("2031-01");
  });
});
