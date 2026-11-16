import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { at, errorCode, errorMessage, setupOrgs, withTestClock } from "./lib/fixtures.testing";

withTestClock();

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

  test("Pagos and Resumen agree: an abono for an upcoming appointment is credit, not debt", async () => {
    const { pay, asAna, ids, t, appointmentId } = await setup();
    await pay(30000);
    let list = await asAna.query(api.payments.listByClient, { clientId: ids.clientA });
    expect(list.payments.map((p) => [p.amount, p.treatmentName])).toEqual([[30000, "Limpieza facial"]]);
    expect(list.owing).toEqual([]);
    expect(await asAna.query(api.clients.summary, { clientId: ids.clientA })).toMatchObject({ balance: 0, credit: 30000 });

    await t.run((ctx) => ctx.db.patch(appointmentId, { status: "completed" }));
    list = await asAna.query(api.payments.listByClient, { clientId: ids.clientA });
    expect(list.owing.map((a) => a.price - a.paidTotal)).toEqual([70000]);
    expect(await asAna.query(api.clients.summary, { clientId: ids.clientA })).toMatchObject({ balance: 70000, credit: 0 });
  });

  test("an abono on a cancelled appointment stays visible as credit", async () => {
    const { pay, asAna, ids, appointmentId } = await setup();
    await pay(40000);
    await asAna.mutation(api.appointments.cancel, { appointmentId });
    expect(await asAna.query(api.clients.summary, { clientId: ids.clientA })).toMatchObject({ balance: 0, credit: 40000 });
  });

  test("changing the appointment's client moves its payments", async () => {
    const { pay, asAna, ids, t, appointmentId } = await setup();
    await pay(30000);
    const other = await t.run((ctx) =>
      ctx.db.insert("clients", {
        orgId: ids.orgA,
        firstName: "Sara",
        lastName: "Prueba",
        searchText: "sara prueba",
        phone: "+573001112233",
        health: { conditions: [], allergies: [], skinConditions: [], none: { conditions: false, allergies: false, skin: false } },
        habits: {},
        skin: {},
        createdBy: ids.ana,
        isArchived: false,
      }),
    );
    await asAna.mutation(api.appointments.update, {
      appointmentId,
      clientId: other,
      treatmentId: ids.treatmentA,
      memberId: ids.ana,
      start: at("09:00"),
      durationMin: 60,
      price: 100000,
    });
    expect((await asAna.query(api.payments.listByClient, { clientId: ids.clientA })).payments).toEqual([]);
    expect((await asAna.query(api.payments.listByClient, { clientId: other })).payments.map((p) => p.amount)).toEqual([30000]);
    expect((await asAna.query(api.clients.summary, { clientId: other })).credit).toBe(30000);
  });

  test("hasBalance follows status, price, and payments (Con saldo pendiente, Hoy, Reportes)", async () => {
    const { pay, asAna, ids, t, appointmentId } = await setup();
    const hasBalance = async () => (await t.run((ctx) => ctx.db.get(appointmentId)))!.hasBalance ?? false;
    const owing = async () => (await asAna.query(api.clients.listWithBalance, {})).map((c) => [c._id, c.balance]);
    await pay(30000);
    expect(await hasBalance()).toBe(false);
    expect(await owing()).toEqual([]);

    // Closing the attention marks it; paying the rest clears it; removing a payment marks it again.
    await t.run((ctx) => ctx.db.patch(appointmentId, { status: "completed" }));
    await t.run((ctx) => ctx.db.patch(appointmentId, { hasBalance: true }));
    expect(await owing()).toEqual([[ids.clientA, 70000]]);
    const last = await pay(70000);
    expect(await hasBalance()).toBe(false);
    expect(await owing()).toEqual([]);
    await asAna.mutation(api.payments.remove, { paymentId: last });
    expect(await hasBalance()).toBe(true);
    expect(await owing()).toEqual([[ids.clientA, 70000]]);
    const today = await asAna.query(api.dashboard.today, { date: "2030-01-07" });
    expect(today.pendingPayments.total).toBe(70000);
    expect((await asAna.query(api.reports.month, { month: "2030-01" })).balance).toBe(70000);
  });

  test("the migration backfills hasBalance for older appointments", async () => {
    const { pay, t, appointmentId } = await setup();
    await pay(30000);
    await t.run((ctx) => ctx.db.patch(appointmentId, { status: "completed", hasBalance: undefined }));
    await t.mutation(internal.migrations.backfill, {});
    expect((await t.run((ctx) => ctx.db.get(appointmentId)))?.hasBalance).toBe(true);
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
