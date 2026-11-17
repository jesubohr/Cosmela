import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { setupOrgs } from "./lib/fixtures.testing";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("data lifecycle", () => {
  test("exports only the administrator's tenant and denies staff", async () => {
    const { asAna, asSofi, ids } = await setupOrgs();
    const page = await asAna.query(api.dataLifecycle.exportPage, { table: "clients", paginationOpts: { cursor: null, numItems: 1 } });
    expect(page.page.map((row) => row._id)).toEqual([ids.clientA]);
    await expect(asSofi.query(api.dataLifecycle.exportPage, { table: "clients", paginationOpts: { cursor: null, numItems: 10 } })).rejects.toThrow();
  });

  test("requires confirmation and canceled renewal; deletion respects holds and other tenants", async () => {
    const { t, asAna, ids } = await setupOrgs();
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", { orgId: ids.orgA, polarId: "sub", productId: "product", status: "active", cancelAtPeriodEnd: false, modifiedAt: Date.now() });
    });
    await expect(asAna.action(api.dataLifecycle.close, { confirmation: "CERRAR" })).rejects.toThrow();
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ id: "sub", product_id: "product", status: "active", cancel_at_period_end: true, current_period_end: null, created_at: new Date(Date.now() + 1000).toISOString(), modified_at: null, metadata: {}, customer: { external_id: ids.orgA } }] }), { status: 200 })));
    await t.run(async (ctx) => {
      const sub = await ctx.db.query("subscriptions").withIndex("by_org", (q) => q.eq("orgId", ids.orgA)).unique();
      await ctx.db.patch(sub!._id, { cancelAtPeriodEnd: true });
    });
    await expect(asAna.action(api.dataLifecycle.close, { confirmation: "no" })).rejects.toThrow();
    await asAna.action(api.dataLifecycle.close, { confirmation: "CERRAR" });
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.orgA, { exportUntil: Date.now() - 1, activeDeletionDueAt: Date.now() - 1, lifecycleNextRunAt: Date.now() - 1 });
      await ctx.db.insert("lifecycleHolds", { orgId: ids.orgA, table: "clients", recordId: ids.clientA, reason: "dispute", owner: "operator", reviewAt: Date.now() });
    });
    await t.mutation(internal.dataLifecycle.sweepDue, {});
    expect(await t.run((ctx) => ctx.db.get(ids.clientA))).not.toBeNull();
    await t.run(async (ctx) => {
      const hold = await ctx.db.query("lifecycleHolds").first();
      await ctx.db.patch(hold!._id, { releasedAt: Date.now() });
      await ctx.db.patch(ids.orgA, { lifecycleNextRunAt: Date.now() - 1 });
    });
    for (let i = 0; i < 10; i++) await t.mutation(internal.dataLifecycle.sweepDue, {});
    expect(await t.run((ctx) => ctx.db.get(ids.clientA))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.clientB))).not.toBeNull();
  });
  test("refuses closure when live Polar state still renews or cannot be verified", async () => {
    const { t, asAna, ids } = await setupOrgs();
    await t.run((ctx) => ctx.db.insert("subscriptions", { orgId: ids.orgA, polarId: "sub", productId: "product", status: "active", cancelAtPeriodEnd: true, modifiedAt: 1 }));
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [{ id: "sub", product_id: "product", status: "active", cancel_at_period_end: false, current_period_end: null, created_at: new Date().toISOString(), modified_at: null, metadata: {}, customer: { external_id: ids.orgA } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(asAna.action(api.dataLifecycle.close, { confirmation: "CERRAR" })).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.get(ids.orgA)))?.closureConfirmedAt).toBeUndefined();
    fetchMock.mockImplementation(async () => new Response("", { status: 503 }));
    await expect(asAna.action(api.dataLifecycle.close, { confirmation: "CERRAR" })).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.get(ids.orgA)))?.closureConfirmedAt).toBeUndefined();
  });

  test("schedules cleanup after the export window", async () => {
    const { t, asAna, ids } = await setupOrgs();
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "");
    await asAna.action(api.dataLifecycle.close, { confirmation: "CERRAR" });
    const org = await t.run((ctx) => ctx.db.get(ids.orgA));
    expect(org?.lifecycleNextRunAt).toBe(org!.exportUntil! + 1);
    await t.mutation(internal.dataLifecycle.sweepDue, {});
    expect(await t.run((ctx) => ctx.db.get(ids.clientA))).not.toBeNull();
  });

  test("checks every Polar page before closure", async () => {
    const { t, asAna, ids } = await setupOrgs();
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    const item = { id: "sub", product_id: "product", status: "active", cancel_at_period_end: false, current_period_end: null, created_at: new Date().toISOString(), modified_at: null, metadata: {}, customer: { external_id: ids.orgA } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], pagination: { max_page: 2 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [item], pagination: { max_page: 2 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(asAna.action(api.dataLifecycle.close, { confirmation: "CERRAR" })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await t.run((ctx) => ctx.db.get(ids.orgA)))?.closureConfirmedAt).toBeUndefined();
  });

  test("blocks an open checkout and releases the closure lock", async () => {
    const { t, asAna, ids } = await setupOrgs();
    await t.run(async (ctx) => {
      const document = await ctx.db.insert("legalDocuments", { type: "terms", version: "test", language: "es-CO", content: "test", hash: "hash", effectiveAt: 1, material: true });
      await ctx.db.insert("checkoutAcceptances", { orgId: ids.orgA, userId: "ana", version: "test", plan: "solo", amount: 1, currency: "COP", interval: "month", termsId: document, refundsId: document, label: "test", at: Date.now(), checkoutState: "created", polarCheckoutId: "checkout-1" });
    });
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => {
      const org = await t.run((ctx) => ctx.db.get(ids.orgA));
      expect(org?.closureRequestedAt).toBeDefined();
      return new Response(JSON.stringify({ id: "checkout-1", status: "open" }), { status: 200 });
    }));
    await expect(asAna.action(api.dataLifecycle.close, { confirmation: "CERRAR" })).rejects.toThrow();
    const org = await t.run((ctx) => ctx.db.get(ids.orgA));
    expect(org?.closureRequestedAt).toBeUndefined();
    expect(org?.closureConfirmedAt).toBeUndefined();
  });

  test("blocks checkout acceptance while a closure lock exists", async () => {
    const { t, asAna, ids } = await setupOrgs();
    await t.run((ctx) => ctx.db.patch(ids.orgA, { closureRequestedAt: Date.now() }));
    await expect(asAna.mutation(internal.billing.recordCheckoutAcceptance, { orgId: ids.orgA, plan: "solo", amount: 1, version: "test" })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("checkoutAcceptances").collect())).toHaveLength(0);
  });

  test("allows a succeeded checkout only after its subscription is verified canceled", async () => {
    const { t, asAna, ids } = await setupOrgs();
    await t.run(async (ctx) => {
      const document = await ctx.db.insert("legalDocuments", { type: "terms", version: "test", language: "es-CO", content: "test", hash: "hash", effectiveAt: 1, material: true });
      await ctx.db.insert("checkoutAcceptances", { orgId: ids.orgA, userId: "ana", version: "test", plan: "solo", amount: 1, currency: "COP", interval: "month", termsId: document, refundsId: document, label: "test", at: Date.now(), checkoutState: "created", polarCheckoutId: "checkout-1" });
    });
    const sub = { id: "sub", product_id: "product", status: "active", cancel_at_period_end: true, current_period_end: null, created_at: new Date().toISOString(), modified_at: null, metadata: {}, customer: { external_id: ids.orgA } };
    vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "checkout-1", status: "succeeded", subscription_id: "sub" }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify(sub), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ items: [sub] }), { status: 200 })));
    await asAna.action(api.dataLifecycle.close, { confirmation: "CERRAR" });
    expect((await t.run((ctx) => ctx.db.get(ids.orgA)))?.closureConfirmedAt).toBeDefined();
  });

});
