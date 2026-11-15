# Cosmela — Architecture

Read with `docs/PRODUCT.md` (what), `docs/DESIGN.md` (look), `docs/TEMPLATES.md` (seed treatments), and the research notes in `docs/research/` (exact APIs and versions, with sources).

## 1. Stack

| Concern | Choice | Notes |
|---|---|---|
| Package manager | `pnpm` | npm is not on PATH. |
| Web | Next.js 16 App Router, React 19, TypeScript strict | `proxy.ts` (not middleware). Cache Components off. |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) + shadcn/ui | Tokens from DESIGN.md. |
| Backend / DB | Convex (`convex` 1.50.x) | All data, auth, scheduling, email sending. |
| Auth | Better Auth 1.7.x + `@convex-dev/better-auth` 0.13.x, `emailOTP` plugin | Passwordless 6-digit code by email. See research `convex.md` §3. |
| Email | `@convex-dev/resend` component (queued, retries) + `resend` SDK only inside the OTP callback if the component cannot be used there | Spanish HTML templates as plain TS functions (no React Email; YAGNI). |
| Files | Cloudflare R2 via `@convex-dev/r2` | Private bucket. Photos (before/after), signatures, logos. |
| Analytics | `posthog-js` via `instrumentation-client.ts`, `/ingest` rewrites | Session replay OFF, autocapture of inputs OFF, identify by opaque user id only. Off when key is empty. |
| Forms | `react-hook-form` + `zod` 4 + shadcn Field | |
| Dates | `date-fns` 4 + `@date-fns/tz`, `es` locale | Zone `America/Bogota` everywhere. |
| Signature | `signature_pad` 5 in a small wrapper | Not `react-signature-canvas`. |
| Calendar | Custom CSS-grid day/week/month views | No calendar library. |
| PWA | `app/manifest.ts` + icons | No service worker in v1; offline banner only. |
| Tests | Vitest + `convex-test` (edge-runtime) | Backend rules and flows. |
| Hosting | Vercel (web) + Convex cloud | Deploy only when the owner asks. |

Before installing, run `pnpm view <pkg> version` and use the current stable version. Read the research notes for API details before writing integration code; if something does not match the installed version, read the package README in `node_modules` and follow it.

## 2. Repository layout

```
/                      Next.js app root (single package, no monorepo)
├─ app/
│  ├─ (auth)/ingresar/                 login (email → code)
│  ├─ (onboarding)/bienvenida/          4-step onboarding
│  ├─ (app)/layout.tsx                  authenticated shell (sidebar / bottom tabs)
│  ├─ (app)/hoy/
│  ├─ (app)/agenda/
│  ├─ (app)/clientes/ [id]/ nuevo/
│  ├─ (app)/casos/ [id]/ [id]/sesiones/[sessionId]/
│  ├─ (app)/tratamientos/ [id]/ nuevo/
│  ├─ (app)/reportes/
│  ├─ (app)/configuracion/ perfil/ negocio/ reservas/ recordatorios/ equipo/ plan/ datos/
│  ├─ (app)/mas/                        phone-only menu page for the "Más" tab
│  ├─ atencion/[appointmentId]/         full-screen attention flow (own layout, no tabs)
│  ├─ imprimir/ficha/[clientId]/ imprimir/sesion/[sessionId]/   print layouts
│  ├─ reservar/[slug]/ reservar/[slug]/privacidad/   public booking (no auth)
│  ├─ invitacion/[token]/               accept team invitation
│  ├─ terminos/ privacidad/             Cosmela legal pages
│  ├─ api/auth/[...all]/route.ts        Better Auth handler
│  ├─ manifest.ts  layout.tsx  globals.css  page.tsx (redirect)
├─ components/
│  ├─ ui/                               shadcn components (restyled)
│  ├─ shell/                            sidebar, bottom tabs, header, offline banner
│  ├─ clients/ agenda/ attention/ cases/ treatments/ forms/ booking/ settings/ dashboard/
│  └─ shared/                           ResponsiveDialog, SignaturePad, PhotoUpload, AlertChips, MoneyInput, PhoneInput, EmptyState
├─ lib/                                 format.ts (dates, money, phone), whatsapp.ts, auth-client.ts, utils.ts, constants.ts (Spanish labels for enum keys)
├─ convex/
│  ├─ schema.ts  convex.config.ts  auth.config.ts  http.ts  crons.ts
│  ├─ betterAuth/                       Better Auth component setup
│  ├─ lib/                              authz.ts (custom functions), validators.ts, slots.ts (pure), time.ts, emails.ts (templates)
│  ├─ orgs.ts members.ts invitations.ts clients.ts treatments.ts templates.ts
│  ├─ appointments.ts timeBlocks.ts cases.ts sessions.ts followUps.ts payments.ts
│  ├─ files.ts booking.ts (public) dashboard.ts reports.ts notifications.ts (email actions)
│  └─ *.test.ts
├─ data/treatment-templates.ts          seed library (from docs/TEMPLATES.md)
├─ docs/                                specs + research
└─ public/icons/                        PWA icons
```

