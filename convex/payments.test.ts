import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { at, errorCode, errorMessage, setupOrgs } from "./lib/fixtures.testing";

async function setup() {
  const s = await setupOrgs();
  const appointmentId = await s.asAna.mutation(api.appointments.create, {
    clientId: s.ids.clientA,
    treatmentId: s.ids.treatmentA,
    memberId: s.ids.ana,
    start: at("09:00"),
    durationMin: 60,
    price: 100000,
  });
  const paidTotal = async () => (await s.t.run((ctx) => ctx.db.get(appointmentId)))!.paidTotal;
  const pay = (amount: number) =>
    s.asSofi.mutation(api.payments.record, { appointmentId, amount, method: "cash", paidAt: at("10:00") });
  return { ...s, appointmentId, paidTotal, pay };
}

describe("payments", () => {
  test("paidTotal follows recorded and removed payments", async () => {
    const { pay, paidTotal, asAna, appointmentId } = await setup();
    const first = await pay(30000);
    await pay(50000);
    expect(await paidTotal()).toBe(80000);
    await asAna.mutation(api.payments.remove, { paymentId: first });
    expect(await paidTotal()).toBe(50000);
    const list = await asAna.query(api.payments.listByAppointment, { appointmentId });
    expect(list.map((p) => p.amount)).toEqual([50000]);
  });

  test("a payment cannot exceed the balance or be zero", async () => {
    const { pay, paidTotal } = await setup();
    await pay(60000);
    expect(await errorMessage(pay(50000))).toBe("El pago supera el saldo de la cita ($ 40.000).");
    expect(await errorCode(pay(0))).toBe("INVALID");
    expect(await errorCode(pay(10.5))).toBe("INVALID");
    await pay(40000);
    expect(await errorMessage(pay(1))).toBe("Esta cita ya está pagada.");
    expect(await paidTotal()).toBe(100000);
  });

  test("no payments on cancelled appointments", async () => {
    const { pay, asAna, appointmentId } = await setup();
    await asAna.mutation(api.appointments.cancel, { appointmentId });
    expect(await errorCode(pay(10000))).toBe("INVALID");
  });

  test("client payments list shows payments and what is still owed", async () => {
    const { pay, asAna, ids } = await setup();
    await pay(30000);
    const { payments, owing } = await asAna.query(api.payments.listByClient, { clientId: ids.clientA });
    expect(payments.map((p) => [p.amount, p.treatmentName])).toEqual([[30000, "Limpieza facial"]]);
    expect(owing.map((a) => a.price - a.paidTotal)).toEqual([70000]);
  });

  test("balance counts completed appointments only", async () => {
    const { pay, asAna, ids, t, appointmentId } = await setup();
    await pay(30000);
    expect((await asAna.query(api.clients.summary, { clientId: ids.clientA })).balance).toBe(0);
    await t.run((ctx) => ctx.db.patch(appointmentId, { status: "completed" }));
    const summary = await asAna.query(api.clients.summary, { clientId: ids.clientA });
    expect(summary.balance).toBe(70000);
    const withBalance = await asAna.query(api.clients.listWithBalance, {});
    expect(withBalance.map((c) => [c._id, c.balance])).toEqual([[ids.clientA, 70000]]);
  });
});

describe("payments: cross-org isolation", () => {
  test("cannot record, remove, or list payments of another org", async () => {
    const { pay, asBea, appointmentId, ids, paidTotal } = await setup();
    const paymentId = await pay(10000);
    expect(
      await errorCode(asBea.mutation(api.payments.record, { appointmentId, amount: 1000, method: "cash", paidAt: 0 })),
    ).toBe("NOT_FOUND");
    expect(await errorCode(asBea.mutation(api.payments.remove, { paymentId }))).toBe("NOT_FOUND");
    expect(await errorCode(asBea.query(api.payments.listByAppointment, { appointmentId }))).toBe("NOT_FOUND");
    expect(await errorCode(asBea.query(api.payments.listByClient, { clientId: ids.clientA }))).toBe("NOT_FOUND");
    expect(await paidTotal()).toBe(10000);
  });
});
