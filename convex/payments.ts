import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getOwned, memberMutation, memberQuery } from "./lib/authz";
import { vPaymentMethod, type PaymentMethod } from "./lib/validators";

/** 40000 → "$ 40.000" (same format as `formatMoney` in lib/format). */
export function money(amount: number) {
  return `$ ${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export type PaymentInput = { amount: number; method: PaymentMethod; paidAt: number; note?: string };

/** A completed appointment that still owes money ("saldo pendiente"). */
export function owesBalance(appointment: Pick<Doc<"appointments">, "status" | "price" | "paidTotal">) {
  return appointment.status === "completed" && appointment.price > appointment.paidTotal;
}

/** Recomputes `hasBalance` after any change to an appointment's status, price, or payments. */
export async function syncBalance(ctx: MutationCtx, appointmentId: Id<"appointments">) {
  const appointment = await ctx.db.get(appointmentId);
  if (!appointment) return;
  const hasBalance = owesBalance(appointment);
  if (Boolean(appointment.hasBalance) !== hasBalance) await ctx.db.patch(appointmentId, { hasBalance });
}

/** Inserts a payment and keeps `appointment.paidTotal` in step. Used by `record` and by appointment create (abono). */
export async function addPayment(
  ctx: MutationCtx & { orgId: Id<"orgs">; member: Doc<"members"> },
  appointment: Doc<"appointments">,
  { amount, method, paidAt, note }: PaymentInput,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ConvexError({ code: "INVALID", message: "Escribe un valor mayor a cero." });
  }
  if (appointment.status === "cancelled") {
    throw new ConvexError({ code: "INVALID", message: "Esta cita está cancelada. No puedes registrar pagos en ella." });
  }
  const balance = appointment.price - appointment.paidTotal;
  if (amount > balance) {
    throw new ConvexError({
      code: "INVALID",
      message:
        balance > 0
          ? `El pago supera el saldo de la cita (${money(balance)}).`
          : "Esta cita ya está pagada.",
    });
  }
  const trimmed = note?.trim();
  const paymentId = await ctx.db.insert("payments", {
    orgId: ctx.orgId,
    appointmentId: appointment._id,
    clientId: appointment.clientId,
    amount,
    method,
    paidAt,
    note: trimmed ? trimmed : undefined,
    recordedBy: ctx.member._id,
  });
  await ctx.db.patch(appointment._id, { paidTotal: appointment.paidTotal + amount });
  await syncBalance(ctx, appointment._id);
  return paymentId;
}

export const record = memberMutation({
  args: {
    appointmentId: v.id("appointments"),
    amount: v.number(),
    method: vPaymentMethod,
    paidAt: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { appointmentId, ...payment }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    return await addPayment(ctx, appointment, payment);
  },
});

/** Deletes a payment recorded by mistake and takes it off `paidTotal`. */
export const remove = memberMutation({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, { paymentId }) => {
    const payment = await getOwned(ctx, "payments", paymentId);
    const appointment = await getOwned(ctx, "appointments", payment.appointmentId);
    await ctx.db.delete(paymentId);
    await ctx.db.patch(appointment._id, { paidTotal: Math.max(0, appointment.paidTotal - payment.amount) });
    await syncBalance(ctx, appointment._id);
  },
});

function toRow(payment: Doc<"payments">) {
  return {
    _id: payment._id,
    appointmentId: payment.appointmentId,
    amount: payment.amount,
    method: payment.method,
    paidAt: payment.paidAt,
    note: payment.note,
  };
}

export const listByAppointment = memberQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    await getOwned(ctx, "appointments", appointmentId);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_appointment", (q) => q.eq("appointmentId", appointmentId))
      .collect();
    return payments.sort((a, b) => a.paidAt - b.paidAt).map(toRow);
  },
});

/**
 * Pagos tab: the client's payments (newest first) and the attended appointments that
 * still owe money (the same rule as "Saldo pendiente" in Resumen). Abonos for appointments
 * that have not happened are credit, not debt (see `clients.summary`).
 */
export const listByClient = memberQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await getOwned(ctx, "clients", clientId);
    const [payments, appointments] = await Promise.all([
      ctx.db.query("payments").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect(),
      ctx.db.query("appointments").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect(),
    ]);
    const byId = new Map(appointments.map((a) => [a._id, a]));
    const treatmentNames = new Map<Id<"treatments">, string>();
    async function treatmentName(id: Id<"treatments">) {
      if (!treatmentNames.has(id)) treatmentNames.set(id, (await ctx.db.get(id))?.name ?? "");
      return treatmentNames.get(id)!;
    }

    const rows = [];
    for (const payment of payments.sort((a, b) => b.paidAt - a.paidAt)) {
      const appointment = byId.get(payment.appointmentId);
      rows.push({
        ...toRow(payment),
        appointmentStart: appointment?.start,
        treatmentName: appointment ? await treatmentName(appointment.treatmentId) : "",
      });
    }

    const owing = [];
    for (const appointment of appointments.sort((a, b) => b.start - a.start)) {
      if (!owesBalance(appointment)) continue;
      owing.push({
        _id: appointment._id,
        start: appointment.start,
        status: appointment.status,
        price: appointment.price,
        paidTotal: appointment.paidTotal,
        treatmentName: await treatmentName(appointment.treatmentId),
      });
    }

    return { payments: rows, owing };
  },
});
