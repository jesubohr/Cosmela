# Cosmela — Build plan

Each phase is built by one implementer agent, reviewed, fixed, and committed. Phases 1A/1B and 3A/3B run **in parallel** in the same working tree, so each agent owns a set of files (listed). Do not edit files owned by the parallel agent; if you need a change there, write it in your final report instead. Shared files (`convex/schema.ts`, `lib/constants.ts`, `components/shared/*`, `components/ui/*`, shell) are frozen after Phase 0 except for additive changes listed in your phase.

Definition of done for every phase: features work end to end against the local anonymous Convex backend; `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass (in a parallel phase, errors in files you do not own are reported, not fixed); UI follows DESIGN.md at 360 px and 1280 px widths; all UI text is Spanish; final report lists what was built, what was skipped and why, and any deviation from the specs.

## Phase 0 — Foundation (sequential)

Owns everything it creates.

1. Scaffold Next.js 16 + TypeScript + Tailwind v4 + ESLint with pnpm in the repo root (keep `docs/` and `.env`). `.gitignore` must cover `.env*`, `.convex/`, `node_modules`, `.next`. `git init` (if absent) and commit at the end.
2. shadcn/ui init and components: button, input, textarea, label, field, select, checkbox, radio-group, switch, tabs, dialog, drawer, sheet, popover, dropdown-menu, command, calendar, sonner, skeleton, avatar, badge, separator, tooltip, sidebar, scroll-area, toggle-group. Restyle with DESIGN.md tokens; fonts Onest + Newsreader via `next/font/google`.
3. Convex setup with the local anonymous backend, `convex.config.ts` with components (Better Auth, R2, Resend), **complete `schema.ts`** from ARCHITECTURE.md §3, shared validators, `lib/constants.ts` (all enum keys → Spanish labels, including the general contraindication list, observed alterations, reasons, conditions, allergies, skin conditions, payment methods, document types, categories, staff colors).
4. Auth: Better Auth + emailOTP + Resend (spike first: OTP send / dev log, identity in mutation, proxy). `/ingresar` page fully designed. `proxy.ts`. Sign out.
5. `convex/lib/authz.ts` (memberQuery/memberMutation/adminQuery/adminMutation/getOwned) + tests (cross-org isolation, staff vs admin).
6. App shell: `(app)/layout.tsx` with desktop sidebar and phone bottom tabs + `/mas` page, header component with title and actions slot, offline banner, empty placeholder pages for every route in ARCHITECTURE.md §2 (title only), redirect logic (no org → `/bienvenida`).
7. Shared components: `ResponsiveDialog`, `SignaturePad`, `PhotoUpload` (camera capture + compression + R2 upload + progress), `AlertChips` (from a client), `MoneyInput`, `PhoneInput` (+57), `EmptyState`, `Initials avatar`, `lib/format.ts` (Bogotá dates, `$ 85.000`, phone display), `lib/whatsapp.ts` (`wa.me` links with prefilled text).
8. `convex/files.ts` (R2 upload URL generation, attach, signed URL with ownership check).
9. PWA: `app/manifest.ts` (name "Cosmela", Spanish description, theme color plum, porcelain background, standalone, icons 192/512/maskable generated as simple monogram PNGs), apple touch icon, viewport theme color.
10. PostHog: `instrumentation-client.ts`, `/ingest` rewrites, replay off, input capture off, off when key empty. Identify with user id only.
11. `README.md` (English): setup, env, scripts, local backend, deploy notes.

## Phase 1A — Business setup (parallel with 1B)

Owns: `app/(onboarding)/**`, `app/(app)/tratamientos/**`, `app/(app)/configuracion/**`, `app/invitacion/**`, `components/treatments/**`, `components/forms/**` (form builder + `FormRenderer`), `components/settings/**`, `convex/orgs.ts`, `convex/members.ts`, `convex/invitations.ts`, `convex/treatments.ts`, `convex/templates.ts`, related tests, `data/treatment-templates.ts`.

- `data/treatment-templates.ts` from `docs/TEMPLATES.md` (typed with `FormField`, Spanish content verbatim).
- Onboarding 4 steps (PRODUCT §6.2), creating org (unique slug from name), admin member, userSettings, selected treatments from templates.
- Treatments list + editor (General, Formulario, Consentimiento, Cuidados), templates picker ("Agregar desde plantillas"), create from scratch, duplicate, deactivate, delete (only if never used; otherwise deactivate).
- **Form builder** and **`FormRenderer`** (renders `FormField[]` with react-hook-form + zod schema generated from fields; used later by Phase 2 in the attention flow — export a clean API: `<FormRenderer fields value onChange errors />` and `validateAnswers(fields, answers)`).
- Configuración: Mi perfil (incl. signature via `SignaturePad`, my schedule editor), Negocio (logo upload, privacy policy default text), Reservas en línea, Recordatorios, Equipo (invite by email with Resend email, accept at `/invitacion/[token]`, roles, deactivate), Plan ("Beta gratuita"), Datos (CSV export of clients — write the query in `convex/orgs.ts`), sign out.
- Schedule editor component reused by onboarding and profile.

## Phase 1B — Clients and agenda (parallel with 1A)

Owns: `app/(app)/clientes/**`, `app/(app)/agenda/**`, `components/clients/**`, `components/agenda/**`, `convex/clients.ts`, `convex/appointments.ts`, `convex/timeBlocks.ts`, `convex/payments.ts`, `convex/lib/slots.ts`, related tests.

- Clients list (search index, filters, pagination), quick create with duplicate phone detection, detail page with tabs (Resumen, Ficha, Historial placeholder for sessions list query, Citas, Pagos, Documentos placeholder), ficha editor (all permanent fields of PRODUCT §3.1 with chips and Fitzpatrick swatches) as a reusable `FichaForm` component (Phase 2 reuses it), archive.
- Agenda: day/week/month views (custom grid), staff columns in day view for salons on desktop, staff chips on phone, navigation, current-time line, working hours shading.
- Appointment create/edit sheet (client picker with inline quick-create, treatment, professional, date, free-slot suggestions + free time entry, conflict warnings, price prefilled, notes, optional abono), detail sheet with actions (reprogramar, registrar pago, WhatsApp confirm, no asistió, cancelar; "Iniciar atención" links to `/atencion/[id]`), confirm/reject requested appointments.
- Time blocks create/edit/delete.
- Payments: record payment (method, amount, date), list per appointment and per client, maintain `paidTotal`.
- `slots.ts` pure function + thorough unit tests.
- Appointment create/confirm/reschedule/cancel must call the reminder scheduling hooks: create `convex/notifications.ts` stubs (`scheduleReminder`, `cancelReminder`, `sendAppointmentConfirmed`) as internal functions with a TODO-free no-op body that Phase 3B fills in. (1B owns these stubs until Phase 3B.)
- "+" global action sheet (Nueva cita, Atención sin cita, Nuevo cliente, Bloquear horario) wired from the shell header.

## Phase 2 — Attention flow and cases (sequential)

Owns: `app/atencion/**`, `app/(app)/casos/**`, `app/imprimir/**`, `components/attention/**`, `components/cases/**`, `convex/cases.ts`, `convex/sessions.ts`, `convex/followUps.ts`; may extend `app/(app)/clientes/[id]` tabs Historial and Documentos.

- Start attention from an appointment (or walk-in), case suggestion, session creation, 6-step stepper with autosave and resume (PRODUCT §4 and §3), all gates, consent rendering with placeholders, client + professional signatures, Habeas Data authorization on first visit, photo capture before/after, procedure form via `FormRenderer`, aftercare, price + payment, follow-up (book next appointment now or create follow-up), close → read-only, postpone path.
- Share aftercare via WhatsApp (prefilled) and email (calls `notifications.sendAftercare`, stub if Phase 3B not done; add the stub).
- Cases list + detail (evolution timeline, photo comparison, follow-ups, close/reopen), session detail read-only with addenda, consent document view.
- Print views for ficha, session, and consent.
- Client detail: Historial and Documentos tabs filled.
- Allowed additive schema change: `sessions.consent` gets `hash: string` (SHA-256, see PRODUCT §3.3), `documentText: string` (the rendered `{documento}`), and optional `guardian: { name, document, relationship }` for clients under 18.
- Tests: session lifecycle, gates enforced server-side (cannot save procedure without consent; cannot close without required form answers), closed session immutability, case numbering.

## Phase 3A — Hoy and reports (parallel with 3B)

Owns: `app/(app)/hoy/**`, `app/(app)/reportes/**`, `components/dashboard/**`, `components/reports/**`, `convex/dashboard.ts`, `convex/reports.ts`.

- Hoy exactly per PRODUCT §6.3 and DESIGN.md §5, including Primeros pasos with auto-check and dismiss, birthdays, follow-ups actions, pending payments, requests confirm/reject.
- Reportes per PRODUCT §6.9 (simple CSS bars; no chart library).

## Phase 3B — Public booking and emails (parallel with 3A)

Owns: `app/reservar/**`, `components/booking/**`, `convex/booking.ts`, `convex/notifications.ts`, `convex/lib/emails.ts`, `convex/crons.ts`, `app/terminos/**`, `app/privacidad/**`.

- Public booking page per PRODUCT §6.11 (mobile-first, business branding, slots from `slots.ts`, data authorization checkbox, abuse limit), business privacy page.
- All emails of PRODUCT §7 with one simple Spanish HTML layout; reminder scheduling + cron sweep (ARCHITECTURE §6); new-request email to the team.
- Cosmela legal pages (Términos, Privacidad) in Spanish; add `docs/LEGAL-REVIEW.md` noting what a Colombian lawyer must review.

## Phase 4 — Review and polish (sequential)

- Independent review agent: correctness, security (authz on every function, public endpoints leak nothing), spec coverage, UX against DESIGN.md, Spanish copy quality.
- Fix agent applies findings.
- QA pass: run the app locally, seed a demo org in the **local** backend only, screenshot key screens at 360 px and 1280 px with Playwright, fix visual issues.
