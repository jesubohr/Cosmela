# Cosmela — Product spec

Cosmela is a web app (installable PWA) for cosmetologists in Colombia: independent professionals and salons with several staff. It replaces paper "fichas clínicas", notebooks, and WhatsApp-only scheduling with one calm tool that works on a salon PC and on a phone.

All user-facing text is **Spanish (Colombia)**, addressing the user as **"tú"**, gender-neutral where possible ("Te damos la bienvenida", not "Bienvenida"). Clients are "clientes". Code, comments, and docs are English.

## 1. Users

| Persona | Context | Needs |
|---|---|---|
| Independent cosmetologist | Works alone, at home studio or visiting clients. Mostly on phone. Not tech-savvy. | Know today's schedule, client health alerts, collect consent, track who still owes money, remind follow-ups. |
| Salon owner (admin) | 2–10 cosmetologists. PC at reception + phone. | Everything above, plus team calendar, shared client records, treatment catalog and prices, simple monthly numbers. |
| Salon cosmetologist (staff) | Attends clients in a cabin, uses a phone or tablet. | Their day, the client's full history, the attention flow. |
| Client (no account) | Books online or by WhatsApp; signs consent on the cosmetologist's device. | Book a slot, receive confirmation and reminder emails. |

Roles: `admin` (owner and any manager) and `staff`. Both can work with all clients, cases, and appointments of the business (records are shared inside a business). Only `admin` can edit the business, the team, the treatment catalog, booking settings, and see reports.

## 2. Core concepts (glossary)

| Spanish (UI) | Code | Meaning |
|---|---|---|
| Negocio | `org` | The business: a solo professional or a salon. All data belongs to one org. |
| Equipo / Profesional | `member` | A user inside an org, with a role, color, schedule, and signature. |
| Cliente | `client` | A person who receives treatments. Holds the **permanent ficha**. |
| Tratamiento | `treatment` | A catalog item: name, duration, price, consent text, contraindications, aftercare, and a custom procedure form. |
| Cita | `appointment` | A scheduled slot: client + treatment + professional + time. Holds price and payments. |
| Bloqueo | `timeBlock` | Reserved time (personal or professional) with no client. |
| Caso | `case` | One treatment process for one client and one reason (e.g. "Manchas en mejillas — Peeling, 4 sesiones"). Groups sessions. Created automatically. |
| Sesión / Atención | `session` | The clinical record of one appointment: pre-treatment checks, consent, procedure, aftercare. |
| Seguimiento | `followUp` | A reminder to contact or re-book a client on a date. |
| Pago / Abono | `payment` | Money received for an appointment (cash, Nequi, Daviplata, Bre-B, transfer, card). An "abono" is a payment made before the session. |

## 3. Mapping the paper ficha (the attached "Ficha clínica — Peeling químico")

The paper ficha has 12 sections. Cosmela splits them by **how often they change**.

### 3.1 Permanent — stored on the client (`client`), confirmed at each visit

| Paper section | Fields | Notes |
|---|---|---|
| 1. Datos generales | Nombre(s), apellidos, tipo y número de documento (optional), fecha de nacimiento (age is derived), sexo (Femenino / Masculino / Otro / Prefiere no decir), teléfono (WhatsApp), correo (optional), ocupación (optional), dirección (optional), contacto de emergencia (optional: nombre + teléfono) | "Fecha de valoración" and "Cosmetóloga responsable" belong to the **session**, not the client. |
| 3. Antecedentes — enfermedades | Diabetes, Hipertensión, Enfermedades autoinmunes, Problemas tiroideos, Herpes simple, Cáncer, Otras (text), Ninguna | Chronic, rarely change. |
| 3. Antecedentes — alergias | Cosméticos, Medicamentos, Alimentos, Otras, Ninguna + detail text ("¿A qué?") | Shown as red alert chips everywhere the client appears. |
| 4. Historial dermatológico — chronic | Dermatitis, Psoriasis, Rosácea, Piel sensible, Cicatrices queloides, Otras, Ninguna + observaciones | Acute items (heridas abiertas, infecciones activas, quemaduras) move to **contraindications** (per visit). |
| 5. Hábitos de cuidado facial | Limpieza facial diaria (Sí/No), Protector solar (Diario / Ocasional / Nunca), Exfoliantes (Frecuente / Ocasional / Nunca), Tratamientos estéticos previos (text) | Semi-permanent; editable any time. |
| 6. Valoración — base | Tipo de piel (Normal / Seca / Mixta / Grasa / Sensible), Fototipo Fitzpatrick (I–VI, shown as skin-tone swatches) | Fototipo is permanent; skin type can be updated at any assessment (the session stores the value seen that day). |
| — | Autorización de tratamiento de datos (Habeas Data) | Signed once by the client (Ley 1581 de 2012, sensitive data). Stored with signature, date, and policy version. |
| — | Notas generales | Preferences ("prefiere música suave", "sensible al frío"). |