Rules: URLs are Spanish (user-facing). Identifiers, file names, tables, and comments are English. Spanish strings live in the components that use them; enum keys map to Spanish labels in `lib/constants.ts` (shared by UI and emails).

## 3. Data model (`convex/schema.ts`)

All times are epoch milliseconds (UTC). Calendar-only dates (birthdays, follow-up due dates) are `"YYYY-MM-DD"` strings in Bogotá time. Money is integer COP. Every business table has `orgId` and is indexed by it.

```ts
orgs: {
  name: string, slug: string,               // slug unique, used in /reservar/[slug]
  kind: "solo" | "salon",
  ownerId: string,                          // Better Auth user id
  city?: string, address?: string, whatsapp?: string,   // E.164
  logoKey?: string,                          // R2 key
  legalName?: string, taxId?: string,
  privacyPolicy?: string,                   // business data policy text; default generated
  booking: { enabled: boolean, minNoticeHours: number, maxDaysAhead: number, slotMinutes: number, welcome?: string },
  reminders: { email: boolean },
  checklistDismissedAt?: number,
}  index by_slug, by_owner

members: {
  orgId, userId: string, email: string,
  role: "admin" | "staff",
  name: string, title?: string,
  color: StaffColor,                         // one of 8 keys
  signatureKey?: string,
  schedule: { day: 0..6, start: "HH:mm", end: "HH:mm" }[],   // multiple ranges per day allowed
  bookable: boolean, active: boolean,
}  index by_org, by_user, by_org_user

invitations: { orgId, email, role, token, invitedBy: Id<"members">, status: "pending"|"accepted"|"cancelled", expiresAt }
  index by_token, by_org, by_email

userSettings: { userId: string, activeOrgId: Id<"orgs"> }  index by_user

clients: {
  orgId, firstName, lastName, searchText,    // lowercased, accent-stripped "first last phone document"
  documentType?: "CC"|"CE"|"TI"|"PA"|"PPT"|"NIT", documentNumber?,
  birthDate?: "YYYY-MM-DD", birthdayKey?: "MM-DD",
  sex?: "female"|"male"|"other"|"undisclosed",
  phone: string (E.164), email?, occupation?, address?,
  emergencyContact?: { name, phone },
  health: {
    conditions: ConditionKey[], conditionsOther?: string,         // diabetes, hypertension, autoimmune, thyroid, herpes, cancer
    allergies: AllergyKey[], allergiesDetail?: string,            // cosmetics, medication, food, other
    skinConditions: SkinConditionKey[], skinConditionsOther?, dermNotes?,  // dermatitis, psoriasis, rosacea, sensitive, keloids
    none: { conditions: boolean, allergies: boolean, skin: boolean },     // explicit "Ninguna" answers
  },
  habits: { dailyCleansing?: boolean, sunscreen?: "daily"|"sometimes"|"never", exfoliants?: "frequent"|"sometimes"|"never", previousTreatments?: string },
  skin: { type?: SkinType, fitzpatrick?: 1|2|3|4|5|6 },
  lastMedications?: string, lastPregnancy?: { pregnant: boolean, lactating: boolean, at: number },
  fichaCompletedAt?: number, healthReviewedAt?: number,
  dataAuthorization?: { at: number, signatureKey?: string, method: "signature"|"online_checkbox", policyText: string },
  notes?: string,
  createdBy: Id<"members">, archivedAt?: number,
}  index by_org, by_org_phone, by_org_birthday (orgId, birthdayKey), searchIndex search_text (searchField searchText, filterFields orgId, archived flag as `isArchived` boolean)

treatments: {
  orgId, name, category: "facial"|"body"|"lashes_brows"|"hair_removal"|"other",
  description?, durationMin, price, color: StaffColor,
  active: boolean, bookableOnline: boolean,
  templateKey?: string,
  consentText: string,                      // with {cliente} {documento} {tratamiento} {negocio} {fecha} placeholders
  contraindications: string[],              // treatment-specific (Spanish labels as written by the user)
  aftercare: string[], followUpDays?: number, suggestedSessions?: number,
  formFields: FormField[],
}  index by_org, by_org_active

FormField = { id: string, type: "section"|"text"|"longtext"|"number"|"single"|"multi"|"yesno"|"scale"|"date",
              label: string, help?: string, required?: boolean, options?: string[], unit?: string, min?: number, max?: number }

appointments: {
  orgId, clientId, memberId, treatmentId,
  start: number, end: number,
  status: "requested"|"scheduled"|"in_progress"|"completed"|"cancelled"|"no_show",
  source: "staff"|"online",
  price: number, paidTotal: number,          // paidTotal maintained by payment mutations
  notes?, caseId?, sessionId?,
  cancelReason?, reminderJobId?: Id<"_scheduled_functions">, reminderSentAt?,
  createdBy?: Id<"members">,
}  index by_org_start (orgId, start), by_member_start (memberId, start), by_client (clientId, start), by_org_status (orgId, status), by_org_balance? (use filter: completed & paidTotal < price; volume is small per org)

timeBlocks: { orgId, memberId, start, end, allDay: boolean, kind: "personal"|"professional", title? }
  index by_org_start, by_member_start

cases: {
  orgId, clientId, treatmentId,
  reasons: ReasonKey[], reasonOther?: string,  // motivo de consulta
  plannedSessions?: number, status: "open"|"closed",
  openedAt, closedAt?, summary?, sessionCount: number, lastSessionAt?,
}  index by_org_status, by_client

sessions: {
  orgId, caseId, clientId, appointmentId, memberId, treatmentId,
  number: number,                            // 1-based within case
  status: "draft"|"closed"|"postponed",
  step: number,                              // last completed step, for resume
  startedAt, closedAt?,
  intake?: { healthChanged: boolean, medications: string, pregnant?: boolean, lactating?: boolean, evolution?: string },
  assessment?: { observed: ObservedKey[], observedOther?, skinType?: SkinType, notes? },
  contraindications?: { present: string[], proceed: boolean, justification? },   // present = labels marked
  consent?: {
    text: string,                            // rendered snapshot
    photoUse: "clinical"|"clinical_and_marketing"|"none",
    clientSignatureKey: string, professionalSignatureKey?: string,
    signedAt: number, userAgent: string,
  },
  procedure?: { fields: FormField[], answers: Record<string, string | number | boolean | string[] | null>, notes? },
  photos: { key: string, kind: "before"|"after", at: number }[],
  aftercare?: { items: string[], notes? },
  followUp?: { recommended: boolean, inDays?: number, note? },
  addenda: { at: number, memberId: Id<"members">, text: string }[],
}  index by_case, by_client, by_appointment, by_org_status

followUps: { orgId, clientId, caseId?, sessionId?, memberId, dueDate: "YYYY-MM-DD", note?, status: "pending"|"done"|"dismissed", outcome?, doneAt? }
  index by_org_status_due (orgId, status, dueDate), by_client

payments: { orgId, appointmentId, clientId, amount, method: "cash"|"nequi"|"daviplata"|"breb"|"transfer"|"card"|"other", paidAt, note?, recordedBy: Id<"members"> }
  index by_org_paidAt, by_appointment, by_client
```

