import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins/email-otp";
import { ConvexError } from "convex/values";
import { Resend } from "resend";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
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
    // Persist counters across function runs; the emailOTP plugin limits sends to 3 per minute per IP.
    rateLimit: { enabled: true, storage: "database" },
    // Set by the Next.js auth route (app/api/auth) from the platform's client IP. Requests
    // that skip that route have no IP and share one bucket; the per-email limit below still holds.
    advanced: { ipAddress: { ipAddressHeaders: ["x-cosmela-client-ip"] } },
    hooks: {
      before: createAuthMiddleware(async (auth) => {
        if (auth.path !== "/email-otp/send-verification-otp" || !("runMutation" in ctx)) return;
        const email = String(auth.body?.email ?? "").trim().toLowerCase();
        const { ok } = await rateLimiter.limit(ctx, "loginCodePerEmail", { key: email });
        if (!ok) throw new APIError("TOO_MANY_REQUESTS", { message: "Pediste varios códigos seguidos. Espera unos minutos e intenta de nuevo." });
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

    return {
      user: { id: userId, email: user.email, name: user.name },
      member:
        member && member.active
          ? { _id: member._id, name: member.name, role: member.role, color: member.color, title: member.title }
          : null,
      org: org ? { _id: org._id, name: org.name, kind: org.kind, slug: org.slug } : null,
    };
  },
});
