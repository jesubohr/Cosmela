import { R2 } from "@convex-dev/r2";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { fail, getOwned, memberMutation, memberQuery } from "./lib/authz";
import { vPhotoKind, vUploadKind, type UploadKind } from "./lib/validators";

// Private bucket configured by the R2_* env vars on the Convex deployment.
export const r2 = new R2(components.r2);

/**
 * Signed URLs live 1 hour. Queries that sign take a `bucket` argument that clients
 * advance every 45 minutes (`useSignedUrls`), so a cached result is replaced while
 * its URLs are still valid.
 */
export const URL_TTL_SECONDS = 60 * 60;
const MAX_KEYS = 100;
const DAY = 24 * 60 * 60_000;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

type MemberCtx = MutationCtx & { orgId: Id<"orgs">; member: Doc<"members"> };

/** Keys are `orgs/{orgId}/{kind}/{uuid}`, so the key proves which org owns a file. */
export function assertOrgKey(orgId: Id<"orgs">, key: string) {
  if (!new RegExp(`^orgs/${orgId}/(photo|signature|logo)/${UUID}$`).test(key)) fail("NOT_FOUND");
}

/** Owners recorded in `uploads.attachedTo`. */
export const owners = {
  session: (id: Id<"sessions">) => `session:${id}`,
  consent: (id: Id<"sessions">) => `consent:${id}`,
  member: (id: Id<"members">) => `member:${id}`,
  org: "org",
};

async function uploadOf(ctx: QueryCtx, key: string) {
  return await ctx.db
    .query("uploads")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

/** Marks an unattached upload of the caller's org and of `kind` as owned by `owner`. */
export async function claimUpload(ctx: MemberCtx, key: string, kind: UploadKind, owner: string) {
  const upload = await uploadOf(ctx, key);
  if (!upload || upload.orgId !== ctx.orgId || upload.kind !== kind) fail("NOT_FOUND");
  if (upload.attachedTo) fail("FORBIDDEN", "Este archivo ya está guardado en otro registro.");
  await ctx.db.patch(upload._id, { attachedTo: owner });
}

/** Deletes the files among `keys` that `owner` owns: the upload rows now, the R2 objects after commit. */
export async function deleteOwnedFiles(ctx: MutationCtx, owner: string, keys: string[]) {
  const deleted: string[] = [];
  for (const key of keys) {
    const upload = await uploadOf(ctx, key);
    if (upload?.attachedTo !== owner) continue;
    await ctx.db.delete(upload._id);
    deleted.push(key);
  }
  if (deleted.length > 0) await ctx.scheduler.runAfter(0, internal.files.deleteObjects, { keys: deleted });
}

export const deleteObjects = internalMutation({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    for (const key of keys) await r2.deleteObject(ctx, key);
  },
});

/** Cron: removes files uploaded more than a day ago that no record claimed (e.g. a step closed after the upload). */
export const sweepUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stale = (
      await ctx.db
        .query("uploads")
        .withIndex("by_attached", (q) => q.eq("attachedTo", undefined))
        .take(200)
    ).filter((upload) => upload._creationTime < Date.now() - DAY);
    for (const upload of stale) await ctx.db.delete(upload._id);
    if (stale.length > 0) await ctx.scheduler.runAfter(0, internal.files.deleteObjects, { keys: stale.map((u) => u.key) });
    return stale.length;
  },
});

/** Returns `{ key, url }`. PUT the file body to `url`, then pass `key` to a mutation that stores it. */
export const generateUploadUrl = memberMutation({
  args: { kind: vUploadKind },
  handler: async (ctx, { kind }) => {
    const key = `orgs/${ctx.orgId}/${kind}/${crypto.randomUUID()}`;
    await ctx.db.insert("uploads", { orgId: ctx.orgId, key, kind, uploadedBy: ctx.member._id });
    return await r2.generateUploadUrl(key);
  },
});

/** Signed URLs for files of the caller's org, as `{ [key]: url }`. Use it through `useSignedUrls`. */
export const getUrls = memberQuery({
  args: { keys: v.array(v.string()), bucket: v.number() },
  handler: async (ctx, { keys }) => {
    if (keys.length > MAX_KEYS) fail("FORBIDDEN");
    const urls: Record<string, string> = {};
    for (const key of keys) {
      assertOrgKey(ctx.orgId, key);
      urls[key] = await r2.getUrl(key, { expiresIn: URL_TTL_SECONDS });
    }
    return urls;
  },
});

/**
 * Stores an uploaded key on its owning document. The key must be an unclaimed upload
 * of the same org and kind. Consent signatures are claimed by `sessions.signConsent`.
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
    switch (target.kind) {
      case "memberSignature": {
        // The previous file stays: signed consents keep referencing it.
        await claimUpload(ctx, key, "signature", owners.member(ctx.member._id));
        await ctx.db.patch(ctx.member._id, { signatureKey: key });
        return;
      }
      case "orgLogo": {
        if (ctx.member.role !== "admin") fail("FORBIDDEN", "Solo un administrador puede cambiar el logo.");
        await claimUpload(ctx, key, "logo", owners.org);
        const org = await ctx.db.get(ctx.orgId);
        await ctx.db.patch(ctx.orgId, { logoKey: key });
        if (org?.logoKey && org.logoKey !== key) await deleteOwnedFiles(ctx, owners.org, [org.logoKey]);
        return;
      }
      case "sessionPhoto": {
        const session = await getOwned(ctx, "sessions", target.sessionId);
        if (session.status !== "draft") fail("FORBIDDEN", "Esta atención ya está cerrada.");
        if (session.consent?.photoUse === "none") fail("FORBIDDEN", "El cliente no autorizó fotos.");
        await claimUpload(ctx, key, "photo", owners.session(session._id));
        await ctx.db.patch(session._id, {
          photos: [...session.photos, { key, kind: target.photoKind, at: Date.now() }],
        });
        return;
      }
    }
  },
});
