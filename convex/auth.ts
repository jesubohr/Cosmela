import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins/email-otp";
import { ConvexError, v } from "convex/values";
import { Resend } from "resend";
import { components, internal } from "./_generated/api";
import { LEGAL_VERSION } from "../lib/legal-documents";
import { hasAccountAcceptance, hasProcessingAcceptance } from "./lib/legal";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import authConfig from "./auth.config";
import { rateLimiter } from "./rateLimits";

export const authComponent = createClient<DataModel>(components.betterAuth);

const siteUrl = process.env.SITE_URL;
// The local backend runs with SITE_URL=http://localhost:3000.
const isDevelopment = siteUrl?.startsWith("http://localhost") ?? false;

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    baseURL: siteUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    databaseHooks: {
      user: { create: { after: async user => {
        if ("runMutation" in ctx) await ctx.runMutation(internal.auth.schedulePendingCleanup, { userId: user.id });
      } } },
    },
    // Persist counters across function runs; the emailOTP plugin limits sends to 3 per minute per IP.
    rateLimit: { enabled: true, storage: "database" },
    // Set by the Next.js auth route (app/api/auth) from the platform's client IP. Requests
    // that skip that route have no IP and share one bucket; the per-email limit below still holds.
    advanced: { ipAddress: { ipAddressHeaders: ["x-cosmela-client-ip"] } },
    hooks: {
      before: createAuthMiddleware(async (auth) => {
        if (auth.path === "/email-otp/send-verification-otp" || auth.path === "/sign-in/email-otp") {
          const headers = auth.headers;
          if (headers?.get("x-cosmela-legal-version") !== LEGAL_VERSION || headers.get("x-cosmela-terms") !== "true" || headers.get("x-cosmela-privacy") !== "true" || headers.get("x-cosmela-adult") !== "true") {
            throw new APIError("BAD_REQUEST", { message: "Revisa y acepta los documentos legales y confirma que eres mayor de edad." });
          }
        }
        if (auth.path !== "/email-otp/send-verification-otp" || !("runMutation" in ctx)) return;
        const email = String(auth.body?.email ?? "").trim().toLowerCase();
        const { ok } = await rateLimiter.limit(ctx, "loginCodePerEmail", { key: email });
        if (!ok) throw new APIError("TOO_MANY_REQUESTS", { message: "Pediste varios códigos seguidos. Espera unos minutos e intenta de nuevo." });
      }),
      after: createAuthMiddleware(async auth => {
        if (auth.path !== "/sign-in/email-otp" || !auth.context.newSession || !("runMutation" in ctx)) return;
        await ctx.runMutation(internal.legal.activateVerifiedAccount, {
          userId: auth.context.newSession.user.id, version: LEGAL_VERSION,
        });
      }),
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp }) => {
          await sendOtpEmail(email, otp);
        },
      }),
      convex({ authConfig }),
    ],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx));

export const schedulePendingCleanup = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(24 * 60 * 60_000, internal.auth.cleanupPendingAuth, args);
  },
});

export const cleanupPendingAuth = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const accepted = await ctx.db.query("accountLegalAcceptances").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (!accepted) await ctx.scheduler.runAfter(0, internal.auth.eraseUnlinkedAuth, { userId });
  },
});

export const eraseUnlinkedAuth = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db.query("members").withIndex("by_user", q => q.eq("userId", userId)).collect();
    if (memberships.some(member => member.active)) return;
    for (const model of ["session", "account"] as const) {
      const result = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model, where: [{ field: "userId", value: userId }] }, paginationOpts: { numItems: 100, cursor: null },
      });
      if (!result.isDone) {
        await ctx.scheduler.runAfter(0, internal.auth.eraseUnlinkedAuth, { userId });
        return;
      }
    }
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, { input: { model: "user", where: [{ field: "_id", value: userId }] } });
    const existing = await ctx.db.query("accountEvidenceExpiry").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (!existing) {
      const retention = new Date(); retention.setUTCFullYear(retention.getUTCFullYear() + 5);
      await ctx.db.insert("accountEvidenceExpiry", { userId, retainUntil: retention.getTime() });
    }
  },
});

async function sendOtpEmail(email: string, otp: string) {
  // Development only: log the code so local sign-in works with any address
  // (use `delivered+name@resend.dev` test addresses to avoid real deliveries).
  if (isDevelopment) console.log(`[dev] OTP for ${email}: ${otp}`);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  let failure: string | null = null;

  if (!apiKey || !from) {
    failure = "RESEND_API_KEY or RESEND_FROM is not set";
  } else {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: email,
      subject: `Tu código de acceso a Cosmela: ${otp}`,
      html: otpEmailHtml(otp),
      text: `Tu código de acceso a Cosmela es ${otp}. Vence en 10 minutos. Si no lo pediste, ignora este correo.`,
    });
    if (error) failure = error.message;
  }

  if (!failure) return;
  if (isDevelopment) {
    // The logged code above stays usable when the email cannot be delivered.
    console.warn(`[dev] OTP email not sent: ${failure}`);
    return;
  }
  console.error(`OTP email not sent: ${failure}`);
  throw new ConvexError({ code: "EMAIL_FAILED", message: "No pudimos enviar el código. Intenta de nuevo." });
}

function otpEmailHtml(otp: string) {
  return `<!doctype html>
<html lang="es-CO">
  <body style="margin:0;padding:32px 16px;background:#F6F4F8;font-family:Arial,Helvetica,sans-serif;color:#2A2131">
    <div style="max-width:440px;margin:0 auto;background:#FFFFFF;border:1px solid #E6E0EB;border-radius:14px;padding:32px">
      <p style="margin:0 0 24px;font-size:18px;color:#5B2A86">Cosmela</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.5">Usa este código para ingresar:</p>
      <p style="margin:0 0 24px;font-size:36px;letter-spacing:8px;font-weight:bold">${otp}</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#6B6273">Vence en 10 minutos. Si no lo pediste, ignora este correo.</p>
    </div>
  </body>
</html>`;
}

/**
 * The signed-in user plus their active membership and org, or null when signed out.
 * `member` and `org` are null until onboarding creates the org.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const userId = user._id;
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const member = settings
      ? await ctx.db
          .query("members")
          .withIndex("by_org_user", (q) => q.eq("orgId", settings.activeOrgId).eq("userId", userId))
          .unique()
      : null;
    const org = member?.active ? await ctx.db.get(member.orgId) : null;
    const legalReady = await hasAccountAcceptance(ctx, userId) && (!org || await hasProcessingAcceptance(ctx, org._id));

    return {
      user: { id: userId, email: user.email, name: user.name },
      member:
        legalReady && member && member.active && org?.closureConfirmedAt === undefined
          ? { _id: member._id, name: member.name, role: member.role, color: member.color, title: member.title }
          : null,
      org: legalReady && org && org.closureConfirmedAt === undefined ? { _id: org._id, name: org.name, kind: org.kind, slug: org.slug } : null,
    };
  },
});
