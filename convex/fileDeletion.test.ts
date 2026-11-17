import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { queueFileDeletion } from "./fileDeletion";
import { setupOrgs, upload } from "./lib/fixtures.testing";

describe("verified private file deletion", () => {
  test("keeps file ownership until verification and retries failure without deleting another tenant", async () => {
    const s = await setupOrgs();
    const key = await upload(s.t, s.ids.orgA, s.ids.ana, "photo");
    await s.t.run(async ctx => {
      const row = await ctx.db.query("uploads").withIndex("by_key", q => q.eq("key", key)).unique();
      await queueFileDeletion(ctx, row!);
      await queueFileDeletion(ctx, row!);
    });
    const request = await s.t.run(ctx => ctx.db.query("fileDeletionRequests").unique());
    expect(request?.attempts).toBe(0);
    await s.t.mutation(internal.fileDeletion.result, { id: request!._id, verified: false });
    const failed = await s.t.run(ctx => ctx.db.get(request!._id));
    expect(failed?.verifiedAt).toBeUndefined();
    expect(failed?.attempts).toBe(1);
    expect(failed?.nextAttemptAt).toBeGreaterThan(Date.now());
    expect(await s.t.run(ctx => ctx.db.query("uploads").withIndex("by_key", q => q.eq("key", key)).unique())).toBeTruthy();
    await s.t.mutation(internal.fileDeletion.result, { id: request!._id, verified: true });
    expect((await s.t.run(ctx => ctx.db.get(request!._id)))?.verifiedAt).toBeDefined();
    expect(await s.t.run(ctx => ctx.db.query("uploads").withIndex("by_key", q => q.eq("key", key)).unique())).toBeNull();
    expect(await s.t.run(ctx => ctx.db.get(s.ids.clientB))).toBeTruthy();
  });

  test("an active legal hold pauses retries without starving other requests", async () => {
    const s = await setupOrgs();
    await s.t.run(async ctx => {
      await ctx.db.insert("lifecycleHolds", { orgId: s.ids.orgA, table: "clients", recordId: s.ids.clientA, reason: "Custody review", owner: "operator", reviewAt: Date.now() });
      await ctx.db.insert("fileDeletionRequests", { orgId: s.ids.orgA, key: "held", requestedAt: Date.now(), nextAttemptAt: Date.now() });
      await ctx.db.insert("fileDeletionRequests", { orgId: s.ids.orgB, key: "ready", requestedAt: Date.now(), nextAttemptAt: Date.now() });
    });
    const due = await s.t.mutation(internal.fileDeletion.due, {});
    expect(due.map(row => row.key)).toEqual(["ready"]);
    const held = await s.t.run(ctx => ctx.db.query("fileDeletionRequests").withIndex("by_org_key", q => q.eq("orgId", s.ids.orgA).eq("key", "held")).unique());
    expect(held?.nextAttemptAt).toBeGreaterThan(Date.now());
  });
});
