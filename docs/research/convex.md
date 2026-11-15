# Convex backend research (Next.js App Router + PWA)

Checked 2026-11-15. Versions from the npm registry on that date. Code is copied or adapted from the linked source; "adapted" or "proposed" marks my own design.

## 1. Versions

| Package | Version | Notes | Source |
|---|---|---|---|
| `convex` | 1.50.0 | Node >= 22 | https://registry.npmjs.org/convex/latest |
| `next` | 16.4.6 | React 18.2 or 19 | https://registry.npmjs.org/next/latest |
| `@convex-dev/auth` | 2.0.0 | Peers `next` ^16, `convex` ^1.48.0 | https://registry.npmjs.org/@convex-dev/auth/latest |
| `@convex-dev/better-auth` | 0.13.0 | Peer `better-auth` >=1.7.16 <1.8.0 | https://registry.npmjs.org/@convex-dev/better-auth/latest |
| `better-auth` | 1.7.25 | Must fit the range above | https://registry.npmjs.org/better-auth/latest |
| `@convex-dev/r2` | 0.10.4 | | https://registry.npmjs.org/@convex-dev/r2/latest |
| `@convex-dev/resend` | 0.2.10 | Peers `convex` ^1.43.0, `convex-helpers` ^0.1.106 | https://registry.npmjs.org/@convex-dev/resend/latest |
| `resend` | 6.38.1 | Node >= 20 | https://registry.npmjs.org/resend/latest |
| `convex-test` | 0.0.71 | Peer `convex` ^1.43.0 | https://registry.npmjs.org/convex-test/latest |
| `convex-helpers` | 0.1.135 | Peer `convex` ^1.46.0 | https://registry.npmjs.org/convex-helpers/latest |

## 2. Project setup and env vars

```bash
npx create-next-app@latest my-app --js
cd my-app
npm install convex
npx convex dev          # login, create project, writes deployment vars; keep running
npm run dev
```

Source: https://docs.convex.dev/quickstart/nextjs (also mentions `npm create convex@latest`).

Provider, adapted from the quickstart:

```tsx
// app/ConvexClientProvider.tsx
"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

Share one `ConvexReactClient` across pages. Source: https://docs.convex.dev/client/react/nextjs/

Server rendering (`convex/nextjs`, beta per the page):

```tsx
// Server Component
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Clients } from "./Clients";

export async function ClientsWrapper() {
  const preloaded = await preloadQuery(api.clients.list, { orgId });
  return <Clients preloaded={preloaded} />;
}
```

```tsx
// Client Component
"use client";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function Clients(p: { preloaded: Preloaded<typeof api.clients.list> }) {
  const clients = usePreloadedQuery(p.preloaded);
}
```

One-shot read, usable in Server Actions and Route Handlers: `await fetchQuery(api.clients.list, args)`. Pass a token as the third argument, `{ token }`, for authenticated reads. Source: https://docs.convex.dev/client/nextjs/app-router/server-rendering

`preloadQuery` uses `cache: 'no-store'`. Avoid several `preloadQuery` calls per page, since they may read different database states.

| Variable | Where | Purpose | Source |
|---|---|---|---|
| `CONVEX_DEPLOYMENT` | Local | Dev deployment name, written to `.env.local` on creation | https://docs.convex.dev/cli |
| `NEXT_PUBLIC_CONVEX_URL` | Client and server | `*.convex.cloud` URL | https://docs.convex.dev/quickstart/nextjs |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Client (Better Auth) | `*.convex.site` URL for auth routes | https://better-auth.com/docs/integrations/convex.md |
| `CONVEX_SITE_URL` | Set by Convex, read in functions | Default domain for HTTP actions (`*.convex.site`) | https://docs.convex.dev/production/custom-domains |
| `CONVEX_CLOUD_URL` | Set by Convex, read in functions | Default domain for the Convex API (`*.convex.cloud`) | https://docs.convex.dev/production/custom-domains |
| `CONVEX_DEPLOY_KEY` | CI, Vercel | Selects the deploy target; takes priority over `CONVEX_DEPLOYMENT` | https://docs.convex.dev/cli |

Backend secrets go through the CLI: `npx convex env set KEY value` (add `--prod` for production). Source: https://docs.convex.dev/cli

### `npx convex dev` and `npx convex deploy`

- `dev` pushes functions and schema to the dev deployment on each change and regenerates `convex/_generated`. Source: https://docs.convex.dev/cli
- `deploy` targets production (via `CONVEX_DEPLOYMENT`) or the key's deployment (via `CONVEX_DEPLOY_KEY`). It runs the optional `--cmd`, typechecks, bundles, and pushes. Functions go live when it succeeds. Source: https://docs.convex.dev/cli
- Vercel build command: `npx convex deploy --cmd 'npm run build'`, with a Production deploy key scoped to Production. Preview keys create one deployment per Git branch. Source: https://docs.convex.dev/production/hosting/vercel

## 3. Authentication

### 3a. Convex Auth (`@convex-dev/auth` 2.0.0)

- The docs call v2 "the current stable release". v1 gets security fixes only. Source: https://docs.convex.dev/auth/convex-auth
- Methods in the v2 docs: username + password, email + password, username + passkey, OAuth (Google, Apple, GitHub). Source: https://docs.convex.dev/auth/convex-auth and https://github.com/get-convex/convex-auth (README)
- No email OTP or magic-link method is documented for v2. The visible part of the v2 source tree (about half read) has no OTP provider. Source: https://api.github.com/repos/get-convex/convex-auth/git/trees/main?recursive=1
- The only Convex-published Resend OTP guide is for v1-era `Email` providers (`AUTH_RESEND_KEY`, `resend`, `@oslojs/crypto`). Source: https://labs.convex.dev/auth/config/otps

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import auth from "@convex-dev/auth/convex.config.js";
const app = defineApp();
app.use(auth);
export default app;
```

