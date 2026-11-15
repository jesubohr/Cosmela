# Cosmela

Installable web app (PWA) for cosmetologists in Colombia: agenda, clinical records ("fichas"), informed consent, and follow-ups. All UI text is Spanish (es-CO); code and docs are English.

Specs live in `docs/` (`PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md`, `PLAN.md`, research notes). Agent rules are in `CLAUDE.md`.

## Stack

| Concern | Package (version) |
|---|---|
| Web | `next` 16.4.6 (App Router, Turbopack, `proxy.ts`), `react` 19.3.1, TypeScript 5.9 |
| UI | Tailwind CSS 4.3 (CSS-first tokens in `app/globals.css`), shadcn/ui (Radix base), `lucide-react` |
| Backend | `convex` 1.50.0, `convex-helpers` 0.1.135 |
| Auth | `better-auth` **1.7.21** + `@convex-dev/better-auth` 0.13.0, email OTP (6-digit code) |
| Email | `resend` 6.38.1 (OTP), `@convex-dev/resend` 0.2.10 (installed for later phases) |
| Files | `@convex-dev/r2` 0.10.4 (private Cloudflare R2 bucket) |
| Analytics | `posthog-js` 1.450.0 via `instrumentation-client.ts` and `/ingest` rewrites |
| Dates | `date-fns` 4.4.0 + `@date-fns/tz` 1.5.0, zone `America/Bogota` |
| Tests | `vitest` 5.1.0 + `convex-test` 0.0.71 (edge-runtime) |

`better-auth` is pinned to 1.7.21 on purpose: from 1.7.22 on, OTP sign-in deletes old codes with an `id ne` query that the Convex adapter in `@convex-dev/better-auth` 0.13.0 rejects ("_id can only be used with eq, in, or not_in"), so every sign-in fails with a 500. Upgrade both packages together and re-test sign-in.

## Requirements

- Node.js 22 or later, `pnpm` 12.
- The owner's `.env` in the repo root (never committed, never printed). It holds the Convex cloud deployment, PostHog, Resend, R2, and Polar credentials.

## First-time setup

```bash
pnpm install
pnpm setup
```

`pnpm setup` (`scripts/setup-local.mjs`) does three things without printing secrets:

