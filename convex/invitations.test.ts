/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return (error.data as { code: string }).code;
    throw error;
  }
  throw new Error("Expected the call to fail");
}

async function setup() {
  const t = convexTest(schema, modules);
  const ana = t.withIdentity({ subject: "ana", email: "ana@example.com" });
  const orgId = await ana.mutation(api.orgs.create, {
    kind: "salon",
    name: "Salón Brisa",
    profile: { name: "Ana", color: "plum" },
    schedule: [],
    treatments: [],
  });
  const invitationId = await ana.mutation(api.invitations.create, { email: " Sofi@Example.com ", role: "staff" });
  const invitation = (await t.run((ctx) => ctx.db.get(invitationId)))!;
  return {
    t,
    ana,
    orgId,
    invitationId,
    token: invitation.token,
    sofi: t.withIdentity({ subject: "sofi", email: "sofi@example.com", name: "Sofía Pérez" }),
  };
}

describe("invitations", () => {
  test("an admin invites by email and the invitee joins the org after login", async () => {
    const { t, orgId, token, sofi, invitationId } = await setup();
    expect(await t.query(api.invitations.get, { token })).toEqual({
      orgName: "Salón Brisa",
      email: "sofi@example.com",
      role: "staff",
      status: "pending",
    });
    expect(await sofi.query(api.invitations.mine, {})).toEqual([{ token, orgName: "Salón Brisa" }]);

    expect(await sofi.mutation(api.invitations.accept, { token })).toBe(orgId);

    const docs = await t.run(async (ctx) => ({
      invitation: await ctx.db.get(invitationId),
      member: await ctx.db
        .query("members")
        .withIndex("by_user", (q) => q.eq("userId", "sofi"))
        .unique(),
      settings: await ctx.db
        .query("userSettings")
        .withIndex("by_user", (q) => q.eq("userId", "sofi"))
        .unique(),
    }));
    expect(docs.invitation?.status).toBe("accepted");
    expect(docs.member).toMatchObject({
      orgId,
      role: "staff",
      email: "sofi@example.com",
      name: "Sofía Pérez",
      active: true,
      bookable: true,
    });
    // Ana took plum, so the new member gets the next free color.
    expect(docs.member?.color).toBe("teal");
    expect(docs.settings?.activeOrgId).toBe(orgId);
    expect((await sofi.query(api.members.me, {})).role).toBe("staff");

    // Accepting again is harmless; the token cannot be reused by someone else.
    expect(await sofi.mutation(api.invitations.accept, { token })).toBe(orgId);
    expect(await errorCode(t.withIdentity({ subject: "otra", email: "sofi@example.com" }).mutation(api.invitations.accept, { token }))).toBe(
      "INVALID",
    );
  });

  test("only the invited email can accept", async () => {
    const { t, token } = await setup();
    const intrusa = t.withIdentity({ subject: "intrusa", email: "intrusa@example.com" });
    expect(await errorCode(intrusa.mutation(api.invitations.accept, { token }))).toBe("FORBIDDEN");
    expect(await errorCode(t.mutation(api.invitations.accept, { token }))).toBe("UNAUTHENTICATED");
  });

  test("expired and cancelled invitations cannot be accepted", async () => {
    const { t, ana, sofi, token, invitationId } = await setup();
    await t.run((ctx) => ctx.db.patch(invitationId, { expiresAt: Date.now() - 1 }));
    expect((await t.query(api.invitations.get, { token }))?.status).toBe("expired");
    expect(await errorCode(sofi.mutation(api.invitations.accept, { token }))).toBe("INVALID");

    await ana.mutation(api.invitations.resend, { id: invitationId });
    expect((await t.query(api.invitations.get, { token }))?.status).toBe("pending");
    await ana.mutation(api.invitations.cancel, { id: invitationId });
    expect(await errorCode(sofi.mutation(api.invitations.accept, { token }))).toBe("INVALID");
    expect(await ana.query(api.invitations.list, {})).toEqual([]);
  });

  test("inviting the same email again renews the pending invitation", async () => {
    const { ana, invitationId } = await setup();
    expect(await ana.mutation(api.invitations.create, { email: "sofi@example.com", role: "admin" })).toBe(invitationId);
    expect(await ana.query(api.invitations.list, {})).toEqual([expect.objectContaining({ _id: invitationId, role: "admin" })]);
  });

  test("staff cannot invite, list, or cancel invitations", async () => {
    const { ana, t, token, invitationId } = await setup();
    const sofi = t.withIdentity({ subject: "sofi", email: "sofi@example.com" });
    await sofi.mutation(api.invitations.accept, { token });
    expect(await errorCode(sofi.mutation(api.invitations.create, { email: "x@example.com", role: "staff" }))).toBe("FORBIDDEN");
    expect(await errorCode(sofi.query(api.invitations.list, {}))).toBe("FORBIDDEN");
    expect(await errorCode(sofi.mutation(api.invitations.cancel, { id: invitationId }))).toBe("FORBIDDEN");
    expect(await errorCode(ana.mutation(api.invitations.create, { email: "sofi@example.com", role: "staff" }))).toBe("INVALID");
  });

  test("unknown tokens return nothing", async () => {
    const { t } = await setup();
    expect(await t.query(api.invitations.get, { token: "nope" })).toBeNull();
  });
});