```ts
// convex/auth.ts
import { components } from "./_generated/api";
import { setupConvexAuth } from "@convex-dev/auth/server";
const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;
```

Source: https://docs.convex.dev/auth/convex-auth/getting-started.md

Next.js: `proxy.ts` (Next 16 naming) with `convexAuthNextjsProxy`, `ConvexAuthNextjsServerProvider` in the root layout, and `isAuthenticatedNextjs()` for real verification (`convexAuthNextjsAccessToken()` only checks expiry). Keep `/auth/*` out of the matcher. Source: https://docs.convex.dev/auth/convex-auth/ssr-nextjs/setup.md

User id in functions: the docs point to `getAuthUserId` from `@convex-dev/auth/server`, but its usage was not on the fetched pages. The generic path is `ctx.auth.getUserIdentity()`. Source: https://docs.convex.dev/auth/functions-auth.md

### 3b. Better Auth with Convex (`@convex-dev/better-auth` 0.13.0)

- Maintained by Convex. Pins Better Auth to `>=1.7.16 <1.8.0`. Source: https://registry.npmjs.org/@convex-dev/better-auth/latest
- The `docs.convex.dev/auth/better-auth` page returned 404. The setup reference is on better-auth.com, which does not pin versions. Source: https://better-auth.com/docs/integrations/convex.md

```bash
npm install better-auth @convex-dev/better-auth
npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
npx convex env set SITE_URL http://localhost:3000
```

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";
const app = defineApp();
app.use(betterAuth);
export default app;
```

```ts
// convex/betterAuth/auth.ts (abridged)
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { betterAuth } from "better-auth";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";

export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth, { local: { schema }, verbose: false },
);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    plugins: [convex({ authConfig })],
  });
```

```ts
// convex/auth.config.ts
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";
export default { providers: [getAuthConfigProvider()] } satisfies AuthConfig;
```

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";
const http = httpRouter();
authComponent.registerRoutes(http, createAuth);
export default http;
```

Next.js: `convexBetterAuthNextJs({ convexUrl, convexSiteUrl })` returns `handler`, `isAuthenticated`, `getToken`, `preloadAuthQuery`, `fetchAuthQuery`. Client: `ConvexBetterAuthProvider` from `@convex-dev/better-auth/react`. Identity: `ctx.auth.getUserIdentity()`, key on `tokenIdentifier`. The reference does not cover Next.js proxy or middleware. Source: https://better-auth.com/docs/integrations/convex.md

### 3c. OTP login with Resend

Better Auth's `emailOTP` plugin (in Better Auth core):

```ts
import { emailOTP } from "better-auth/plugins";

emailOTP({
  otpLength: 6,    // default 6
  expiresIn: 300,  // seconds, default 300
  async sendVerificationOTP({ email, otp, type }) {
    // type: "sign-in" | "email-verification" | "forget-password"
    // send `otp` with the Resend SDK here
  },
}),
```

```ts
import { emailOTPClient } from "better-auth/client/plugins";
await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
await authClient.signIn.emailOtp({ email, otp });
```

