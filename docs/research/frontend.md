# Frontend research: Cosmela

Date: 2026-11-15. Scope: frontend only (web app for PC and phone, Spanish only, Colombia). Backend (Convex) is out of scope.

**Version source:** npm registry `https://registry.npmjs.org/<pkg>/latest`, read on 2026-11-15. Run `npm view <pkg> version` before you install. Items marked **VERIFY** came from a secondary source or a page I could not fully confirm.

---

## 1. Next.js (App Router)

| Item | Finding | Source |
|---|---|---|
| Latest stable | `next` **16.4.6** | https://registry.npmjs.org/next/latest |
| React | App Router uses React canary builds with the React 19.2 features (View Transitions, `useEffectEvent`, `<Activity>`). Declare `react` and `react-dom` 19.x in `package.json`. npm reports `react` **19.3.1** as latest. | https://nextjs.org/blog/next-16 |
| Node.js / TypeScript | Node.js **20.9+**, TypeScript **5.1+** | https://nextjs.org/docs/app/getting-started/installation |
| Browsers | Chrome/Edge 111+, Firefox 111+, Safari 16.4+ | https://nextjs.org/docs/app/getting-started/installation |
| Bundler | Turbopack is the default for `next dev` and `next build`. Opt out with `next dev --webpack`. | https://nextjs.org/blog/next-16 |
| Proxy | `proxy.ts` replaces `middleware.ts`. Rename the file and export `proxy`. Runs on the Node.js runtime. The `runtime` config option is not allowed. `middleware.ts` is deprecated. | https://nextjs.org/docs/app/api-reference/file-conventions/proxy |
| Caching | Opt-in. Dynamic code runs per request by default. Enable with `cacheComponents: true` in `next.config.ts`, then use `"use cache"`. Implicit caching from older App Router versions is gone. | https://nextjs.org/blog/next-16 |
| Cache APIs | `revalidateTag(tag, profile)` (single-argument form deprecated). `updateTag(tag)` in Server Actions for read-your-writes. `refresh()` for uncached data. | https://nextjs.org/blog/next-16 |
| Request APIs | `params`, `searchParams`, `cookies()`, `headers()` must be awaited. | https://nextjs.org/blog/next-16 |
| Removed | `next lint` (use the ESLint or Biome CLI), `experimental.ppr`, `serverRuntimeConfig` / `publicRuntimeConfig`. `next build` no longer lints. | https://nextjs.org/blog/next-16 |

### Project creation

The `--yes` flag applies the recommended defaults, and those defaults include **Cache Components**. We do not need that yet (YAGNI), so run the prompts and answer **No** to Cache Components:

```bash
npx create-next-app@latest cosmela-web
# Choose: customize settings -> TypeScript yes, Tailwind yes, App Router yes,
# src/ no, Cache Components no, import alias @/* , ESLint (or Biome)
```

Source: https://nextjs.org/docs/app/getting-started/installation

### Spanish (Colombia): `lang`, metadata, viewport

Next.js does not translate anything. Set the language on `<html>` in the root layout. The metadata API generates the charset and viewport meta tags for you.

```tsx
// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Cosmela", template: "%s | Cosmela" },
  description: "Historias clínicas y agenda para cosmetólogas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>{children}</body>
    </html>
  );
}
```

- Default meta tags (`charset`, `viewport`) are added automatically. Source: https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- Theme color and other viewport options use a separate `viewport` export. **VERIFY** the export name and type against the `generateViewport` reference page.

### Fonts (`next/font`)

Self-hosted at build time, so there are no browser requests to Google.

```tsx
import { Geist } from "next/font/google";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });

// <html lang="es-CO" className={sans.variable}>
```

- The `latin` subset covers Spanish accents and `ñ`. **VERIFY** the glyphs in a browser preview.
- Source: https://nextjs.org/docs/app/getting-started/fonts

---

## 2. PWA on Next.js

### Manifest (built in)

Create `app/manifest.ts`. Next.js serves it at `/manifest.webmanifest`.

