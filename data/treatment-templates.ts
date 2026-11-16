// Seed treatment library (docs/TEMPLATES.md). Spanish content is verbatim.
// Imported by the UI and by Convex functions, so only relative imports here.
import type { FormField, StaffColor, TreatmentCategory } from "../convex/lib/validators";

export type TreatmentScope = "cosmetologist" | "gray";

export type TreatmentTemplate = {
  key: string;
  name: string;
  category: TreatmentCategory;
  description: string;
  durationMin: number;
  price: number;
  color: StaffColor;
  scope: TreatmentScope;
  /** Preselected in onboarding. */
  popular: boolean;
  /** Treatment-specific, in addition to the general list. */
  contraindications: string[];
  aftercare: string[];
  followUpDays?: number;
  suggestedSessions?: number;
  consentText: string;
  formFields: FormField[];
};

/** Shown for `scope: "gray"` on the template card and in the treatment editor, never in the attention flow. */
export const GRAY_SCOPE_NOTICE =
  "La normativa colombiana no define con claridad si este procedimiento puede hacerlo una cosmetóloga. Verifica tu formación, el registro INVIMA de equipos y productos, y si requiere supervisión médica.";

const BASE_CONSENT = `Yo, {cliente}, con {documento}, autorizo a {negocio} a realizarme el procedimiento de {tratamiento} el {fecha}.

Declaro que:
• Me explicaron en qué consiste el procedimiento, los beneficios esperados, los posibles riesgos y los cuidados posteriores.
• La información que di sobre mi salud, medicamentos, alergias y antecedentes es verdadera y completa. Entiendo que ocultar información puede afectar mi seguridad y el resultado.
• Entiendo que los resultados cambian de una persona a otra y que no se garantiza un resultado específico.
• Me comprometo a seguir las indicaciones posteriores que me entregaron.
• Pude hacer preguntas y recibí respuestas claras.

Beneficios esperados: {benefits}

Posibles riesgos y reacciones: {risks}

Puedo retirar este consentimiento en cualquier momento antes de iniciar el procedimiento.`;

/** Base consent text with the treatment's benefits and risks. Runtime placeholders stay in the text. */
export function composeConsent(benefits: string, risks: string): string {
  return BASE_CONSENT.replace("{benefits}", benefits).replace("{risks}", risks);
}

/** Placeholders filled when the consent is shown to the client. */
export const CONSENT_PLACEHOLDERS = [
  { token: "{cliente}", label: "Nombre del cliente" },
  { token: "{documento}", label: "Documento" },
  { token: "{tratamiento}", label: "Tratamiento" },
  { token: "{negocio}", label: "Negocio" },
  { token: "{fecha}", label: "Fecha" },
] as const;

export type ConsentValues = {
  cliente: string;
  /** Already rendered, e.g. "cédula de ciudadanía 1.023.456.789" or "documento no registrado". */
  documento: string;
  tratamiento: string;
  negocio: string;
  /** e.g. "15 de noviembre de 2026". */
  fecha: string;
};

/** Replaces every placeholder in a consent text. */
export function renderConsent(text: string, values: ConsentValues): string {
  return text.replace(/\{(cliente|documento|tratamiento|negocio|fecha)\}/g, (_, key: keyof ConsentValues) => values[key]);
}

function slug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type FieldOptions = Omit<FormField, "id" | "label" | "type">;

/** Field ids are the kebab-case label, unique within a template. */
function field(label: string, type: FormField["type"], options: FieldOptions = {}): FormField {
  return { id: slug(label), label, type, ...options };
}

const required = { required: true } as const;

const CLOSING_FIELDS: FormField[] = [
  field("Reacción inmediata", "single", {
    options: ["Ninguna", "Eritema leve", "Eritema moderado", "Ardor", "Edema", "Otra"],
    required: true,
  }),
  field("Observaciones del procedimiento", "longtext"),
];

type TemplateInput = Omit<TreatmentTemplate, "consentText"> & { benefits: string; risks: string };