### 3.2 Per visit — asked before each treatment (`session.intake`, `session.assessment`)

| Paper section | Fields | Notes |
|---|---|---|
| 3. Medicamentos actuales | Free text, **prefilled from the last session** | Changes often (isotretinoína!). |
| 3. Embarazo o lactancia | Embarazo Sí/No, Lactancia Sí/No | Asked every visit for clients with sex ≠ Masculino. |
| 2. Motivo de consulta | Acné, Secuelas de acné, Hiperpigmentación, Melasma, Fotoenvejecimiento, Arrugas finas, Poros dilatados, Piel opaca, Otro | Stored on the **case** (the reason a process starts); shown and editable at each session. |
| 6. Alteraciones observadas | Acné, Comedones, Melasma, Manchas solares, Cicatrices, Arrugas finas, Flacidez, Poros dilatados, Hiperqueratosis, Otra + notas | What the professional sees today. Plus "Tipo de piel hoy". |
| — | "¿Hubo cambios en tu salud desde la última visita?" | One tap "Sin cambios" confirms the permanent ficha; "Sí, actualizar" opens it. |
| 11. Evolución (from session 2 of a case) | "¿Cómo evolucionó desde la última sesión?" text | Evolution lives at the start of the next session. |
| — | Fotos "antes" | Optional, from camera. |

### 3.3 Before treatment — mandatory gates

- **8. Contraindicaciones** (`session.contraindications`): a checklist of the general list (Embarazo, Lactancia, Herpes activo, Infección cutánea, Quemaduras recientes, Uso reciente de isotretinoína, Heridas abiertas, Alergia al producto a usar, Exposición solar intensa reciente) **plus** the treatment's own list. Items are **pre-marked** from intake (embarazo/lactancia) and **flagged** from the ficha (herpes simple history → "revisa herpes activo"; allergies → shown). If any item is marked, the app shows a clear warning and two choices: "Posponer tratamiento" (closes the session as postponed) or "Continuar bajo mi criterio" (requires a written justification). "Ninguna aplica" is one tap.
- **12. Consentimiento informado** (`session.consent`): the treatment's consent text, rendered with the client's name, document, treatment name, and date. Includes a photo-use choice: "Solo para mi historia" / "Historia y redes sociales del negocio" / "No autorizo fotos". The client signs on screen. The professional's saved signature is attached automatically (or drawn if missing). The consent is stored as an **immutable snapshot** (text, signatures, timestamp, device info) with a SHA-256 hash of the rendered text plus the signature keys and timestamp, shown on the printed consent as "Código de verificación". The first time, the Habeas Data authorization is shown and signed in the same step. **Clients under 18**: the consent shows "Datos del acudiente" (name, document, relationship) and the guardian signs instead of the client. Without consent, the procedure step stays locked.

### 3.4 Not used from the paper

- **7. Peeling seleccionado** — replaced by each treatment's **custom procedure form** (section 5 below).

### 3.5 After treatment (`session`)

- **9. Procedimiento realizado** — the treatment's custom form (answers) + free notes + fotos "después".
- **10. Indicaciones posteriores** — checklist prefilled from the treatment's aftercare list, editable for this client, + notes. Can be sent to the client by WhatsApp (prefilled message) and email.
- **11. Evolución y seguimiento** — "¿Recomiendas seguimiento?": No / Sí → in N days (prefilled from treatment) with note → either **book the next appointment now** or **create a follow-up reminder**.

## 4. The main flow: from first contact to follow-up

```
Contact ──► Cita ──► Día de la cita ──► Atención (6 steps) ──► Cierre ──► Seguimiento
```

1. **First contact.** The client writes by WhatsApp or Instagram, or books on the **public booking page**.
   - From WhatsApp: the professional taps **"+" → Nueva cita**. Picks or creates the client (only name + phone required), the treatment, the professional (salon), and a free slot. Optional **abono**. On save, the app offers "Enviar confirmación por WhatsApp" (opens `wa.me` with a prefilled Spanish message) and sends a confirmation email if the client has an email.
   - From the booking page: the appointment arrives as **"Por confirmar"** (status `requested`), the team gets an email, and it appears on Hoy. One tap **Confirmar** (client gets an email) or **Rechazar** (with optional reason).