```ts
// app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cosmela",
    short_name: "Cosmela",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000", // replace with the brand color
    lang: "es-CO",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

- Add `lang` if the manifest type accepts it. **VERIFY**.
- Add a maskable icon for Android adaptive icons. **VERIFY** the current field shape against the manifest reference.
- Source: https://nextjs.org/docs/app/guides/progressive-web-apps

### Installability and platforms

- HTTPS is required (the Next.js guide states this).
- Android and desktop Chromium: the browser shows an install prompt when the criteria are met. `beforeinstallprompt` works only on Chromium, not on iOS. Source: https://nextjs.org/docs/app/guides/progressive-web-apps
- iOS Safari: the user taps Share, then "Add to Home Screen". There is no automatic prompt. Show a short instruction in Spanish on iOS. Source: same page.
- **VERIFY** the installability criteria in Chrome DevTools > Application > Manifest. Browser install rules have changed over time, so do not assume a service worker is optional or required without testing.

### Push notifications on iOS

- Web Push works for home-screen web apps on iOS and iPadOS **16.4+**. Source: https://nextjs.org/docs/app/guides/progressive-web-apps
- Declarative Web Push is available on iOS and iPadOS **18.4+** for home-screen web apps. Source: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/ (dated 2025-03-31)
- Push needs a server (VAPID keys, subscription storage, a sender). This is medium effort. Not needed for an MVP.

### Service worker

| Option | Package | Notes |
|---|---|---|
| Serwist | `@serwist/next` **9.5.13** plus dev dependency `serwist` | Precache and runtime caching. Peer `next >=14`. Setup: `withSerwistInit` in `next.config`, service worker source in `app/sw.ts`. Install: `npm i @serwist/next && npm i -D serwist`. Source: https://serwist.pages.dev/docs/next/getting-started |
| Manual | none | Write `public/sw.js` with `push` and `notificationclick` handlers. Good for push only. Next.js guide shows the code. |

- The Serwist guide is written for webpack. It links a separate Turbopack guide. **VERIFY** that `next build` with Turbopack works with Serwist before you adopt it. If it does not, use `next build --webpack`.
- Next.js has an experimental `useOffline` hook for connectivity-aware UI. It does not do service-worker caching. Source: https://nextjs.org/docs/app/guides/progressive-web-apps

### Recommendation (PWA)

1. **Phase 1:** `app/manifest.ts`, HTTPS, responsive layout, `lang="es-CO"`. This gives an installable app with no service worker.
2. **Phase 2 (only if needed):** offline caching for the agenda or forms, with Serwist.
3. **Phase 3 (later):** push notifications for appointment reminders, after the subscription and sender design is settled.

---

## 3. Tailwind CSS v4 and shadcn/ui

### Tailwind CSS

- Latest stable: `tailwindcss` **4.3.5** (npm). `create-next-app` installs it when you choose Tailwind. Manual install:

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

```js
// postcss.config.mjs
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Example tokens only. Replace with brand values. */
  --color-ink: oklch(0.25 0.02 260);
  --font-sans: var(--font-sans);
}
```

- No `tailwind.config` file is needed. Customize with `@theme` in CSS.
- Sources: https://tailwindcss.com/docs/installation/framework-guides/nextjs and https://registry.npmjs.org/tailwindcss/latest
- **VERIFY** that `@tailwindcss/postcss` matches the `tailwindcss` 4.x version. Install both with `@latest` and check the lockfile.

### shadcn/ui

- CLI: `shadcn` **4.23.0** (npm registry). The docs show `pnpm dlx shadcn@latest init`. `npx shadcn@latest init` is the same CLI. **VERIFY** the npm command form on the docs page.
- Setup: `npx shadcn@latest init` writes `components.json` and the theme variables.
- Source: https://ui.shadcn.com/docs/installation/next

**Tailwind v4 notes from shadcn:**
- Theme variables go under `@theme inline`. Use `oklch` or plain values, not `hsl()` wrappers inside `@theme inline`.
- `tailwindcss-animate` is replaced by `tw-animate-css`. Install it and add `@import "tw-animate-css";`.
- React 19 removed `forwardRef` in shadcn components. Components use `React.ComponentProps<...>` and a `data-slot` attribute.
- Source: https://ui.shadcn.com/docs/tailwind-v4

### Components for this app

| Component | Install | Use in Cosmela | Notes |
|---|---|---|---|
| Sidebar | `npx shadcn@latest add sidebar` | PC navigation | On mobile it renders inside a Sheet. For phones, a bottom tab bar is simpler. Source: https://ui.shadcn.com/docs/components/radix/sidebar |
| Sheet | `add sheet` | Side panels (client detail, edit) | Radix Dialog based |
| Drawer | `add drawer` | Bottom sheets on phone | Built on **vaul** `1.1.2` (npm registry; peer React `^16.8 \|\| ... \|\| ^19`) |
| Dialog | `add dialog` | Confirmations | Radix Dialog |
| Calendar | `add calendar` | Date picker (birthdays, consent dates) | Uses **react-day-picker**. Latest on npm is `10.0.2` (peer React `>=16.8`). **VERIFY** which major the shadcn block pins. |
| Field | `add field` | Form layout and errors | Field, FieldGroup, FieldLabel, FieldDescription, FieldError. `data-invalid` on Field, `aria-invalid` on the input. Source: https://ui.shadcn.com/docs/components/radix/field |
| Sonner | `add sonner` | Toasts | **sonner** `2.0.8` (npm registry; peer React `^18 \|\| ^19`) |
| Command | `add command` | Client search (Cmd+K style) | Built on cmdk |
| Tabs | `add tabs` | Record sections, agenda views | |

- shadcn's `form` component is still documented. The Field pattern is the newer approach. The docs do not say `form` is deprecated.

### Forms

- **react-hook-form** `7.92.0` (npm registry; peer React `^16.8` through `^19`)
- **zod** `4.6.7` (npm registry)
- Connect them with the resolver from `@hookform/resolvers` (**VERIFY** the version and the zod v4 compatibility note).
- Field-level errors render with `FieldError` directly after the control.

---

## 4. Calendar and scheduling UI

Requirements: month, week, and day views. Drag on the grid to create time blocks. Works on phone.

| Option | Package and version | License | React peer | Drag to create | Notes |
|---|---|---|---|---|---|
| FullCalendar | `@fullcalendar/react` **7.1.5**, plus view and interaction plugins | MIT for the core React package. Resource and timeline views are premium (`@fullcalendar/react-scheduler`, needs `schedulerLicenseKey`). | `^17 \|\| ^18 \|\| ^19` | Yes, via `select` with the interaction plugin. **VERIFY** interaction plugin license. | Good touch support. Styling needs theme work to look custom. Source: https://fullcalendar.io/docs/react |
| Schedule-X | `@schedule-x/react` **2.0.8** | **VERIFY** (npm did not show license in my read) | `^18 \|\| ^19` | Listed as a plugin marked with a star. **VERIFY** whether the star means paid. | Needs `temporal-polyfill`. Next.js uses `useNextCalendarApp`. Source: https://schedule-x.dev/docs/frameworks/react |
| react-big-calendar | `react-big-calendar` **4.1.0** | MIT | `^16.7 \|\| ^17 \|\| ^18 \|\| ^19` | Via the drag-and-drop add-on. | Older look. Mobile behavior is weak (**VERIFY** in a test). |
| Custom CSS grid | `date-fns` only | Ours | Any | Pointer events | Full styling control. More code to write. |

### Recommendation: custom CSS grid

- The app needs three views for one professional or a small team. A custom grid is small to build and fits the "less is more" design direction.
- Time grid: one column per day, rows of 15 minutes. Position events and drag blocks with CSS `grid-row` and absolute positioning. Snap to 15 minutes.
- Drag to create: `pointerdown` on a column, `pointermove` updates the end time, `pointerup` opens a dialog with the block. Set `touch-action: none` on the grid while dragging (standard CSS property) so touch drags do not scroll the page.
- Phone: default to the day view with a horizontal day strip. Month view is read-only on phone.
- Overlapping events need a column-packing function. This is the main cost (about 50 lines of logic).
- **Fallback:** if overlap handling takes too long, switch to FullCalendar React (MIT core). Confirm the interaction plugin license first.

---

## 5. Signature capture

| Package | Version | Notes |
|---|---|---|
| `signature_pad` | **5.1.4** (npm registry) | Vanilla library. "Library for drawing smooth signatures." Exports PNG with `toDataURL("image/png")`. |
| `react-signature-canvas` | npm `latest` tag is **`1.1.0-alpha.2`** (2025-03-29). Last stable is **`1.0.7`** (2025-01-03). | Wrapper. Peer React `0.14 - 19`. Depends on `signature_pad ^2.3.2` (old major). |

- Recommendation: use `signature_pad` 5.x directly with a small React component. This avoids an alpha tag and the old `signature_pad` dependency. Source for versions: https://registry.npmjs.org/react-signature-canvas
- Touch: the canvas needs `touch-action: none`, or the page scrolls while the user signs. (`signature_pad` README; **VERIFY**.)

```tsx
"use client";
import SignaturePad from "signature_pad";
import { useEffect, useRef } from "react";

