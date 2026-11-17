# Cosmela UI polish rules

These rules apply to every surface: the landing page (plain CSS in `components/landing/landing.css`) and the app (Tailwind 4 and the components in `components/ui/`). They set surfaces, icons, and motion. The values are exact unless a rule says "by eye". `docs/DESIGN.md` keeps the color tokens, type, and writing style.

## Surfaces

**Nested radii are concentric.** When a padded surface holds another rounded surface, the outer radius is the inner radius plus the padding plus the outer border width. A 12px card inside 12px padding takes a 24px parent. Above 24px of padding, or with uneven padding, treat the two layers as separate surfaces and give each its own radius token. A deliberate shape, such as the arched hero ground, can break this rule on its decorative edge only.

**Shadows show elevation. Borders show structure.** A card, frame, or popover that sits above the page uses the shadow ring, not a border:

```css
--shadow-border:
  0 0 0 1px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.06),
  0 2px 4px 0 oklch(0 0 0 / 0.04);
/* dark mode */
--shadow-border: 0 0 0 1px oklch(1 0 0 / 0.08);
```

Always keep `border: 1px solid transparent` under the ring. Forced-colors mode removes shadows and paints that border instead. Keep real borders on dividers, list rows, table cells, form inputs, and selected states.

**Image outlines are pure black or white.** Content images (client photos, before and after shots) get `outline: 1px solid oklch(0 0 0 / 0.1); outline-offset: -1px`, and `oklch(1 0 0 / 0.1)` in dark mode. Never use a tinted neutral or the brand color. Logos and transparent art get no outline.

**Align by eye where geometry looks wrong.** A button with a trailing icon takes 2px less padding on the icon side (`padding: 12px 19px 12px 21px`, or `ps-4 pe-3.5`). A leading icon takes the 2px off the start side.

## Icons

- Use `lucide-react` only. Do not mix icon libraries on one surface.
- The rendered stroke follows the weight of the text beside it: `1.5px` next to 400, `2px` next to 500 to 600, `2.5px` next to 700 or on an emphasized standalone icon.
- Render strokes at a fixed width with `absoluteStrokeWidth` in Tailwind code. The landing page sets `vector-effect: non-scaling-stroke` and a CSS `stroke-width` on its SVGs instead, so markup carries no stroke props.
- Size inline icons from `1em` to `1.25em` of the adjacent text: 16px beside 13 to 14px text.
- Icons use `currentColor`. Hover, selected, and disabled states change color or opacity in CSS, never the asset. Outline is the default; a filled variant marks the active state.

## Motion

**Transitions for state, keyframes for one-time sequences.** Hover, press, toggle, open, and close use CSS transitions (or springs), because they reverse mid-flight. Keyframes only run sequences that play once, such as a page entrance.

**Name the properties.** Write `transition-property: background-color, scale`, or `transition-[background-color,scale]` in Tailwind. Never `transition-all` or `transition: all`.

**Press scales to 0.96.** A pressed button scales to `0.96` over `150ms` `ease-out`. A disabled button never scales (`enabled:active:scale-[0.96]`, or `:not(:disabled):active`). Give the button a way to opt out where the scale would distract.

**Frequent interactions respond at once.** Row hovers, tab switches, and keystrokes get no motion, or at most `100ms` to `150ms` on `opacity` or `background-color`. Save larger motion for rare moments: a first load, a success state, an empty state.

**Motion is never the only signal.** Every animated state also changes a color, an icon, or a label. The selected appointment row, for example, keeps its background and `aria-pressed`.

**Staged entrances.** Split an entrance into meaningful chunks (title, text, actions, media). Stagger them `100ms` apart. Each chunk enters with opacity, `translateY(12px)`, and `blur(4px)` over `300ms` `ease-out`. Put the hidden state only in the `from` keyframe and use `animation-fill-mode: both`, so content stays visible if the animation does not run. Never stagger routine UI.

**Exits are shorter than entrances.** Exit with opacity, `blur(4px)`, and `translateY(-12px)` over `150ms` `ease-out`. Slide fully out only when the destination has meaning, such as a drawer closing. Remove the element at once when motion adds nothing.

**No mount animation for state swaps.** Wrap a state swap in `AnimatePresence initial={false}`, but never wrap a deliberate entrance that way.

**Icon swaps cross-fade.** For rare swaps (copy to copied, play to pause): scale `0.25` to `1`, opacity `0` to `1`, blur `4px` to `0px`, over `300ms` `cubic-bezier(0.2, 0, 0, 1)`, with both icons kept in the DOM. With a spring, `bounce` is always `0`. Tab and navigation icons swap instantly.

**Respect reduced motion.** Movement, scale, and blur run only under `prefers-reduced-motion: no-preference` (Tailwind: `motion-safe:`). Under `reduce`, keep an opacity fade so nothing pops in. `app/globals.css` also shortens every duration to `100ms` under `reduce`.

**Theme changes do not run element transitions.** `next-themes` runs with `disableTransitionOnChange`; any new theme switch suppresses transitions the same way. The landing toggle (`components/landing/theme-toggle.tsx`) instead reveals the new theme with one view transition, a blurred circle that grows from the top-left corner over `450ms` with `--expo-out`, only for fine pointers without reduced motion. It changes the `.dark` class inside the `startViewTransition` callback, because next-themes applies it in an effect, after the snapshot.

**`will-change` only to fix a seen stutter.** Name the property you animate (`scale`, `transform`, `opacity`, `filter`). Never `all`.

**No vendor motion kits.** Write the few rules a page needs. A generic layer adds weight, hidden behavior, and selectors that collide with our class names.

## Touch and hover

- Hover styles live under `@media (hover: hover)`. Tailwind 4's `hover:` already does this; plain CSS must add the query. On touch, `:hover` otherwise sticks after a tap.
- A control that draws its own pressed state sets `-webkit-tap-highlight-color: transparent`.
- Scrollable dialogs, drawers, sheets, and menus set `overscroll-behavior: contain` (`overscroll-contain`), so the page behind does not scroll.

## Layout and color

- Peer cards in a row share their rows. Use `grid-template-rows: subgrid` so icons, titles, text, and example cards line up across columns whatever the text length. Never align them with a fixed `height` or a guessed `min-height` on the text.
- Content inside a panel sits on one shared edge. A row whose fill must bleed past that edge uses a negative inline margin with matching padding, so its text stays on the edge.
- Every surface uses the app tokens in `app/globals.css`, so it follows the light and dark themes. Local names (as on the landing page) point at those tokens; only a value with no app token gets its own light and dark pair. Print views stay light with `data-light`.
- In-page anchor links scroll smoothly only under `prefers-reduced-motion: no-preference`.

## Plain CSS hygiene

- Write resets with `:where()` (for example `.cl-landing :where(h1, p) { margin: 0 }`). The reset then has class-level specificity, and component rules win by source order without `!important`.
- Keep one rule per selector and breakpoint. Do not add override blocks at the end of a file; fix the original rule.
- Delete classes, keyframes, and tokens that nothing uses.

## Known gaps in the app

These components still break the rules above and should change when someone next edits them:

- `transition-all` in `components/ui/badge.tsx`, `switch.tsx`, `tabs.tsx`, `toggle.tsx`, `sidebar.tsx`, and `app/(onboarding)/bienvenida/onboarding-flow.tsx`.
