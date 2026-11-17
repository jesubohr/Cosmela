# Cosmela legal compliance

Status: implementation approved by the operator and implemented locally on November 16, 2026. No production deployment or legal certification was performed. Sources checked November 16, 2026. Runtime document version: `2026-11-16`, effective-date text November 16, 2026. The `documents/` files preserve the review drafts; `content/legal/es-CO/2026-11-16/` contains the exact runtime Spanish documents and the server stores their hashes/snapshots upon acceptance. Lawyer review and the provider checklist below remain launch requirements.

Start with [the implementation plan](implementation-plan.md). Spanish drafts: [terms](documents/terms-and-conditions.md), [privacy](documents/privacy-policy.md), [cookies](documents/cookies-policy.md), [refunds](documents/refund-policy.md), [processing agreement](documents/data-processing-agreement.md), and [collection notices](documents/collection-notices.md). Supporting audits: [data inventory](data-inventory.md) and [media inventory](media-inventory.md).

## Business profile

- Operator: Cosmela S.A., company, NIT 99009900-1. Operator-supplied details; no registry verification performed.
- Address supplied by the operator: Cra 51B #76 - 136, Barranquilla, Colombia.
- Contact: ayuda@cosmela.app. Responsible person: Jesus Borrero. This designation does not assert a statutory DPO appointment.
- Telephone: +57 302 258 3921. Production domain: `cosmela.app`. Both supplied by the operator; ownership/operation has not been independently verified.
- Market: Colombia only; adult professional users and adult clients. No minors.
- Product: Next.js 16 / React 19 web SaaS; Better Auth email OTP; Convex data/functions; Cloudflare R2 files; Resend email; optional PostHog analytics; Vercel hosting; paid Polar subscriptions. Treatment-payment records are separate from subscription payments.
- Hosting: operator confirms United States services. [TODO: verify each provider's actual storage, backups, support access, subprocessors, and contracts. Do not promise exclusive US processing.]
- Professional scope: cosmetology-related professionals, including regulated professionals where applicable. The operator permits this audience; that does not establish suitability for every regulated clinical-record use. Professionals/establishments must meet the requirements of their actual activity. Cosmela does not provide treatments or manage their clinical relationship with clients; public booking, reminders, and records still involve processing client data.
- Credential responsibility confirmed by the operator: professionals hold the qualifications their work requires; businesses check their teams. Cosmela does not verify or certify credentials. Account creation, booking listings, and templates must not imply endorsement. Preserve Cosmela's own nonwaivable responsibilities; this is not a blanket liability exclusion.

## Baseline findings addressed by this implementation

1. `convex/clients.ts` accepts health fields before authorization. `convex/sessions.ts` records authorization only at treatment signing and treats an existing booking checkbox authorization as sufficient. `convex/files.ts` can attach photos before consent exists. These are priority gaps.
2. Account login has a combined implied-acceptance notice; it does not store acceptance of exact Cosmela terms and privacy versions.
3. `instrumentation-client.ts` initializes PostHog when configured without a consent gate. Replay is disabled, and masking/token scrubbing already exist. Do not assume masking removes every personal identifier.
4. Existing policy snapshots and signed treatment snapshots provide a useful foundation. Preserve them and their hashes; never manufacture missing historical acceptance.
5. Public terms describe a free beta even though paid plans exist. Public pages contain operator and retention placeholders.
6. Current CSV export covers identity/contact fields, not the complete treatment record, photos, or consent evidence. Archive is not deletion.
7. Code supports guardian signatures, which conflicts with the confirmed adults-only scope. Unknown birth dates currently count as adults in `isMinor()`.

## Sources and application

All links below were checked through official sources on November 16, 2026. `(verify)` flags a project-specific conclusion that needs legal or factual confirmation.

| Source | Application and action |
| --- | --- |
| [Ley 1581 de 2012](https://www.cancilleria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm) | Personal-data rights, prior informed authorization, explicit sensitive-data authorization, security, controller/processor duties. Queries: 10 business days, possible 5-business-day extension; claims: 15, possible 8. |
| [Decreto 1074 de 2015, data protection chapter](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr025.htm) | Notices, consent evidence, sensitive-data optionality, limited retention, and transmission contracts. Distinguish a processor transmission from a transfer to an independent controller. |
| [Ley 1480 de 2011](https://www.cancilleria.gov.co/normograma/compilacion/docs/ley_1480_2011.htm) | Consumer information, distance contracts, withdrawal, warranty, payment reversal, and unfair clauses where the customer qualifies as a consumer. SaaS used intrinsically in a business may fall outside that definition (verify); do not deny rights through a blanket B2B exclusion. |
| [Ley 2439 de 2024](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=257116) | Updated electronic-commerce disclosures and withdrawal refunds: maximum 15 calendar days once statutory prerequisites are met. |
| [Ley 527 de 1999](https://www.cancilleria.gov.co/normograma/compilacion/docs/ley_0527_1999.htm), [Decreto 2364 de 2012](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=50583) | Electronic records and reliable, appropriate signatures. A drawn image or hash alone does not prove signer identity or universal legal validity. |
| [Ley 2300 de 2023](https://normograma.mintic.gov.co/mintic/compilacion/docs/ley_2300_2023.htm) | Assess commercial/advertising and collection contacts, authorized channels, frequency, schedules, and unsubscribe. Do not classify every service confirmation as advertising. |
| [Ley 962 de 2005, article 28](https://www.cancilleria.gov.co/normograma/compilacion/docs/ley_0962_2005.htm) | Ten years for applicable commercial books and papers, from the last entry/document/voucher; this does not justify retaining all client health records for ten years. Accountant must map actual records. |
| [SIC RNBD scope](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/cuales-personas-estan-obligadas-realizar-el-registro-de-bases-de-datos-personales-en-el-rnbd) | Company registration duty depends on total assets above 100,000 UVT. Obtain asset figure; assess salons separately. Exemption does not remove data-protection duties. |
| [SIC incident guidance](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/cumplimiento-de-la-obligacion-del-reporte-de-incidentes-de-seguridad) | Assess and make applicable incident reports within 15 business days from detection and notification to the responsible area, including processors/non-RNBD entities. |
| [Ley 711 de 2001](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=14756) | Cosmetology professional scope; software templates do not authorize procedures. Healthcare-record obligations require a separate scope review (verify). |
| [MinSalud, legal bulletin March 2026](https://minsalud.gov.co/Normatividad_Nuevo/Bolet%C3%ADn%20Jur%C3%ADdico%20No.%2003%20%20de%202026.pdf) | Distinguishes noninvasive cosmetology establishments from habilitated healthcare services. Checked November 16, 2026. A cosmetology credential does not authorize every medical procedure; regulated-record duties depend on actual services. |
| [Polar buyer terms](https://polar.sh/legal/checkout-buyer-terms), [supplier terms](https://polar.sh/legal/master-services-terms) | Polar acts as merchant of record/reseller. Confirm enabled refund workflow and governing responsibilities; provider terms cannot erase mandatory customer rights. |

## Checklist

| Item | Status | Notes |
| --- | --- | --- |
| Terms, privacy, cookies, refunds | Implemented locally | Five public legal routes; complete operator identity, subscriptions and credential responsibilities. |
| Data-processing agreement and short notices | Implemented locally | Admin agreement; purpose-specific account, booking, health and photo notices. |
| Account acceptance and versioned evidence | Implemented locally | Verified OTP hook, pending-identity cleanup, invitations, existing-user gate and backend enforcement. |
| Prior sensitive-data/photo authorization | Implemented locally | Append-only purpose ledger; withdrawal limits future reads/writes; session-bound upload permission; procedure signing records the electronic-signature agreement under hash version 3. Legacy snapshots remain unchanged. |
| Analytics opt-in and withdrawal | Implemented locally | Lazy SDK initialization, equal accept/reject, expiring preferences and anonymous receipts. No product events are approved: the event filter currently discards all events. |
| No minors | Implemented locally | Actual date/age checks, adult attestations, blocked new guardian flow and admin legacy-minor inventory; lawful custody review remains operational. |
| Closure, export, deletion | Implemented locally | Paginated full tenant export and signed file links; live Polar verification and checkout freeze; export window, bounded purges, holds, evidence expiry, unlinked identity cleanup and verified/retried R2 deletion. |
| Provider contracts/regions | Needs decision | US hosting confirmed only at a high level. |
| Media rights | Needs evidence | See media inventory. |
| RNBD, privacy requests, incidents | Runbook ready; operator action required | Named owner must run procedures and assess RNBD against real assets. |
| Healthcare scope | Audience and credential responsibility confirmed; suitability needs review | Professionals hold required qualifications; Cosmela does not certify them. Review medical-record duties and software capability before claiming clinical-record compliance. |

## Proposed retention decisions

The operator approved these business periods; they are not a universal Colombian SaaS standard. Obtain legal review and verify provider configuration before production publication. Provider settings remain external launch checks even where the application implements a scheduled period.

| Data | Proposed period / trigger |
| --- | --- |
| Operational tenant data and account profile | During service; 30 calendar days to export after confirmed closure; remove active-system copies by day 60 after closure. Cancellation of renewal alone does not start deletion. |
| Tenant clinical/cosmetic record retention while active | Controller sets a documented necessary period by purpose and obligations (verify). Do not invent a blanket five-year retention or a medical-record period. |
| Backups | Proposed maximum 90 calendar days after active deletion, if supported (verify); no routine use; restore must reapply deletion ledger before access. Latest physical expiry could be 150 days after closure. |
| Minimum consent/contract and rights-request evidence | Proposed relationship plus five years after termination/resolution, respectively (verify). Restrict access and review necessity annually. Do not retain complete health records under this rule. |
| Security/access logs | 30 days rolling, except scoped incident preservation. No health payloads, OTPs, or bearer tokens. |
| Analytics events | 90 days rolling after collection, only with optional opt-in; delete associated profiles on withdrawal where applicable. |
| Browser analytics preference | 12 months or until a material change; rejection has the same duration. |
| Ordinary support conversations | Proposed 12 months after resolution; separate rights/incident evidence from general correspondence. Mailbox provider and deletion capabilities remain pending. |
| Applicable accounting/commercial documents | Ten years from last entry/document/voucher under article 28; accountant must classify records and other duties. |

Legal holds must identify the record, legal reason, owner, scope, and review/expiry date. A hold does not justify indefinite storage of unrelated records. A tenant must arrange lawful record custody before account closure; resolve holds before promising deletion.

## Open questions and launch blockers

- [TODO: verify supplied operator details before production publication; the operator approved implementation with the supplied NIT, telephone and domain.]
- [TODO: lawyer review of credential-responsibility wording, regulated-record suitability, and scope-specific custody and retention.]
- [TODO: provider DPAs, independent-controller roles, regions, backups/deletion limits, and Polar refund workflow.]
- [TODO: assets for RNBD determination; media licenses/ownership evidence.]
- [TODO: lawyer review of approved retention periods and statutory refund applicability; accountant review of commercial-record classification.]

## Verification and external launch checks

Local tests cover account activation, exact document snapshots, authorization withdrawal, tenant isolation, adult checks, idempotent booking, checkout consent/price changes, closure locks and live-provider response handling, legal holds and durable file-deletion state. See `verification.md` for final commands and browser checks.

Before production launch, verify vendor DPAs/regions/subprocessors; configure real log, analytics, mailbox and backup retention; test a sandbox cancellation/refund and provider deletion against disposable records; validate production auth cookies; and review media rights. No real refund, production deletion, or provider dashboard change was performed by this implementation. Never mark these completed from mocked tests.

## Ongoing duties

Jesus Borrero owns privacy intake at ayuda@cosmela.app. Maintain a request register with verified identity, deadlines, outcome, and minimal evidence. Do not routinely demand a full ID copy. Escalate queries before day 10 and claims before day 15; use statutory extensions only with timely notice and reasons. Transfer misdirected claims to the competent party within two business days where article 15 applies; tell the requester. Mark disputed records within two business days after a complete claim where required.

Maintain an incident register and response process: contain, preserve limited evidence, determine affected tenants/data, notify the affected controller without undue delay, assess SIC reporting and affected-person notices, and record remediation. Do not treat RNBD exemption as an incident-reporting exemption.

Version documents immutably. Notify users before material changes and obtain renewed authorization when purposes require it. Reassess providers, permissions, retention, and media rights when the product changes. Recheck laws before entering another country, adding marketing/AI, allowing minors, or expanding regulated clinical functions. A Colombian lawyer must review these drafts before launch; an accountant must confirm accounting duties. This draft does not certify compliance.
