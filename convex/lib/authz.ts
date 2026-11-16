import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";

export type AuthzErrorCode = "UNAUTHENTICATED" | "NO_ORG" | "FORBIDDEN" | "NOT_FOUND";

const MESSAGES: Record<AuthzErrorCode, string> = {
  UNAUTHENTICATED: "Tu sesión terminó. Ingresa de nuevo.",
  NO_ORG: "Primero crea tu negocio.",
  FORBIDDEN: "No tienes permiso para hacer esto.",
  NOT_FOUND: "No encontramos lo que buscas.",
};

/** Throws `ConvexError({ code, message })`; `message` is Spanish and safe to show. */
export function fail(code: AuthzErrorCode, message = MESSAGES[code]): never {
  throw new ConvexError({ code, message });
}

/** Better Auth user id of the caller (`identity.subject`). */
export async function requireUserId(ctx: QueryCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED");
  return identity.subject;
}

/** Resolves identity → `userSettings.activeOrgId` → active `members` row. */
export async function requireMember(ctx: QueryCtx) {
  const userId = await requireUserId(ctx);
  const settings = await ctx.db
    .query("userSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!settings) fail("NO_ORG");
  const member = await ctx.db
    .query("members")
    .withIndex("by_org_user", (q) => q.eq("orgId", settings.activeOrgId).eq("userId", userId))
    .unique();
  if (!member) fail("NO_ORG");
  if (!member.active) fail("FORBIDDEN", "Tu acceso a este negocio está desactivado.");
  return { userId, member, orgId: member.orgId };
}

export async function requireAdmin(ctx: QueryCtx) {
  const result = await requireMember(ctx);
  if (result.member.role !== "admin") fail("FORBIDDEN", "Solo un administrador puede hacer esto.");
  return result;
}

/** Signed-in user, with or without an org (onboarding, invitations). Injects `ctx.userId`. */
export const authedQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ userId: await requireUserId(ctx) })),
);
export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ userId: await requireUserId(ctx) })),
);

/** Active member of the active org. Injects `ctx.userId`, `ctx.member`, `ctx.orgId`. */
export const memberQuery = customQuery(query, customCtx(requireMember));
export const memberMutation = customMutation(mutation, customCtx(requireMember));

/** Same as member functions, but the member must have `role: "admin"`. */
export const adminQuery = customQuery(query, customCtx(requireAdmin));
export const adminMutation = customMutation(mutation, customCtx(requireAdmin));

/** Tables whose documents carry `orgId`. */
export type OrgTable = Exclude<TableNames, "orgs" | "userSettings">;

/**
 * Loads a document and throws NOT_FOUND unless it belongs to the caller's org.
 * Use it for every id received from the client.
 */
export async function getOwned<T extends OrgTable>(
  ctx: QueryCtx & { orgId: Id<"orgs"> },
  table: T,
  id: Id<T>,
): Promise<Doc<T>> {
  const normalized = ctx.db.normalizeId(table, id);
  const doc = normalized ? await ctx.db.get(normalized) : null;
  if (!doc || (doc as unknown as { orgId: Id<"orgs"> }).orgId !== ctx.orgId) fail("NOT_FOUND");
  return doc;
}