Source: https://better-auth.com/docs/plugins/email-otp.md

Not verified: whether `sendVerificationOTP` can call the `@convex-dev/resend` component, which needs a Convex ctx. The plain `resend` SDK is the simpler first choice. Spike it.

Convex Auth v2 has no OTP method, and its Resend path is tied to a password. That leaves Better Auth as the fit for OTP-only.

### 3d. Recommendation for OTP-only login

Use **Better Auth + `emailOTP`**, with the Resend SDK in `sendVerificationOTP`.

- Costs: two packages with a version pin, a proxy you write yourself, and your own rate limiting.
- Fallback: Convex Auth v2 with email + password. It is not OTP-only.
- Spike before committing: (1) OTP email sends from `sendVerificationOTP`, (2) `ctx.auth.getUserIdentity()` works in a mutation after `signIn.emailOtp`, (3) the Next.js proxy blocks unauthenticated routes.

## 4. Schema design

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({ name: v.string(), tokenIdentifier: v.string() })
    .index("by_token", ["tokenIdentifier"]),
  messages: defineTable({ body: v.string(), user: v.id("users") }),
});
```

Source: https://docs.convex.dev/database/schemas.md

- Convex adds `_id` and `_creationTime`. Do not declare them. Source: same page.
- Validators: `v.optional`, `v.union`, `v.literal`, `v.record`, `v.any`, `v.array`, `v.object`, `v.id`. Source: same page.
- Limits: 32 indexes per table, 16 fields per index. Source: https://docs.convex.dev/production/state/limits.md

### Search index

```ts
clients: defineTable({ orgId: v.id("orgs"), fullName: v.string() })
  .searchIndex("search_name", {
    searchField: "fullName",
    filterFields: ["orgId"],
    staged: false,
  }),

const results = await ctx.db
  .query("clients")
  .withSearchIndex("search_name", (q) => q.search("fullName", term).eq("orgId", orgId))
  .take(20);