export function SignatureField({ onChange }: { onChange: (png: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const pad = new SignaturePad(canvas, { minWidth: 0.8, maxWidth: 2.2 });
    const emit = () => onChange(pad.isEmpty() ? null : pad.toDataURL("image/png"));
    pad.addEventListener("endStroke", emit);
    return () => pad.off();
  }, [onChange]);

  return <canvas ref={canvasRef} className="h-40 w-full touch-none rounded-md border" />;
}
```

- **VERIFY** the v5 event API (`addEventListener`, `off`) and handle canvas resize for high-DPI screens. Check the `signature_pad` README for the current pattern.
- Storage and legal evidence (timestamp, who signed, version of the consent text) belong to the `legal-compliance` skill, not to this file.

---

## 6. Dates, time zone, currency

### Date handling

| Option | Status |
|---|---|
| `date-fns` **4.4.0** (npm; version read from tarball, **VERIFY**) | Recommended. Locale `es` from `date-fns/locale`. |
| `@date-fns/tz` **1.5.0** (npm registry) | Time zone support for date-fns. No peer dependencies. |
| Temporal API | **Not ready for us.** Caniuse snapshot: supported by default in Chrome and Edge 144+, Firefox 139+. Safari stable and iOS Safari are not listed as supported. Global usage about 72%. Source: https://caniuse.com/temporal (**VERIFY** the snapshot date). Use `temporal-polyfill` only where a library needs it (FullCalendar and Schedule-X examples do). |

```ts
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";