1. Writes `.env.local` with the public values Next.js needs (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`).
2. Creates a **local anonymous Convex backend** (first run only). The Convex CLI writes `CONVEX_DEPLOYMENT=anonymous:…`, `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`, and `NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211` to `.env.local`.
3. Sets the backend env vars on that local deployment: `SITE_URL=http://localhost:3000`, a generated `BETTER_AUTH_SECRET` (kept on later runs), and `RESEND_API_KEY`, `RESEND_FROM`, `R2_*` copied from `.env`.

The script refuses to set env vars when `.env.local` points to a non-local deployment. Local backend data lives in `.convex/local/` (gitignored). Run it again any time; it is idempotent.

## Run locally

```bash
pnpm dev
```

This runs Next.js on http://localhost:3000 and `convex dev` against the local backend side by side (`concurrently`). `convex dev` uses `--env-file .env.local`, so it never falls back to the cloud `CONVEX_DEPLOYMENT` in `.env` (the CLI otherwise reads `.env.local` first and `.env` second). Next.js also loads both files; `.env.local` wins.

Open the local Convex dashboard with `pnpm exec convex dashboard`.

### Signing in locally

1. Go to `/ingresar` and enter any email. Use Resend test addresses such as `delivered+ana@resend.dev` to avoid real deliveries.
2. The code appears in the Convex logs (the `convex` pane of `pnpm dev`) as `[dev] OTP for <email>: 123456`. Development (`SITE_URL` on localhost) always logs the code; when Resend fails or the key is missing it also logs the reason.
3. New emails get an account automatically. A user without a business is sent to `/bienvenida` (onboarding, Phase 1A).

At the time of writing, Resend rejects sends with "The associated domain with your API key is not verified", so emails do not arrive and the logged code is the only way in. Verify the sending domain in Resend before launch.

## Scripts

| Script | What it does |
|---|---|
| `pnpm setup` | Creates `.env.local` and the local Convex backend, sets local backend env vars |
| `pnpm dev` | Next.js + Convex (local) together |
| `pnpm dev:next` / `pnpm dev:convex` | Each one alone |
| `pnpm typecheck` | `next typegen`, then `tsc` for the app and for `convex/` |
| `pnpm lint` | ESLint (Next.js core web vitals + TypeScript) |
| `pnpm test` | Vitest: `convex/**/*.test.ts` (convex-test) and `lib/**/*.test.ts` |
| `pnpm build` | Production build of the Next.js app |

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `CONVEX_DEPLOYMENT` | `.env.local` (CLI) | Which Convex deployment the CLI targets |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Convex client URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` | Convex HTTP actions URL; `/api/auth/*` proxies to it |
| `NEXT_PUBLIC_SITE_URL` | `.env.local` | App URL |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | `.env.local` | PostHog; analytics stay off when the key is empty |
| `SITE_URL` | Convex deployment | Better Auth base URL; `http://localhost…` enables dev OTP logging |
| `BETTER_AUTH_SECRET` | Convex deployment | Session and token signing |
| `RESEND_API_KEY`, `RESEND_FROM` | Convex deployment | OTP email |
| `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_TOKEN` | Convex deployment | Private file storage |

Polar is not used in v1.

## Switching to the cloud dev deployment

Only when the owner decides to. Development and tests use the local backend.

1. `pnpm exec convex login`.
2. In `.env.local`, replace the three Convex lines with the cloud values from `.env`: `CONVEX_DEPLOYMENT=<CONVEX_DEPLOYMENT>`, `NEXT_PUBLIC_CONVEX_URL=<CONVEX_URL>`, `NEXT_PUBLIC_CONVEX_SITE_URL=<CONVEX_SITE_URL>`.
3. Set the backend env vars on the cloud deployment with `pnpm exec convex env set NAME` (omit the value to paste it): `BETTER_AUTH_SECRET` (new random value, e.g. `openssl rand -base64 32`), `SITE_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `R2_*`. `scripts/setup-local.mjs` deliberately refuses to do this.
4. `pnpm dev`. With a non-localhost `SITE_URL`, OTP codes are no longer logged; a failed email shows "No pudimos enviar el código".

To go back, restore the local lines (or delete `.env.local` and run `pnpm setup`, which creates a fresh local backend).

## Deploy (when the owner asks)

- Vercel for the web app, Convex cloud for the backend. Build command: `npx convex deploy --cmd 'pnpm build'` with a production `CONVEX_DEPLOY_KEY` in Vercel.
- Vercel env: `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.
- Convex production env: as in the table above, with `SITE_URL` set to the production domain.
- Add the production origin to the R2 bucket CORS policy (GET and PUT). `http://localhost:3000` is already allowed.
- Verify the Resend sending domain.

## Code map

```
app/(auth)/ingresar     email → 6-digit code login
app/(app)/              authenticated shell (sidebar ≥ 1024 px, bottom tabs below) and placeholder pages
app/api/auth/[...all]   proxies Better Auth requests to Convex
components/shell/       AppShell, sidebar, bottom tabs, PageHeader/PageBody, QuickActions ("+"), offline banner, useViewer
components/shared/      ResponsiveDialog, SignaturePad, PhotoUpload (+ useUploadFile), AlertChips, MoneyInput, PhoneInput, EmptyState, InitialsAvatar
components/ui/          shadcn components restyled with the DESIGN.md tokens
convex/schema.ts        full data model (ARCHITECTURE.md §3)
convex/lib/validators.ts  enum keys and shared validators; Spanish labels in lib/constants.ts
convex/lib/authz.ts     authedQuery/Mutation, memberQuery/Mutation, adminQuery/Mutation, getOwned
convex/auth.ts          Better Auth + email OTP, `viewer` query
convex/files.ts         R2 upload URLs, signed URLs, attach
lib/format.ts           Bogotá dates and times, `$ 85.000`, phones
lib/whatsapp.ts         wa.me links with prefilled text
proxy.ts                redirects signed-out requests on app routes to /ingresar
```