2. **Day before.** Automatic reminder email to the client (if email exists and reminders are on).
3. **Day of the appointment.** Hoy shows the next appointment with the client's alert chips (allergies, conditions, pregnancy). **"Iniciar atención"** opens the attention flow. A client without a booking: **"+" → Atención sin cita** creates an appointment starting now.
4. **Atención** — a full-screen stepper, autosaved after each step, resumable:
   1. **Ficha** — first visit: complete the permanent ficha (3.1). Returning: summary + "¿Hubo cambios…?" → Sin cambios / Actualizar. Medications and pregnancy/lactation every time.
   2. **Valoración** — case selection (continue an open case for the same treatment, suggested by default, or start a new one with motivo de consulta), alteraciones observadas, skin type today, evolution (session ≥ 2), fotos antes.
   3. **Contraindicaciones** — gate (3.3).
   4. **Consentimiento** — gate (3.3), client signs.
   5. **Procedimiento** — custom treatment form, notes, fotos después.
   6. **Cierre** — aftercare, price (prefilled, editable), payment (method + amount, or "Queda pendiente"), follow-up recommendation, then **"Finalizar atención"**.
5. **After closing.** The session becomes read-only (later corrections are added as dated "notas adicionales" with author). The appointment becomes `completed`. The app offers to send the aftercare by WhatsApp/email.
6. **Follow-up.** Follow-ups due today or overdue appear on Hoy. The professional opens WhatsApp with a prefilled check-in message, then marks **Hecho** with an optional outcome note, or **Agendar cita**. A follow-up appointment continues the same case.

Postponed session (contraindication): appointment status `completed` is NOT used; it becomes `cancelled` with reason "Pospuesta por contraindicación" and the session is kept as `postponed` for the record.

## 5. Custom treatment forms

Each treatment has an ordered list of fields (the "procedure form", successor of paper section 7). Field types:

| Type | UI | Options |
|---|---|---|
| `section` | Heading that groups fields | — |
| `text` | Short text | placeholder |
| `longtext` | Multi-line text | — |
| `number` | Number with optional unit (%, pH, min, capas, J/cm², mm) | unit, min, max |
| `single` | Choice chips, pick one | options |
| `multi` | Choice chips, pick many | options |
| `yesno` | Sí / No toggle | — |
| `scale` | 1–5 or 1–10 tappable scale | min, max, labels |
| `date` | Date picker | — |

Every field has a label, optional help text, and required flag. The editor is a simple vertical list: add field (bottom sheet with the types, each with an icon and a one-line Spanish description), edit label/options inline, reorder with up/down buttons (and drag on desktop), duplicate, delete, and a live **Vista previa** toggle. When a session is closed, the form definition is **snapshotted** with the answers, so editing a treatment never breaks old records.

Treatments also edit: name, category, description, duration, price, calendar color, "Disponible para reserva en línea", consent text (with placeholders `{cliente}`, `{documento}`, `{tratamiento}`, `{negocio}`, `{fecha}`), specific contraindications, aftercare list, suggested follow-up days, suggested number of sessions.

**Templates.** Cosmela ships a library of ready treatments (see `docs/TEMPLATES.md`). During onboarding the user picks the ones they offer; they are **copied** into the org's catalog and are fully editable or deletable. Later, "Agregar desde plantillas" adds more. "Crear desde cero" starts with an empty form.

## 6. Screens

Navigation — phone: bottom tab bar **Hoy · Agenda · Clientes · Casos · Más**, plus a primary **"+"** button in the header of Hoy/Agenda/Clientes (sheet: Nueva cita, Atención sin cita, Nuevo cliente, Bloquear horario). Desktop (≥ 1024 px): left sidebar with the same items plus Tratamientos, Reportes (admin), Equipo (admin), Configuración, and the user at the bottom.

### 6.1 Ingresar (`/ingresar`)
Email field → "Enviar código" → 6-digit code field (auto-advance, paste support, numeric keyboard) → in. "Reenviar código" after 30 s. No passwords. An invitation link pre-fills the email.