export const BOGOTA = "America/Bogota";

export function formatBogota(epochMs: number, pattern = "EEEE d 'de' MMMM, HH:mm") {
  return format(new TZDate(epochMs, BOGOTA), pattern, { locale: es });
}
```

- **VERIFY** the `TZDate` constructor signature against the `@date-fns/tz` README.
- Colombia uses `America/Bogota`, UTC-05:00, all year. There is no daylight saving time. (**VERIFY** against the IANA tz database.)
- Storage rule: store instants as UTC epoch milliseconds. Store calendar-only dates (birthday, consent date) as `"YYYY-MM-DD"` strings.

### Currency (COP)

```ts
export const formatCOP = (amount: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
```

- Store money as integer pesos. Never use floats.
- The exact output (`$150.000` and the space or non-breaking space after the sign) depends on the browser. **VERIFY** in Chrome, Safari, and Firefox. The MDN page for `Intl.NumberFormat` was not available when I checked.

---

## 7. Dynamic form builder

Cosmetologists define custom forms per treatment. Field types: text, long text, number, single choice, multiple choice, yes/no, scale, date, photo, section header.

### Option A: JSON Schema renderer

- **@rjsf/core** `6.11.1` (npm registry; peer React `>=18`). Renders forms from JSON Schema.
- Pros: mature, existing ecosystem.
- Cons: UI needs a theme package (**VERIFY** a shadcn-compatible theme). Photo, scale, and section headers need custom widgets. JSON Schema is verbose for non-developers to read and for us to maintain. Spanish labels need translation wiring.

### Option B: small custom renderer (recommended)

Ten field types map to ten small components and one `switch`.

```ts
export type FieldType =
  | "text" | "longText" | "number" | "singleChoice" | "multipleChoice"
  | "yesNo" | "scale" | "date" | "photo" | "section";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];          // singleChoice, multipleChoice
  min?: number; max?: number;  // number, scale
}

