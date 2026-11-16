# Cosmela — Treatment template library

Seed data for `data/treatment-templates.ts`. Users pick templates during onboarding (or later with "Agregar desde plantillas"); each pick is **copied** into the org's `treatments` table and becomes fully editable. All content below is user-facing Spanish and must be copied verbatim.

Sources and scope rules: `docs/research/domain.md` §1–3. Prices are typical Bogotá/Medellín ranges (2025–2026); the seed uses the value shown, rounded.

## Scope rules

- `scope: "cosmetologist"` — within Ley 711 de 2001 scope. No notice.
- `scope: "gray"` — not clearly regulated for cosmetologists. Show this notice on the template card, in the treatment editor (General tab, under the name), and **not** in the attention flow:
  > "La normativa colombiana no define con claridad si este procedimiento puede hacerlo una cosmetóloga. Verifica tu formación, el registro INVIMA de equipos y productos, y si requiere supervisión médica."
- Physician-only procedures (plasma rico en plaquetas, depilación láser/IPL, microneedling/dermapen, carboxiterapia, mesoterapia) are **not** in the library. A user can still create any treatment from scratch.

## Template shape

```ts
type TreatmentTemplate = {
  key: string;                 // stable id, e.g. "limpieza-facial"
  name: string;
  category: "facial" | "body" | "lashes_brows" | "hair_removal" | "other";
  description: string;
  durationMin: number;
  price: number;               // COP
  color: StaffColor;
  scope: "cosmetologist" | "gray";
  popular: boolean;            // preselected in onboarding
  contraindications: string[]; // treatment-specific, in addition to the general list
  aftercare: string[];
  followUpDays?: number;
  suggestedSessions?: number;
  benefits: string;            // used only to compose consentText at build time
  risks: string;               // used only to compose consentText at build time
  formFields: FormField[];     // ids: kebab-case, unique within the template
};
```

`consentText = composeConsent(benefits, risks)` using the base text below. The runtime placeholders `{cliente}`, `{documento}`, `{tratamiento}`, `{negocio}`, `{fecha}` stay in the stored text and are filled when the consent is shown.

## Base consent text

```
Yo, {cliente}, con {documento}, autorizo a {negocio} a realizarme el procedimiento de {tratamiento} el {fecha}.

Declaro que:
• Me explicaron en qué consiste el procedimiento, los beneficios esperados, los posibles riesgos y los cuidados posteriores.
• La información que di sobre mi salud, medicamentos, alergias y antecedentes es verdadera y completa. Entiendo que ocultar información puede afectar mi seguridad y el resultado.
• Entiendo que los resultados cambian de una persona a otra y que no se garantiza un resultado específico.
• Me comprometo a seguir las indicaciones posteriores que me entregaron.
• Pude hacer preguntas y recibí respuestas claras.

Beneficios esperados: {benefits}

Posibles riesgos y reacciones: {risks}

Puedo retirar este consentimiento en cualquier momento antes de iniciar el procedimiento.
```

Rendering rule for `{documento}`: "cédula de ciudadanía 1.023.456.789" (type label + formatted number). If the client has no document, the consent step asks for it (optional); if still empty, the ", con {documento}" clause is dropped ("Yo, {cliente}, autorizo…"); any other use renders "documento no registrado".

## Field notation

`label` — `type` [options | unit] (required = *). Lists separated by " · " in this file are separate array items.

Common closing fields (append to every template):
- `Reacción inmediata` — `single` [Ninguna, Eritema leve, Eritema moderado, Ardor, Edema, Otra]*
- `Observaciones del procedimiento` — `longtext`

---

