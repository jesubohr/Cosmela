# Cosmela — Design system

Philosophy: less is more (https://jakub.kr/writing/less-is-more). Every element must earn its place. No eyebrow labels, no decorative text, no gratuitous icons, no gradient washes, no "AI SaaS card kit". The audience is cosmetologists who may not be tech-savvy: big targets, plain words, one primary action per screen.

## 1. Point of view

A cosmetologist's day is measured in appointment times and in skin. Cosmela spends its boldness in **one place: time**. Appointment times are set large in a refined serif (Newsreader) — on Hoy, in the agenda, in the attention header — like the handwritten time in a paper appointment book. Everything else is quiet: a cool porcelain surface, plum ink, hairline borders, and generous space.

The skin-tone Fitzpatrick swatches (I–VI) are the only "illustration" in the product, used where they carry information (the ficha and assessment).

## 2. Color tokens

Light and dark themes. The user picks Como el dispositivo, Claro, or Oscuro in Mi perfil (stored per device by next-themes, class `dark` on <html>). Dark uses plum-tinted neutrals: background #151118, cards #1F1A23, floating layers #29232E (lighter means higher), text #EDE8F1, and desaturated light accents (plum #C5A3EA) with dark text on solid fills (`on-solid`). Never hardcode colors; use the tokens, including the staff color variables. Print views and emails stay light (`data-light`). Define as CSS variables in `app/globals.css` under Tailwind v4 `@theme` and map shadcn variables to them.

| Token | Hex | Use |
|---|---|---|
| `--porcelain` | `#F6F4F8` | App background (cool, faintly lilac — never warm cream) |
| `--surface` | `#FFFFFF` | Cards, sheets, inputs |
| `--ink` | `#2A2131` | Primary text (deep aubergine, not black) |
| `--ink-soft` | `#6B6273` | Secondary text, placeholders ≥ 4.5:1 on white |
| `--line` | `#E6E0EB` | Hairline borders, dividers |
| `--plum` | `#5B2A86` | Primary actions, active nav, focus ring, links |
| `--plum-hover` | `#4A2170` | Primary hover/pressed |
| `--lilac` | `#EFE8F6` | Selected chips, active nav background, subtle highlights |
| `--sage` | `#3F7D5F` / soft `#E5F1EA` | Success, paid, completed |
| `--amber` | `#9A6510` / soft `#FBF0DC` | Pending payment, warnings, requested |
| `--rose` | `#B0303C` / soft `#FBE7E9` | Allergies, contraindications, destructive |

Fitzpatrick swatches (I→VI): `#F6E1D3`, `#EBC9AE`, `#D8A884`, `#B9835B`, `#8A5A3A`, `#4E3022`.

Staff colors (calendar, avatars; soft bg + strong text): plum `#EDE3F7/#5B2A86`, teal `#DDF0EE/#1F6B66`, coral `#FBE4DC/#A2452A`, olive `#EAF0DA/#56661F`, blue `#E0E9F8/#2D548F`, rose `#F8E1EA/#9B2F5B`, sand `#F3EAD8/#7A5A1F`, slate `#E5E8EC/#46505C`.

Treatment colors use the same 8 hues (left bar on agenda blocks).

Contrast: body text ≥ 4.5:1, large text ≥ 3:1. Never encode meaning by color alone — chips carry text, statuses carry a label or icon.

## 3. Typography

- **UI**: `Onest` (Google Fonts via `next/font/google`, variable). Fallback: `Figtree`. Body 16 px / 1.5. Never below 14 px (captions only), inputs always 16 px (prevents iOS zoom).
- **Display + time numerals**: `Newsreader` (variable, optical size). Use only for: page titles, the Hoy greeting, appointment times, and big report numbers. Never for body text or buttons.
- Numbers: `font-variant-numeric: tabular-nums` for times, prices, and tables.
- Scale (rem, 1.25 ratio): 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 / 2.75. Titles weight 500 (Newsreader), UI labels 500, body 400. Sentence case everywhere. **No all-caps labels.** No accenting single words in headings.
- Line length ≤ 70 characters for text blocks (consent text, help).

## 4. Shape, depth, spacing

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48. Page gutter 16 px phone, 32 px desktop.
- Radius hierarchy (not one radius everywhere): sheets and dialogs 20 px, cards 14 px, inputs and buttons 10 px, chips full pill.
- Depth: surfaces are separated by **hairline borders**, not shadows. Shadows only on floating layers (sheets, popovers, menus): `0 8px 30px rgb(42 33 49 / 0.12)`.
- Lists are lists (rows with dividers), not grids of identical cards. Use a card only for a distinct object that the user acts on (e.g. "Próxima cita").

## 5. Layout

Content is **left-aligned**. Max content width 1120 px on desktop.

Phone (< 768 px):
```
┌───────────────────────────┐
│ Title (Newsreader)    [+] │  header, sticky, 56px
├───────────────────────────┤
│ content, single column    │
│                           │
├───────────────────────────┤
│ Hoy Agenda Clientes Casos Más │  bottom tabs, 64px + safe area
└───────────────────────────┘
```
Tablet (768–1023): same as phone with wider content and two-column forms.

Desktop (≥ 1024 px):
```
┌──────────┬──────────────────────────────────────┐
│ Cosmela  │ Title                    [actions]   │
│          ├──────────────────────────────────────┤
│ Hoy      │                                      │
│ Agenda   │  content (max 1120px)                │
│ Clientes │                                      │
│ Casos    │                                      │
│ Tratam.  │                                      │
│ Reportes │                                      │
│          │                                      │
│ Equipo   │                                      │
│ Config.  │                                      │
│ (avatar) │                                      │
└──────────┴──────────────────────────────────────┘
  240px sidebar, collapsible to icons
```

Hoy on phone:
```
Buenos días, Ana
sábado 15 de noviembre

┌ Próxima cita ─────────────────┐
│ 10:30          (Newsreader 44)│
│ Laura Gómez                   │
│ Peeling químico               │
│ [Alergia: medicamentos]       │
│ [ Iniciar atención ] [WhatsApp]│
└───────────────────────────────┘

Tu día
 08:00 ─ Limpieza facial — María R.
 10:30 ● Peeling — Laura G.
 ── now ───────────────────
 13:00 ▨ Almuerzo
 15:00 ─ Lifting de pestañas — Sofía P.

Seguimientos (2)
Pagos pendientes  $ 120.000
```
(Rows render client and treatment on separate lines or separated by spacing, never with "·" joiners.)

Hoy on desktop: left column (greeting, next appointment, day timeline), right column 360 px (Por confirmar, Seguimientos, Pagos pendientes, Cumpleaños, Primeros pasos).

## 6. Components (shadcn/ui, restyled with the tokens)

- **Button**: primary (plum fill, white text), secondary (white with line border), ghost, destructive (rose). Height 44 px (48 px for the main action in the attention flow), 10 px radius, label = exact action ("Guardar cliente", "Iniciar atención"). No trailing arrows.
- **Responsive overlay**: `Drawer` (bottom sheet, vaul) on phone, `Dialog` (or side `Sheet` for long forms) on desktop. One component `ResponsiveDialog` decides by media query.
- **Chips**: alert chips (rose soft bg + rose text + small icon) for allergies/contraindications; status chips (sage/amber/plum/ink-soft). Choice chips for single/multi selection in forms (lilac when selected, with check icon), min height 40 px.
- **Inputs**: label above, always visible; help text below in ink-soft; error in rose with a precise message ("Escribe un teléfono de 10 dígitos"). Numeric keyboard for phones/money (`inputmode`). Money inputs show `$` prefix and format thousands with dots while typing.
- **List row**: 56–64 px, avatar/initials (staff color), primary line, secondary line, trailing meta or chevron.
- **Empty states**: one sentence that says what to do + one button. No illustrations.
- **Toasts**: Sonner, bottom-center on phone, bottom-right on desktop, past-tense echo of the action ("Cita guardada").
- **Skeletons**: for lists and Hoy while Convex loads; render page headers immediately (never block the whole page on data).
- **Stepper (Atención)**: thin progress bar + "Paso 2 de 6 · Valoración" (use a line break or spacing, not a dot) in the header; sticky footer with Atrás / Continuar.
- **Signature pad**: full-width canvas, 200 px tall (240 px on tablet), light baseline, "Borrar" button, works with finger and mouse, exports PNG.
- **Time grid (Agenda)**: hour rows 64 px (week/day), 15-min snapping, current-time line in plum, working hours on white, non-working on porcelain.
- **Icons**: `lucide-react`, 20 px, stroke 1.75. Only where they speed recognition (nav, actions, alert chips). Never decorative.

## 7. Motion

- Respond to actions only: sheet open/close (vaul), step change in Atención (150 ms crossfade + 8 px slide), toast in/out, checkbox check.
- No entrance animations on page load, no hover lift on cards.
- Respect `prefers-reduced-motion` (disable slides, keep fades ≤ 100 ms).

## 8. Writing (Spanish, es-CO)

- Tú form, warm and direct, sentence case. Active voice.
- Buttons say what happens: "Guardar cliente", "Enviar código", "Confirmar cita". The toast echoes it: "Cliente guardado".
- Errors explain what happened and how to fix it, without apologizing: "Este teléfono ya pertenece a Laura Gómez. Abre su ficha o usa otro número."
- Empty states invite action: "Aún no tienes clientes. Crea el primero para empezar su ficha."
- Dates: "sábado 15 de noviembre", times "10:30 a. m." (es-CO format from `date-fns` `es` locale; use 12-hour with "a. m./p. m." as Colombians read it).
- Money: `$ 85.000`.
- Avoid jargon: "Página de reservas" not "booking link"; "Recordatorios" not "notificaciones automáticas".

## 9. Accessibility floor

Tap targets ≥ 44 px, visible focus ring (2 px plum + 2 px offset), labels on every input, `aria-live` for toasts and stepper errors, keyboard reachable everything on desktop, `lang="es-CO"`, works at 200 % zoom, no horizontal scroll at 360 px width.