export interface FormTemplate {
  id: string;
  version: number;             // stored with every response
  fields: FormField[];
}
```

- Validation: build a zod schema from `fields` at runtime. About 30 lines.
- Responses: store `{ templateId, templateVersion, answers: Record<fieldId, value> }`. Storing the version keeps old responses readable after the template changes.
- Photo fields: upload to Convex file storage and store the storage id.
- Section headers are not inputs. They have no answer key.

### Recommendation

Option B. The field set is closed and small. A custom renderer gives us the Spanish UI, the look, and the storage format without a JSON Schema layer. Revisit only if we need arbitrary third-party schemas.

---

## 8. Alternatives: Expo or Capacitor

**Expo universal app.** The current SDK is **58.0.0**, with React Native **0.88**, React **19.3.0**, and `react-native-web` **0.21.0** (Source: https://docs.expo.dev/versions/latest/). One codebase gives store apps, native push, and a native camera and signature experience. The costs are real: App Store and Google Play review and fees, two sets of platform behavior to test, and a weaker desktop web. `react-native-web` does not give a good desktop experience for dense tables and keyboard-heavy work. A responsive web app ships a change the same day, has no store fees, and gives a better PC layout. For an MVP with a PC-first workflow, a web app is the better first step.

**Capacitor wrapping a Next.js static export.** Capacitor is at **v8** (Source: https://capacitorjs.com/docs/getting-started). Install with `npm i @capacitor/core` and `npm i -D @capacitor/cli`. The wrapper loads the built web app inside a native shell. This needs a static export (`output: "export"`), which rules out Server Actions and `proxy.ts` on the server. A Convex client app works with a static export because the data loads in the browser. This is the middle option when store presence or native push becomes necessary. **VERIFY** the Next.js export folder name in the Capacitor config (`webDir`).

---

## 9. Accessibility basics

| Topic | Rule | Source |
|---|---|---|
| Tap targets | WCAG 2.2 AA minimum is **24 x 24 CSS px** (SC 2.5.8), with exceptions. For this audience, use **44 x 44 px** minimum for buttons, chips, and calendar slots. The 44 px size matches the enhanced target in WCAG 2.5.5. | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| Body text | 16 px minimum for body text. Labels and helper text are never smaller than 14 px. (Team rule, not a standard.) | Team rule |
| Contrast | 4.5:1 for normal text, 3:1 for large text and UI components (WCAG 1.4.3 and 1.4.11). **VERIFY** the palette with a checker. | WCAG 2.2 |
| Labels | Visible labels on every field. Do not use placeholder text as the label. Errors in Spanish, next to the field. | Team rule |
| Numeric input | Use `inputMode="numeric"` for money and phone fields. | HTML standard |
| Reduced motion | Replace motion with opacity changes when the user prefers less motion. | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion |

```css
@media (prefers-reduced-motion: reduce) {
  .animated {
    animation: none;
    transition-duration: 0.01ms;
  }
}
```

---

## Recommended setup for this project

- **Framework:** `next@16.4.6` with App Router, TypeScript, Tailwind CSS 4 (`tailwindcss@4.3.5`). Create with `npx create-next-app@latest cosmela-web`. Choose Cache Components: **No**.
- **Language:** `<html lang="es-CO">`, Spanish strings in one file from day one (no i18n library; YAGNI).
- **Metadata and fonts:** Next Metadata API for title and description. `next/font/google` (Geist or another variable font with Spanish glyphs).
- **PWA phase 1:** `app/manifest.ts` and HTTPS only. Add Serwist only if offline use is required. Defer push.
- **UI kit:** shadcn/ui via `npx shadcn@latest init`. Add `sidebar` (PC), `drawer` (phone bottom sheets), `dialog`, `sheet`, `calendar`, `field`, `sonner`, `command`, `tabs`.
- **Forms:** `react-hook-form` `7.92.0` with `zod` `4.6.7`, validation through the shadcn Field components.
- **Calendar:** custom CSS grid with `date-fns` `4.4.0` and `@date-fns/tz` `1.5.0`. Day view default on phone. Fallback: FullCalendar React once its interaction plugin license is confirmed.
- **Signature:** `signature_pad` `5.1.4` in a small wrapper component. Do not use `react-signature-canvas` (its `latest` tag is an alpha).
- **Dates and money:** store UTC epoch ms, render in `America/Bogota`. Store COP as integer pesos. Format with `Intl.NumberFormat("es-CO", ...)`. Skip Temporal until Safari supports it.
- **Dynamic forms:** custom renderer with 10 field types. Store template version with each response. No JSON Schema library.
- **Platform:** responsive web app first. Expo or Capacitor later, only when store presence or native push is required.
- **Accessibility:** 44 px tap targets, 16 px body text, visible labels, Spanish errors, reduced-motion fallback.
- **Before first install:** run `npm view <pkg> version` for every package in this list. Confirm the items marked VERIFY.
