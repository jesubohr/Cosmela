/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { LEGAL_DOCUMENTS, LEGAL_VERSION, ACCOUNT_TERMS_LABEL, ACCOUNT_PRIVACY_LABEL, ADULT_LABEL } from "../lib/legal-documents";
import { api } from "./_generated/api";
import { errorCode, setupOrgs } from "./lib/fixtures.testing";
import { sha256Hex } from "./lib/consent";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const acceptance = { version: LEGAL_VERSION, terms: true, privacy: true, adult: true };

describe("platform legal activation", () => {
  test("a verified identity cannot create a business until the exact terms, privacy and adult declaration are accepted", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "new-adult", email: "adult@example.com" });
    const business = { kind: "solo" as const, name: "Prueba", profile: { name: "Ana", color: "plum" as const }, schedule: [], treatments: [] };
    expect(await errorCode(user.mutation(api.orgs.create, business))).toBe("LEGAL_REQUIRED");
    for (const invalid of [{ ...acceptance, adult: false }, { ...acceptance, privacy: false }, { ...acceptance, terms: false }, { ...acceptance, version: "old" }]) {
      expect(await errorCode(user.mutation(api.legal.acceptAccount, invalid))).toBe("LEGAL_REQUIRED");
    }
    await user.mutation(api.legal.acceptAccount, acceptance);
    await user.mutation(api.legal.acceptAccount, acceptance);
    const records = await t.run(ctx => ctx.db.query("accountLegalAcceptances").collect());
    expect(records).toHaveLength(2);
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: "new-adult", label: ACCOUNT_TERMS_LABEL, adultLabel: ADULT_LABEL, action: "accepted" }),
      expect.objectContaining({ userId: "new-adult", label: ACCOUNT_PRIVACY_LABEL }),
    ]));
    for (const record of records) {
      const document = await t.run(ctx => ctx.db.get(record.documentId));
      const canonical = LEGAL_DOCUMENTS[record.type as "terms" | "privacy"];
      expect(document?.content).toBe(canonical.content);
      expect(document?.hash).toBe(await sha256Hex(canonical.content));
    }
    await user.mutation(api.orgs.create, business);
    expect(await errorCode(user.query(api.members.me, {}))).toBe("LEGAL_REQUIRED");
    await user.mutation(api.legal.acceptProcessing, { version: LEGAL_VERSION, authorized: true });
    expect((await user.query(api.members.me, {})).role).toBe("admin");
  });

  test("withdrawal preserves history and blocks business access; reacceptance adds new evidence", async () => {
    const s = await setupOrgs();
    await s.asAna.mutation(api.legal.withdrawAccount, {});
    expect((await s.asAna.query(api.legal.status, {})).accountAccepted).toBe(false);
    expect(await errorCode(s.asAna.query(api.clients.list, { paginationOpts: { numItems: 10, cursor: null } }))).toBe("LEGAL_REQUIRED");
    await s.asAna.mutation(api.legal.acceptAccount, acceptance);
    expect((await s.asAna.query(api.legal.status, {})).accountAccepted).toBe(true);
    const records = await s.t.run(ctx => ctx.db.query("accountLegalAcceptances").withIndex("by_user", q => q.eq("userId", "ana")).collect());
    expect(records.filter(row => row.action === "withdrawn")).toHaveLength(1);
    expect(records.filter(row => row.action === "accepted")).toHaveLength(4);
  });

  test("staff cannot accept the organization's processing agreement", async () => {
    const s = await setupOrgs();
    expect(await errorCode(s.asSofi.mutation(api.legal.acceptProcessing, { version: LEGAL_VERSION, authorized: true }))).toBe("FORBIDDEN");
    expect(await errorCode(s.asAna.mutation(api.legal.acceptProcessing, { version: "old", authorized: true }))).toBe("LEGAL_REQUIRED");
  });

  test("new document content cannot silently reuse evidence for a previous version", async () => {
    const s = await setupOrgs();
    await s.t.run(async ctx => {
      const record = await ctx.db.query("accountLegalAcceptances").withIndex("by_user", q => q.eq("userId", "ana")).first();
      await ctx.db.patch(record!.documentId, { hash: "changed" });
    });
    expect((await s.asAna.query(api.legal.status, {})).accountAccepted).toBe(false);
    await expect(s.asAna.mutation(api.legal.acceptAccount, acceptance)).rejects.toThrow("without a new version");
  });

  test("cookie receipt retries are idempotent and do not identify a user", async () => {
    const s = await setupOrgs();
    const receipt = { receiptId: crypto.randomUUID(), version: LEGAL_VERSION, choice: "rejected" as const };
    await s.t.mutation(api.legal.recordCookieChoice, receipt);
    await s.t.mutation(api.legal.recordCookieChoice, receipt);
    const records = await s.t.run(ctx => ctx.db.query("cookieChoices").collect());
    expect(records).toHaveLength(1);
    expect(records[0]).not.toHaveProperty("userId");
    expect(await errorCode(s.t.mutation(api.legal.recordCookieChoice, { ...receipt, version: "old" }))).toBe("INVALID");
  });
});
