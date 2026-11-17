import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { errorCode, setupOrgs } from "./lib/fixtures.testing";

describe("client authorizations", () => {
  test("requires health permission, records refusal and withdrawal, and isolates tenants", async () => {
    const { asAna, asBea, ids, t } = await setupOrgs();
    await t.run(async ctx => { for (const row of await ctx.db.query("clientAuthorizations").collect()) if (row.clientId === ids.clientA) await ctx.db.delete(row._id); });
    const notice = await asAna.query(api.clientAuthorizations.notice, { clientId: ids.clientA });
    const decision = { clientId: ids.clientA, purpose: "health" as const, policyHash: notice.policyHash, adult: true, evidence: "Signed paper on file" };
    expect(await asAna.query(api.clientAuthorizations.status, { clientId: ids.clientA })).toMatchObject({ health: false });
    await asAna.mutation(api.clientAuthorizations.record, { ...decision, action: "rejected", requestKey: "refusal" });
    expect(await asAna.query(api.clientAuthorizations.status, { clientId: ids.clientA })).toMatchObject({ health: false });
    const accepted = await asAna.mutation(api.clientAuthorizations.record, { ...decision, action: "accepted", requestKey: "accept" });
    expect(await asAna.mutation(api.clientAuthorizations.record, { ...decision, action: "accepted", requestKey: "accept" })).toBe(accepted);
    expect(await asAna.query(api.clientAuthorizations.status, { clientId: ids.clientA })).toMatchObject({ health: true });
    expect(await errorCode(asBea.mutation(api.clientAuthorizations.record, { ...decision, action: "accepted", requestKey: "other" }))).toBe("NOT_FOUND");
    expect(await errorCode(asAna.mutation(api.clientAuthorizations.record, { ...decision, policyHash: "stale", action: "accepted", requestKey: "stale" }))).toBe("STALE_POLICY");
    await asAna.mutation(api.clientAuthorizations.record, { ...decision, action: "withdrawn", requestKey: "withdraw" });
    expect(await asAna.query(api.clientAuthorizations.status, { clientId: ids.clientA })).toMatchObject({ health: false });
    const health = { conditions: [], allergies: [], skinConditions: [], none: { conditions: false, allergies: false, skin: false } };
    expect(await errorCode(asAna.mutation(api.clients.update, { clientId: ids.clientA, client: { firstName: "Laura", lastName: "Prueba", phone: "+573001234567", health } }))).toBe("AUTHORIZATION_REQUIRED");
    expect(await t.run(async ctx => (await ctx.db.query("clientAuthorizations").collect()).filter(row => row.clientId === ids.clientA).length)).toBe(3);
  });
  test("rejects minor and invalid birth dates during registration", async () => {
    const { asAna } = await setupOrgs();
    const notice = await asAna.query(api.clientAuthorizations.registrationNotice, {});
    const evidence = { adult: true, evidence: "Signed paper", policyHash: notice.policyHash, requestKey: "age" };
    for (const birthDate of ["2020-01-01", "2000-02-30"]) {
      expect(await errorCode(asAna.mutation(api.clients.create, { ...evidence, client: { firstName: "Eva", lastName: "", phone: "+573104445566", birthDate } }))).toBe("INVALID");
    }
    expect(await errorCode(asAna.mutation(api.clients.create, { ...evidence, adult: false, client: { firstName: "Eva", lastName: "", phone: "+573104445566" } }))).toBe("INVALID");
  });
  test("photo upload URLs require an authorized session", async () => {
    const { asAna } = await setupOrgs();
    expect(await errorCode(asAna.mutation(api.files.generateUploadUrl, { kind: "photo" }))).toBe("FORBIDDEN");
  });
});
