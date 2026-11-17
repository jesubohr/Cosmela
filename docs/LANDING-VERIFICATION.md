GATE: OPEN 3 (rounds used up)

# Landing page verification

This report records the initial English design review. The landing page now uses neutral Latin American Spanish, including the product preview, accessibility labels, and metadata. Lint, type checks, and the production build passed after translation. The full design gate has not been rerun for the Spanish copy.

The public landing page is implemented at `/`. This report records the design skill gate separately from application checks.

## Application checks

- `pnpm typecheck`: passed.
- `pnpm lint`: passed. Supplied, unchanged design-kit files are excluded from authored-code lint.
- `pnpm build`: passed; the landing route prerenders successfully.
- `pnpm exec vitest run --maxWorkers=2`: all 185 tests passed across 17 files. The initial unrestricted run hit 10 test timeouts while browser and build work ran; reduced concurrency resolved them without test or application changes.
- `git diff --check`: passed.

## Open design findings

The skill permits three gate rounds and then requires stopping fixes. The final gate has these findings. The page does not have a clean visual-gate pass.

- **button-styles** at `(one screen)`: 3 button styles on one screen: soft, fill #285d4b, outline #285d4b ("Create an account"); pill, fill #e5ddd0 ("VR", in a mock); soft, fill #285d4b ("View client record", in a mock); the odd one out: "View client record"
  Recommended change: one primary and one secondary button: one shape, one height per size, one label size
- **one-heading** at `h2#questions-h "A few practical questions."`: headings of two sections show whole on one screen at 4 of 73 scroll positions (5.5%; at scroll 2000, 2050, 3000, 3050px), here with "6": at most 3% on a desktop (SR-5)
  Recommended change: make the sections one screen tall so their headings sit a screen apart and two never share one
- **split-pair** at `main#main > section.cl-hero.hero > div.cl-wrap.wrap > div.cl-heroGrid.hero-text "Practice software with room to care.Appo"`: the two columns of the split start 29px apart at the top: a split's columns are top-aligned, 8px either way (SR-8)
  Recommended change: top-align both columns of the split (align-items: start)

## Waivers

- **text-only** at `section#questions "A few practical questions."`: This section contains practical FAQ answers. A photograph or invented product visual would add no information; open answers support the user's less-is-more instruction.
- **copy-headings** at `h2#practice-h "Appointments, records, and follow-ups."`: The headings name real product concepts from docs/PRODUCT.md: appointments, records, follow-ups, assessment, contraindications, consent, procedure, and aftercare. The noun dictionary does not recognize these clinical terms.
- **motion-layer** at `html[data-motion]`: Next.js bundles the unchanged supplied motion.css into its route stylesheet. The stylesheet is loaded through the page import, and the supplied motion.js runs on the landing page.
- **container-edges** at `div.cl-landing "Skip to contentcosmela.Your practiceClie"`: This single route wrapper scopes landing-page colors and English language inside the existing Spanish Next.js application. Its children remain header, main, and footer in document order.

## Remaining warnings

These warnings remain for review; they do not block this gate. The complete messages follow so the report does not hide copy or layout warnings.

