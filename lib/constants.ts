// Spanish labels for every enum key in `convex/lib/validators.ts`.
// Shared by the UI and emails. To render a list in order, iterate the key arrays
// exported by validators (e.g. `CONDITIONS.map((k) => CONDITION_LABELS[k])`).
import type {
  AllergyKey,
  AppointmentSource,
  AppointmentStatus,
  AuthorizationMethod,
  CaseStatus,
  ConditionKey,
  DocumentType,
  ExfoliantHabit,
  Fitzpatrick,
  FollowUpStatus,
  FormFieldType,
  GeneralContraindicationKey,
  InvitationStatus,
  ObservedKey,
  OrgKind,
  PaymentMethod,
  PhotoKind,
  PhotoUse,
  ReasonKey,
  Role,
  SessionStatus,
  Sex,
  SkinConditionKey,
  SkinType,
  StaffColor,
  SunscreenHabit,
  TimeBlockKind,
  TreatmentCategory,
} from "@/convex/lib/validators";

export const TIME_ZONE = "America/Bogota";

export const ORG_KIND_LABELS: Record<OrgKind, string> = {
  solo: "Trabajo independiente",
  salon: "Tengo un salón con equipo",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  staff: "Profesional",
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  cancelled: "Cancelada",
};

export const MEMBER_TITLES = ["Cosmetóloga", "Esteticista", "Cosmiatra", "Otro"] as const;

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CC: "Cédula de ciudadanía",
  CE: "Cédula de extranjería",
  TI: "Tarjeta de identidad",
  PA: "Pasaporte",
  PPT: "Permiso por protección temporal",
  NIT: "NIT",
};

export const SEX_LABELS: Record<Sex, string> = {
  female: "Femenino",
  male: "Masculino",
  other: "Otro",
  undisclosed: "Prefiere no decir",
};

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  diabetes: "Diabetes",
  hypertension: "Hipertensión",
  autoimmune: "Enfermedades autoinmunes",
  thyroid: "Problemas tiroideos",
  herpes: "Herpes simple",
  cancer: "Cáncer",
};

export const ALLERGY_LABELS: Record<AllergyKey, string> = {
  cosmetics: "Cosméticos",
  medication: "Medicamentos",
  food: "Alimentos",
  other: "Otras",
};

export const SKIN_CONDITION_LABELS: Record<SkinConditionKey, string> = {
  dermatitis: "Dermatitis",
  psoriasis: "Psoriasis",
  rosacea: "Rosácea",
  sensitive: "Piel sensible",
  keloids: "Cicatrices queloides",
};

export const SUNSCREEN_LABELS: Record<SunscreenHabit, string> = {
  daily: "Diario",
  sometimes: "Ocasional",
  never: "Nunca",
};

export const EXFOLIANT_LABELS: Record<ExfoliantHabit, string> = {
  frequent: "Frecuente",
  sometimes: "Ocasional",
  never: "Nunca",
};

export const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  normal: "Normal",
  dry: "Seca",
  combination: "Mixta",
  oily: "Grasa",
  sensitive: "Sensible",
};

export const FITZPATRICK: Record<Fitzpatrick, { label: string; swatch: string }> = {
  1: { label: "I", swatch: "#F6E1D3" },
  2: { label: "II", swatch: "#EBC9AE" },
  3: { label: "III", swatch: "#D8A884" },
  4: { label: "IV", swatch: "#B9835B" },
  5: { label: "V", swatch: "#8A5A3A" },
  6: { label: "VI", swatch: "#4E3022" },
};

export const AUTHORIZATION_METHOD_LABELS: Record<AuthorizationMethod, string> = {
  signature: "Firma en el dispositivo",
  online_checkbox: "Aceptación en línea",
};

export const TREATMENT_CATEGORY_LABELS: Record<TreatmentCategory, string> = {
  facial: "Faciales",
  body: "Corporales",
  lashes_brows: "Cejas y pestañas",
  hair_removal: "Depilación",
  other: "Otros",
};

