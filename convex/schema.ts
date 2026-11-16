import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vAppointmentSource,
  vAppointmentStatus,
  vBookingSettings,
  vCaseStatus,
  vClientHabits,
  vClientHealth,
  vClientSkin,
  vDataAuthorization,
  vDocumentType,
  vFollowUpStatus,
  vFormField,
  vInvitationStatus,
  vOrgKind,
  vPaymentMethod,
  vReason,
  vRole,
  vScheduleRange,
  vSessionAftercare,
  vSessionAssessment,
  vSessionConsent,
  vSessionContraindications,
  vSessionFollowUp,
  vSessionIntake,
  vSessionPhoto,
  vSessionProcedure,
  vSessionStatus,
  vSex,
  vStaffColor,
  vTimeBlockKind,
  vTreatmentCategory,
  vUploadKind,
} from "./lib/validators";

// Times are epoch ms (UTC). Calendar-only dates are "YYYY-MM-DD" in Bogotá time.
// Money is integer COP. User ids are Better Auth user ids (`identity.subject`).
export default defineSchema({
  orgs: defineTable({
    name: v.string(),
    slug: v.string(),
    kind: vOrgKind,
    ownerId: v.string(),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    logoKey: v.optional(v.string()),
    legalName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    privacyPolicy: v.optional(v.string()),
    booking: vBookingSettings,
    reminders: v.object({ email: v.boolean() }),
    checklistDismissedAt: v.optional(v.number()),
    // "Primeros pasos" items that leave no other trace in the data.
    consentReviewedAt: v.optional(v.number()),
    bookingSharedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  members: defineTable({
    orgId: v.id("orgs"),
    userId: v.string(),
    email: v.string(),
    role: vRole,
    name: v.string(),
    title: v.optional(v.string()),
    color: vStaffColor,
    signatureKey: v.optional(v.string()),
    schedule: v.array(vScheduleRange),
    bookable: v.boolean(),
    active: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"]),

  invitations: defineTable({
    orgId: v.id("orgs"),
    email: v.string(),
    role: vRole,
    token: v.string(),
    invitedBy: v.id("members"),
    status: vInvitationStatus,
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_org", ["orgId"])
    .index("by_email", ["email"]),

  userSettings: defineTable({
    userId: v.string(),
    activeOrgId: v.id("orgs"),
  }).index("by_user", ["userId"]),

  clients: defineTable({
    orgId: v.id("orgs"),
    firstName: v.string(),
    lastName: v.string(),
    // Lowercased, accent-stripped "first last phone document"; see `searchText()` in convex/lib/text.ts.
    searchText: v.string(),
    documentType: v.optional(vDocumentType),
    documentNumber: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    birthdayKey: v.optional(v.string()),
    sex: v.optional(vSex),
    phone: v.string(),
    email: v.optional(v.string()),
    occupation: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContact: v.optional(v.object({ name: v.string(), phone: v.string() })),
    health: vClientHealth,
    habits: vClientHabits,
    skin: vClientSkin,
    lastMedications: v.optional(v.string()),
    lastPregnancy: v.optional(v.object({ pregnant: v.boolean(), lactating: v.boolean(), at: v.number() })),
    fichaCompletedAt: v.optional(v.number()),
    healthReviewedAt: v.optional(v.number()),
    dataAuthorization: v.optional(vDataAuthorization),
    notes: v.optional(v.string()),
    // Set when a session closes; shown as "última visita" in the list.
    lastVisitAt: v.optional(v.number()),
    createdBy: v.id("members"),
    isArchived: v.boolean(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    // A–Z list of active clients (searchText starts with the first name).
    .index("by_org_archived_name", ["orgId", "isArchived", "searchText"])
    .index("by_org_phone", ["orgId", "phone"])
    .index("by_org_birthday", ["orgId", "birthdayKey"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["orgId", "isArchived"],
    }),

  treatments: defineTable({
    orgId: v.id("orgs"),
    name: v.string(),
    category: vTreatmentCategory,
    description: v.optional(v.string()),
    durationMin: v.number(),
    price: v.number(),
    color: vStaffColor,
    active: v.boolean(),
    bookableOnline: v.boolean(),
    templateKey: v.optional(v.string()),
    // Placeholders: {cliente} {documento} {tratamiento} {negocio} {fecha}
    consentText: v.string(),
    contraindications: v.array(v.string()),
    aftercare: v.array(v.string()),
    followUpDays: v.optional(v.number()),
    suggestedSessions: v.optional(v.number()),
    formFields: v.array(vFormField),
  })
    .index("by_org", ["orgId"])
    .index("by_org_active", ["orgId", "active"]),

  appointments: defineTable({
    orgId: v.id("orgs"),
    clientId: v.id("clients"),
    memberId: v.id("members"),
    treatmentId: v.id("treatments"),
    start: v.number(),
    end: v.number(),
    status: vAppointmentStatus,
    source: vAppointmentSource,
    price: v.number(),
    // Maintained by payment mutations.
    paidTotal: v.number(),
    // Completed and `price > paidTotal`; kept in step by `syncBalance` (convex/payments.ts).
    hasBalance: v.optional(v.boolean()),
    // Email typed in an online request for an existing client. Used for this
    // appointment's emails only when the client has no email of their own.
    contactEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
    sessionId: v.optional(v.id("sessions")),
    cancelReason: v.optional(v.string()),
    reminderJobId: v.optional(v.id("_scheduled_functions")),
    reminderSentAt: v.optional(v.number()),
    createdBy: v.optional(v.id("members")),
  })
    .index("by_org_start", ["orgId", "start"])
    .index("by_member_start", ["memberId", "start"])
    .index("by_client", ["clientId", "start"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_balance", ["orgId", "hasBalance"])
    // A treatment with appointments cannot be deleted, only deactivated.
    .index("by_treatment", ["treatmentId"]),

  timeBlocks: defineTable({
    orgId: v.id("orgs"),
    memberId: v.id("members"),
    start: v.number(),
    end: v.number(),
    allDay: v.boolean(),
    kind: vTimeBlockKind,
    title: v.optional(v.string()),
  })
    .index("by_org_start", ["orgId", "start"])
    .index("by_member_start", ["memberId", "start"]),

  cases: defineTable({
    orgId: v.id("orgs"),
    clientId: v.id("clients"),
    treatmentId: v.id("treatments"),
    reasons: v.array(vReason),
    reasonOther: v.optional(v.string()),
    plannedSessions: v.optional(v.number()),
    status: vCaseStatus,
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
    summary: v.optional(v.string()),
    sessionCount: v.number(),
    lastSessionAt: v.optional(v.number()),
    // Professionals with a closed or postponed session in the case (Casos filter).
    memberIds: v.optional(v.array(v.id("members"))),
  })
    .index("by_org_status", ["orgId", "status"])
    .index("by_client", ["clientId"]),

  sessions: defineTable({
    orgId: v.id("orgs"),
    caseId: v.id("cases"),
    clientId: v.id("clients"),
    appointmentId: v.id("appointments"),
    memberId: v.id("members"),
    treatmentId: v.id("treatments"),
    // 1-based within the case, assigned at close. Drafts and postponed sessions have none.
    number: v.optional(v.number()),
    status: vSessionStatus,
    // Why a session ended as postponed (contraindication, or not performed).
    reason: v.optional(v.string()),
    // Last completed step, for resume.
    step: v.number(),
    startedAt: v.number(),
    closedAt: v.optional(v.number()),
    intake: v.optional(vSessionIntake),
    assessment: v.optional(vSessionAssessment),
    contraindications: v.optional(vSessionContraindications),
    consent: v.optional(vSessionConsent),
    procedure: v.optional(vSessionProcedure),
    photos: v.array(vSessionPhoto),
    aftercare: v.optional(vSessionAftercare),
    followUp: v.optional(vSessionFollowUp),
    addenda: v.array(v.object({ at: v.number(), memberId: v.id("members"), text: v.string() })),
  })
    .index("by_case", ["caseId"])
    .index("by_client", ["clientId"])
    .index("by_appointment", ["appointmentId"])
    .index("by_org_status", ["orgId", "status"]),

  followUps: defineTable({
    orgId: v.id("orgs"),
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    sessionId: v.optional(v.id("sessions")),
    memberId: v.id("members"),
    dueDate: v.string(),
    note: v.optional(v.string()),
    status: vFollowUpStatus,
    outcome: v.optional(v.string()),
    doneAt: v.optional(v.number()),
  })
    .index("by_org_status_due", ["orgId", "status", "dueDate"])
    .index("by_client", ["clientId"]),

  payments: defineTable({
    orgId: v.id("orgs"),
    appointmentId: v.id("appointments"),
    clientId: v.id("clients"),
    amount: v.number(),
    method: vPaymentMethod,
    paidAt: v.number(),
    note: v.optional(v.string()),
    recordedBy: v.id("members"),
  })
    .index("by_org_paidAt", ["orgId", "paidAt"])
    .index("by_appointment", ["appointmentId"])
    .index("by_client", ["clientId"]),

  // Every R2 key handed out by `files.generateUploadUrl`. A key is stored on a record
  // only while unattached, and deleted only by the record that owns it.
  uploads: defineTable({
    orgId: v.id("orgs"),
    key: v.string(),
    kind: vUploadKind,
    uploadedBy: v.id("members"),
    // "session:<id>", "consent:<sessionId>", "member:<id>", or "org".
    attachedTo: v.optional(v.string()),
  })
    .index("by_key", ["key"])
    .index("by_attached", ["attachedTo"]),

  // Privacy policy texts that clients accepted, stored once per distinct text.
  policies: defineTable({
    orgId: v.id("orgs"),
    hash: v.string(),
    text: v.string(),
  }).index("by_org_hash", ["orgId", "hash"]),
});