## 1. Limpieza facial profunda
- key `limpieza-facial` · category facial · 75 min · $ 120.000 · color teal · scope cosmetologist · popular
- description: "Limpieza profunda con extracción de comedones, exfoliación, mascarilla e hidratación."
- contraindications: Acné inflamatorio severo · Quemadura solar en el rostro
- aftercare: No maquillarse durante 12 horas · Usar protector solar FPS 50+ y reaplicarlo cada 3 horas · No exponerse al sol ni al calor intenso por 48 horas · No tocar ni manipular las zonas de extracción · Mantener la piel hidratada
- followUpDays 30 · suggestedSessions —
- benefits: "Piel más limpia, luminosa y con poros menos visibles."
- risks: "Enrojecimiento temporal, sensibilidad, pequeñas marcas en las zonas de extracción y, en pocos casos, brotes de acné en los días siguientes."
- formFields:
  - `Productos y pasos` — `section`
  - `Desmaquillante / limpiador` — `text`
  - `Exfoliación` — `single` [Química, Física, Enzimática, No aplica]
  - `Vapor (minutos)` — `number` [min]
  - `Zonas de extracción` — `multi` [Frente, Nariz, Mentón, Mejillas, Espalda, Otra]
  - `Alta frecuencia` — `yesno`
  - `Mascarilla` — `text`
  - `Producto final (hidratante / protector)` — `text`
  - common closing fields

## 2. Peeling químico superficial
- key `peeling-quimico` · facial · 40 min · $ 180.000 · plum · gray · popular
- description: "Exfoliación química superficial para manchas, textura, acné y fotoenvejecimiento."
- contraindications: Cicatrices queloides · Rosácea activa · Uso de retinoides tópicos en los últimos 7 días · Depilación con cera en la zona en la última semana
- aftercare: Usar protector solar FPS 50+ todos los días · No exponerse al sol · No retirar la descamación con las manos · No usar exfoliantes ni retinoides por 7 días · Mantener hidratación adecuada · Evitar calor excesivo (sauna, ejercicio intenso) por 48 horas
- followUpDays 15 · suggestedSessions 4
- benefits: "Mejora de manchas, textura, poros y luminosidad de la piel."
- risks: "Ardor y enrojecimiento durante y después de la aplicación, descamación por varios días, sensibilidad, manchas (hiperpigmentación) si hay exposición al sol, reacción alérgica y, en casos raros, costras o cicatrices."
- formFields:
  - `Peeling utilizado` — `section`
  - `Tipo de ácido` — `multi` [Glicólico, Láctico, Mandélico, Salicílico, Kójico, Pirúvico, Combinado, Otro]*
  - `Producto (marca y lote)` — `text`
  - `Concentración` — `number` [%]*
  - `pH` — `number` [pH]
  - `Número de capas` — `number` [capas]*
  - `Tiempo de exposición` — `number` [min]*
  - `Neutralización` — `yesno`*
  - `Nivel de escarcha` — `single` [Ninguno, Nivel I, Nivel II, Nivel III]
  - common closing fields

## 3. Hidrafacial
- key `hidrafacial` · facial · 60 min · $ 250.000 · blue · gray
- description: "Limpieza, exfoliación, extracción por succión e hidratación con sueros."
- contraindications: Rosácea en brote · Quemadura solar
- aftercare: No maquillarse durante 6 horas · Usar protector solar FPS 50+ · Evitar exfoliantes por 48 horas · Mantener la piel hidratada
- followUpDays 30
- benefits: "Piel hidratada, limpia y luminosa desde la primera sesión."
- risks: "Enrojecimiento leve y temporal, sensibilidad y, en pocos casos, reacción a los sueros."
- formFields:
  - `Equipo y punta` — `text`
  - `Nivel de succión` — `scale` [1–10]
  - `Sueros utilizados (marca y lote)` — `longtext`
  - `Extracción` — `yesno`
  - `Zonas tratadas` — `multi` [Rostro completo, Cuello, Escote]
  - common closing fields

