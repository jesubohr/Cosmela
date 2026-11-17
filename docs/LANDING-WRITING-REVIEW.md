# Landing page writing review

Scope: the Spanish landing page, local product preview, metadata, and accessible labels. All changes below have been applied. The visual design and application behavior remain outside this review.

## Vocabulary inventory

The landing page stores its strings directly in `app/page.tsx` and `components/landing/product-preview.tsx`. It has no translation calls, locale catalogs, CMS copy, or server-supplied messages.

| Object or action               | Preferred wording                                                            | Source                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Business                       | negocio; centro de estética when describing the audience                     | `docs/PRODUCT.md`                                                          |
| Person receiving treatment     | cliente                                                                      | `docs/PRODUCT.md`                                                          |
| Client record                  | ficha del cliente                                                            | `components/attention/ficha-step.tsx`                                      |
| Session steps                  | Ficha, Valoración, Contraindicaciones, Consentimiento, Procedimiento, Cierre | `components/attention/attention-flow.tsx:27`                               |
| Aftercare                      | cuidados posteriores                                                         | `docs/PRODUCT.md`                                                          |
| Booked appointment             | Agendada                                                                     | `lib/constants.ts:151`                                                     |
| Completed appointment          | Atendida                                                                     | `lib/constants.ts:153`                                                     |
| Returning account access       | Ingresar                                                                     | `app/(auth)/ingresar/page.tsx:5`                                           |
| New account entry              | Crear cuenta                                                                 | Existing email-code sign-in also registers new accounts; `docs/PRODUCT.md` |
| Open a preview record          | Ver ficha del cliente                                                        | Local `setShowRecord(true)` action                                         |
| Return to the preview day view | Volver a Hoy                                                                 | Local `setShowRecord(false)` action; Hoy is the app section name           |

Voice: neutral Latin American Spanish, direct address with tú, sentence case, familiar cosmetology terms, and no unnecessary gender. Code and documentation stay in English.

## Links describe their destination

| Severity | Location                                                 | Before                                           | After                              | Why                                                                                                          |
| -------- | -------------------------------------------------------- | ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| MEDIUM   | `app/page.tsx:260`                                       | Configurar mi negocio                            | Crear cuenta                       | The link opens account access, not business settings. The new label also removes the shift from tú to mi.    |
| MEDIUM   | `app/page.tsx:88`, `app/page.tsx:89`, `app/page.tsx:115` | Tu negocio; Atención al cliente; Conocer Cosmela | Funciones; Sesiones; Ver funciones | These links open the feature overview and session guide. Atención al cliente could suggest customer support. |

## One voice, one vocabulary

| Severity | Location                                                                                                                                                                                                                    | Before                                                                                | After                                                                                                  | Why                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| MEDIUM   | `app/page.tsx:67`, `app/page.tsx:68`, `app/page.tsx:253`                                                                                                                                                                    | Cuidados posteriores as the final step; desde la ficha hasta los cuidados posteriores | Cierre; desde la ficha hasta el cierre; closing description includes aftercare, payment, and follow-up | The final step now matches the app and explains its full scope.                                                                           |
| MEDIUM   | `components/landing/product-preview.tsx:21`, `components/landing/product-preview.tsx:29`, `components/landing/product-preview.tsx:37`, `components/landing/product-preview.tsx:153`, `app/page.tsx:159`, `app/page.tsx:167` | Completada; Próxima cita; Confirmada                                                  | Atendida; Agendada                                                                                     | The same appointment states now use the app's existing labels. Selecting a later appointment no longer labels it as the next appointment. |

## Plain words and concrete instructions

| Severity | Location                                                                                                                                                                           | Before                                                                                                                                    | After                                                                                                                                                 | Why                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| MEDIUM   | `components/landing/product-preview.tsx:77`                                                                                                                                        | Todo listo para tu jornada.                                                                                                               | Consulta las citas de hoy.                                                                                                                            | The preview cannot verify that everything is ready. The new copy gives a specific next action.                                           |
| LOW      | `app/page.tsx:145`, `app/page.tsx:178`, `app/page.tsx:216`, `app/page.tsx:229`, `app/page.tsx:245`, `app/page.tsx:287`, `app/page.tsx:307`, `app/page.tsx:314`, `app/page.tsx:340` | Repeated introductions, abstract wording such as Ten claro el siguiente paso, and indirect wording such as Quienes administran el negocio | Direct instructions: Consulta las citas del día; Registra lo que haces en cada sesión; Envía las indicaciones por WhatsApp; Si administras el negocio | The copy names the task, addresses the reader, and removes words that do not add information. FAQs preserve the existing feature claims. |
| LOW      | `components/landing/product-preview.tsx:133`                                                                                                                                       | 3 hoy                                                                                                                                     | 3 citas hoy                                                                                                                                           | The count names what it counts. This is a complete static example string, not a sentence assembled from fragments.                       |

## Verification

- Read every string in both landing components, including the alternate client-record view, metadata, and accessible labels.
- Checked terminology against the product specification, appointment status labels, and the implemented six-step attention flow.
- Checked account link destinations against the existing email-code login and registration flow. The primary links use `/ingresar`; feature and session links point to existing page anchors.
- Checked preview button labels against their local state handlers. No form, error, destructive action, or recovery message exists in the reviewed landing components.
- Preserved the established brand headline rather than replacing it for preference alone.
- Updated `DESIGN.md` with the vocabulary and link-label decisions.
- Targeted ESLint, `pnpm typecheck`, and `git diff --check` passed. No behavior changes or new tests were needed for these copy edits.
- Not verified: wording inside legal destination pages, backend emails, authentication errors, and other application screens. These are outside the reviewed landing-page scope. Browser rendering and the visual design gate were not rerun for this writing review.

No HIGH writing findings remain in the reviewed scope.

Approve
