# Billing, Email, and Analytics: Research Notes

Date: 2026-11-15. Stack: Convex backend, Next.js App Router PWA, Colombian business with Colombian customers.

Legend: **[Verified]** = stated in the cited page. **[Unverified]** = not confirmed in the sources reviewed; check before relying on it.

Versions are from the npm registry on 2026-11-15 (`https://registry.npmjs.org/<pkg>/latest`).

| Package | Latest | Notes |
|---|---|---|
| `@convex-dev/polar` | 0.9.2 | peers: `convex ^1.29.0`, `@polar-sh/sdk >=0.45.0`, `@polar-sh/checkout >=0.1.10`, React `^18 \|\| ^19` |
| `@polar-sh/sdk` | 1.1.0 | Docs examples import from a dated subpath, e.g. `@polar-sh/sdk/2026-10` |
| `@convex-dev/resend` | 0.2.10 | peers: `convex ^1.43.0`, `convex-helpers ^0.1.106` |
| `resend` | 6.38.1 | |
| `@react-email/components` | 1.0.12 | |
| `posthog-js` | 1.450.0 | |
| `posthog-node` | 5.74.0 | Requires Node 20+ [Verified: `https://posthog.com/docs/libraries/node`] |
| `standardwebhooks` | 1.1.1 | Optional, for manual Polar webhook verification |
| `@convex-dev/posthog` | n/a | Not found on npm. No official PostHog Convex component located. |

---

## 1. Polar (payments and subscriptions)

### 1.1 Verdict on Colombia (summary)

- **Merchant side: supported.** Colombia is in Polar's payout country list. Payouts use Stripe Connect Express. [Verified: `https://polar.sh/docs/merchant-of-record/supported-countries.md`]
- **Buyer currency: COP is supported.** Products can be priced in COP as well as USD. [Verified: `https://polar.sh/docs/features/products.md`, currency table includes `COP`]
- **Buyer payment methods: weak for Colombia.** Polar lists cards, Apple Pay, Google Pay, Link, and a few non-LatAm local methods. It lists no PSE, Nequi, Daviplata, or Bancolombia options. [Verified: `https://polar.sh/docs/features/checkout/payment-methods.md`]
- **Taxes: Polar is the Merchant of Record.** Polar collects and remits sales tax, but you remain responsible for your own income tax. [Verified: `https://polar.sh/docs/merchant-of-record/introduction.md`]
- **Colombian e-invoicing (DIAN): not covered by Polar's docs.** Polar receipts are not DIAN electronic invoices. [Unverified: this is from general knowledge of Colombian invoicing rules. Confirm with an accountant.]
- **Fees:** Starter plan is 5% + 50 cents per transaction. Payouts add Stripe fees and currency conversion. [Verified: `https://polar.sh/docs/merchant-of-record/fees.md`]

**Verdict:** Polar technically works for a Colombian merchant. It is a poor fit as the main billing system for Colombian customers paying in COP. Local payment methods are missing, the fee stack is high for small tickets, and DIAN invoicing is not covered. Polar is a reasonable option only for customers who pay in USD from outside Colombia. See section 4 for alternatives.

### 1.2 Merchant of Record, countries, currencies, and payouts

**Who can sell.** Merchants can onboard from many countries. Customer payments are blocked from Cuba, Russia, Iran, North Korea, and Syria. [Verified: `https://polar.sh/docs/merchant-of-record/supported-countries.md`]

**Payouts.**
- Polar uses Stripe Connect Express to pay out. You must connect a payout account before Polar accepts money for you. [Verified: `https://polar.sh/docs/features/finance/accounts.md`]
- Colombia is listed as a payout country. [Verified: supported-countries page above]
- The bank account must be in the business's country and use its local currency (COP for Colombia). [Verified: `https://polar.sh/docs/features/finance/accounts.md`]
- Multi-currency or "borderless" accounts (Wise, Payoneer, Revolut) do not satisfy Stripe's verification for payouts. Use a domestic Colombian bank account. [Verified: accounts page]
- Individuals can sell only if Stripe Connect Express supports the individual business type in their region. [Verified: supported-countries page]

