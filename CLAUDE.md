# Cosmela — agent guide

Web app (installable PWA) for cosmetologists in Colombia. Specs live in `docs/`:

- `docs/PRODUCT.md`: what to build (screens, flows, rules)
- `docs/DESIGN.md`: visual system and writing style
- `docs/ARCHITECTURE.md`: stack, layout, schema, authorization
- `docs/TEMPLATES.md`: seed treatment templates
- `docs/PLAN.md`: phases and file ownership
- `docs/research/`: verified notes on Convex, Better Auth, R2, Resend, PostHog, Next.js, and the domain

## Rules

- All user-facing text is Spanish (es-CO, "tú"). Code, identifiers, comments, and docs are English.
- Never print, log, or commit secrets from `.env`. Never commit `.env*`.
- Develop and test against the local anonymous Convex backend. Never push to or seed the owner's cloud deployment.
- YAGNI. Prefer simple, readable code. Comment only what the code cannot say.
- Health data never goes to analytics, logs, or email subjects.
- Every Convex function checks org membership (`convex/lib/authz.ts`).
- Before a phase ends, `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pass.
- Commits: title-only messages, no co-author lines.