## 4. Dermaplaning
- key `dermaplaning` · facial · 30 min · $ 90.000 · sand · gray
- description: "Exfoliación con bisturí que retira células muertas y vello facial fino."
- contraindications: Acné activo · Rosácea · Uso de anticoagulantes · Quemadura solar
- aftercare: Usar protector solar FPS 50+ · No exfoliar la piel por 5 días · Evitar maquillaje por 12 horas · Mantener hidratación adecuada
- followUpDays 28
- benefits: "Piel más suave, uniforme y mejor absorción de productos."
- risks: "Enrojecimiento temporal, pequeños cortes superficiales, sensibilidad y brotes en pieles con acné."
- formFields:
  - `Hoja (tipo y lote)` — `text`*
  - `Zonas tratadas` — `multi` [Frente, Mejillas, Mentón, Bozo, Cuello]
  - `Producto posterior` — `text`
  - common closing fields

## 5. Microdermoabrasión
- key `microdermoabrasion` · facial · 45 min · $ 150.000 · slate · gray
- description: "Exfoliación mecánica con punta de diamante o cristales."
- contraindications: Rosácea · Cicatrices queloides · Acné inflamatorio activo
- aftercare: Usar protector solar FPS 50+ · No exponerse al sol por 48 horas · No usar exfoliantes por 5 días · Mantener la piel hidratada
- followUpDays 15 · suggestedSessions 5
- benefits: "Mejora de textura, poros, manchas superficiales y cicatrices leves."
- risks: "Enrojecimiento, sensibilidad, pequeñas abrasiones y, si hay exposición al sol, manchas."
- formFields:
  - `Tipo de punta` — `single` [Diamante, Cristales]*
  - `Nivel de succión` — `scale` [1–10]
  - `Número de pasadas` — `number` [pasadas]
  - `Zonas tratadas` — `multi` [Rostro completo, Cuello, Escote, Espalda]
  - common closing fields

## 6. Radiofrecuencia facial
- key `radiofrecuencia-facial` · facial · 40 min · $ 150.000 · rose · gray
- description: "Calor controlado para estimular colágeno y mejorar la firmeza."
- contraindications: Marcapasos o dispositivo electrónico implantado · Implantes metálicos en la zona · Cáncer activo · Epilepsia no controlada · Rellenos dérmicos recientes en la zona
- aftercare: Beber suficiente agua · Usar protector solar FPS 50+ · Evitar calor intenso por 24 horas
- followUpDays 7 · suggestedSessions 8
- benefits: "Piel más firme, mejora de flacidez leve y de líneas finas."
- risks: "Enrojecimiento y calor temporal, sensibilidad y, en casos raros, quemaduras."
- formFields:
  - `Equipo` — `text`
  - `Tipo de cabezal` — `single` [Monopolar, Bipolar, Tripolar, Multipolar]
  - `Temperatura objetivo` — `number` [°C]
  - `Tiempo por zona` — `number` [min]
  - `Zonas tratadas` — `multi` [Frente, Contorno de ojos, Mejillas, Mandíbula, Papada, Cuello]
  - common closing fields

## 7. Radiofrecuencia corporal
- key `radiofrecuencia-corporal` · body · 45 min · $ 130.000 · rose · gray
- description: "Calor controlado para flacidez y celulitis en zonas del cuerpo."
- contraindications: same as radiofrecuencia facial (without "Rellenos dérmicos…") + Embarazo
- aftercare: Beber suficiente agua · Evitar calor intenso por 24 horas · Mantener actividad física y buena hidratación
- followUpDays 7 · suggestedSessions 10
- benefits: "Mejora de flacidez y de la apariencia de la celulitis."
- risks: "Enrojecimiento y calor temporal, sensibilidad y, en casos raros, quemaduras."
- formFields:
  - `Equipo` — `text`
  - `Temperatura objetivo` — `number` [°C]
  - `Zonas tratadas` — `multi` [Abdomen, Flancos, Glúteos, Piernas, Brazos, Espalda]
  - `Medida de la zona (antes)` — `number` [cm]
  - common closing fields

