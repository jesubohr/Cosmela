import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { DEFAULT_SCHEDULE } from "../components/settings/schedule";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, query, type MutationCtx } from "./_generated/server";
import { adminMutation, adminQuery, authedMutation, authedQuery, fail, getOwned, requireStaffRoom, requireWritable } from "./lib/authz";
import { vRole } from "./lib/validators";
import { nextFreeColor } from "./members";
import { invalid } from "./treatments";

const EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
// The local backend runs with SITE_URL=http://localhost:3000.
const isDevelopment = siteUrl.startsWith("http://localhost");

// In development only Resend test addresses are sent; the link is logged instead.
const mailer = new Resend(components.resend, { testMode: isDevelopment });

type InvitationStatus = Doc<"invitations">["status"] | "expired";

function statusOf(invitation: Doc<"invitations">, now = Date.now()): InvitationStatus {
  return invitation.status === "pending" && invitation.expiresAt < now ? "expired" : invitation.status;
}

function newToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function scheduleEmail(ctx: MutationCtx, invitation: Pick<Doc<"invitations">, "email" | "token" | "orgId">, inviterName: string) {
  const org = await ctx.db.get(invitation.orgId);
  await ctx.scheduler.runAfter(0, internal.invitations.sendEmail, {
    to: invitation.email,
    orgName: org?.name ?? "Cosmela",
    inviterName,
    url: `${siteUrl}/invitacion/${invitation.token}`,
  });
}

/** Pending invitations of the org. */
export const list = adminQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect();
    return invitations
      .filter((i) => i.status === "pending")
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((i) => ({ _id: i._id, email: i.email, role: i.role, token: i.token, expired: i.expiresAt < now }));
  },
});

/** Invites by email, or renews and resends a pending invitation for the same email. */
export const create = adminMutation({
  args: { email: v.string(), role: vRole },
  handler: async (ctx, { role, ...args }) => {
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) invalid("Escribe un correo válido, como nombre@correo.com.");

    const members = await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect();
    if (members.some((m) => m.active && m.email === email)) invalid("Esta persona ya está en tu equipo.");
    await requireStaffRoom(ctx, ctx.orgId);

    const pending = (
      await ctx.db
        .query("invitations")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect()
    ).find((i) => i.orgId === ctx.orgId && i.status === "pending");

    const expiresAt = Date.now() + EXPIRES_MS;
    let invitation: Doc<"invitations">;
    if (pending) {
      await ctx.db.patch(pending._id, { role, expiresAt, invitedBy: ctx.member._id });
      invitation = { ...pending, role, expiresAt };
    } else {
      const id = await ctx.db.insert("invitations", {
        orgId: ctx.orgId,
        email,
        role,
        token: newToken(),
        invitedBy: ctx.member._id,
        status: "pending",
        expiresAt,
      });
      invitation = (await ctx.db.get(id))!;
    }
    await scheduleEmail(ctx, invitation, ctx.member.name);
    return invitation._id;
  },
});

export const resend = adminMutation({
  args: { id: v.id("invitations") },
  handler: async (ctx, { id }) => {
    const invitation = await getOwned(ctx, "invitations", id);
    if (invitation.status !== "pending") invalid("Esta invitación ya no está pendiente.");
    await ctx.db.patch(id, { expiresAt: Date.now() + EXPIRES_MS });
    await scheduleEmail(ctx, invitation, ctx.member.name);
  },
});

export const cancel = adminMutation({
  args: { id: v.id("invitations") },
  handler: async (ctx, { id }) => {
    const invitation = await getOwned(ctx, "invitations", id);
    if (invitation.status === "pending") await ctx.db.patch(id, { status: "cancelled" });
  },
});

/** Public: what the invitation page shows. Anyone with the token can read it. */
export const get = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invitation) return null;
    const org = await ctx.db.get(invitation.orgId);
    if (!org || org.closureConfirmedAt !== undefined) return null;
    return { orgName: org?.name ?? "", email: invitation.email, role: invitation.role, status: statusOf(invitation) };
  },
});

