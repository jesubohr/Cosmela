# Media inventory

Draft, November 16, 2026. This is a repository-level inventory, not proof of licenses. No asset has been replaced. Retain receipts, license text and version, assignment contracts, and releases in a restricted evidence repository; link evidence here without exposing personal documents.

| Asset | Location | Source / license evidence | Status and action |
| --- | --- | --- | --- |
| App icons | `app/icon.png`, `app/apple-icon.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png` | Source and creator unknown | Check: obtain source files, authorship and commercial permission/assignment. Do not claim ownership until verified. |
| Onest and Newsreader fonts | `app/layout.tsx`, `next/font/google` | Named Google Fonts packages; exact shipped license notices not inspected | Check upstream licenses and bundled notices. Next font build flow ordinarily self-hosts output; verify browser network before stating no runtime third-party font requests. |
| Lucide icons and UI dependency assets | `package.json`, components | Package licenses not audited in this draft | Check installed license/notice files and preserve required notices. Do not infer all dependency licenses from Lucide alone. |
| Landing illustrations/product UI and preview content | `components/landing/`, `app/page.tsx` | Code-rendered product mockups; concurrent user edits exist | Check text/images for real identifiable client data and rights. Use fictional records. Preserve unrelated ongoing edits. |
| Business logos | `components/settings/business-settings.tsx`, R2 uploads | Uploaded by tenants | Require uploader's rights, service-limited hosting license and claim channel. Check third-party trademarks if used in promotion. |
| Treatment photos and signatures | `components/shared/photo-upload.tsx`, attention/session records, private R2 | Uploaded by businesses/clients | Prior explicit purpose-specific authorization, private storage, no analytics reuse; separate selected-image promotional release if offered. |
| Treatment templates | `data/treatment-templates.ts`, `docs/TEMPLATES.md` | Authorship/source evidence pending | Check authorship and professional review. A template's availability does not establish medical accuracy or procedural authorization. |

No static video/audio/stock-photo files were found in the inspected `app/` and `public/` paths. This does not cover future uploads, externally hosted marketing assets, supplier dashboards, or assets added after the audit. No license status is marked verified without evidence.