Use shared validators in `convex/lib/validators.ts` so the UI imports the same enum lists (with Spanish labels in `lib/constants.ts`). Keep documents small: photos are R2 keys, never bytes.

## 4. Authorization

- `convex/lib/authz.ts` builds custom functions with `convex-helpers` (`customQuery`, `customMutation`):
  - `memberQuery` / `memberMutation`: resolve user identity → `userSettings.activeOrgId` → active `members` row. Inject `ctx.member` and `ctx.orgId`. Throw `ConvexError({ code: "UNAUTHENTICATED" | "NO_ORG" | "FORBIDDEN" })`.
  - `adminQuery` / `adminMutation`: same + `role === "admin"`.
  - Helper `getOwned(ctx, table, id)` loads a doc and throws unless `doc.orgId === ctx.orgId`. Use it for **every** id received from the client.
- Public functions for the booking page (`booking.ts`) take a `slug`, never return health data, and only return: business public profile, bookable treatments (name, duration, price, description), bookable members (name, color), and free slots.
- Files: `files.getUrl` returns short-lived signed URLs only for keys referenced by a document of the caller's org. Upload keys are prefixed `orgs/{orgId}/…`.
- Write tests that a member of org A cannot read or write org B (clients, sessions, files) and that staff cannot call admin mutations.