**Currencies.**
- Polar supports 130+ currencies for product pricing. [Verified: `https://polar.sh/docs/features/products.md`]
- A price in the organization default currency is required. Add other currencies on top. [Verified: products page]
- Every enabled currency must share the same price structure (price type, metered prices, etc.). [Verified: products page]
- Polar chooses the checkout currency from the customer's geolocation. If the customer's currency is not enabled, the default applies. [Verified: products page]
- For server-created checkout sessions, forward the customer IP as `customer_ip_address`. Otherwise the geolocation may be wrong. [Verified: products page]
- Settlement and analytics balances are kept in USD. [Unverified: from a draft internal design doc in search results, `https://handbook.polar.sh/engineering/design-documents/multi-currency`. Not an official user doc.]

**Payout fees.** [Verified: `https://polar.sh/docs/merchant-of-record/fees.md`]
- Stripe charges $2 per month of active payouts, plus 0.25% + $0.25 per payout. No Polar markup.
- Currency conversion: 0.25% (EU) to 1% (other countries).
- International (non-US) cards: +1.5% on Polar's side.

### 1.3 Plans and fees

| Plan | Monthly | Per transaction |
|---|---|---|
| Starter | Free | 5% + 50 cents |
| Pro | $20 | 3.8% + 40 cents |
| Growth | $100 | 3.6% + 35 cents |
| Scale | $400 | 3.4% + 30 cents |

Source: `https://polar.sh/docs/merchant-of-record/fees.md`

Disputes cost $15 each. Initial transaction fees are not refunded on refund. [Verified: fees page]

### 1.4 Taxes

