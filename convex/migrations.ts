import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { owners } from "./files";
import type { UploadKind } from "./lib/validators";
import { owesBalance } from "./payments";
import { POSTPONED_REASON } from "./sessions";

/**
 * One-off backfill for data created before `hasBalance`, session numbering at close,
 * `cases.memberIds`, and the `uploads` table. Safe to run more than once.
 * Reads whole tables, so it is meant for small (local or early) deployments:
 *   pnpm exec convex run migrations:backfill
 */
export const backfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    let appointments = 0;
    for (const a of await ctx.db.query("appointments").collect()) {
      const hasBalance = owesBalance(a);
      if (Boolean(a.hasBalance) !== hasBalance) {
        await ctx.db.patch(a._id, { hasBalance });
        appointments++;
      }
    }

    const sessions = await ctx.db.query("sessions").collect();
    const memberIds = new Map<Id<"cases">, Set<Id<"members">>>();
    for (const s of sessions) {
      if (s.status !== "closed" && s.number !== undefined) await ctx.db.patch(s._id, { number: undefined });
      if (s.status === "postponed" && !s.reason) await ctx.db.patch(s._id, { reason: POSTPONED_REASON });
      if (s.status !== "draft") memberIds.set(s.caseId, (memberIds.get(s.caseId) ?? new Set()).add(s.memberId));
      for (const photo of s.photos) await claim(ctx, s.orgId, photo.key, "photo", s.memberId, owners.session(s._id));
      if (s.consent) {
        await claim(ctx, s.orgId, s.consent.clientSignatureKey, "signature", s.memberId, owners.consent(s._id));
      }
    }
    for (const c of await ctx.db.query("cases").collect()) {
      const ids = [...(memberIds.get(c._id) ?? [])];
      if (ids.length > 0 && ids.length !== (c.memberIds?.length ?? 0)) await ctx.db.patch(c._id, { memberIds: ids });
    }

    const members = await ctx.db.query("members").collect();
    for (const m of members) {
      if (m.signatureKey) await claim(ctx, m.orgId, m.signatureKey, "signature", m._id, owners.member(m._id));
    }
    for (const org of await ctx.db.query("orgs").collect()) {
      const owner = members.find((m) => m.orgId === org._id && m.userId === org.ownerId);
      if (org.logoKey && owner) await claim(ctx, org._id, org.logoKey, "logo", owner._id, owners.org);
    }
    return { appointments, sessions: sessions.length };
  },
});

/** Records an existing key as an attached upload, unless it already has a row. */
async function claim(ctx: MutationCtx, orgId: Id<"orgs">, key: string, kind: UploadKind, uploadedBy: Doc<"members">["_id"], owner: string) {
  const existing = await ctx.db
    .query("uploads")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!existing) await ctx.db.insert("uploads", { orgId, key, kind, uploadedBy, attachedTo: owner });
}