### 6.2 Onboarding (`/bienvenida`) — 4 short steps, progress dots, back allowed
1. **¿Cómo trabajas?** Two large choices: "Trabajo independiente" / "Tengo un salón con equipo". Then business name ("¿Cómo se llama tu negocio?" — for independents, hint "Puede ser tu nombre"), city, WhatsApp.
2. **Tu perfil** — your name, title (Cosmetóloga, Esteticista, Cosmiatra, Otro), calendar color.
3. **Tus tratamientos** — template cards grouped by category; tap to select (popular ones preselected). Selected cards show editable price (COP) and duration inline. "Puedes cambiar esto después."
4. **Tu horario** — weekdays with toggles and time ranges (default Lun–Vie 8:00–18:00, Sáb 8:00–13:00), "Agregar pausa" for lunch.
→ Lands on Hoy with the **Primeros pasos** card.

### 6.3 Hoy (`/hoy`) — "your day at a glance"
Order (phone, single column; desktop, two columns: day on the left, lists on the right):
- Greeting with the date in words ("Buenos días, Ana · sábado 15 de noviembre" — render as two lines, no middle dot).
- **Próxima cita** card: time, client, treatment, professional (salon), alert chips, buttons **Iniciar atención** and WhatsApp. If an attention is in progress: **Continuar atención**.
- **Tu día**: vertical timeline of today's appointments and blocks with a "now" line. Admin in a salon: toggle "Mi día / Todo el equipo".
- **Por confirmar**: online booking requests with Confirmar / Rechazar.
- **Seguimientos**: due today and overdue, with WhatsApp, Hecho, Agendar.
- **Pagos pendientes**: total owed + list (client, date, balance) → Registrar pago.
- **Cumpleaños**: clients with a birthday today, with a WhatsApp greeting button (only when there are any).
- **Primeros pasos** (until dismissed or done): Crea tu primer cliente · Agenda tu primera cita · Revisa tu consentimiento informado · Guarda tu firma · Comparte tu página de reservas · (salon) Invita a tu equipo. Each item auto-checks.
Empty day: a calm illustration-free message "No tienes citas hoy" + "Agendar cita".

### 6.4 Agenda (`/agenda`)
- Views: **Día · Semana · Mes** (segmented control). Phone default Día, desktop default Semana. Date navigation: today button, prev/next, tap the title to open a month picker.
- Día (desktop, salon, "Todo el equipo"): one column per professional. Phone: one professional at a time (chips).
- Appointments colored by treatment color (left bar) with the client name and treatment; status styles: requested (dashed outline), scheduled (solid), in progress (pulsing dot), completed (muted), cancelled (hidden by default, toggle), no-show (strikethrough).
- Blocks: hatched gray with title ("Almuerzo", "Capacitación").
- Tap an empty slot (or drag on desktop) → sheet: "Nueva cita" / "Bloquear horario", prefilled with the time.
- Tap an appointment → detail sheet: client (alerts), treatment, time, professional, status, price, payments + balance, notes; actions: Iniciar atención, Reprogramar, Registrar abono, WhatsApp, Marcar no asistió, Cancelar.
- Working hours shaded; outside hours lighter but still bookable (with a soft warning).
- Overlap: warn on conflicts with appointments or blocks of the same professional; allow override.
- Bloqueo form: professional (admin can block others), date, all day or time range, type (Personal / Profesional), title optional.

### 6.5 Clientes (`/clientes`, `/clientes/nuevo`, `/clientes/[id]`)
- List: search (name, phone, document) with instant results, A–Z list with avatar initials, phone, last visit, and alert dot. Filters: "Con saldo pendiente", "Cumpleaños este mes". Pagination.
- Quick create: name + phone required; "Completar ficha ahora" optional (the ficha is otherwise completed at the first attention).
- Detail: header (name, age, phone with WhatsApp and call buttons, alert chips). Tabs: **Resumen** (next appointment, open cases, balance, notes), **Ficha** (permanent data, edit), **Historial** (sessions timeline with photos), **Citas**, **Pagos**, **Documentos** (signed consents and data authorization, each viewable/printable). Actions: Nueva cita, Iniciar atención, Imprimir ficha, Archivar.
- Duplicate detection by phone on create.

### 6.6 Casos (`/casos`, `/casos/[id]`)
- List: filters Abiertos / Cerrados / Todos and by professional; each row: client, treatment, motivo, sessions done / planned, last session date, next appointment or follow-up.
- Detail: header (client + treatment + motivo + status), **progress** (sessions done of planned), **Evolución**: a timeline of sessions (date, professional, key procedure values, notes, photos), **Comparar fotos** (pick two photos, side-by-side on desktop, slider on phone), follow-ups list, actions: Agendar siguiente sesión, Cerrar caso (with summary), Reabrir.
- Session detail (`/casos/[id]/sesiones/[sessionId]`): read-only view of all steps, consent document, notas adicionales (add), print.