## 5. Auth flow

1. `/ingresar`: `authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })` → `authClient.signIn.emailOtp({ email, otp })`. New emails get an account automatically.
2. `proxy.ts` redirects unauthenticated requests on app routes to `/ingresar` (public: `/ingresar`, `/reservar/*`, `/invitacion/*`, `/terminos`, `/privacidad`, `/api/auth/*`, static).
3. After login: if no membership → `/bienvenida` (onboarding creates the org + admin member + userSettings + selected treatments). If an invitation token is pending → accept it.
4. OTP email: Spanish subject "Tu código de acceso a Cosmela: 123456". Without `RESEND_API_KEY`, log the code to the Convex logs (dev).
5. Rate limit OTP sends (Better Auth built-in rate limiting or a simple per-email counter).

Spike this first (research §3d): OTP send, identity inside a mutation, proxy blocking.

## 6. Key algorithms

- **Free slots** (`convex/lib/slots.ts`, pure and unit-tested): input = member schedule ranges for the day, existing busy intervals (appointments with status requested/scheduled/in_progress + time blocks), treatment duration, slot step, min notice, now. Output = start times where `[start, start+duration)` fits fully inside a schedule range and overlaps no busy interval. All in Bogotá local time converted to epoch ms with `@date-fns/tz`. "Cualquiera disponible" = union over bookable members; on submit, assign the first free member.
- **Case suggestion** when starting an attention: the client's open case with the same treatment, else new case.
- **Session number** = `case.sessionCount + 1` at creation.
- **Balance** = `appointment.price - appointment.paidTotal`. Pending payments = completed appointments with balance > 0.
- **Reminders**: on schedule/confirm, `ctx.scheduler.runAt(start - 24h)` (clamped to ≥ now + 5 min; if that lands between 20:00 and 07:00 Bogotá, move to 19:00 the day before or 07:00 same day if later than now) and store `reminderJobId`; cancel/reschedule on change. A cron every 30 min sends missed reminders for appointments in the next 26 h without `reminderSentAt`. The send action re-checks status, org setting, and client email.

## 7. Files (R2)

- `@convex-dev/r2` component. Env on the Convex deployment: `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_TOKEN` (check the component README for the exact names).
- Client compresses images before upload: max 1600 px longest side, JPEG 0.82 (canvas). Signatures: PNG from `signature_pad` (trimmed, transparent background).
- After upload, a mutation attaches the key to its document (session photo, consent signature, member signature, org logo) after checking ownership.
- Fallback if R2 is not configured locally: Convex built-in storage behind the same `files.ts` interface is NOT needed — R2 credentials exist. Do not build a fallback (YAGNI).

## 8. Environment

`.env` (root, never committed, never printed) holds the owner's credentials. Next.js needs public names, so create `.env.local` (gitignored) with:

```
NEXT_PUBLIC_CONVEX_URL=<CONVEX_URL>
NEXT_PUBLIC_CONVEX_SITE_URL=<CONVEX_SITE_URL>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_POSTHOG_KEY=<POSTHOG_KEY>
NEXT_PUBLIC_POSTHOG_HOST=<POSTHOG_HOST>
```

Convex deployment env (set with `npx convex env set`, values from `.env`): `BETTER_AUTH_SECRET` (generate), `SITE_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `R2_*`. Polar is not used in v1.

**Development and testing** run against a throwaway **local anonymous Convex backend** (`CONVEX_AGENT_MODE=anonymous npx convex dev --local` or the current documented equivalent), never against the owner's cloud dev deployment, unless the orchestrator says otherwise. Never seed data into the cloud deployment.

## 9. Conventions

- TypeScript strict, no `any`. Small components. Server components for page shells; client components for Convex hooks.
- Render page headers immediately; show skeletons for data. Never block a whole page on auth or data.
- Convex functions validate all args with `v`, return only needed fields, and use indexes (no `.filter` scans over whole tables except tiny per-org sets).
- Errors to the UI: `ConvexError` with a Spanish `message` meant for the user; the UI shows it in a toast or inline.
- Comments only for what the code cannot say. YAGNI: no abstraction for a single use.
- Health data never goes to PostHog, console logs, or email subjects.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` must pass at the end of every phase.
- Git: commit at the end of each phase with a title-only message. Never add a co-author line. Never commit `.env*`.
