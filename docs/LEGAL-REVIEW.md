# Legal review before launch

The legal texts in Cosmela are drafts written without a lawyer. A Colombian lawyer must review them before real clients use the product. This file lists what to review and the placeholders to fill.

## Texts to review

| Text | Where |
|---|---|
| Cosmela privacy policy (Cosmela as controller for account data and processor for client data) | `app/privacidad/page.tsx` (`/privacidad`) |
| Cosmela terms and conditions, including the processor clauses and the electronic-signature clause | `app/terminos/page.tsx` (`/terminos`) |
| Default privacy policy generated for each business | `defaultPrivacyPolicy()` in `convex/orgs.ts` |
| Online data-authorization checkbox on the booking page | `components/booking/details-form.tsx` |
| Consent templates and contraindication lists per treatment | `docs/TEMPLATES.md`, `data/treatment-templates.ts` |
| Habeas Data authorization signed at the first visit | `convex/lib/consent.ts`, `components/attention/consent-step.tsx` |

## Questions for the lawyer

From `docs/research/domain.md` §1.7, plus points that come from the drafts:

1. If a clinic with habilitación uses Cosmela, does it become subject to Res. 1995 de 1999, Ley 2015 de 2020, and the 2026 draft rule on health information-system providers?
2. What retention period should salon records have when no historia clínica duty applies? Should it follow a civil-liability limitation period? (Fills `[plazo de conservación]`.)
3. Does a drawn signature plus audit data plus a document hash meet Decreto 2364 de 2012 art. 4 for consent to procedures with equipment? Is the electronic-signature clause in the terms (§6) enough, given that the business's clients never accept Cosmela's terms?
4. Laser hair removal is "aparatología" in Res. 2263 de 2004, but MinSalud calls it a medical procedure. Which reading do local secretariats apply? Should the template carry a warning?
5. Is Cosmela an encargado under Ley 1581? Do the processor clauses in the terms (§5) work as the transmission contract (DUR 2.2.2.25.5.2), or is a separate signed contract needed?
6. Data is hosted in the United States (Convex, Cloudflare R2, Resend, PostHog, Vercel). Is this a transmission or a transfer, and what does it require (SIC adequacy list, contract clauses, explicit authorization)?
7. Is there any rule on cosmetologists applying superficial peels, by acid type or concentration?
8. Does the RNBD apply to the salon, given its asset level? Does it apply to Cosmela as a provider?
9. Is an online checkbox on the booking page a valid "previa, expresa e informada" authorization for the business, given that the booking form collects no health data and the health data is authorized later with a signature?
10. Are the limitation-of-liability and termination clauses valid under Ley 1480 de 2011 when the user is a small business or a natural person?
11. Do appointment reminders fall under the contact hours of Ley 2300 de 2023? The product sends them between 07:00 and 20:00 Bogotá time, every day of the week.

## Placeholders to fill

These appear in the public pages and must be replaced before launch:

| Placeholder | Pages |
|---|---|
| `[razón social]` | `/privacidad`, `/terminos` |
| `[NIT]` | `/privacidad`, `/terminos` |
| `[dirección]`, `[ciudad]` | `/privacidad` (domicile), `/terminos` (jurisdiction) |
| `[correo de contacto]` | `/privacidad`, `/terminos` |
| `[teléfono de contacto]` | `/privacidad` |
| `[área o persona responsable]` | `/privacidad` (who handles data requests) |
| `[plazo de conservación]` | `/privacidad` (account data after closing) |
| `[plazo de eliminación]` | `/privacidad` (business data after leaving) |
| `[días de aviso]` | `/terminos` (notice before paid plans) |
| `[plazo de exportación]` | `/terminos` (days to export after closing) |

Also update the effective date ("15 de noviembre de 2026") on both pages when the reviewed version is published.