- Polar handles sales tax calculation, collection, and remittance. It shows the tax breakdown at checkout and issues an itemized receipt. [Verified: `https://polar.sh/docs/features/tax-inclusive-pricing.md`]
- Tax can be inclusive or exclusive. The default is location-based. The US, Canada, and India use exclusive pricing. Other countries use inclusive pricing. Colombia is not named; it would fall under "all other countries." [Verified for the rule. Colombia's classification is Unverified.]
- Changing tax behavior does not change your tax obligations. [Verified: tax page]

### 1.5 Checkout flow options

**Option A: Checkout Links (no code).** Persistent URL created in the dashboard. Each visit creates a new short-lived checkout session. Links can preset a product, a discount, a trial, seats, and metadata. Query params prefill fields (`product_id`, `customer_email`, `discount_code`, `reference_id`, `utm_*`). [Verified: `https://polar.sh/docs/features/checkout/links.md`]

**Option B: Checkout Sessions via API (recommended for this app).** Create a session on the server, then redirect the user to the returned URL.

```ts
// Server-side only (Convex action or Next.js route handler)
import { createPolar } from "@polar-sh/sdk/2026-10";

const polar = createPolar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  environment: "sandbox", // omit or use "production" for live
});

const checkout = await polar.checkouts.create({
  products: ["<product-id>"],
});
// redirect the user to checkout.url
```

Source: `https://polar.sh/docs/features/checkout/session.md`. `products` is the only field the page calls required. `external_customer_id` links the checkout to your own customer ID. [Verified] The page does not document `customer_email`, `success_url`, `metadata`, or `trial` fields in this page. Check the API reference before using them. [Unverified]

### 1.6 Subscriptions, trials, discounts, seats

**Recurring products.** Intervals: daily, weekly, monthly, yearly, with optional counts (every 2 weeks). The interval cannot change after creation. [Verified: products page]

**Free trials.**
- Set on the product, on a checkout link, or on a session. A link or session trial overrides the product trial.
- Unit: day, week, month, or year. Duration: a number.
- Card is required at checkout. The customer is not charged until the trial ends. [Verified: `https://polar.sh/docs/features/subscriptions/trials.md`]

**Discounts.** [Verified: `https://polar.sh/docs/features/discounts.md`]
- Types: percentage, fixed amount, recurring (percentage with a duration).
- Duration for recurring: once, several months, forever.
- Codes are optional and not case sensitive. Codeless discounts apply only through checkout links or the API.
- Preset on a link (silent), or prefill with `?discount_code=`.
- The page does not say whether a fixed-amount discount is tied to a currency. [Unverified]

**Seats (team pricing).** [Verified: `https://polar.sh/docs/features/seat-based-pricing.md`]
- Supported. Models: fixed per seat, graduated tiers, or volume discounts.
- Entities: Customer (payer), Member (a person with a role: owner, billing_manager, member), CustomerSeat (product-to-member link with status pending, claimed, or revoked).
- Benefits go to members only after they claim a seat.
- Limit: 1,000 seats per subscription. Claim links expire after 24 hours.
- Seat assignment is in the Customer Portal or via API. The page gives no API code. See the guide at `https://polar.sh/docs/guides/seat-based-pricing` [Unverified: not fetched].
- Relevance: a per-cosmetologist plan does not need seats (YAGNI). Use seats only for salon or team plans.

### 1.7 Customer portal

- Self-service page for customers to manage subscriptions, payment methods, and invoices. [Verified in index: `https://polar.sh/docs/llms.txt`. Detailed settings page not fetched.]
- Pages: `https://polar.sh/docs/features/customer-portal/introduction.md`, `.../navigate-customers.md`, `.../settings.md`. [Unverified: listed, not fetched]
- The Convex component exposes `generateCustomerPortalUrl` (see 1.9).

### 1.8 Webhooks

**Setup.** Settings, then Webhooks, then Add Endpoint. Choose a delivery format (Raw for custom JSON), set a secret, and pick events. [Verified: `https://polar.sh/docs/integrate/webhooks/endpoints.md`]

**Headers and signing.** [Verified: `https://polar.sh/docs/integrate/webhooks/delivery.md`]
- Headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`.
- Secret starts with `whsec_`.
- Secrets created on or after 2026-09-08 00:00 UTC use Standard Webhooks. Pass the `whsec_...` string unchanged to the library.
- Older secrets use Polar's HMAC scheme. This is not relevant to a new project.

**Verification (SDK).** [Verified: delivery page]

```ts
import express from "express";
import { webhooks } from "@polar-sh/sdk/2026-10";

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res, next) => {
    try {
      const event = await webhooks.validateEvent(
        req.body,
        {
          "webhook-id": req.header("webhook-id") ?? "",
          "webhook-timestamp": req.header("webhook-timestamp") ?? "",
          "webhook-signature": req.header("webhook-signature") ?? "",
        },
        process.env.POLAR_WEBHOOK_SECRET ?? "",
      );
      res.status(202).send("");
    } catch (error) {
      if (error instanceof webhooks.PolarWebhookVerificationError) {
        res.status(403).send("");
        return;
      }
      if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
        res.status(202).send(""); // unknown type: ack so Polar does not retry
        return;
      }
      next(error);
    }
  },
);
```

Use the raw body. Parsed JSON breaks signature checks.

**Events.** [Verified: `https://polar.sh/docs/integrate/webhooks/events.md`]
- Checkout: `checkout.created`, `checkout.updated`, `checkout.expired`
- Customer: `customer.created`, `customer.updated`, `customer.deleted`, `customer.state_changed`
- Subscription: `subscription.created`, `subscription.active`, `subscription.uncanceled`, `subscription.cycled`, `subscription.canceled`, `subscription.past_due`, `subscription.updated`, `subscription.revoked`, `subscription.paused`, `subscription.resumed`, `subscription.migrated`
- Order: `order.created`, `order.paid`, `order.updated`, `order.refunded`
- Refund: `refund.created`, `refund.updated`
- Benefit grant: `benefit_grant.created`, `benefit_grant.updated`, `benefit_grant.revoked`
- Organization: `benefit.*`, `product.created`, `product.updated`, `discount.*`, `organization.updated`

**Local testing.** `polar webhook listen <url>` forwards events to your machine. `polar webhook trigger` sends sample events. [Verified: endpoints page]

### 1.9 Sandbox

- Dashboard: `https://sandbox.polar.sh`. Separate account and organization from production. [Verified: `https://polar.sh/docs/integrate/sandbox.md`]
- API base URL: `https://sandbox-api.polar.sh`. Production tokens do not work in sandbox.
- SDK: `createPolar({ accessToken, environment: "sandbox" })`. Python: `Polar(token, environment="sandbox")`. [Verified: sandbox page]
- Test card: `4242 4242 4242 4242`, any future date, any CVC. [Verified: sandbox page]
- Limitation: customer emails are delivered only to members of your organization. [Verified: sandbox page]

### 1.10 Organization access tokens (OAT)

- Scoped to one organization. Created under Settings, then Access Tokens, then Create token. Set name, expiration, and scopes. [Verified: `https://polar.sh/docs/integrate/oat.md`]
- Keep private. Never ship to the client. [Verified: OAT page]
- The docs reviewed do not state the `polar_oat_` prefix, the scope list, the header format, or which endpoints each scope allows. [Unverified. Check the API reference or the token form.]
- The Convex component reads this token from `POLAR_ORGANIZATION_TOKEN`. Treat it as a server secret.

