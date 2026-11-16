import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { adminQuery } from "./lib/authz";
import { bogotaToEpoch } from "./lib/time";
import type { PaymentMethod } from "./lib/validators";
import { invalid } from "./treatments";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-12" → "2027-01". */
export function nextMonthKey(month: string) {
  const [year, m] = month.split("-").map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
}

type Tally = { count: number; revenue: number };

/**
 * Monthly numbers for a Bogotá month ("YYYY-MM"). Ingresos are payments by `paidAt`,
 * so treatment and professional revenue add up to the monthly total.
 */
export const month = adminQuery({
  args: { month: v.string() },
  handler: async (ctx, { month }) => {
    if (!MONTH.test(month)) invalid("Elige un mes válido.");
    const start = bogotaToEpoch(`${month}-01`);
    const end = bogotaToEpoch(`${nextMonthKey(month)}-01`);

    const [payments, appointments, newClients, owing, members] = await Promise.all([
      ctx.db
        .query("payments")
        .withIndex("by_org_paidAt", (q) => q.eq("orgId", ctx.orgId).gte("paidAt", start).lt("paidAt", end))
        .collect(),
      ctx.db
        .query("appointments")
        .withIndex("by_org_start", (q) => q.eq("orgId", ctx.orgId).gte("start", start).lt("start", end))
        .collect(),
      ctx.db
        .query("clients")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId).gte("_creationTime", start).lt("_creationTime", end))
        .collect(),
      ctx.db.query("appointments").withIndex("by_org_balance", (q) => q.eq("orgId", ctx.orgId).eq("hasBalance", true)).collect(),
      ctx.db.query("members").withIndex("by_org", (q) => q.eq("orgId", ctx.orgId)).collect(),
    ]);

    const byTreatment = new Map<Id<"treatments">, Tally>();
    const byMember = new Map<Id<"members">, Tally>();
    const tally = <K>(map: Map<K, Tally>, key: K) => {
      if (!map.has(key)) map.set(key, { count: 0, revenue: 0 });
      return map.get(key)!;
    };

    const completed = appointments.filter((a) => a.status === "completed");
    for (const a of completed) {
      tally(byTreatment, a.treatmentId).count += 1;
      tally(byMember, a.memberId).count += 1;
    }

    const appointmentCache = new Map<Id<"appointments">, Doc<"appointments"> | null>(appointments.map((a) => [a._id, a]));
    const byMethod = new Map<PaymentMethod, number>();
    let income = 0;
    for (const p of payments) {
      income += p.amount;
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
      if (!appointmentCache.has(p.appointmentId)) appointmentCache.set(p.appointmentId, await ctx.db.get(p.appointmentId));
      const appointment = appointmentCache.get(p.appointmentId);
      if (!appointment) continue;
      tally(byTreatment, appointment.treatmentId).revenue += p.amount;
      tally(byMember, appointment.memberId).revenue += p.amount;
    }

    const treatments = [];
    for (const [treatmentId, t] of byTreatment) {
      treatments.push({ treatmentId, name: (await ctx.db.get(treatmentId))?.name ?? "", ...t });
    }

    return {
      income,
      completed: completed.length,
      newClients: newClients.length,
      balance: owing.reduce((sum, a) => sum + a.price - a.paidTotal, 0),
      byMethod: [...byMethod].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
      // "Más realizados": only treatments attended this month; `revenue` is what was collected for them.
      treatments: treatments
        .filter((t) => t.count > 0)
        .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
        .slice(0, 5),
      members: members
        .filter((m) => m.active || byMember.has(m._id))
        .map((m) => ({ memberId: m._id, name: m.name, color: m.color, ...(byMember.get(m._id) ?? { count: 0, revenue: 0 }) }))
        .sort((a, b) => b.revenue - a.revenue || b.count - a.count),
    };
  },
});
