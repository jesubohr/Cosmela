import { v, type Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

// Enum keys shared by the schema, the functions, and the UI.
// Spanish labels for every key live in `lib/constants.ts`.

export const ORG_KINDS = ["solo", "salon"] as const;
export const ROLES = ["admin", "staff"] as const;
export const STAFF_COLORS = ["plum", "teal", "coral", "olive", "blue", "rose", "sand", "slate"] as const;
export const INVITATION_STATUSES = ["pending", "accepted", "cancelled"] as const;
export const DOCUMENT_TYPES = ["CC", "CE", "TI", "PA", "PPT", "NIT"] as const;
export const SEXES = ["female", "male", "other", "undisclosed"] as const;
export const CONDITIONS = ["diabetes", "hypertension", "autoimmune", "thyroid", "herpes", "cancer"] as const;
export const ALLERGIES = ["cosmetics", "medication", "food", "other"] as const;
export const SKIN_CONDITIONS = ["dermatitis", "psoriasis", "rosacea", "sensitive", "keloids"] as const;
export const SUNSCREEN_HABITS = ["daily", "sometimes", "never"] as const;
export const EXFOLIANT_HABITS = ["frequent", "sometimes", "never"] as const;
export const SKIN_TYPES = ["normal", "dry", "combination", "oily", "sensitive"] as const;
export const FITZPATRICK_TYPES = [1, 2, 3, 4, 5, 6] as const;
export const AUTHORIZATION_METHODS = ["signature", "online_checkbox"] as const;
export const TREATMENT_CATEGORIES = ["facial", "body", "lashes_brows", "hair_removal", "other"] as const;
export const FORM_FIELD_TYPES = ["section", "text", "longtext", "number", "single", "multi", "yesno", "scale", "date"] as const;
export const APPOINTMENT_STATUSES = ["requested", "scheduled", "in_progress", "completed", "cancelled", "no_show"] as const;
export const APPOINTMENT_SOURCES = ["staff", "online"] as const;
export const TIME_BLOCK_KINDS = ["personal", "professional"] as const;
export const REASONS = [
  "acne",
  "acne_scars",
  "hyperpigmentation",
  "melasma",
  "photoaging",
  "fine_lines",
  "enlarged_pores",
  "dull_skin",
  "other",
] as const;
export const CASE_STATUSES = ["open", "closed"] as const;
export const SESSION_STATUSES = ["draft", "closed", "postponed"] as const;
export const OBSERVED_ALTERATIONS = [
  "acne",
  "comedones",
  "melasma",
  "sun_spots",
  "scars",
  "fine_lines",
  "sagging",
  "enlarged_pores",
  "hyperkeratosis",
  "other",
] as const;
export const PHOTO_USES = ["clinical", "clinical_and_marketing", "none"] as const;
export const PHOTO_KINDS = ["before", "after"] as const;
export const FOLLOW_UP_STATUSES = ["pending", "done", "dismissed"] as const;
export const PAYMENT_METHODS = ["cash", "nequi", "daviplata", "breb", "transfer", "card", "other"] as const;
// Sessions store the Spanish labels of marked items (`contraindications.present`);
// keys exist so intake answers can pre-mark items (e.g. pregnancy).
export const GENERAL_CONTRAINDICATIONS = [
  "pregnancy",
  "lactation",
  "active_herpes",
  "skin_infection",
  "recent_burns",
  "isotretinoin",
  "open_wounds",
  "product_allergy",
  "sun_exposure",
] as const;

export const vOrgKind = literals(...ORG_KINDS);
export const vRole = literals(...ROLES);
export const vStaffColor = literals(...STAFF_COLORS);
export const vInvitationStatus = literals(...INVITATION_STATUSES);
export const vDocumentType = literals(...DOCUMENT_TYPES);
export const vSex = literals(...SEXES);
export const vCondition = literals(...CONDITIONS);
export const vAllergy = literals(...ALLERGIES);
export const vSkinCondition = literals(...SKIN_CONDITIONS);
export const vSunscreenHabit = literals(...SUNSCREEN_HABITS);
export const vExfoliantHabit = literals(...EXFOLIANT_HABITS);
export const vSkinType = literals(...SKIN_TYPES);
export const vFitzpatrick = literals(...FITZPATRICK_TYPES);
export const vAuthorizationMethod = literals(...AUTHORIZATION_METHODS);
export const vTreatmentCategory = literals(...TREATMENT_CATEGORIES);
export const vFormFieldType = literals(...FORM_FIELD_TYPES);
export const vAppointmentStatus = literals(...APPOINTMENT_STATUSES);
export const vAppointmentSource = literals(...APPOINTMENT_SOURCES);
export const vTimeBlockKind = literals(...TIME_BLOCK_KINDS);
export const vReason = literals(...REASONS);
export const vCaseStatus = literals(...CASE_STATUSES);
export const vSessionStatus = literals(...SESSION_STATUSES);
export const vObservedAlteration = literals(...OBSERVED_ALTERATIONS);
export const vPhotoUse = literals(...PHOTO_USES);
export const vPhotoKind = literals(...PHOTO_KINDS);
export const vFollowUpStatus = literals(...FOLLOW_UP_STATUSES);
export const vPaymentMethod = literals(...PAYMENT_METHODS);

/** One working range, e.g. `{ day: 1, start: "08:00", end: "12:00" }`. Day 0 is Sunday. */
export const vScheduleRange = v.object({
  day: v.number(),
  start: v.string(),
  end: v.string(),
});

export const vFormField = v.object({
  id: v.string(),
  type: vFormFieldType,
  label: v.string(),
  help: v.optional(v.string()),
  required: v.optional(v.boolean()),
  options: v.optional(v.array(v.string())),
  unit: v.optional(v.string()),
  min: v.optional(v.number()),
  max: v.optional(v.number()),
});

export const vFormAnswer = v.union(v.string(), v.number(), v.boolean(), v.array(v.string()), v.null());
/** Field id → answer. */
export const vFormAnswers = v.record(v.string(), vFormAnswer);

export const vClientHealth = v.object({
  conditions: v.array(vCondition),
  conditionsOther: v.optional(v.string()),
  allergies: v.array(vAllergy),
  allergiesDetail: v.optional(v.string()),
  skinConditions: v.array(vSkinCondition),
  skinConditionsOther: v.optional(v.string()),
  dermNotes: v.optional(v.string()),
  // Explicit "Ninguna" answers, so an empty list is never ambiguous.
  none: v.object({ conditions: v.boolean(), allergies: v.boolean(), skin: v.boolean() }),
});

export const vClientHabits = v.object({
  dailyCleansing: v.optional(v.boolean()),
  sunscreen: v.optional(vSunscreenHabit),
  exfoliants: v.optional(vExfoliantHabit),
  previousTreatments: v.optional(v.string()),
});

export const vClientSkin = v.object({
  type: v.optional(vSkinType),
  fitzpatrick: v.optional(vFitzpatrick),
});

export const vDataAuthorization = v.object({
  at: v.number(),
  signatureKey: v.optional(v.string()),
  method: vAuthorizationMethod,
  /** The accepted policy. Older records carry the full text instead. */
  policyId: v.optional(v.id("policies")),
  policyText: v.optional(v.string()),
});

export const UPLOAD_KINDS = ["photo", "signature", "logo"] as const;
export const vUploadKind = literals(...UPLOAD_KINDS);

export const vBookingSettings = v.object({
  enabled: v.boolean(),
  minNoticeHours: v.number(),
  maxDaysAhead: v.number(),
  slotMinutes: v.number(),
  welcome: v.optional(v.string()),
});

export const vSessionIntake = v.object({
  healthChanged: v.boolean(),
  medications: v.string(),
  pregnant: v.optional(v.boolean()),
  lactating: v.optional(v.boolean()),
  evolution: v.optional(v.string()),
});

export const vSessionAssessment = v.object({
  observed: v.array(vObservedAlteration),
  observedOther: v.optional(v.string()),
  skinType: v.optional(vSkinType),
  notes: v.optional(v.string()),
});

export const vSessionContraindications = v.object({
  present: v.array(v.string()),
  proceed: v.boolean(),
  justification: v.optional(v.string()),
});

export const vGuardian = v.object({ name: v.string(), document: v.string(), relationship: v.string() });

export const vSessionConsent = v.object({
  text: v.string(),
  photoUse: vPhotoUse,
  clientSignatureKey: v.string(),
  professionalSignatureKey: v.optional(v.string()),
  signedAt: v.number(),
  userAgent: v.string(),
  /** SHA-256 (hex) of the signed evidence (see `consentHash`); shown as "Código de verificación". */
  hash: v.string(),
  /** 2: the hash also covers `photoUse`. Older consents have no version. */
  hashVersion: v.optional(v.number()),
  /** The rendered `{documento}`, e.g. "cédula de ciudadanía 1.020.304.050". */
  documentText: v.string(),
  /** Clients under 18: the guardian signs instead of the client. */
  guardian: v.optional(vGuardian),
});

export const vSessionProcedure = v.object({
  fields: v.array(vFormField),
  answers: vFormAnswers,
  notes: v.optional(v.string()),
});

export const vSessionPhoto = v.object({ key: v.string(), kind: vPhotoKind, at: v.number() });

export const vSessionAftercare = v.object({
  items: v.array(v.string()),
  notes: v.optional(v.string()),
});

export const vSessionFollowUp = v.object({
  recommended: v.boolean(),
  inDays: v.optional(v.number()),
  note: v.optional(v.string()),
});

export type OrgKind = Infer<typeof vOrgKind>;
export type Role = Infer<typeof vRole>;
export type StaffColor = Infer<typeof vStaffColor>;
export type InvitationStatus = Infer<typeof vInvitationStatus>;
export type DocumentType = Infer<typeof vDocumentType>;
export type Sex = Infer<typeof vSex>;
export type ConditionKey = Infer<typeof vCondition>;
export type AllergyKey = Infer<typeof vAllergy>;
export type SkinConditionKey = Infer<typeof vSkinCondition>;
export type SunscreenHabit = Infer<typeof vSunscreenHabit>;
export type ExfoliantHabit = Infer<typeof vExfoliantHabit>;
export type SkinType = Infer<typeof vSkinType>;
export type Fitzpatrick = Infer<typeof vFitzpatrick>;
export type AuthorizationMethod = Infer<typeof vAuthorizationMethod>;
export type TreatmentCategory = Infer<typeof vTreatmentCategory>;
export type FormFieldType = Infer<typeof vFormFieldType>;
export type AppointmentStatus = Infer<typeof vAppointmentStatus>;
export type AppointmentSource = Infer<typeof vAppointmentSource>;
export type TimeBlockKind = Infer<typeof vTimeBlockKind>;
export type ReasonKey = Infer<typeof vReason>;
export type CaseStatus = Infer<typeof vCaseStatus>;
export type SessionStatus = Infer<typeof vSessionStatus>;
export type ObservedKey = Infer<typeof vObservedAlteration>;
export type PhotoUse = Infer<typeof vPhotoUse>;
export type PhotoKind = Infer<typeof vPhotoKind>;
export type FollowUpStatus = Infer<typeof vFollowUpStatus>;
export type PaymentMethod = Infer<typeof vPaymentMethod>;
export type UploadKind = Infer<typeof vUploadKind>;
export type GeneralContraindicationKey = (typeof GENERAL_CONTRAINDICATIONS)[number];
export type ScheduleRange = Infer<typeof vScheduleRange>;
export type FormField = Infer<typeof vFormField>;
export type FormAnswer = Infer<typeof vFormAnswer>;
export type FormAnswers = Infer<typeof vFormAnswers>;
export type ClientHealth = Infer<typeof vClientHealth>;
export type Guardian = Infer<typeof vGuardian>;
export type SessionConsent = Infer<typeof vSessionConsent>;