## 8. Depilación con cera
- key `depilacion-cera` · hair_removal · 30 min · $ 40.000 · coral · cosmetologist · popular
- description: "Depilación con cera caliente o tibia por zonas."
- contraindications: Uso de retinoides tópicos en la zona · Várices en la zona · Diabetes sin control médico
- aftercare: No exponerse al sol por 24 horas · Evitar piscina, sauna y ejercicio intenso por 24 horas · No usar desodorante ni perfume en la zona por 12 horas · Exfoliar suavemente desde el tercer día para evitar vellos encarnados
- followUpDays 30
- benefits: "Piel sin vello por 3 a 5 semanas."
- risks: "Enrojecimiento, irritación, foliculitis, vellos encarnados y, en casos raros, quemaduras o levantamiento de piel."
- formFields:
  - `Zonas` — `multi` [Cejas, Bozo, Rostro, Axilas, Brazos, Media pierna, Pierna completa, Bikini, Bikini completo, Espalda, Abdomen]*
  - `Tipo de cera` — `single` [Caliente, Tibia, Fría, Roll-on]*
  - `Marca` — `text`
  - `Prueba de temperatura` — `yesno`*
  - common closing fields

## 9. Lifting de pestañas
- key `lifting-pestanas` · lashes_brows · 60 min · $ 100.000 · plum · cosmetologist · popular
- description: "Curvatura y elevación de las pestañas naturales, con tinte opcional."
- contraindications: Conjuntivitis · Orzuelo · Blefaritis · Cirugía ocular reciente · Alergia a productos de pestañas o tintes
- aftercare: No mojar las pestañas durante 24 horas · No usar vapor, sauna ni piscina por 24 horas · No frotar los ojos · No usar rímel a prueba de agua ni encrespador · Peinar las pestañas cada mañana
- followUpDays 45
- benefits: "Pestañas más elevadas y visibles por 6 a 8 semanas."
- risks: "Irritación ocular, enrojecimiento, reacción alérgica y quiebre de pestañas si no se siguen los cuidados."
- formFields:
  - `Prueba de alergia realizada` — `yesno`*
  - `Productos (marca y lote)` — `text`*
  - `Talla del molde` — `single` [XS, S, M, L, XL]
  - `Tiempo paso 1 (lifting)` — `number` [min]
  - `Tiempo paso 2 (fijación)` — `number` [min]
  - `Tinte` — `single` [Sin tinte, Negro, Café, Otro]
  - common closing fields

## 10. Laminado de cejas
- key `laminado-cejas` · lashes_brows · 50 min · $ 65.000 · olive · cosmetologist · popular
- description: "Alisado y fijación del vello de las cejas para un efecto ordenado y lleno."
- contraindications: Conjuntivitis · Dermatitis o heridas en la zona de las cejas · Alergia a productos de cejas o tintes
- aftercare: No mojar las cejas durante 24 horas · No usar maquillaje en las cejas por 24 horas · Peinar las cejas cada mañana · Aplicar aceite nutritivo desde el segundo día
- followUpDays 45
- benefits: "Cejas más ordenadas, definidas y con apariencia más llena por 6 a 8 semanas."
- risks: "Irritación, enrojecimiento, reacción alérgica y resequedad del vello."
- formFields:
  - `Prueba de alergia realizada` — `yesno`*
  - `Productos (marca y lote)` — `text`*
  - `Tiempo paso 1` — `number` [min]
  - `Tiempo paso 2` — `number` [min]
  - `Tinte` — `single` [Sin tinte, Negro, Café oscuro, Café claro, Otro]
  - `Diseño / depilación` — `single` [No, Cera, Pinza, Hilo]
  - common closing fields