```

Source: https://docs.convex.dev/search/text-search.md. Results come back in relevance order only. `collect()` throws above 1024 documents. Limits: 4 search indexes per table, 16 filter fields per index. Source: https://docs.convex.dev/production/state/limits.md

### Pagination

```ts
import { paginationOptsValidator } from "convex/server";
export const list = query({
  args: { orgId: v.id("orgs"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    ctx.db.query("clients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .paginate(args.paginationOpts),
});
```

```tsx
const { results, status, loadMore } = usePaginatedQuery(
  api.clients.list, { orgId }, { initialNumItems: 20 },
);
// status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
```

Source: https://docs.convex.dev/database/pagination.md. The page does not show the import; `usePaginatedQuery` comes from `convex/react`.

### Flexible JSON for dynamic forms

| Validator | Use for | Trade-off |
|---|---|---|
| `v.any()` | Data you never query or validate | No database-level validation |
| `v.record(v.string(), valueValidator)` | Maps with dynamic keys (field id to answer) | Keys must be ASCII |
| `v.array(v.object({...}))` | Ordered field definitions | Typed; counts toward nesting and size limits |

Source for validators: https://docs.convex.dev/database/schemas.md

Proposed design (adapted):

```ts
forms: defineTable({
  orgId: v.id("orgs"),
  name: v.string(),
  version: v.number(),
  fields: v.array(v.object({
    id: v.string(),
    label: v.string(),
    type: v.union(v.literal("text"), v.literal("number"), v.literal("choice"),
                  v.literal("date"), v.literal("signature")),
    required: v.boolean(),
    options: v.optional(v.array(v.string())),
  })),
}).index("by_org", ["orgId"]),

answers: defineTable({
  orgId: v.id("orgs"),
  clientId: v.id("clients"),
  formId: v.id("forms"),
  formVersion: v.number(),
  values: v.record(v.string(), v.union(v.string(), v.number(), v.boolean(),
                                       v.null(), v.array(v.string()))),
}).index("by_client", ["clientId"]),
```

- Publish form versions as immutable rows. Each answer keeps its `formVersion`.
- Keep photos and signatures out of JSON. Store the storage key on a separate row (section 6).

### Limits

- Document size: 1 MiB (limits page); the types page says "less than 1MB". Plan for 1 MiB. Sources: https://docs.convex.dev/production/state/limits.md, https://docs.convex.dev/database/types.md
- Nesting: 16 levels per document. Arrays: 8192 elements. Objects: 1024 fields. Field names: 64 characters at top level, 1024 nested. Source: https://docs.convex.dev/production/state/limits.md

### Dates

- Instants (created, booked, sent): store epoch milliseconds as a number. This is what `_creationTime` uses. Source: https://docs.convex.dev/database/types.md
- Calendar dates or clock times: store an ISO 8601 string, plus the IANA zone name (for example `America/Bogota`) if users pick zones. Source: same page.

## 5. Authorization for multi-tenant (org, members, roles)

Convex has no built-in tenancy. Check membership in a wrapper, then check each fetched document's `orgId`.

```ts
// convex/schema.ts (add)
orgs: defineTable({ name: v.string() }),
members: defineTable({
  orgId: v.id("orgs"),
  tokenIdentifier: v.string(),
  role: v.union(v.literal("owner"), v.literal("admin"), v.literal("staff")),
})
  .index("by_user", ["tokenIdentifier"])
  .index("by_org_and_user", ["orgId", "tokenIdentifier"]),
```

```ts
// convex/functions.ts (adapted from the customQuery/customMutation pattern)
import { ConvexError, v } from "convex/values";
import { customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function requireMember(ctx: QueryCtx | MutationCtx, orgId: Id<"orgs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("UNAUTHENTICATED");
  const member = await ctx.db.query("members")
    .withIndex("by_org_and_user", (q) =>
      q.eq("orgId", orgId).eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!member) throw new ConvexError("FORBIDDEN");
  return member;
}

export const orgQuery = customQuery(query, {
  args: { orgId: v.id("orgs") },
  input: async (ctx, { orgId }) => ({
    ctx: { orgId, member: await requireMember(ctx, orgId) },
    args: {},
  }),
});

export const orgMutation = customMutation(mutation, {
  args: { orgId: v.id("orgs") },
  input: async (ctx, { orgId }) => ({
    ctx: { orgId, member: await requireMember(ctx, orgId) },
    args: {},
  }),
});

export const adminMutation = customMutation(mutation, {
  args: { orgId: v.id("orgs") },
  input: async (ctx, { orgId }) => {
    const member = await requireMember(ctx, orgId);
    if (member.role === "staff") throw new ConvexError("FORBIDDEN");
    return { ctx: { orgId, member }, args: {} };
  },
});
```

```ts
// convex/clients.ts
export const get = orgQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const client = await ctx.db.get(clientId);
    if (!client || client.orgId !== ctx.orgId) throw new ConvexError("NOT_FOUND");
    return client;
  },
});
```

Source for the `input` and `ctx` return shape: https://raw.githubusercontent.com/get-convex/convex-helpers/main/README.md

Row-level security exists in `convex-helpers/server/rowLevelSecurity` (`wrapDatabaseReader`, `wrapDatabaseWriter`, `Rules`, `RLSConfig` with `defaultPolicy: "deny"`). The README calls its CRUD helpers prototype-grade, and points to the rate-limiter and action-retrier components for other needs. Source: same README.

Recommendation: the wrapper approach above, plus explicit `orgId` checks. Add RLS only if you need per-row enforcement across all reads.

## 6. Files

### Built-in storage

```ts
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});
```

```ts
const postUrl = await generateUploadUrl();
const res = await fetch(postUrl, {
  method: "POST",
  headers: { "Content-Type": file.type },
  body: file,
});
const { storageId } = await res.json();
await saveRecord({ storageId });
```

Source: https://docs.convex.dev/file-storage/upload-files.md. Serve with `ctx.storage.getUrl(storageId)` in a query. Source: https://docs.convex.dev/file-storage/serve-files.md

- Upload URL expires in 1 hour. POST times out after 2 minutes. Source: https://docs.convex.dev/file-storage/upload-files.md
- Anyone with the URL can read the file. For expiring URLs the docs point to R2. Source: https://docs.convex.dev/file-storage/serve-files.md

### Cloudflare R2 (`@convex-dev/r2` 0.10.4)

Env vars (set with `npx convex env set`):

```
R2_TOKEN
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ENDPOINT
R2_BUCKET
```

Source: https://raw.githubusercontent.com/get-convex/r2/main/README.md. Env vars are only needed if the `R2` constructor gets no config; constructor values win.

```ts
// convex/convex.config.ts
import r2 from "@convex-dev/r2/convex.config.js";
app.use(r2);
```

```ts
// convex/r2.ts
import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const r2 = new R2(components.r2);

