# Data lifecycle operations

Owner: Jesus Borrero, ayuda@cosmela.app. The application implements this workflow locally; provider controls and legal retention classifications still require verification before launch.

## Closure and export

Verify that the requester is an administrator of the tenant. Ask them to cancel renewal in Polar and confirm the subscription state in Polar and the application before closure. A cancellation or inactive subscription alone does not close a tenant. The closure action queries Polar directly and updates cached subscriptions before confirmation. When Polar is unavailable, closure fails if the tenant has paid subscription history; resolve the billing state with support. On confirmed closure, record the 30-day export window and 60-day active deletion target. Ensure the tenant has arranged lawful custody of its records. Use the restricted administrator export functions for paginated tenant data and five-minute signed file URLs. Treat URLs and exported files as sensitive; do not send them through ordinary support email. Test with disposable tenants only.

The cleanup job starts after the 30-day export window and schedules bounded follow-up batches toward the day-60 target. Any unreleased hold pauses the entire tenant, including files, until an operator reviews and releases it. Record its reason, owner and review date. The job retains signed procedural consent and its signatures, policy snapshots and authorization evidence separately; scheduled sweeps expire evidence five calendar years after closure and treatment payments ten calendar years after their date. The lawyer and accountant must verify these classifications. Cleanup removes tenant memberships, selects another active organization for shared users, and minimizes organization identity fields. Auth cleanup rechecks active memberships before removing an unlinked Better Auth identity and its sessions/accounts. Minimum platform acceptance evidence expires separately after five years. Abandoned identities without any acceptance are checked after 24 hours.

Private file deletion uses a durable `fileDeletionRequests` ledger. The worker awaits the provider deletion action and verifies a signed read returns 404 before removing file ownership. Failures retain ownership and schedule backoff retries; holds postpone retries. Internal `fileDeletion:report` lists pending attempts and failures. Monitor this and closure deadlines daily. Tests do not prove production credentials can delete objects: verify a disposable object before launch. Operational completion does not mean retained evidence or vendor backups have expired.

Configure and verify each provider's backup expiry, including support mailbox exports. The proposed maximum is 90 days after active deletion, subject to provider capability. Keep the deletion ledger through backup expiry and reapply it to restored data before allowing traffic. Resolve provider limits and holds before promising deletion.

Closure freezes new checkout requests, verifies unresolved checkouts and linked subscriptions, and reads all current Polar subscription pages. A confirmed payment still in progress blocks closure. Ambiguous checkout failures require reconciliation. If a process stops while holding `closureRequestedAt`, verify Polar state before an operator invokes internal `dataLifecycle:releaseClosure` with the matching tenant and timestamp. Do not clear the lock just to bypass a pending purchase. The administrator portal remains available when platform terms are declined.

## Provider and content launch checks

- Review vendor DPAs, subprocessors, storage/access countries and production cookie lifetimes.
- Configure log rotation, mailbox/support retention and backup expiry; application crons cannot change vendor controls.
- Set PostHog retention before approving product events. The shipped filter rejects every event until an explicit safe allowlist is reviewed. Handle historic profiles/events and provider-side deletion requests separately.
- Test actual Polar cancellation and a sandbox refund; a refund does not necessarily cancel a subscription. Mocked responses do not establish provider behavior.
- Obtain licenses/ownership evidence for icons, fonts, templates and uploaded material.
- Review legacy minors with their controller and arrange lawful custody; do not bulk-delete them. Review medical-record suitability before offering that use.

## Rights requests

Receive requests at ayuda@cosmela.app. Keep a restricted register with receipt date, request type, identity verification method, deadline, assigned owner, status, dispute marker, decision, and minimum supporting evidence. Use proportional verification and avoid routine identity-document copies. Request missing information and track statutory deadlines; escalate queries before day 10 and claims before day 15. Where applicable, transfer a misdirected claim to the competent controller within two business days and notify the requester. Mark disputed data within two business days after a complete claim where required. Record extensions, reasons and notices, and review evidence retention annually.

## Incidents

Jesus Borrero coordinates containment, preservation of limited evidence, provider escalation, affected tenant identification, and notification decisions. Assess SIC reporting within the applicable 15-business-day period and document the decision, dates, affected data, notices and remediation. Assess RNBD obligations against actual company assets; do not assume registration or exemption. Use a separate restricted incident register.