### 1.11 Convex Polar component (`@convex-dev/polar`)

Sources: `https://www.convex.dev/components/polar` and `https://raw.githubusercontent.com/get-convex/polar/main/README.md`. [Verified unless marked]

**Install.**

```bash
npm install @convex-dev/polar
```

**`convex/convex.config.ts`.**

```ts
import { defineApp } from "convex/server";
import polar from "@convex-dev/polar/convex.config.js";

const app = defineApp();
app.use(polar);
export default app;
```

**Environment variables** (set in Convex, not `.env.local`):

```bash
npx convex env set POLAR_ORGANIZATION_TOKEN <oat>
npx convex env set POLAR_WEBHOOK_SECRET <whsec_...>
npx convex env set POLAR_SERVER sandbox   # or production; defaults to sandbox if unset
```

**Webhook in Polar.** URL: `<your-convex-site-url>/polar/events`. The README lists four events: `product.created`, `product.updated`, `subscription.created`, `subscription.updated`. [Unverified: confirm whether cancellation and past-due events are needed. The README does not list them.]

**`convex/polar.ts`** (adapted: the README uses `convex/example.ts`, and `api.users.current` is a placeholder for your own user query).

```ts
import { Polar } from "@convex-dev/polar";
import { api, components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const polar = new Polar<DataModel>(components.polar, {
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.users.current); // your query
    return { userId: user._id, email: user.email };
  },
  // Optional: map keys to Polar product IDs
  products: {
    premiumMonthly: { id: "<polar-product-id>" },
  },
});

export const {
  changeCurrentSubscription,
  cancelCurrentSubscription,
  getConfiguredProducts,
  listAllProducts,
  listAllSubscriptions,
  generateCheckoutLink,
  generateCustomerPortalUrl,
} = polar.api();
```

**Routes in `convex/http.ts`.**

```ts
import { httpRouter } from "convex/server";
import { polar } from "./polar";

const http = httpRouter();
polar.registerRoutes(http as any);
export default http;
```

**Sync products** (must run in an action, not a query or mutation).

```ts
export const syncProducts = action({
  args: {},
  handler: async (ctx) => {
    await polar.syncProducts(ctx);
  },
});
```

**Read subscription state.**

```ts
const sub = await polar.getCurrentSubscription(ctx, { userId });
// null when there is no active subscription; expired trials excluded
```

**React components.**

```tsx
import { CheckoutLink, CustomerPortalLink } from "@convex-dev/polar/react";

<CheckoutLink polarApi={api.polar} productIds={[products.premiumMonthly.id]} embed={false}>
  Subscribe
</CheckoutLink>

<CustomerPortalLink polarApi={api.polar}>Manage billing</CustomerPortalLink>
```

Options named in the README: `trialInterval`, `trialIntervalCount`, `lazy`, `embed`. [Verified]

### 1.12 Polar gaps to check before building

- DIAN e-invoicing and IVA on top of Polar's receipts. [Unverified; confirm with accountant]
- Whether Colombian-issued cards succeed on Polar's Stripe checkout in COP. [Unverified; not documented]
- Whether a Colombian legal entity (NIT) passes Stripe Connect Express verification. [Unverified; test in sandbox first]
- Health-data handling: Polar should only receive billing data. Keep clinical records out of Polar metadata. [Recommendation, not sourced]

---

## 2. Resend (transactional email)

### 2.1 Test mode and sender limits

**`onboarding@resend.dev`.**
- Sends only to the email address tied to your Resend account. Other recipients return a 403. [Verified: `https://resend.com/docs/knowledge-base/403-error-resend-dev-domain.md`]
- Error text: "You can only send testing emails to your own email address." [Verified]
- Fix: verify your own domain at `https://resend.com/domains`, add the DNS records, and set `from` to that domain. [Verified]

**Test recipients (no real delivery).** [Verified: `https://resend.com/docs/dashboard/emails/send-test-emails.md`]
- `delivered@resend.dev`
- `bounced@resend.dev`
- `complained@resend.dev`
- `suppressed@resend.dev`

**Recommendation:** Verify a domain such as `mail.<yourdomain>` early. Use test addresses for development. The sandbox sender cannot reach patients or customers.

