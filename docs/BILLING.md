# Cosmela — Subscription billing

Businesses pay Cosmela a monthly subscription through [Polar](https://polar.sh) (Merchant of Record). This is unrelated to client payments for treatments. Product rules: `docs/PRODUCT.md` §10.

## How it works

- **The org is the Polar customer.** Checkout sends `external_customer_id = orgId`, so Polar creates (or reuses) a customer whose external id is the org id. The admin's email prefills the checkout. Subscriptions also carry `metadata.orgId`.
- **Plans** are two Polar products: "Solo" (1 active professional) and "Practice", shown as "Salón" (up to `SALON_STAFF_LIMIT = 5`). Prices come from Polar (the COP price of each product); the UI never hard-codes them.
- **State** (`convex/lib/billing.ts`, `billingSummary`):

  | State | When | Writes |
  |---|---|---|
  | `beta` | `BILLING_ENFORCED` is off | allowed, no limits |
  | `trial` | no live subscription and now < `orgs.trialEndsAt` | allowed, up to 5 professionals |
  | `active` | subscription `active` or `trialing` | allowed, plan limit |
  | `canceling` | same, with `cancel_at_period_end` | allowed until the period ends |
  | `past_due` | subscription `past_due` | read-only |
  | `expired` | trial over and no live subscription (canceled, unpaid, never paid) | read-only |

- **Write guard** (`convex/lib/authz.ts`): `memberMutation` and `adminMutation` call `requireWritable`, which throws `READ_ONLY` with a Spanish message in read-only mode. Only these stay open: own profile and schedule (`unguardedMemberMutation`), own signature upload, the "Primeros pasos" checklist, billing actions, CSV export (an action), sign-out, and the public booking request. Confirming a request is blocked.
- **Plan limits** (`requireStaffRoom`): invite, accept an invitation, and reactivate a member fail with `PLAN_LIMIT` when the active members already reach the limit. A checkout for Solo fails while more than 1 professional is active.
- **Sync.** Two paths write the `subscriptions` table (`billing.saveSubscription`, newest `modified_at` wins):
  1. The webhook `POST https://<convex-site>/polar/events` (`convex/http.ts`), verified with Standard Webhooks signatures (`convex/lib/polar.ts`). Every `subscription.*` event carries the full subscription.
  2. `billing.sync`: on return from checkout (`/configuracion/plan?checkout=<id>`), the Plan page pulls the org's subscriptions from the Polar API. This is how local development works, since Polar cannot reach localhost.
- **Trial reminders:** a daily cron (9:00 Bogotá) emails admins 3 days and 1 day before the trial ends, only when enforced.
- **Polar API** calls use plain `fetch` with `Polar-Version: 2026-10` (`convex/lib/polar.ts`). We do not use `@convex-dev/polar`: it keys customers by user and email (not by org), assumes one open subscription, and imports `@polar-sh/sdk` 0.x paths that the current SDK (1.x) removed. The 1.x SDK pulls metering, OpenTelemetry, and Redis dependencies we do not need.

## Environment

| Variable (Convex env) | Local | Production |
|---|---|---|
| `BILLING_ENFORCED` | unset (off); `true` to test | unset until launch, then `true` |
| `POLAR_ORGANIZATION_TOKEN` | from `POLAR_SANDBOX_TOKEN` in `.env` (`pnpm setup`) | the production organization access token (`POLAR_ACCESS_TOKEN` in `.env`) |
| `POLAR_SERVER` | `sandbox` (`pnpm setup`) | `production` |
| `POLAR_PRODUCT_SOLO_ID` | set by `scripts/polar-sandbox-products.mjs` | `c71b7b47-541a-4222-9dff-f992b67fb9e2` |
| `POLAR_PRODUCT_SALON_ID` | set by `scripts/polar-sandbox-products.mjs` | `ca91878f-0026-4ea8-97f2-808d0312518f` ("Practice") |
| `POLAR_WEBHOOK_SECRET` | not needed | the endpoint secret (`whsec_…`) |
| `SITE_URL` | `http://localhost:3000` | the production domain (checkout and portal return URLs) |

`POLAR_SERVER` defaults to `sandbox` when unset, so a missing value fails safely (a production token is rejected by the sandbox).

### Local setup (Polar sandbox)

1. Create an organization access token at https://sandbox.polar.sh (Settings, then Access Tokens) with the scopes `products:read`, `products:write`, `checkouts:write`, `customer_sessions:write`, `subscriptions:read`. Add it to `.env` as `POLAR_SANDBOX_TOKEN`.
2. `pnpm setup` maps it to the local backend (`POLAR_ORGANIZATION_TOKEN`, `POLAR_SERVER=sandbox`).
3. `node scripts/polar-sandbox-products.mjs` creates "Solo" and "Practice" monthly products in the sandbox if missing (COP 90.000 / 220.000 and USD 24 / 58) and sets their ids locally.
4. To test enforcement: `CONVEX_DEPLOYMENT=anonymous:anonymous-agent pnpm exec convex env set BILLING_ENFORCED true`, then `pnpm exec convex run billing:startTrialsForExisting` (same prefix). Pay with the test card `4242 4242 4242 4242`, any future date, any CVC. Remove the switch afterwards with `convex env remove BILLING_ENFORCED`.

## Production setup checklist

1. **Products** (already in the production Polar org, read on 2026-11-15):
   - "Solo": `c71b7b47-541a-4222-9dff-f992b67fb9e2`, monthly, COP 90.000 and USD 24.
   - "Practice": `ca91878f-0026-4ea8-97f2-808d0312518f`, monthly, COP 220.000 and USD 58.
   - Both products have a **1-month Polar trial** configured. Checkout applies it, so a business that subscribes after Cosmela's 14-day trial gets one more month before the first charge (card required, state `active`). Remove the product trials in Polar if that is not intended.
2. **Organization access token** with the scopes listed above. `pnpm exec convex env set POLAR_ORGANIZATION_TOKEN` (omit the value to paste it) on the production deployment, plus `POLAR_SERVER=production` and the two product ids.
3. **Webhook** in Polar (Settings, then Webhooks, then Add Endpoint):
   - URL: `https://<production-convex-site>/polar/events` (the `.convex.site` host, not the app domain).
   - Format: Raw.
   - Events: `subscription.created`, `subscription.updated` (required; `updated` fires for activation, cancellation, uncancellation, renewal, past due, and revocation). `subscription.active`, `subscription.canceled`, `subscription.uncanceled`, `subscription.revoked`, and `subscription.past_due` are optional; the handler treats them the same. No `order.*` events are needed.
   - Copy the secret into `POLAR_WEBHOOK_SECRET`.
4. **Customer portal** (Polar settings): allow updating the card, viewing invoices, and canceling. If plan changes are allowed there, Polar cannot apply the "Solo only with 1 active professional" rule; the app then just blocks adding professionals beyond the new limit.
5. Set `SITE_URL` to the production domain.

## Turning the switch on

1. Finish the checklist above and test one real checkout with a small discount if needed.
2. `pnpm exec convex env set BILLING_ENFORCED true` on the production deployment.
3. Right away, run once: `pnpm exec convex run billing:startTrialsForExisting`. It gives **every existing business 14 days from now** (businesses whose trial ends later keep theirs). New businesses get 14 days from creation. Running it again extends all trials again, so run it once.
4. What businesses see: the Plan page shows "Prueba gratis: te quedan N días" and the plans with "Elegir plan". Admins get reminder emails 3 days and 1 day before the end. When the trial ends without a subscription, the business becomes read-only: a banner explains it, reads and export keep working, public booking requests keep arriving, and the team cannot confirm them until an admin subscribes.

To turn it off again, remove `BILLING_ENFORCED`: everything returns to the free beta at once; subscriptions stay stored.