export const { generateUploadUrl, syncMetadata } = r2.clientApi<DataModel>({
  checkUpload: async (ctx, bucket) => { /* org membership and role */ },
  onUpload: async (ctx, bucket, key) => { /* save key on the owning row */ },
});
```

```tsx
import { useUploadFile } from "@convex-dev/r2/react";
import { api } from "../convex/_generated/api";
const uploadFile = useUploadFile(api.r2);
const key = await uploadFile(file);
```

```ts
const url = await r2.getUrl(key, { expiresIn: 60 * 5 }); // seconds; default 900
export const deleteObject = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => await r2.deleteObject(ctx, args.key),
});
```

Source for all of the above: https://raw.githubusercontent.com/get-convex/r2/main/README.md

README caveats: CORS must allow `GET` and `PUT` from the app origin. `generateUploadUrl` takes no custom key; write a mutation that calls `r2.generateUploadUrl(key)` for that. Signed URLs bypass the edge cache. Do not use the `r2.dev` URL in production. Use one `R2` instance per bucket.

### Recommendation for before/after photos and signatures

- Private bucket. No `r2.dev` or public links.
- Store only the `key` on a row, such as `photos` with `{ orgId, clientId, kind, key, takenAt }`.
- Generate `getUrl` inside an authorized function, with a short expiry (about 5 minutes).
- Check membership in `checkUpload` and `onUpload`.
- These are sensitive personal data. Review consent and retention with the `legal-compliance` skill before launch.

## 7. Scheduling and crons

```ts
const jobId = await ctx.scheduler.runAfter(delayMs, internal.reminders.send, { appointmentId });
await ctx.scheduler.cancel(jobId);
// runAt takes epoch milliseconds
```

Source: https://docs.convex.dev/scheduling/scheduled-functions.md. Limits: 1000 scheduled functions per call, 8 MB total arguments, results kept 7 days. Same source.

```ts
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.daily("daily digest", { hourUTC: 13, minuteUTC: 5 }, internal.digest.run);
crons.interval("sweep reminders", { minutes: 15 }, internal.reminders.sweep);
export default crons;
```

Source: https://docs.convex.dev/scheduling/cron-jobs.md. Cron times are UTC, so 08:00 Colombia time (UTC-5) is `hourUTC: 13`. Only one run of each job executes at a time. Avoid minute 0. An interval job first runs at deploy.

Proposed reminder flow (adapted):
1. On booking, `runAfter` or `runAt` for `startsAt - 24h`. Store the job id on the appointment.
2. On reschedule or cancel, call `ctx.scheduler.cancel(jobId)` and schedule again.
3. The 15-minute cron sweeps unsent reminders as a safety net. The send mutation checks `reminderSentAt` first to stay idempotent.

## 8. Email with Resend

Option A: `@convex-dev/resend` 0.2.10 (queued sends, delivery webhooks).

```ts
// convex/convex.config.ts
import resend from "@convex-dev/resend/convex.config.js";
app.use(resend);
```

```ts
// convex/sendEmails.ts
import { Resend } from "@convex-dev/resend";
import { components, internal } from "./_generated/api";

export const resend: Resend = new Resend(components.resend, {
  onEmailEvent: internal.sendEmails.handleEmailEvent,
  testMode: false,  // default true
});

await resend.sendEmail(ctx, {
  from: "Studio <no-reply@yourdomain.co>",
  to: "client@example.com",
  subject: "Recordatorio de cita",
  html: "<p>...</p>",
});
```

- Env: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`. Source: https://raw.githubusercontent.com/get-convex/resend/main/README.md
- Webhook: `return await resend.handleResendEventWebhook(ctx, req);` on POST `/resend-webhook` in `convex/http.ts`. Enable all `email.*` events.
- `testMode` defaults to `true`. Pass `idempotencyKey` to dedupe. Sent emails cannot be cancelled. React Email rendering needs a `"use node"` action. Same README.

Option B: `resend` SDK 6.38.1 inside an action. Use it for the Better Auth OTP callback (section 3c). Source: https://registry.npmjs.org/resend/latest

Name the key once. Other docs use `AUTH_RESEND_KEY` (v1 guide) and `RESEND_API_KEY` (component, v2 email + password guide). Sources: https://labs.convex.dev/auth/config/otps, https://docs.convex.dev/auth/convex-auth/methods/email-password.md

## 9. Testing with `convex-test`

```bash
npm install --save-dev convex-test vitest @edge-runtime/vm
```

```ts
// vitest.config.mts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "edge-runtime" } });
```

