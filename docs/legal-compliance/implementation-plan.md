# Implementation plan

Draft, November 16, 2026. Approve this plan before application changes. This document describes proposed behavior, not deployed controls.

Stack: Next.js App Router, React/TypeScript, Better Auth email OTP, Convex validators/custom functions, R2, Resend, PostHog, Polar. Use existing components and `DocumentPage`; keep Spanish interface copy short. Do not introduce an unrelated CMS, consent vendor, workflow engine, or new authentication system.

## 1. Resolve publication inputs and preserve current work

Files: drafts in this folder; `docs/LEGAL-REVIEW.md`; existing uncommitted `proxy.ts`, `app/page.tsx`, landing components and design files.

- Use operator-supplied Cosmela S.A., NIT 99009900-1, +57 302 258 3921 and cosmela.app. Confirm the effective date and obtain lawyer review. Approve retention proposals and confirm provider capabilities. Do not claim registry verification that has not occurred.
- Regulated cosmetology-related professionals are within the audience. The operator confirmed professionals must hold their required credentials and Cosmela does not verify or certify them. Include that declaration in the accepted terms and the administrator's team obligations; do not add certificate uploads, verification badges, or claims of endorsement. Preserve Cosmela's own legal duties. Determine regulated-record requirements before advertising suitability for medical records.
- Preserve existing work; patch only relevant sections. Do not overwrite the landing page or proxy from an earlier version.
- Do not publish draft markers, unresolved placeholders, unverified provider guarantees, or a claim of complete compliance. Pending operator identity blocks production legal publication and paid launch, not local development.
- Update `docs/LEGAL-REVIEW.md` to point to reviewed documents and maintain unresolved questions. Replace its outdated free-beta/retention assumptions only after approval.

Validation: review each TODO in README, all Spanish documents, and provider configurations; save sign-off with the release.

## 2. Version documents and record acceptance

Files: `convex/schema.ts`, new `convex/legal.ts`, new `convex/lib/legal.ts`, new `lib/legal-documents.ts`; versioned approved content under `content/legal/es-CO/<version>/`.

- Preserve existing `policies` and old signed snapshots. Use that mechanism for tenant policies; introduce platform document versions for terms, privacy, refunds, cookies and the processing agreement.
- Store immutable type, version, language, full approved content, SHA-256, publication/effective timestamps, and material-change flag. The renderer and server must read the same approved content. Never trust a client-supplied hash or full policy body.
- Add an append-only authorization ledger scoped to account or tenant client. Store subject ID, org where applicable, exact document ID/hash, exact presented label, purpose, accepted/rejected/withdrawn action, server timestamp, method, bounded device evidence and route identifier. Avoid raw IP retention unless justified; never accept a claimed IP from the browser.
- Add a request key/index for duplicate submissions. Check idempotency in the same transaction. Records have no public update/delete endpoint; controlled retention purge is separate from ordinary operations. SHA-256 alone is not tamper-proof storage or proof of identity.

Sketch (field names may follow existing validator conventions):

```ts
type Purpose = "account" | "booking" | "health" | "record_photos" | "promotion";
type ConsentAction = "accepted" | "rejected" | "withdrawn";

async function requirePurpose(ctx, orgId, clientId, purpose: Purpose) {
  const latest = await latestAuthorization(ctx, orgId, clientId, purpose);
  if (latest?.action !== "accepted") {
    throw new ConvexError({ code: "AUTHORIZATION_REQUIRED", message: "Primero registra la autorización correspondiente." });
  }
}
```

Migration: old `online_checkbox` maps only to evidence of booking authorization. Do not reinterpret it as health/photo consent. Existing signatures remain historical evidence with their original scope; inspect text before deciding they cover a new purpose. Unknown scope stays unknown and requires authorization for future processing. Never backdate records or overwrite signed hashes.

Tests: wrong tenant/subject, forged/stale document version, missing purpose, latest withdrawal, duplicate retry, and immutable old text/hash. Test that every accepted record matches exactly what the UI presented.

## 3. Account creation, invitations and renewed acceptance

Files: `app/(auth)/ingresar/login-form.tsx`, `convex/auth.ts`, `app/api/auth/[...all]/route.ts`, `convex/lib/authz.ts`, `convex/orgs.ts`, `convex/invitations.ts`, `components/shell/app-shell.tsx`, onboarding and invitation views; new reusable legal-acceptance component.

- Present separate unchecked terms and account-data authorization controls before submitting the initial email, plus adult confirmation. Show the short notice before collecting email. Keep links to exact versions available without losing input.
- Bind pre-auth agreement to the verified OTP identity using a server-controlled pending acceptance/session mechanism. It cannot be an unverified browser email used to write another person's acceptance. Record account acceptance before activating the account.
- Better Auth stores users in a component. First inspect supported server hooks/adapter transactions; do not assume its user insert and an app-table write are atomic. If cross-component atomic insertion is unsupported, create only a pending auth identity and deny application activation until a single Convex transaction commits verified acceptance. Clean abandoned pending records on a short documented schedule. Confirm the actual hook API against installed package types before implementation.
- All authenticated app/API paths enforce effective acceptance, including onboarding creation, invitation acceptance, billing actions, exports and direct Convex calls. UI redirects alone are insufficient. Keep legal reading, acceptance, sign-out, rights requests and closure assistance available. Decide a narrow secure export path for users declining changed terms so they can recover their data.
- Existing users receive an acceptance step on next use. A new material version requires renewed acceptance before affected operations. A typo/contact update alone does not require blanket reacceptance.
- The authorized administrator separately accepts the processing agreement for the organization; ordinary staff cannot bind the company. No marketing checkbox because the product does not currently need marketing.