- **scroll-reveal** at `section#workflow > div.cl-wrap.wrap > div.cl-workflowBody > div.cl-workflowIntro "6 7 8 9 0 1 2 3 4 5 6 steps, from record"`: starts an animation (1.4 s) the moment it is scrolled into view (an IntersectionObserver) on span.mo-cr__strip (inside a dealt moment's section, [data-moment]: an enter moment is expected on every kind; its still is judged under reduced motion)
- **off-grid** at `ol.cl-steps > li:nth-of-type(1) > div > h3 "Client record"`: left edge at 769.5px, 2.5px off a common edge of its section at 772px (10 elements, like h3); 1 more in this section off the grid too (p at 769.5px)
- **nav-labels** at `header.cl-header.nav > div.cl-wrap.wrap > nav.cl-nav > a:nth-of-type(1) "Your practice"`: "Your practice" opens a section headed "Appointments, records, and follow-ups."
- **orphan** at `div.cl-wrap.wrap > div.cl-workflowBody > div.cl-workflowIntro > p.cl-figure.t-stat "6 7 8 9 0 1 2 3 4 5 6"`: its last line holds only "6" (inside a held section or scroll scene, whose motion --quick does not check)
- **copy-length** at `section#questions "A few practical questions."`: 2 sections over 90 words a screen outside the UI mocks ("A few practical question" 126, "A place for every step o" 98); 86 words a screen across the page (343 words in 4 screens): a tech page says it in about 80 or fewer
- **empty-area** at `div.cl-landing > footer.cl-section.cl-footer "A little more room for your practice."`: 44% of the section is empty: 208px of empty rows between its content, 15% beside content that covers under half the container, in its 720px of rows (WARN over 35%, FAIL over 50%)
- **lang** at `html "es-CO"`: <html lang="es-CO">, but the words read as en (83 common en words against 0 es ones in 341)
- **tap-size** at `div.cl-landing > header.cl-header.nav > div.cl-wrap.wrap > a.cl-wordmark "cosmela."`: a 101x33px tap target: under the 44px a phone needs
- **tap-size** at `footer.cl-section.cl-footer > div.cl-wrap.wrap > div.cl-footerBottom > a.cl-wordmark "cosmela."`: a 342x33px tap target: under the 44px a phone needs
- **cta** at `section#practice "Appointments, records, and follow-ups."`: a section over 1.5 screens long with no link or button in it
- **copy-numbered** at `(the copy)`: 6 step numbers
- **copy-rhythm** at `(the copy)`: every sentence about 9 words long (spread 3.2)

## Design and copy decisions

- Kind: software for independent cosmetologists and salon teams in Colombia.
- Deal: split hero; rose-grey-green palette, softened to paper and sage surfaces; established Newsreader/Onest typography retained instead of adding Red Hat fonts; centered navigation; solid buttons; surface-pair rhythm; wordmark; supplied counter-rolls moment on the documented six-step session.
- No shader, continuous loop, or 3D scene: the workflow and HTML product preview carry the page.
- Voice: direct American English; concrete appointment and care tasks; no invented customer proof, savings, or business outcomes.
- The FAQ stays fully open. The route wrapper scopes English and landing tokens inside the existing Spanish application. The supplied motion stylesheet ships through the Next.js CSS bundle.
- The existing Cosmela name needs no coined-name search.
- No assumed commercial facts, prices, or trial promises. Preview names and appointments are fictional interface content.

## Assets and wiring

- The hero preview supports appointment selection, matching client details, and returning to the day view. It uses local state and does not access real client data.
- Account actions use `/ingresar`; privacy and terms use their existing routes. Those destination pages retain their existing Spanish copy.
- No page form, contact stand-in, external submission endpoint, stock photography, licensed art, or empty client asset slot.
- Existing fonts and icon assets are used. Social metadata uses the existing app icon; a dedicated hero share image remains future work. No canonical URL has been added.

## Visual verification limits

- The gate inspected 1440 and 390 widths, including a narrow-width sweep. Final desktop and phone hero screenshots were inspected, along with full-page tablet captures.
- The standalone layout checker first failed Chrome discovery; after selecting Edge, it threw an internal TypeError. It did not provide a complete standalone layout pass.
- The full five-width consistency run did not complete and was stopped before the gate runs. Final screenshots at 1440, 1024, 820, 768, and 390 are captured separately under `.taste-skill/shots/`.
- No authenticated browser session or live registration was exercised. Existing automated tests cover backend behavior; they do not replace an end-to-end account-creation check.
- Final tablet captures show uneven feature-fragment top edges and a client-record divider extending below its fixed frame at 768 and 820. These remain visual follow-up work after the skill round limit. The 1024 hero also wraps to four lines. The tablet count capture caught its rolling animation at 5; the written and final resting value is 6.
- The retained warnings reflect a required supplied moment, clinical step terminology, the English route wrapper inside a Spanish application, and remaining layout/copy checks. They are disclosed above rather than presented as passing checks.
- `perf.mjs` against the existing development server: 2 FAIL and 2 WARN across desktop and phone. Both failures concern parsed JavaScript (5787.8 KiB, including development framework tooling); both warnings concern font bytes (162.4 KiB). Total transfer passed at about 1450 KiB, CSS at 33.9 KiB, broken requests at 0, and measured layout shift at 0.000. Production performance was not measured; these development measurements do not establish a production performance pass.

Design rules: [DESIGN.md](../DESIGN.md). The authenticated app retains [its existing guide](DESIGN.md).