### 2.2 `@convex-dev/resend` component

Sources: `https://www.convex.dev/components/resend` and `https://raw.githubusercontent.com/get-convex/resend/main/README.md`. [Verified]

**Install.**

```bash
npm install @convex-dev/resend
```

**`convex/convex.config.ts`.**

```ts
import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config.js";

const app = defineApp();
app.use(resend);
export default app;
```

**Environment variables** (Convex dashboard or CLI):
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET` (set after you create the webhook in Resend)

**Client and send** (from an action).

```ts
import { Resend } from "@convex-dev/resend";
import { components, internal } from "./_generated/api";

export const resend = new Resend(components.resend, {
  testMode: false, // default is true: only test addresses
  onEmailEvent: internal.email.handleEmailEvent,
});

export const sendWelcome = action({
  args: { to: v.string() },
  handler: async (ctx, { to }) => {
    await resend.sendEmail(ctx, {
      from: "Cosmela <hola@mail.example.com>",
      to,
      subject: "Bienvenida",
      html: "<p>Hola</p>",
    });
  },
});
```

`testMode` defaults to `true` and blocks non-test addresses. [Verified] Set it to `false` only after the domain is verified.

**Webhook route** in `convex/http.ts`.

```ts
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    return await resend.handleResendEventWebhook(ctx, req);
  }),
});
```

- Webhook URL: `https://<deployment>.convex.site/resend-webhook`.
- In Resend, create the webhook at that URL and enable all `email.*` events. Other types are ignored. [Verified]
- Event handler is an `internalMutation` with `args: vOnEmailEventArgs`, receiving `{ id, event }`. [Verified]

**Peer dependencies:** `convex ^1.43.0`, `convex-helpers ^0.1.106`.

### 2.3 Plain `resend` SDK

Use only if you need features outside the component. Package: `resend@6.38.1`. Signature verification uses Svix-style headers. The Resend webhook page did not state the header names or the `svix` package. [Unverified; check `https://resend.com/docs/webhooks/verify-webhooks-requests`.] Prefer the component to avoid this.

### 2.4 React Email templates

- Package: `@react-email/components@1.0.12`. Dev setup per `https://react.email/docs/getting-started/manual-setup`: `npm install react-email react react-dom -E` and `npm install @react-email/ui -D -E`, with an `email:dev` script running `email dev`. [Verified]
- Resend's Convex component README shows sending a React Email template from an action, so the pattern works with the Convex component. [Verified in README excerpt; exact snippet not captured]
- Convex runtime: actions can use Node via `"use node"` at the top of the file. The default runtime supports most npm libraries that work in browser, Deno, or Cloudflare Workers. [Verified: `https://docs.convex.dev/functions/runtimes`]
- Recommendation: put rendering code in a file with `"use node";` if `render()` fails in the default runtime. Test first. [Unverified for `render()` specifically]

---

## 3. PostHog (product analytics)

### 3.1 Environment variables (naming changed)

- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is the current name. The older `NEXT_PUBLIC_POSTHOG_KEY` is what you asked about, but the current docs use the project-token name. [Verified: `https://posthog.com/docs/libraries/next-js`]
- `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` (or `https://eu.i.posthog.com` for EU Cloud). [Verified]
- Both must start with `NEXT_PUBLIC_` to reach the browser. [Verified]

### 3.2 Client setup (App Router)

The current PostHog docs use `instrumentation-client.ts` at the project root, not a provider. It works for both App Router and Pages Router. [Verified: `https://posthog.com/docs/libraries/next-js`]

Package: `posthog-js@1.450.0`.

```ts
// instrumentation-client.ts (project root)
import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com", // https://eu.posthog.com for EU
  defaults: "2026-08-30",
  person_profiles: "identified_only",
  disable_session_recording: true, // see 3.4
});
```

- `defaults` sets the default bundle of options. A date of `2025-05-24` or later makes `capture_pageview: "history_change"` the default, which handles App Router navigations. [Verified: `https://posthog.com/docs/libraries/js/config`]
- `person_profiles` options: `always`, `identified_only`, `never`. Default is `identified_only`. [Verified: config page] The docs do not describe each option in detail. [Unverified]
- Identify a user with an opaque ID (for example the Convex user `_id`), not an email or name. Call `posthog.identify(userId)` after login. [Recommendation. The PostHog identify page was not fetched.]

### 3.3 Reverse proxy (`/ingest`)