```ts
// convex/clients.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("members see their own org only", async () => {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity({ name: "Ana" });
  // seed org and member rows, then assert list results
});
```

Source: https://docs.convex.dev/testing/convex-test.md. The glob is relative to the test file. Use the current Vitest; the page does not pin a version.

## 10. Limits

Functions:
- Query and mutation user code: 1 second (database time excluded). Source: https://docs.convex.dev/production/state/limits.md
- Actions: 30 minutes on the Convex runtime, 10 minutes on Node. HTTP action timeout is not stated separately. Same source.
- Arguments: 16 MiB (Node actions 5 MiB). Return values: 16 MiB. Same source.

Per transaction:
- Data read and written: 16 MiB each. Documents scanned: 32,000. Documents written: 16,000. Index ranges: 4,096. Same source.

Schema:
- Document: 1 MiB, 16 levels of nesting. Tables: 10,000 per deployment. Indexes: 32 per table. Deployments per team: 40 on Free and Starter. Same source.

Plans:
- Free: file storage 1 GB, egress 1 GB per month. Starter: storage 1 GB included, then $0.033 per GB-month; egress 1 GB included, then $0.132 per GB. Source: https://docs.convex.dev/production/state/limits.md
- Usage limits: a warning threshold (production and preview) logs an event. A disable threshold (all deployments) disables the deployment until the window resets at midnight UTC. Source: https://docs.convex.dev/production/usage-limits.md
- The Free plan's database and function call allowances were not on the pages I fetched. Check https://www.convex.dev/pricing.

## 11. Offline behavior

- The React client retries a mutation until the database confirms it, and the backend runs it once. It warns when the tab closes with mutations pending. Source: https://docs.convex.dev/client/react (read via search summary; not fetched in full).
- No official page describes durable offline writes. The `offline-support` URL returned 404.
- A Convex team member said pending mutations live in memory and are lost on tab close. Community answer, not official. Source: https://discord-questions.convex.dev/m/1071671698815979630

Recommendation: service worker for the app shell, a clear offline state, and no offline write queue on Convex without a design review.

## Gaps

- Not fetched (404): `docs.convex.dev/auth/better-auth`, `/production/hosting/preview-deployments`, `/client/react/offline-support`, `/testing/convex-backend`.
- Not found: the v2 Convex Auth `getAuthUserId` usage and the v2 Next.js setup for OTP.
- R2 README was summarized by the fetch tool, not copied byte for byte. Check env names against the repo.
- Resend inside Better Auth's `sendVerificationOTP` is untested.
- The Colombia UTC-5 and no-DST statement is from general knowledge, not a fetched source.

## Recommended setup for this project

- Backend: Convex (`convex` 1.50.0) with Next.js 16.4.6 App Router. `NEXT_PUBLIC_CONVEX_URL` for the client. Production deploys with `npx convex deploy --cmd 'npm run build'` and a Production `CONVEX_DEPLOY_KEY` in Vercel.
- Auth: Better Auth via `@convex-dev/better-auth` 0.13.0 and `better-auth` 1.7.25 (`<1.8.0`), with `emailOTP` for codes and the Resend SDK in `sendVerificationOTP`. Run the spike in section 3d first.
- Authorization: `members` table with roles, `orgQuery`/`orgMutation`/`adminMutation` wrappers from `convex-helpers` 0.1.135, and an `orgId` check on every fetched document.
- Schema: epoch-ms numbers for instants; ISO date strings plus an IANA zone for calendar dates; `v.union(v.literal(...))` for status; dynamic forms as immutable `forms` rows plus `answers` with `v.record` values and `formVersion`.
- Search and lists: `searchIndex` on client names with `orgId` as filter field; `paginationOptsValidator` with `usePaginatedQuery`.
- Files: R2 via `@convex-dev/r2` 0.10.4, private bucket, `useUploadFile`, short-lived `getUrl` generated in authorized functions. Store keys only.
- Reminders: `ctx.scheduler.runAfter` at booking with the job id stored, `cancel` on change, and a 15-minute cron sweep as a safety net, all in UTC.
- Email: `resend` SDK for the OTP callback; `@convex-dev/resend` 0.2.10 for queued sends and delivery webhooks. Set `testMode: false` only in production.
- Tests: `convex-test` 0.0.71 with Vitest and `edge-runtime`. Use `t.withIdentity` for each role, and test that org A cannot read org B.
- Offline: service worker for the shell only, no offline write queue.