### 6.7 Atención (`/atencion/[appointmentId]`)
Full-screen stepper described in section 4. Header: client name + alert chips, step name, "Paso 2 de 6", close (saves draft). Footer: Atrás / Continuar (primary, large). Steps that are gates show why Continuar is disabled.

### 6.8 Tratamientos (`/tratamientos`, `/tratamientos/[id]`)
- List grouped by category: name, duration, price, color dot, online-booking icon, active toggle. Admin: "Nuevo tratamiento" (from template or from scratch).
- Editor tabs: **General**, **Formulario** (form builder), **Consentimiento**, **Cuidados** (contraindications + aftercare + follow-up days + sessions). Staff can view, not edit.

### 6.9 Reportes (`/reportes`, admin)
Month selector. Four numbers: Ingresos recibidos, Citas atendidas, Clientes nuevos, Saldo por cobrar. Then: ingresos by payment method (bar), top treatments (count + revenue), per professional (salon). Simple, no export in v1.

### 6.10 Configuración (`/configuracion/...`)
- **Mi perfil**: name, title, color, email (read-only), firma profesional (draw / clear), my schedule.
- **Negocio** (admin): name, type, city, address, WhatsApp, logo, legal name, NIT/cédula, política de tratamiento de datos (default text generated from the business data, editable).
- **Reservas en línea** (admin): on/off, public link (copy / share by WhatsApp / open), anticipación mínima (hours), máximo días a futuro, intervalo de horarios (15/30/60), mensaje de bienvenida, which professionals accept online bookings.
- **Recordatorios** (admin): email reminder on/off (day before).
- **Equipo** (admin, salon): members (name, role, color, active, accepts online bookings), invite by email (role), resend/cancel invitation, deactivate member.
- **Plan**: "Beta gratuita" card, no payment.
- **Datos**: export clients as CSV, links to Términos and Privacidad.
- **Cerrar sesión**.

### 6.11 Public booking page (`/reservar/[slug]`)
No login. Business header (logo, name, city). Steps: 1) treatment (name, duration, price), 2) professional (salon; "Cualquiera disponible" default), 3) day (next available days strip) and time slot, 4) your data: name, WhatsApp, email (required for confirmation and reminder), note, **checkbox authorizing data processing** with a link to the business privacy policy (`/reservar/[slug]/privacidad`). → Confirmation screen "Solicitud enviada. {Negocio} confirmará tu cita." Slots = professional schedule − appointments (requested + scheduled + in progress) − blocks − min notice, in the slot interval. Abuse limits: max 2 open requests per phone per business.

### 6.12 Legal pages
`/terminos`, `/privacidad` (Cosmela as data processor "encargado del tratamiento"), drafted in Spanish with a visible note in the repo (not in UI) that a Colombian lawyer must review them.

### 6.13 Print views
Ficha, session, and consent have a clean print layout (browser print → PDF). This also serves Habeas Data access requests.

## 7. Emails (Spanish, simple branded HTML)

| Email | To | When |
|---|---|---|
| Código de acceso | user | login |
| Invitación al equipo | invitee | admin invites |
| Nueva solicitud de cita | admins + chosen professional | online request |
| Cita confirmada | client | staff creates appointment or confirms a request (if client email) |
| Solicitud rechazada | client | staff rejects a request |
| Recordatorio de cita | client | ~24 h before, between 7:00 and 20:00 Bogotá time |
| Indicaciones posteriores | client | on demand after closing |

Emails never include health data except the aftercare instructions the professional chose to send.

## 8. Rules

- Time zone is always `America/Bogota`. Money is integer COP, shown as `$ 85.000`.
- Phone numbers: Colombian mobile by default (+57, 10 digits), stored E.164.
- A closed session is never edited; only addenda are added.
- Archived clients disappear from lists and search but keep their history; v1 has no hard delete from the UI.
- Health data never goes to analytics, logs, or emails (except chosen aftercare).
- Every write checks org membership on the server.

## 9. Out of scope for v1

Payments processing and subscriptions (Polar is deferred: no PSE/Nequi support), automatic WhatsApp messages (Meta API cost), inventory, commissions, DIAN e-invoicing, offline writes, push notifications, native apps, multi-language.