Ad blockers often block `posthog.com` hosts, so proxy through your own domain. [Verified: `https://posthog.com/docs/advanced/proxy/nextjs.md`]

```js
// next.config.js (adapted from the PostHog docs)
const region = process.env.POSTHOG_REGION === "eu" ? "eu" : "us";

module.exports = {
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `https://${region}-assets.i.posthog.com/static/:path*` },
      { source: "/ingest/array/:path*", destination: `https://${region}-assets.i.posthog.com/array/:path*` },
      { source: "/ingest/:path*", destination: `https://${region}.i.posthog.com/:path*` },
    ];
  },
  skipTrailingSlashRedirect: true,
};
```

- Static and array rules must come before the catch-all. [Verified]
- `skipTrailingSlashRedirect: true` prevents redirects on PostHog paths that end in `/`. [Verified]
- If you use `middleware.ts` or `proxy.ts`, exclude `/ingest` from its matcher. [Verified]
- Avoid names like `/analytics` or `/tracking`, which blockers catch. [Verified]

### 3.4 Privacy for a health-data app

This app stores health data. Keep session replay off unless you have reviewed it.

- **Recommended:** set `disable_session_recording: true` in `posthog.init`, or do not enable replay in the project settings. [Verified option name: `https://posthog.com/docs/libraries/js/config`]
- If replay is ever enabled, keep masking on and tighten it:
  - `session_recording.maskAllInputs` defaults to masking inputs. Keep it on. [Verified: `https://posthog.com/docs/session-replay/privacy`]
  - Mask all text: `session_recording: { maskTextSelector: "*" }`. General text is not masked by default. [Verified]
  - Mask a block with the CSS class `ph-no-capture`. The page documents the class, not a data attribute. [Verified]
  - Block sensitive network query params with `maskCapturedNetworkRequestFn`. [Verified]
- `recordCrossOriginIframes`: not confirmed in the source reviewed. [Unverified]
- Do not send patient names, notes, phone numbers, or emails as event properties. Use event names and counts only. [Recommendation]

### 3.5 Server-side capture from Convex

No official PostHog component for Convex was found. Use `posthog-node` in a Node action. [Unverified that no component exists; search was not exhaustive]

```ts
// convex/analytics.ts
"use node";
import { PostHog } from "posthog-node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const client = new PostHog(process.env.POSTHOG_PROJECT_TOKEN!, {
  host: "https://us.i.posthog.com",
});

export const track = internalAction({
  args: { distinctId: v.string(), event: v.string() },
  handler: async (_ctx, { distinctId, event }) => {
    try {
      client.capture({ distinctId, event });
    } finally {
      try {
        await client.flush();
      } catch (err) {
        console.error("PostHog flush failed", err);
      }
    }
  },
});
```

- Use the same `distinctId` the frontend passes to `identify()`. Otherwise backend and frontend events do not join. [Verified: `https://posthog.com/docs/libraries/node`]
- Always `await client.flush()`. Telemetry failures must not fail the action. [Verified]
- Keep the client at module scope to reuse it. [Verified]
- Use `"use node";` because `posthog-node` depends on Node APIs. [Recommendation; test in default runtime if you want to avoid it]
- Name the env var `POSTHOG_PROJECT_TOKEN` in Convex (not `NEXT_PUBLIC_`). [Recommendation]

---

## 4. Alternatives for Colombian customers in COP

Only Wompi has any Colombia-specific source. The others are listed for comparison and are **[Unverified]** in this pass.

- **Wompi (Bancolombia / Grupo Cibest):** Cards, PSE, Nequi, Daviplata, Bancolombia options, cash, Puntos Colombia. Supports payment source tokenization, which can underpin recurring charges. Confirm recurring support and any enablement step in the official developer docs. Sources: `https://soporte.wompi.co/hc/es-419/articles/1500000278742-Queremos-contarte-sobre-Wompi`, search snippets. [Partly unverified]
- **ePayco:** Offers a subscriptions product in Colombia with monthly, quarterly, or annual charges. [Unverified: search summary only, no URL fetched.]
- **Mercado Pago (Colombia):** Subscriptions product exists for Latin America. [Unverified: not researched in this pass.]
- **Polar:** Use for USD customers outside Colombia only. See 1.1.

---

## Recommended setup for this project

