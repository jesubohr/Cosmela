import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { r2 } from "./files";

export async function queueFileDeletion(ctx: MutationCtx, upload: Doc<"uploads">) {
  const existing = await ctx.db.query("fileDeletionRequests").withIndex("by_org_key", q => q.eq("orgId", upload.orgId).eq("key", upload.key)).unique();
  if (!existing) await ctx.db.insert("fileDeletionRequests", { orgId: upload.orgId, key: upload.key, requestedAt: Date.now(), nextAttemptAt: Date.now(), attempts: 0 });
}

export const due = internalMutation({ args: {}, handler: async ctx => {
  const requests = await ctx.db.query("fileDeletionRequests").withIndex("by_next_attempt", q => q.gt("nextAttemptAt", undefined).lte("nextAttemptAt", Date.now())).take(25);
  const ready: Doc<"fileDeletionRequests">[] = [];
  for (const request of requests) {
    const hold = await ctx.db.query("lifecycleHolds").withIndex("by_org_record", q => q.eq("orgId", request.orgId)).filter(q => q.eq(q.field("releasedAt"), undefined)).first();
    if (hold) await ctx.db.patch(request._id, { nextAttemptAt: Date.now() + 24 * 60 * 60_000 });
    else ready.push(request);
  }
  return ready;
} });

export const result = internalMutation({
  args: { id: v.id("fileDeletionRequests"), verified: v.boolean() },
  handler: async (ctx, { id, verified }) => {
    const request = await ctx.db.get(id);
    if (!request || request.verifiedAt) return;
    const attempts = (request.attempts ?? 0) + 1;
    if (verified) {
      await ctx.db.patch(id, { verifiedAt: Date.now(), nextAttemptAt: undefined, attempts, lastError: undefined });
      const upload = await ctx.db.query("uploads").withIndex("by_key", q => q.eq("key", request.key)).unique();
      if (upload?.orgId === request.orgId) await ctx.db.delete(upload._id);
    } else {
      await ctx.db.patch(id, { attempts, lastError: "Provider deletion or verification failed; retry scheduled.", nextAttemptAt: Date.now() + Math.min(24 * 60, 2 ** Math.min(attempts, 10)) * 60_000 });
    }
  },
});

export const process = internalAction({ args: {}, handler: async ctx => {
  const requests = await ctx.runMutation(internal.fileDeletion.due, {});
  for (const request of requests) {
    let verified = false;
    try {
      await ctx.runAction(components.r2.lib.deleteR2Object, { key: request.key, ...r2.config });
      const url = await r2.getUrl(request.key, { expiresIn: 60 });
      const response = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(10_000) });
      verified = response.status === 404;
      await response.body?.cancel();
    } catch {
      // Never log a signed URL or service credentials from an upstream error.
    }
    await ctx.runMutation(internal.fileDeletion.result, { id: request._id, verified });
  }
} });

export const report = internalQuery({ args: {}, handler: async ctx => {
  const pending = await ctx.db.query("fileDeletionRequests").withIndex("by_next_attempt", q => q.gt("nextAttemptAt", undefined)).take(100);
  return pending.map(request => ({ id: request._id, orgId: request.orgId, attempts: request.attempts ?? 0,
    requestedAt: request.requestedAt, nextAttemptAt: request.nextAttemptAt, error: request.lastError }));
} });
