import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { billingEnforced, countActiveMembers, isReadOnly, limitMessage, loadBilling, readOnlyMessage } from "./billing";
import { hasProcessingAcceptance, requireAccountAcceptance, legalRequired } from "./legal";

export type AuthzErrorCode = "UNAUTHENTICATED" | "NO_ORG" | "FORBIDDEN" | "NOT_FOUND" | "READ_ONLY" | "PLAN_LIMIT";

const MESSAGES: Record<AuthzErrorCode, string> = {
  UNAUTHENTICATED: "Tu sesión terminó. Ingresa de nuevo.",
  NO_ORG: "Primero crea tu negocio.",
  FORBIDDEN: "No tienes permiso para hacer esto.",
  NOT_FOUND: "No encontramos lo que buscas.",
  READ_ONLY: "Tu prueba terminó. Elige un plan para seguir creando citas y fichas.",
  PLAN_LIMIT: "Tu plan no permite más profesionales.",
};

/** Throws `ConvexError({ code, message })`; `message` is Spanish and safe to show. */
export function fail(code: AuthzErrorCode, message = MESSAGES[code]): never {
  throw new ConvexError({ code, message });
}

/** Better Auth user id of the caller (`identity.subject`). */
export async function requireUserId(ctx: QueryCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED");
  await requireAccountAcceptance(ctx, identity.subject);
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
  const org = await ctx.db.get(member.orgId);
  if (!org || org.closureConfirmedAt !== undefined) fail("FORBIDDEN", "El negocio está en proceso de cierre. Puedes exportar tus datos desde Configuración o contactar a ayuda@cosmela.app.");
  if (!await hasProcessingAcceptance(ctx, member.orgId)) legalRequired("Un administrador debe aceptar el acuerdo de tratamiento de datos del negocio.");
  return { userId, member, orgId: member.orgId };
}

export async function requireAdmin(ctx: QueryCtx) {
  const result = await requireMember(ctx);
  if (result.member.role !== "admin") fail("FORBIDDEN", "Solo un administrador puede hacer esto.");
  return result;
}

/**
 * Billing write guard: throws READ_ONLY when the trial ended or the subscription
 * lapsed. Does nothing while `BILLING_ENFORCED` is off.
 */
export async function requireWritable(ctx: QueryCtx, orgId: Id<"orgs">) {
  const org = await ctx.db.get(orgId);
  if (!org || org.closureConfirmedAt !== undefined) fail("FORBIDDEN", "Este negocio está cerrado.");
  if (!billingEnforced()) return;
  const billing = await loadBilling(ctx, orgId);
  if (isReadOnly(billing.state)) fail("READ_ONLY", readOnlyMessage(billing));
}

/**
 * Plan limit for adding an active professional (invite, accept, reactivate).
 * Does nothing while `BILLING_ENFORCED` is off.
 */
export async function requireStaffRoom(ctx: QueryCtx, orgId: Id<"orgs">) {
  if (!billingEnforced()) return;
  const { limit } = await loadBilling(ctx, orgId);
  if (limit !== undefined && (await countActiveMembers(ctx, orgId)) >= limit) fail("PLAN_LIMIT", limitMessage(limit));
}

async function requireWritableMember(ctx: QueryCtx) {
  const result = await requireMember(ctx);
  await requireWritable(ctx, result.orgId);
  return result;
}

async function requireWritableAdmin(ctx: QueryCtx) {
  const result = await requireAdmin(ctx);
  await requireWritable(ctx, result.orgId);
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

/**
 * Active member of the active org. Injects `ctx.userId`, `ctx.member`, `ctx.orgId`.
 * Mutations also pass the billing write guard (`requireWritable`).
 */
export const memberQuery = customQuery(query, customCtx(requireMember));
export const memberMutation = customMutation(mutation, customCtx(requireWritableMember));

/** Same as member functions, but the member must have `role: "admin"`. */
export const adminQuery = customQuery(query, customCtx(requireAdmin));
export const adminMutation = customMutation(mutation, customCtx(requireWritableAdmin));

/**
 * Member mutations that stay open in read-only mode: the caller's own profile and
 * signature, and UI preferences. Never use them for business data.
 */
export const unguardedMemberMutation = customMutation(mutation, customCtx(requireMember));
export const unguardedAdminMutation = customMutation(mutation, customCtx(requireAdmin));

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