## 11. Diseño de cejas con henna
- key `cejas-henna` · lashes_brows · 40 min · $ 30.000 · sand · cosmetologist
- description: "Diseño, depilación y pigmentación temporal con henna."
- contraindications: Alergia a la henna o a tintes · Infección o herida en la zona
- aftercare: No mojar las cejas por 12 horas · No exfoliar la zona · Evitar sol directo y piscina para que dure más
- followUpDays 21
- benefits: "Cejas definidas y con color por 2 a 4 semanas."
- risks: "Irritación, enrojecimiento y reacción alérgica a la henna."
- formFields:
  - `Prueba de alergia realizada` — `yesno`*
  - `Henna (marca y lote)` — `text`
  - `Tono` — `text`
  - `Visagismo / medición` — `yesno`
  - `Método de depilación` — `single` [Cera, Pinza, Hilo, No aplica]
  - common closing fields

## 12. Masaje reductor
- key `masaje-reductor` · body · 60 min · $ 90.000 · teal · cosmetologist
- description: "Masaje corporal de presión firme para modelar zonas con grasa localizada."
- contraindications: Embarazo · Trombosis o várices severas · Infección aguda · Insuficiencia cardiaca o renal · Heridas abiertas en la zona
- aftercare: Beber al menos 2 litros de agua al día · Mantener actividad física · Reducir azúcares y harinas
- followUpDays 3 · suggestedSessions 10
- benefits: "Mejora del contorno corporal y de la apariencia de la piel."
- risks: "Dolor muscular, sensibilidad y moretones leves."
- formFields:
  - `Zonas` — `multi` [Abdomen, Flancos, Espalda, Glúteos, Piernas, Brazos]*
  - `Técnica / presión` — `single` [Suave, Media, Firme]
  - `Producto (aceite / gel)` — `text`
  - `Medida de cintura` — `number` [cm]
  - `Medida de abdomen` — `number` [cm]
  - `Peso` — `number` [kg]
  - common closing fields

## 13. Drenaje linfático manual
- key `drenaje-linfatico` · body · 60 min · $ 100.000 · blue · cosmetologist · popular
- description: "Masaje suave y rítmico que estimula la circulación linfática y reduce la retención de líquidos."
- contraindications: Trombosis venosa profunda · Infección aguda · Insuficiencia cardiaca · Enfermedad renal severa · Cáncer activo sin autorización médica
- aftercare: Beber suficiente agua · Evitar comidas muy saladas · Usar prenda de compresión si te la indicaron
- followUpDays 3 · suggestedSessions 8
- benefits: "Disminución de la hinchazón y sensación de piernas ligeras."
- risks: "Leve mareo o cansancio y aumento de la necesidad de orinar."
- formFields:
  - `Motivo` — `single` [Retención de líquidos, Posoperatorio (con orden médica), Bienestar, Otro]
  - `Zonas` — `multi` [Piernas, Abdomen, Brazos, Rostro, Cuerpo completo]*
  - `Nivel de edema` — `scale` [1–5]
  - `Medida de la zona` — `number` [cm]
  - common closing fields

## 14. Maderoterapia
- key `maderoterapia` · body · 60 min · $ 90.000 · olive · cosmetologist
- description: "Masaje con instrumentos de madera para modelar el contorno y mejorar la celulitis."
- contraindications: Enfermedad cardiaca o renal · Várices en la zona · Dermatitis en la zona · Embarazo · Piel muy sensible o con moretones fáciles
- aftercare: Beber suficiente agua · Mantener actividad física · Informar si aparecen moretones intensos
- followUpDays 3 · suggestedSessions 10
- benefits: "Mejora del contorno y de la apariencia de la celulitis."
- risks: "Dolor, sensibilidad y moretones."
- formFields:
  - `Instrumentos` — `multi` [Rodillo, Copa sueca, Tabla moldeadora, Mushroom, Otro]
  - `Zonas` — `multi` [Abdomen, Flancos, Glúteos, Piernas, Brazos, Espalda]*
  - `Presión` — `single` [Suave, Media, Firme]
  - `Medida de cintura` — `number` [cm]
  - common closing fields