/** Pending invitations for the signed-in email, so onboarding can offer to join instead. */
export const mine = authedQuery({
  args: {},
  handler: async (ctx) => {
    const email = (await ctx.auth.getUserIdentity())?.email?.toLowerCase();
    if (!email) return [];
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const open = invitations.filter((i) => statusOf(i) === "pending");
    return await Promise.all(
      open.map(async (i) => ({ token: i.token, orgName: (await ctx.db.get(i.orgId))?.name ?? "" })),
    );
  },
});

/** Joins the org as the invited role and makes it the active org. The signed-in email must match. */
export const accept = authedMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invitation) fail("NOT_FOUND", "Esta invitación no existe.");
    const status = statusOf(invitation);
    if (status === "expired") invalid("Esta invitación venció. Pide una nueva a quien te invitó.");
    if (status === "cancelled") invalid("Esta invitación fue cancelada.");

    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email?.toLowerCase();
    if (email !== invitation.email) {
      fail("FORBIDDEN", `Esta invitación es para ${invitation.email}. Ingresa con ese correo para aceptarla.`);
    }

    const existing = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) => q.eq("orgId", invitation.orgId).eq("userId", ctx.userId))
      .unique();
    if (status === "accepted" && !existing) invalid("Esta invitación ya fue usada.");
    if (status === "pending" && !existing?.active) {
      await requireWritable(ctx, invitation.orgId);
      await requireStaffRoom(ctx, invitation.orgId);
    }

    if (existing) {
      if (status === "pending") await ctx.db.patch(existing._id, { active: true, role: invitation.role });
    } else {
      const team = await ctx.db
        .query("members")
        .withIndex("by_org", (q) => q.eq("orgId", invitation.orgId))
        .collect();
      await ctx.db.insert("members", {
        orgId: invitation.orgId,
        userId: ctx.userId,
        email,
        role: invitation.role,
        name: identity?.name?.trim() || email.split("@")[0],
        color: nextFreeColor(team.map((m) => m.color)),
        schedule: DEFAULT_SCHEDULE,
        bookable: true,
        active: true,
      });
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .unique();
    if (settings) await ctx.db.patch(settings._id, { activeOrgId: invitation.orgId });
    else await ctx.db.insert("userSettings", { userId: ctx.userId, activeOrgId: invitation.orgId });

    if (status === "pending") await ctx.db.patch(invitation._id, { status: "accepted" });
    return invitation.orgId;
  },
});

export const sendEmail = internalAction({
  args: { to: v.string(), orgName: v.string(), inviterName: v.string(), url: v.string() },
  handler: async (ctx, { to, orgName, inviterName, url }) => {
    if (isDevelopment) console.log(`[dev] Invitation link for ${to}: ${url}`);
    try {
      const from = process.env.RESEND_FROM;
      if (!from) throw new Error("RESEND_FROM is not set");
      await mailer.sendEmail(ctx, {
        from,
        to,
        subject: `${inviterName} te invitó al equipo de ${orgName} en Cosmela`,
        html: invitationHtml(orgName, inviterName, url),
        text: `${inviterName} te invitó al equipo de ${orgName} en Cosmela. Acepta la invitación aquí: ${url}\n\nVence en 7 días.`,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (isDevelopment) console.warn(`[dev] Invitation email not sent (${reason}). Use the link above.`);
      else console.error(`Invitation email not sent: ${reason}`);
    }
  },
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function invitationHtml(orgName: string, inviterName: string, url: string) {
  return `<!doctype html>
<html lang="es-CO">
  <body style="margin:0;padding:32px 16px;background:#F6F4F8;font-family:Arial,Helvetica,sans-serif;color:#2A2131">
    <div style="max-width:440px;margin:0 auto;background:#FFFFFF;border:1px solid #E6E0EB;border-radius:14px;padding:32px">
      <p style="margin:0 0 24px;font-size:18px;color:#5B2A86">Cosmela</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escapeHtml(inviterName)} te invitó al equipo de <strong>${escapeHtml(orgName)}</strong>.</p>
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#5B2A86;color:#FFFFFF;text-decoration:none;font-size:16px;padding:12px 20px;border-radius:10px">Aceptar invitación</a>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#6B6273">La invitación vence en 7 días. Si no esperabas este correo, ignóralo.</p>
    </div>
  </body>
</html>`;
}