Tests: new OTP user, existing user, invite login, direct mutation/action bypass, pending failure/retry, stale terms, non-admin DPA attempt, decline and export/closure route. No business data access before required activation.

## 4. Prior client authorization and adults-only records

Files: `convex/clients.ts`, `convex/booking.ts`, `convex/sessions.ts`, `convex/files.ts`, `convex/lib/validators.ts`, `convex/lib/consent.ts`, `convex/orgs.ts`, client forms, booking details/flow, attention flow/steps and upload components.

- Add basic-data notice/authorization at first staff registration, with an honest verified method (client action or recorded external authorization evidence). A staff checkbox must not pretend the client personally clicked it. Create initial client and basic-purpose evidence in one transaction.
- Booking returns exact current notice/version identifiers. Submit the displayed version and adult attestation; server rechecks current version and writes booking-purpose evidence atomically with appointment creation. Record evidence for repeat bookings too, without blindly overwriting a client found only by phone. An anonymous booking does not prove identity of the owner of that phone or authorize sensitive processing on their existing ficha.
- Before ficha/assessment/contraindications or session photos, collect distinct explicit authorization with policy snapshot and purpose. Place this step before the existing ficha step; procedural consent remains after assessment. A recorded refusal must permit basic scheduling and exit, with no sensitive answers persisted.
- Enforce in every health-write path (`clients.create/update`, intake, assessment, contraindications, postponed sessions and custom fields), not just `signConsent`. Audit read paths as well: withdrawal stops future non-required processing and restricts continued access to records retained under a documented duty.
- Photo authorization precedes the upload, including obtaining a signed upload URL. Bind temporary photo uploads to an authorized session; checking only `attach` allows unauthorized objects to reach R2. Continue checking attachment and later use. Reuse existing claim/ownership rules. Do not delete a photograph only after an unauthorized initial upload and call that prior authorization.
- Keep private record photos and promotional release separate. Do not enable promotion until its exact channels, selected images, duration, and withdrawal process are approved. Default to no promotion.
- Require adult attestation for new clients and booking; reject explicitly minor dates/documents on the server. Validate actual calendar dates and compute age in Bogotá, including birthday boundaries. For procedures that require reliable age confirmation, require verified age evidence proportionate to the need. Missing DOB is not an adult attestation.
- Remove new guardian-signing paths from the UI and reject them on new submissions; retain backward-compatible validators to read old records. Inventory legacy minors, quarantine inappropriate new processing, notify authorized admins and coordinate lawful custody/deletion. Do not bulk-delete history.
- Revise `defaultPrivacyPolicy()` to require actual controller identification/contact and the tenant's necessary retention criteria. Block enabling public collection with incomplete legal identity. A policy checkbox is not proof that the policy is adequate.

Tests: booking permission cannot save health; no permission cannot create/update health via API; rejection does not save answers; no photo permission cannot obtain upload URL or attach; withdrawal prevents future use; public repeat request does not alter existing sensitive permissions; minor birth dates/adult contradictions/invalid dates; cross-tenant evidence; original consent snapshot preserved.

## 5. Analytics and browser storage

Files: `instrumentation-client.ts`, `lib/analytics.ts`, `components/providers.tsx`, new cookie preference component, `components/settings/data-settings.tsx`, public footer.

- Initialize PostHog only after optional opt-in. Configure persistence TTL and provider event retention to the approved values; application code cannot enforce the vendor dashboard setting alone.
- Explicitly disable autocapture, automatic pageviews, performance/exception capture that is not approved, and session replay. Use an event/property allowlist with route templates instead of raw URLs, IDs, searches and tokenized links. Keep masking and invitation scrubbing as secondary controls.
- `identifyUser`, capture helpers and sign-out reset must respect consent and initialization. Retain the authenticated ID only in memory until consent; identify when the user opts in. Do not let a reset silently restart capture or create a new optional identifier after rejection.
- Provide equally visible accept/reject controls and a persistent preferences entry. Persist choice, notice version and anonymous receipt ID for up to 12 months; record server receipt idempotently with rate/size limits. Do not attach an anonymous visitor to a logged-in profile without the proper authorized purpose.
- Withdrawal disables capture before cleanup, removes optional persistence, records the action, and requests provider deletion of associated analytics profiles as appropriate. Clarify any limited evidence retained. Do not send a withdrawal event via the rejected analytics SDK.