export const FORM_FIELD_TYPE_LABELS: Record<FormFieldType, { label: string; description: string }> = {
  section: { label: "Sección", description: "Un título para agrupar campos" },
  text: { label: "Texto corto", description: "Una línea, como un producto o una marca" },
  longtext: { label: "Texto largo", description: "Varias líneas para notas" },
  number: { label: "Número", description: "Con unidad opcional: %, pH, min, capas" },
  single: { label: "Una opción", description: "Elige una entre varias" },
  multi: { label: "Varias opciones", description: "Elige todas las que apliquen" },
  yesno: { label: "Sí o no", description: "Una pregunta de respuesta rápida" },
  scale: { label: "Escala", description: "Del 1 al 5 o del 1 al 10" },
  date: { label: "Fecha", description: "Un día del calendario" },
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: "Por confirmar",
  scheduled: "Agendada",
  in_progress: "En atención",
  completed: "Atendida",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export const APPOINTMENT_SOURCE_LABELS: Record<AppointmentSource, string> = {
  staff: "Agendada por el equipo",
  online: "Reserva en línea",
};

export const TIME_BLOCK_KIND_LABELS: Record<TimeBlockKind, string> = {
  personal: "Personal",
  professional: "Profesional",
};

export const REASON_LABELS: Record<ReasonKey, string> = {
  acne: "Acné",
  acne_scars: "Secuelas de acné",
  hyperpigmentation: "Hiperpigmentación",
  melasma: "Melasma",
  photoaging: "Fotoenvejecimiento",
  fine_lines: "Arrugas finas",
  enlarged_pores: "Poros dilatados",
  dull_skin: "Piel opaca",
  other: "Otro",
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Abierto",
  closed: "Cerrado",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  draft: "En curso",
  closed: "Cerrada",
  postponed: "Pospuesta",
};

export const OBSERVED_LABELS: Record<ObservedKey, string> = {
  acne: "Acné",
  comedones: "Comedones",
  melasma: "Melasma",
  sun_spots: "Manchas solares",
  scars: "Cicatrices",
  fine_lines: "Arrugas finas",
  sagging: "Flacidez",
  enlarged_pores: "Poros dilatados",
  hyperkeratosis: "Hiperqueratosis",
  other: "Otra",
};

export const GENERAL_CONTRAINDICATION_LABELS: Record<GeneralContraindicationKey, string> = {
  pregnancy: "Embarazo",
  lactation: "Lactancia",
  active_herpes: "Herpes activo",
  skin_infection: "Infección cutánea",
  recent_burns: "Quemaduras recientes",
  isotretinoin: "Uso reciente de isotretinoína",
  open_wounds: "Heridas abiertas",
  product_allergy: "Alergia al producto a usar",
  sun_exposure: "Exposición solar intensa reciente",
};

export const PHOTO_USE_LABELS: Record<PhotoUse, string> = {
  clinical: "Solo para mi historia",
  clinical_and_marketing: "Historia y redes sociales del negocio",
  none: "No autorizo fotos",
};

export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  before: "Antes",
  after: "Después",
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: "Pendiente",
  done: "Hecho",
  dismissed: "Descartado",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  nequi: "Nequi",
  daviplata: "Daviplata",
  breb: "Bre-B",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};

/** Calendar and avatar colors: `soft` is the background, `strong` the text or bar. */
export const STAFF_COLORS: Record<StaffColor, { label: string; soft: string; strong: string }> = {
  plum: { label: "Ciruela", soft: "#EDE3F7", strong: "#5B2A86" },
  teal: { label: "Turquesa", soft: "#DDF0EE", strong: "#1F6B66" },
  coral: { label: "Coral", soft: "#FBE4DC", strong: "#A2452A" },
  olive: { label: "Oliva", soft: "#EAF0DA", strong: "#56661F" },
  blue: { label: "Azul", soft: "#E0E9F8", strong: "#2D548F" },
  rose: { label: "Rosa", soft: "#F8E1EA", strong: "#9B2F5B" },
  sand: { label: "Arena", soft: "#F3EAD8", strong: "#7A5A1F" },
  slate: { label: "Pizarra", soft: "#E5E8EC", strong: "#46505C" },
};