1. **Billing for Colombian customers in COP:** Wompi or ePayco, pending a fetch of their developer docs. Keep the billing provider behind a small Convex module so it can change. Do not adopt Polar for COP billing.
2. **Polar (optional):** Use only if you sell to foreign customers in USD. Start in `sandbox.polar.sh`. Use `@convex-dev/polar` for the Convex integration. Confirm DIAN invoicing and Colombian card acceptance before going live.
3. **Email:** `@convex-dev/resend` plus React Email templates. Verify a sending domain before launch. Keep `testMode: true` in development. Send in actions. Use `"use node";` if rendering needs Node.
4. **Analytics:** `posthog-js` via `instrumentation-client.ts`, with `/ingest` rewrites and `skipTrailingSlashRedirect: true`. Disable session replay (`disable_session_recording: true`). Identify users by opaque ID only. Track events with `posthog-node` in a Node action when needed.
5. **Health data:** Keep clinical content out of billing, email, and analytics payloads. Billing and email carry identity and amounts only.
6. **Before launch:** Confirm DIAN e-invoicing with an accountant, test COP checkout with Colombian cards in each provider's sandbox, and check the privacy policy lists the processors (Polar or Wompi, Resend, PostHog).

---

## Sources (primary)

- Polar docs index: https://polar.sh/docs/llms.txt
- Polar supported countries: https://polar.sh/docs/merchant-of-record/supported-countries.md
- Polar Merchant of Record: https://polar.sh/docs/merchant-of-record/introduction.md
- Polar payout accounts: https://polar.sh/docs/features/finance/accounts.md
- Polar fees: https://polar.sh/docs/merchant-of-record/fees.md
- Polar payment methods: https://polar.sh/docs/features/checkout/payment-methods.md
- Polar products and currencies: https://polar.sh/docs/features/products.md
- Polar tax: https://polar.sh/docs/features/tax-inclusive-pricing.md
- Polar checkout links: https://polar.sh/docs/features/checkout/links.md
- Polar checkout sessions: https://polar.sh/docs/features/checkout/session.md
- Polar trials: https://polar.sh/docs/features/subscriptions/trials.md
- Polar discounts: https://polar.sh/docs/features/discounts.md
- Polar seats: https://polar.sh/docs/features/seat-based-pricing.md
- Polar webhooks (endpoints, delivery, events): https://polar.sh/docs/integrate/webhooks/endpoints.md, https://polar.sh/docs/integrate/webhooks/delivery.md, https://polar.sh/docs/integrate/webhooks/events.md
- Polar sandbox: https://polar.sh/docs/integrate/sandbox.md
- Polar organization access tokens: https://polar.sh/docs/integrate/oat.md
- Convex Polar component: https://www.convex.dev/components/polar, https://raw.githubusercontent.com/get-convex/polar/main/README.md
- Convex Resend component: https://www.convex.dev/components/resend, https://raw.githubusercontent.com/get-convex/resend/main/README.md
- Resend test emails: https://resend.com/docs/dashboard/emails/send-test-emails.md
- Resend 403 for resend.dev sender: https://resend.com/docs/knowledge-base/403-error-resend-dev-domain.md
- React Email manual setup: https://react.email/docs/getting-started/manual-setup
- Convex runtimes: https://docs.convex.dev/functions/runtimes
- PostHog Next.js: https://posthog.com/docs/libraries/next-js
- PostHog Next.js proxy: https://posthog.com/docs/advanced/proxy/nextjs.md
- PostHog JS config: https://posthog.com/docs/libraries/js/config
- PostHog session replay privacy: https://posthog.com/docs/session-replay/privacy
- PostHog Node: https://posthog.com/docs/libraries/node
- Wompi support article: https://soporte.wompi.co/hc/es-419/articles/1500000278742-Queremos-contarte-sobre-Wompi
- Polar multi-currency design doc (draft, internal): https://handbook.polar.sh/engineering/design-documents/multi-currency

## Open items

- Polar `polar_oat_` token prefix and scope list: not in the docs fetched.
- Polar seat API code: guide at `https://polar.sh/docs/guides/seat-based-pricing` not fetched.
- Polar customer portal settings page: not fetched.
- Resend webhook signature headers and `svix` verification: not on the page fetched.
- PostHog `posthog.identify` and `person_profiles` option details: not fetched.
- Wompi official developer docs for recurring charges: not fetched.
- DIAN e-invoicing requirements: not researched in these sources.