Validation: use browser storage/network inspection during the implementation QA phase. Assert no PostHog requests/IDs before consent, after rejection, or after withdrawal; no sensitive fields/raw URLs after acceptance; equal choice and keyboard access; normal auth/theme still work. This draft has not performed browser validation.

## 6. Legal routes and checkout

Files: existing `app/terminos/page.tsx`, `app/privacidad/page.tsx`; new `app/cookies/page.tsx`, `app/reembolsos/page.tsx`, `app/acuerdo-datos/page.tsx`; `proxy.ts`, `components/settings/data-settings.tsx`, landing/footer, `components/settings/plan-settings.tsx`, `convex/billing.ts`.

- Render approved Spanish documents with `DocumentPage`, version and real effective date. Make all public legal pages reachable without login; carefully merge the public-route list into the already modified proxy. Archive old versions for evidence.
- Link terms, privacy, cookies, refunds and contact from the footer and settings. Provide preference changes where optional tracking operates. Show short notices at collection points.
- Before creating a Polar checkout, present total price/currency/tax treatment, recurring interval, limits, trial conditions, renewal, refund link and Polar merchant identity. Require current organization DPA/terms and server-validated purchase authorization bound to plan/version, not a client-only checkbox.
- Keep cancellation portal accessible during past-due/read-only status and route failures to support. Test webhook/sync state and actual cancellation. Do not build a second billing processor.
- Implement support-assisted statutory refund intake and traceable case handling first; do not add automatic discretionary refund issuance beyond approved policy. Test an actual sandbox refund through Polar's supported tooling and reconcile financial/status results before enabling production billing. Do not assume refunding cancels a subscription.
- Do not presume the statutory service-start exception from account access; any express service-start request requires lawyer-approved wording, evidence and effect.

Tests: protected routes never intercept legal pages; checkout with missing/stale acceptance fails; non-admin and wrong-plan request fails; no accidental trial charge; cancel/refund are distinct; support intake does not ask for PAN/CVC.

## 7. Export, closure, retention and rights operations

Files: `components/settings/data-settings.tsx`, `convex/orgs.ts`, new `convex/dataLifecycle.ts`, `convex/schema.ts`, `convex/crons.ts`, `convex/files.ts`, email templates; new operational runbook in this folder.

- Extend export to tenant-scoped structured records, relationship IDs, consent/policy evidence and private files; use authorized short-lived downloads and bounded pagination. Existing contact CSV remains a useful optional format. Preserve access for export during the approved closure window and read-only billing state.
- Closing needs verified admin authority and explicit confirmation. Cancel future billing or resolve it before marking closure complete. Immediately stop public booking, reminder jobs, invitations and unwanted access. Cancellation of renewal and ordinary inactivity never trigger silent deletion.
- Use an idempotent internal job with `closureConfirmedAt`, `exportUntil`, `activeDeletionDueAt`, progress and scoped holds. Batch-delete active copies/files by the approved deadline; keep only separately justified minimum evidence/commercial records. Remove Better Auth accounts only after checking membership in other organizations. Do not orphan R2 files or delete shared signatures needed for retained evidence.
- Configure backup expiry with each provider, including mailbox/support exports; do not promise a cron can delete vendor-managed backups. Keep a restricted deletion ledger and reapply it on restoration before serving traffic. If a vendor cannot meet the proposal, resolve the contract/wording before release.
- Rights requests start through ayuda@cosmela.app; keep a minimal restricted case register. Document deadlines, proportional verification, incomplete claims, transfer to the competent controller, pending-dispute markers and outcomes. Operational staff need access only to necessary evidence.
- Implement incident runbook with named owner, containment, vendor escalation, affected-tenant notifications, 15-business-day SIC reporting assessment, and evidence. Determine RNBD duties using actual assets; do not automatically register or declare an exemption.

Tests: paginated export complete and isolated, unauthorized export fails, unrelated tenant/user survives closure, retry and partial R2 failure, holds restrict only selected records, scheduled reminders stop, provider deletion request logged, restoration reapplies tombstones. Test purge only with disposable fixtures; no live data deletions as a verification step.

## 8. Review, verification and release

- Collect media/license evidence from `media-inventory.md`; replace only confirmed problematic assets after review.
- Review meaningful authorization, age, billing and lifecycle tests with existing Vitest/convex-test patterns. Run `pnpm test`, `pnpm lint`, and `pnpm typecheck` after implementation. Run a production build once inputs permit it. Add no tests that merely mirror static legal prose.
- Inspect Spanish legal routes and account/booking/attention/checkout flows in a browser when authorized QA begins. Verify real cookies, requests, provider retention and signed document output; static source inspection is insufficient for those claims.
- Run the applicable code-review skill before any merge. Obtain Colombian legal review of controller/processor contracts, consumer applicability, refunds, service-start exceptions, electronic evidence, healthcare scope and retention. Confirm accounting treatment with the accountant.
- Update README statuses only after each control actually ships and passes its checks. Never label a draft or a mocked provider setting as implemented. Deploy/publish legal text and effective dates only with the approved release.
