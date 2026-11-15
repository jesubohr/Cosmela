import { R2 } from "@convex-dev/r2";
import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { fail, getOwned, memberMutation, memberQuery } from "./lib/authz";
import { vPhotoKind } from "./lib/validators";

// Private bucket configured by the R2_* env vars on the Convex deployment.
export const r2 = new R2(components.r2);

const URL_TTL_SECONDS = 5 * 60;

/** Keys are `orgs/{orgId}/{kind}/{uuid}`, so the prefix proves which org owns a file. */
export function assertOrgKey(orgId: Id<"orgs">, key: string) {
  if (!key.startsWith(`orgs/${orgId}/`)) fail("NOT_FOUND");
}

/** Returns `{ key, url }`. PUT the file body to `url`, then pass `key` to a mutation that stores it. */
export const generateUploadUrl = memberMutation({
  args: { kind: literals("photo", "signature", "logo") },
  handler: async (ctx, { kind }) => {
    return await r2.generateUploadUrl(`orgs/${ctx.orgId}/${kind}/${crypto.randomUUID()}`);
  },
});

/** Short-lived (5 min) signed URL for a file of the caller's org. */
export const getUrl = memberQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    assertOrgKey(ctx.orgId, key);
    return await r2.getUrl(key, { expiresIn: URL_TTL_SECONDS });
  },
});

/** Signed URLs for several keys at once, as `{ [key]: url }`. */
export const getUrls = memberQuery({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    const urls: Record<string, string> = {};
    for (const key of keys) {
      assertOrgKey(ctx.orgId, key);
      urls[key] = await r2.getUrl(key, { expiresIn: URL_TTL_SECONDS });
    }
    return urls;
  },
});

/**
 * Stores an uploaded key on its owning document after checking ownership.
 * Consent and data-authorization signatures are stored by the mutations that save
 * those records (they call `assertOrgKey`).
 */
export const attach = memberMutation({
  args: {
    key: v.string(),
    target: v.union(
      v.object({ kind: v.literal("memberSignature") }),
      v.object({ kind: v.literal("orgLogo") }),
      v.object({ kind: v.literal("sessionPhoto"), sessionId: v.id("sessions"), photoKind: vPhotoKind }),
    ),
  },
  handler: async (ctx, { key, target }) => {
    assertOrgKey(ctx.orgId, key);

    switch (target.kind) {
      case "memberSignature": {
        // The previous file stays: signed consents keep referencing it.
        await ctx.db.patch(ctx.member._id, { signatureKey: key });
        return;
      }
      case "orgLogo": {
        if (ctx.member.role !== "admin") fail("FORBIDDEN", "Solo un administrador puede cambiar el logo.");
        const org = await ctx.db.get(ctx.orgId);
        await ctx.db.patch(ctx.orgId, { logoKey: key });
        if (org?.logoKey && org.logoKey !== key) await r2.deleteObject(ctx, org.logoKey);
        return;
      }
      case "sessionPhoto": {
        const session = await getOwned(ctx, "sessions", target.sessionId);
        if (session.status !== "draft") fail("FORBIDDEN", "Esta atención ya está cerrada.");
        if (session.consent?.photoUse === "none") fail("FORBIDDEN", "El cliente no autorizó fotos.");
        await ctx.db.patch(session._id, {
          photos: [...session.photos, { key, kind: target.photoKind, at: Date.now() }],
        });
        return;
      }
    }
  },
});