function template({ benefits, risks, formFields, ...rest }: TemplateInput): TreatmentTemplate {
  return { ...rest, consentText: composeConsent(benefits, risks), formFields: [...formFields, ...CLOSING_FIELDS] };
}

const RF_FACIAL_CONTRAINDICATIONS = [
  "Marcapasos o dispositivo electrónico implantado",
  "Implantes metálicos en la zona",
  "Cáncer activo",
  "Epilepsia no controlada",
];

export const TREATMENT_TEMPLATES: TreatmentTemplate[] = [
  template({
    key: "limpieza-facial",
    name: "Limpieza facial profunda",
    category: "facial",
    description: "Limpieza profunda con extracción de comedones, exfoliación, mascarilla e hidratación.",
    durationMin: 75,
    price: 120000,
    color: "teal",
    scope: "cosmetologist",
    popular: true,
    contraindications: ["Acné inflamatorio severo", "Quemadura solar en el rostro"],
    aftercare: [
      "No maquillarse durante 12 horas",
      "Usar protector solar FPS 50+ y reaplicarlo cada 3 horas",
      "No exponerse al sol ni al calor intenso por 48 horas",
      "No tocar ni manipular las zonas de extracción",
      "Mantener la piel hidratada",
    ],
    followUpDays: 30,
    benefits: "Piel más limpia, luminosa y con poros menos visibles.",
    risks:
      "Enrojecimiento temporal, sensibilidad, pequeñas marcas en las zonas de extracción y, en pocos casos, brotes de acné en los días siguientes.",
    formFields: [
      field("Productos y pasos", "section"),
      field("Desmaquillante / limpiador", "text"),
      field("Exfoliación", "single", { options: ["Química", "Física", "Enzimática", "No aplica"] }),
      field("Vapor (minutos)", "number", { unit: "min" }),
      field("Zonas de extracción", "multi", { options: ["Frente", "Nariz", "Mentón", "Mejillas", "Espalda", "Otra"] }),
      field("Alta frecuencia", "yesno"),
      field("Mascarilla", "text"),
      field("Producto final (hidratante / protector)", "text"),
    ],
  }),
  template({
    key: "peeling-quimico",
    name: "Peeling químico superficial",
    category: "facial",
    description: "Exfoliación química superficial para manchas, textura, acné y fotoenvejecimiento.",
    durationMin: 40,
    price: 180000,
    color: "plum",
    scope: "gray",
    popular: true,
    contraindications: [
      "Cicatrices queloides",
      "Rosácea activa",
      "Uso de retinoides tópicos en los últimos 7 días",
      "Depilación con cera en la zona en la última semana",
    ],
    aftercare: [
      "Usar protector solar FPS 50+ todos los días",
      "No exponerse al sol",
      "No retirar la descamación con las manos",
      "No usar exfoliantes ni retinoides por 7 días",
      "Mantener hidratación adecuada",
      "Evitar calor excesivo (sauna, ejercicio intenso) por 48 horas",
    ],
    followUpDays: 15,
    suggestedSessions: 4,
    benefits: "Mejora de manchas, textura, poros y luminosidad de la piel.",
    risks:
      "Ardor y enrojecimiento durante y después de la aplicación, descamación por varios días, sensibilidad, manchas (hiperpigmentación) si hay exposición al sol, reacción alérgica y, en casos raros, costras o cicatrices.",
    formFields: [
      field("Peeling utilizado", "section"),
      field("Tipo de ácido", "multi", {
        options: ["Glicólico", "Láctico", "Mandélico", "Salicílico", "Kójico", "Pirúvico", "Combinado", "Otro"],
        ...required,
      }),
      field("Producto (marca y lote)", "text"),
      field("Concentración", "number", { unit: "%", ...required }),
      field("pH", "number", { unit: "pH" }),
      field("Número de capas", "number", { unit: "capas", ...required }),
      field("Tiempo de exposición", "number", { unit: "min", ...required }),
      field("Neutralización", "yesno", required),
      field("Nivel de escarcha", "single", { options: ["Ninguno", "Nivel I", "Nivel II", "Nivel III"] }),
    ],
  }),
  template({
    key: "hidrafacial",
    name: "Hidrafacial",
    category: "facial",
    description: "Limpieza, exfoliación, extracción por succión e hidratación con sueros.",
    durationMin: 60,
    price: 250000,
    color: "blue",
    scope: "gray",
    popular: false,
    contraindications: ["Rosácea en brote", "Quemadura solar"],
    aftercare: [
      "No maquillarse durante 6 horas",
      "Usar protector solar FPS 50+",
      "Evitar exfoliantes por 48 horas",
      "Mantener la piel hidratada",
    ],
    followUpDays: 30,
    benefits: "Piel hidratada, limpia y luminosa desde la primera sesión.",
    risks: "Enrojecimiento leve y temporal, sensibilidad y, en pocos casos, reacción a los sueros.",
    formFields: [
      field("Equipo y punta", "text"),
      field("Nivel de succión", "scale", { min: 1, max: 10 }),
      field("Sueros utilizados (marca y lote)", "longtext"),
      field("Extracción", "yesno"),
      field("Zonas tratadas", "multi", { options: ["Rostro completo", "Cuello", "Escote"] }),
    ],
  }),
  template({
    key: "dermaplaning",
    name: "Dermaplaning",
    category: "facial",
    description: "Exfoliación con bisturí que retira células muertas y vello facial fino.",
    durationMin: 30,
    price: 90000,
    color: "sand",
    scope: "gray",
    popular: false,
    contraindications: ["Acné activo", "Rosácea", "Uso de anticoagulantes", "Quemadura solar"],
    aftercare: [
      "Usar protector solar FPS 50+",
      "No exfoliar la piel por 5 días",
      "Evitar maquillaje por 12 horas",
      "Mantener hidratación adecuada",
    ],
    followUpDays: 28,
    benefits: "Piel más suave, uniforme y mejor absorción de productos.",
    risks: "Enrojecimiento temporal, pequeños cortes superficiales, sensibilidad y brotes en pieles con acné.",
    formFields: [
      field("Hoja (tipo y lote)", "text", required),
      field("Zonas tratadas", "multi", { options: ["Frente", "Mejillas", "Mentón", "Bozo", "Cuello"] }),
      field("Producto posterior", "text"),
    ],
  }),
  template({
    key: "microdermoabrasion",
    name: "Microdermoabrasión",
    category: "facial",
    description: "Exfoliación mecánica con punta de diamante o cristales.",
    durationMin: 45,
    price: 150000,
    color: "slate",
    scope: "gray",
    popular: false,
    contraindications: ["Rosácea", "Cicatrices queloides", "Acné inflamatorio activo"],
    aftercare: [
      "Usar protector solar FPS 50+",
      "No exponerse al sol por 48 horas",
      "No usar exfoliantes por 5 días",
      "Mantener la piel hidratada",
    ],
    followUpDays: 15,
    suggestedSessions: 5,
    benefits: "Mejora de textura, poros, manchas superficiales y cicatrices leves.",
    risks: "Enrojecimiento, sensibilidad, pequeñas abrasiones y, si hay exposición al sol, manchas.",
    formFields: [
      field("Tipo de punta", "single", { options: ["Diamante", "Cristales"], ...required }),
      field("Nivel de succión", "scale", { min: 1, max: 10 }),
      field("Número de pasadas", "number", { unit: "pasadas" }),
      field("Zonas tratadas", "multi", { options: ["Rostro completo", "Cuello", "Escote", "Espalda"] }),
    ],
  }),
  template({
    key: "radiofrecuencia-facial",
    name: "Radiofrecuencia facial",
    category: "facial",
    description: "Calor controlado para estimular colágeno y mejorar la firmeza.",
    durationMin: 40,
    price: 150000,
    color: "rose",
    scope: "gray",
    popular: false,
    contraindications: [...RF_FACIAL_CONTRAINDICATIONS, "Rellenos dérmicos recientes en la zona"],
    aftercare: ["Beber suficiente agua", "Usar protector solar FPS 50+", "Evitar calor intenso por 24 horas"],
    followUpDays: 7,
    suggestedSessions: 8,
    benefits: "Piel más firme, mejora de flacidez leve y de líneas finas.",
    risks: "Enrojecimiento y calor temporal, sensibilidad y, en casos raros, quemaduras.",
    formFields: [
      field("Equipo", "text"),
      field("Tipo de cabezal", "single", { options: ["Monopolar", "Bipolar", "Tripolar", "Multipolar"] }),
      field("Temperatura objetivo", "number", { unit: "°C" }),
      field("Tiempo por zona", "number", { unit: "min" }),
      field("Zonas tratadas", "multi", {
        options: ["Frente", "Contorno de ojos", "Mejillas", "Mandíbula", "Papada", "Cuello"],
      }),
    ],
  }),
  template({
    key: "radiofrecuencia-corporal",
    name: "Radiofrecuencia corporal",
    category: "body",
    description: "Calor controlado para flacidez y celulitis en zonas del cuerpo.",
    durationMin: 45,
    price: 130000,
    color: "rose",
    scope: "gray",
    popular: false,
    contraindications: [...RF_FACIAL_CONTRAINDICATIONS, "Embarazo"],
    aftercare: [
      "Beber suficiente agua",
      "Evitar calor intenso por 24 horas",
      "Mantener actividad física y buena hidratación",
    ],
    followUpDays: 7,
    suggestedSessions: 10,
    benefits: "Mejora de flacidez y de la apariencia de la celulitis.",
    risks: "Enrojecimiento y calor temporal, sensibilidad y, en casos raros, quemaduras.",
    formFields: [
      field("Equipo", "text"),
      field("Temperatura objetivo", "number", { unit: "°C" }),
      field("Zonas tratadas", "multi", { options: ["Abdomen", "Flancos", "Glúteos", "Piernas", "Brazos", "Espalda"] }),
      field("Medida de la zona (antes)", "number", { unit: "cm" }),
    ],
  }),
  template({
    key: "depilacion-cera",
    name: "Depilación con cera",
    category: "hair_removal",
    description: "Depilación con cera caliente o tibia por zonas.",
    durationMin: 30,
    price: 40000,
    color: "coral",
    scope: "cosmetologist",
    popular: true,
    contraindications: ["Uso de retinoides tópicos en la zona", "Várices en la zona", "Diabetes sin control médico"],
    aftercare: [
      "No exponerse al sol por 24 horas",
      "Evitar piscina, sauna y ejercicio intenso por 24 horas",
      "No usar desodorante ni perfume en la zona por 12 horas",
      "Exfoliar suavemente desde el tercer día para evitar vellos encarnados",
    ],
    followUpDays: 30,
    benefits: "Piel sin vello por 3 a 5 semanas.",
    risks: "Enrojecimiento, irritación, foliculitis, vellos encarnados y, en casos raros, quemaduras o levantamiento de piel.",
    formFields: [
      field("Zonas", "multi", {
        options: [
          "Cejas",
          "Bozo",
          "Rostro",
          "Axilas",
          "Brazos",
          "Media pierna",
          "Pierna completa",
          "Bikini",
          "Bikini completo",
          "Espalda",
          "Abdomen",
        ],
        ...required,
      }),
      field("Tipo de cera", "single", { options: ["Caliente", "Tibia", "Fría", "Roll-on"], ...required }),
      field("Marca", "text"),
      field("Prueba de temperatura", "yesno", required),
    ],
  }),
  template({
    key: "lifting-pestanas",
    name: "Lifting de pestañas",
    category: "lashes_brows",
    description: "Curvatura y elevación de las pestañas naturales, con tinte opcional.",
    durationMin: 60,
    price: 100000,
    color: "plum",
    scope: "cosmetologist",
    popular: true,
    contraindications: [
      "Conjuntivitis",
      "Orzuelo",
      "Blefaritis",
      "Cirugía ocular reciente",
      "Alergia a productos de pestañas o tintes",
    ],
    aftercare: [
      "No mojar las pestañas durante 24 horas",
      "No usar vapor, sauna ni piscina por 24 horas",
      "No frotar los ojos",
      "No usar rímel a prueba de agua ni encrespador",
      "Peinar las pestañas cada mañana",
    ],
    followUpDays: 45,
    benefits: "Pestañas más elevadas y visibles por 6 a 8 semanas.",
    risks: "Irritación ocular, enrojecimiento, reacción alérgica y quiebre de pestañas si no se siguen los cuidados.",
    formFields: [
      field("Prueba de alergia realizada", "yesno", required),
      field("Productos (marca y lote)", "text", required),
      field("Talla del molde", "single", { options: ["XS", "S", "M", "L", "XL"] }),
      field("Tiempo paso 1 (lifting)", "number", { unit: "min" }),
      field("Tiempo paso 2 (fijación)", "number", { unit: "min" }),
      field("Tinte", "single", { options: ["Sin tinte", "Negro", "Café", "Otro"] }),
    ],
  }),
  template({
    key: "laminado-cejas",
    name: "Laminado de cejas",
    category: "lashes_brows",
    description: "Alisado y fijación del vello de las cejas para un efecto ordenado y lleno.",
    durationMin: 50,
    price: 65000,
    color: "olive",
    scope: "cosmetologist",
    popular: true,
    contraindications: [
      "Conjuntivitis",
      "Dermatitis o heridas en la zona de las cejas",
      "Alergia a productos de cejas o tintes",
    ],
    aftercare: [
      "No mojar las cejas durante 24 horas",
      "No usar maquillaje en las cejas por 24 horas",
      "Peinar las cejas cada mañana",
      "Aplicar aceite nutritivo desde el segundo día",
    ],
    followUpDays: 45,
    benefits: "Cejas más ordenadas, definidas y con apariencia más llena por 6 a 8 semanas.",
    risks: "Irritación, enrojecimiento, reacción alérgica y resequedad del vello.",
    formFields: [
      field("Prueba de alergia realizada", "yesno", required),
      field("Productos (marca y lote)", "text", required),
      field("Tiempo paso 1", "number", { unit: "min" }),
      field("Tiempo paso 2", "number", { unit: "min" }),
      field("Tinte", "single", { options: ["Sin tinte", "Negro", "Café oscuro", "Café claro", "Otro"] }),
      field("Diseño / depilación", "single", { options: ["No", "Cera", "Pinza", "Hilo"] }),
    ],
  }),
  template({
    key: "cejas-henna",
    name: "Diseño de cejas con henna",
    category: "lashes_brows",
    description: "Diseño, depilación y pigmentación temporal con henna.",
    durationMin: 40,
    price: 30000,
    color: "sand",
    scope: "cosmetologist",
    popular: false,
    contraindications: ["Alergia a la henna o a tintes", "Infección o herida en la zona"],
    aftercare: [
      "No mojar las cejas por 12 horas",
      "No exfoliar la zona",
      "Evitar sol directo y piscina para que dure más",
    ],
    followUpDays: 21,
    benefits: "Cejas definidas y con color por 2 a 4 semanas.",
    risks: "Irritación, enrojecimiento y reacción alérgica a la henna.",
    formFields: [
      field("Prueba de alergia realizada", "yesno", required),
      field("Henna (marca y lote)", "text"),
      field("Tono", "text"),
      field("Visagismo / medición", "yesno"),
      field("Método de depilación", "single", { options: ["Cera", "Pinza", "Hilo", "No aplica"] }),
    ],
  }),
  template({
    key: "masaje-reductor",
    name: "Masaje reductor",
    category: "body",
    description: "Masaje corporal de presión firme para modelar zonas con grasa localizada.",
    durationMin: 60,
    price: 90000,
    color: "teal",
    scope: "cosmetologist",
    popular: false,
    contraindications: [
      "Embarazo",
      "Trombosis o várices severas",
      "Infección aguda",
      "Insuficiencia cardiaca o renal",
      "Heridas abiertas en la zona",
    ],
    aftercare: ["Beber al menos 2 litros de agua al día", "Mantener actividad física", "Reducir azúcares y harinas"],
    followUpDays: 3,
    suggestedSessions: 10,
    benefits: "Mejora del contorno corporal y de la apariencia de la piel.",
    risks: "Dolor muscular, sensibilidad y moretones leves.",
    formFields: [
      field("Zonas", "multi", { options: ["Abdomen", "Flancos", "Espalda", "Glúteos", "Piernas", "Brazos"], ...required }),
      field("Técnica / presión", "single", { options: ["Suave", "Media", "Firme"] }),
      field("Producto (aceite / gel)", "text"),
      field("Medida de cintura", "number", { unit: "cm" }),
      field("Medida de abdomen", "number", { unit: "cm" }),
      field("Peso", "number", { unit: "kg" }),
    ],
  }),
  template({
    key: "drenaje-linfatico",
    name: "Drenaje linfático manual",
    category: "body",
    description: "Masaje suave y rítmico que estimula la circulación linfática y reduce la retención de líquidos.",
    durationMin: 60,
    price: 100000,
    color: "blue",
    scope: "cosmetologist",
    popular: true,
    contraindications: [
      "Trombosis venosa profunda",
      "Infección aguda",
      "Insuficiencia cardiaca",
      "Enfermedad renal severa",
      "Cáncer activo sin autorización médica",
    ],
    aftercare: ["Beber suficiente agua", "Evitar comidas muy saladas", "Usar prenda de compresión si te la indicaron"],
    followUpDays: 3,
    suggestedSessions: 8,
    benefits: "Disminución de la hinchazón y sensación de piernas ligeras.",
    risks: "Leve mareo o cansancio y aumento de la necesidad de orinar.",
    formFields: [
      field("Motivo", "single", {
        options: ["Retención de líquidos", "Posoperatorio (con orden médica)", "Bienestar", "Otro"],
      }),
      field("Zonas", "multi", { options: ["Piernas", "Abdomen", "Brazos", "Rostro", "Cuerpo completo"], ...required }),
      field("Nivel de edema", "scale", { min: 1, max: 5 }),
      field("Medida de la zona", "number", { unit: "cm" }),
    ],
  }),
  template({
    key: "maderoterapia",
    name: "Maderoterapia",
    category: "body",
    description: "Masaje con instrumentos de madera para modelar el contorno y mejorar la celulitis.",
    durationMin: 60,
    price: 90000,
    color: "olive",
    scope: "cosmetologist",
    popular: false,
    contraindications: [
      "Enfermedad cardiaca o renal",
      "Várices en la zona",
      "Dermatitis en la zona",
      "Embarazo",
      "Piel muy sensible o con moretones fáciles",
    ],
    aftercare: ["Beber suficiente agua", "Mantener actividad física", "Informar si aparecen moretones intensos"],
    followUpDays: 3,
    suggestedSessions: 10,
    benefits: "Mejora del contorno y de la apariencia de la celulitis.",
    risks: "Dolor, sensibilidad y moretones.",
    formFields: [
      field("Instrumentos", "multi", { options: ["Rodillo", "Copa sueca", "Tabla moldeadora", "Mushroom", "Otro"] }),
      field("Zonas", "multi", { options: ["Abdomen", "Flancos", "Glúteos", "Piernas", "Brazos", "Espalda"], ...required }),
      field("Presión", "single", { options: ["Suave", "Media", "Firme"] }),
      field("Medida de cintura", "number", { unit: "cm" }),
    ],
  }),
];

export function findTemplate(key: string | undefined): TreatmentTemplate | undefined {
  return key ? TREATMENT_TEMPLATES.find((t) => t.key === key) : undefined;
}
