import { v } from "convex/values";
import { formatNumber, isEmptyAnswer, validateAnswers } from "../components/forms/validate-answers";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { claimUpload, deleteOwnedFiles, owners } from "./files";
import { fail, getOwned, memberMutation, memberQuery } from "./lib/authz";
import { CONSENT_HASH_VERSION, consentHash, isMinor, renderConsentText, renderDocument } from "./lib/consent";
import { clientSearchText } from "./lib/text";
import { addDaysToDateKey, bogotaDateKey } from "./lib/time";
import {
  vDocumentType,
  vFormAnswers,
  vGuardian,
  vPaymentMethod,
  vPhotoUse,
  vReason,
  vSessionAftercare,
  vSessionAssessment,
  vSessionFollowUp,
  type FormAnswer,
  type FormField,
} from "./lib/validators";
import { currentPolicyId, privacyPolicyText } from "./orgs";
import { addPayment, syncBalance } from "./payments";
import { invalid } from "./treatments";

type OrgCtx = QueryCtx & { orgId: Id<"orgs"> };
type MemberCtx = MutationCtx & { orgId: Id<"orgs">; member: Doc<"members"> };

/** Steps of the attention flow; `session.step` is the last one completed. */
export const STEPS = { ficha: 1, assessment: 2, contraindications: 3, consent: 4, procedure: 5, closing: 6 } as const;

export const POSTPONED_REASON = "Pospuesta por contraindicación";
export const NOT_PERFORMED_REASON = "Atención no realizada";

// Same labels as GENERAL_CONTRAINDICATION_LABELS in lib/constants.ts.
const PREGNANCY = "Embarazo";
const LACTATION = "Lactancia";

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function fullName(client: Pick<Doc<"clients">, "firstName" | "lastName">) {
  return `${client.firstName} ${client.lastName}`.trim();
}

async function sessionOf(ctx: OrgCtx, appointmentId: Id<"appointments">) {
  return await ctx.db
    .query("sessions")
    .withIndex("by_appointment", (q) => q.eq("appointmentId", appointmentId))
    .first();
}

/** A session of the caller's org that can still change. */
async function getDraft(ctx: OrgCtx, sessionId: Id<"sessions">) {
  const session = await getOwned(ctx, "sessions", sessionId);
  if (session.status !== "draft") invalid("Esta atención ya está cerrada. Agrega una nota adicional si necesitas corregir algo.");
  return session;
}

function completed(session: Doc<"sessions">, step: number) {
  return Math.max(session.step, step);
}

/** Open cases of a client for one treatment, most recent first. */
async function openCases(ctx: OrgCtx, clientId: Id<"clients">, treatmentId: Id<"treatments">) {
  const cases = await ctx.db
    .query("cases")
    .withIndex("by_client", (q) => q.eq("clientId", clientId))
    .collect();
  return cases
    .filter((c) => c.orgId === ctx.orgId && c.status === "open" && c.treatmentId === treatmentId)
    .sort((a, b) => (b.lastSessionAt ?? b.openedAt) - (a.lastSessionAt ?? a.openedAt));
}

async function insertCase(ctx: MemberCtx, clientId: Id<"clients">, treatmentId: Id<"treatments">) {
  const treatment = await ctx.db.get(treatmentId);
  const caseId = await ctx.db.insert("cases", {
    orgId: ctx.orgId,
    clientId,
    treatmentId,
    reasons: [],
    plannedSessions: treatment?.suggestedSessions,
    status: "open",
    openedAt: Date.now(),
    sessionCount: 0,
  });
  return (await ctx.db.get(caseId))!;
}

async function sessionsOfCase(ctx: OrgCtx, caseId: Id<"cases">) {
  return await ctx.db
    .query("sessions")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .collect();
}

/** True when anything besides the given session and appointment points at the case, so it must stay. */
async function caseIsReferenced(
  ctx: OrgCtx,
  caseDoc: Doc<"cases">,
  except: { sessionId: Id<"sessions">; appointmentId: Id<"appointments"> },
) {
  if (caseDoc.sessionCount > 0) return true;
  const [sessions, appointments, followUps] = await Promise.all([
    sessionsOfCase(ctx, caseDoc._id),
    ctx.db.query("appointments").withIndex("by_client", (q) => q.eq("clientId", caseDoc.clientId)).collect(),
    ctx.db.query("followUps").withIndex("by_client", (q) => q.eq("clientId", caseDoc.clientId)).collect(),
  ]);
  return (
    sessions.some((s) => s._id !== except.sessionId) ||
    appointments.some((a) => a.caseId === caseDoc._id && a._id !== except.appointmentId) ||
    followUps.some((f) => f.caseId === caseDoc._id)
  );
}

function withMember(caseDoc: Doc<"cases">, memberId: Id<"members">) {
  const memberIds = caseDoc.memberIds ?? [];
  return memberIds.includes(memberId) ? memberIds : [...memberIds, memberId];
}

/**
 * Case suggestion: the case the appointment was booked for (same client and treatment,
 * still open), else the client's open case for the same treatment, else a new case.
 */
async function suggestCase(ctx: MemberCtx, appointment: Doc<"appointments">) {
  if (appointment.caseId) {
    const linked = await ctx.db.get(appointment.caseId);
    if (
      linked &&
      linked.orgId === ctx.orgId &&
      linked.status === "open" &&
      linked.clientId === appointment.clientId &&
      linked.treatmentId === appointment.treatmentId
    ) {
      return linked;
    }
  }
  const [open] = await openCases(ctx, appointment.clientId, appointment.treatmentId);
  return open ?? (await insertCase(ctx, appointment.clientId, appointment.treatmentId));
}

/** Creates the draft session for an appointment, or returns the one it already has. */
export const start = memberMutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    const existing = await sessionOf(ctx, appointmentId);
    if (existing) return existing._id;
    if (appointment.status === "requested") invalid("Confirma esta solicitud antes de iniciar la atención.");
    if (appointment.status !== "scheduled" && appointment.status !== "in_progress") {
      invalid("Esta cita ya no admite una atención. Revisa su estado en la agenda.");
    }
    const client = await getOwned(ctx, "clients", appointment.clientId);
    if (client.isArchived) invalid("Este cliente está archivado. Restáuralo para atenderlo.");

    const caseDoc = await suggestCase(ctx, appointment);
    const sessionId = await ctx.db.insert("sessions", {
      orgId: ctx.orgId,
      caseId: caseDoc._id,
      clientId: appointment.clientId,
      appointmentId,
      memberId: appointment.memberId,
      treatmentId: appointment.treatmentId,
      status: "draft",
      step: 0,
      startedAt: Date.now(),
      photos: [],
      addenda: [],
    });
    await ctx.db.patch(appointmentId, { status: "in_progress", sessionId, caseId: caseDoc._id });
    return sessionId;
  },
});

/**
 * "Descartar atención". Before the consent: deletes the draft (and its photos, and a
 * case that only it used) and the appointment goes back to scheduled. After the consent:
 * keeps the signed record as a postponed session ("Atención no realizada") and cancels
 * the appointment with that reason.
 */
export const discard = memberMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await getDraft(ctx, sessionId);
    const appointment = await getOwned(ctx, "appointments", session.appointmentId);

    if (session.consent) {
      await ctx.db.patch(sessionId, { status: "postponed", closedAt: Date.now(), reason: NOT_PERFORMED_REASON });
      const caseDoc = await ctx.db.get(session.caseId);
      if (caseDoc) await ctx.db.patch(caseDoc._id, { memberIds: withMember(caseDoc, session.memberId) });
      await ctx.db.patch(appointment._id, { status: "cancelled", cancelReason: NOT_PERFORMED_REASON });
      await ctx.runMutation(internal.notifications.cancelReminder, { appointmentId: appointment._id });
      return;
    }

    await deleteOwnedFiles(ctx, owners.session(sessionId), session.photos.map((p) => p.key));
    await ctx.db.delete(sessionId);
    const caseDoc = await ctx.db.get(session.caseId);
    const keepCase = caseDoc ? await caseIsReferenced(ctx, caseDoc, { sessionId, appointmentId: appointment._id }) : false;
    if (caseDoc && !keepCase) await ctx.db.delete(caseDoc._id);
    await ctx.db.patch(appointment._id, { status: "scheduled", sessionId: undefined, caseId: keepCase ? appointment.caseId : undefined });
    if (!appointment.reminderSentAt) await ctx.runMutation(internal.notifications.scheduleReminder, { appointmentId: appointment._id });
  },
});

/** Everything the attention flow needs for one appointment. `session` is null until `start`. */
export const attention = memberQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const appointment = await getOwned(ctx, "appointments", appointmentId);
    const session = await sessionOf(ctx, appointmentId);
    const [client, treatment, member, org, payments, clientSessions] = await Promise.all([
      ctx.db.get(appointment.clientId),
      ctx.db.get(appointment.treatmentId),
      // The professional responsible for the session: whoever signed the consent, else the appointment's.
      ctx.db.get(session?.memberId ?? appointment.memberId),
      ctx.db.get(ctx.orgId),
      ctx.db.query("payments").withIndex("by_appointment", (q) => q.eq("appointmentId", appointmentId)).collect(),
      ctx.db.query("sessions").withIndex("by_client", (q) => q.eq("clientId", appointment.clientId)).collect(),
    ]);
    if (!client || !treatment || !member || !org) fail("NOT_FOUND");

    const caseDoc = session ? await ctx.db.get(session.caseId) : null;
    const cases = await openCases(ctx, client._id, treatment._id);
    const future = session
      ? (await ctx.db.query("appointments").withIndex("by_client", (q) => q.eq("clientId", client._id).gt("start", Date.now())).collect())
          .filter((a) => a.caseId === session.caseId && a._id !== appointmentId && (a.status === "scheduled" || a.status === "requested"))
          .sort((a, b) => a.start - b.start)[0]
      : undefined;

    return {
      appointment: {
        _id: appointment._id,
        status: appointment.status,
        start: appointment.start,
        price: appointment.price,
        paidTotal: appointment.paidTotal,
        memberId: appointment.memberId,
        cancelReason: appointment.cancelReason,
        contactEmail: appointment.contactEmail,
      },
      session,
      client,
      // The first visit is the first attention that closes, whatever the ficha holds.
      firstVisit: !clientSessions.some((s) => s.status === "closed" && s._id !== session?._id),
      treatment: {
        _id: treatment._id,
        name: treatment.name,
        consentText: treatment.consentText,
        contraindications: treatment.contraindications,
        aftercare: treatment.aftercare,
        followUpDays: treatment.followUpDays,
        suggestedSessions: treatment.suggestedSessions,
        formFields: treatment.formFields,
      },
      member: { _id: member._id, name: member.name },
      // The member running the attention signs the consent as the professional.
      signer: { _id: ctx.member._id, name: ctx.member.name, signatureKey: ctx.member.signatureKey },
      org: { name: org.name, kind: org.kind, privacyPolicy: await privacyPolicyText(ctx, ctx.orgId) },
      case: caseDoc,
      openCases: cases.map((c) => ({
        _id: c._id,
        reasons: c.reasons,
        reasonOther: c.reasonOther,
        plannedSessions: c.plannedSessions,
        sessionCount: c.sessionCount,
        lastSessionAt: c.lastSessionAt,
        openedAt: c.openedAt,
      })),
      payments: payments.sort((a, b) => a.paidAt - b.paidAt).map((p) => ({ _id: p._id, amount: p.amount, method: p.method, paidAt: p.paidAt })),
      nextAppointment: future ? { _id: future._id, start: future.start } : null,
    };
  },
});

/** Paso 1: per-visit health answers. The permanent ficha is saved with `clients.update`. */
export const saveIntake = memberMutation({
  args: {
    sessionId: v.id("sessions"),
    healthChanged: v.boolean(),
    medications: v.string(),
    pregnant: v.optional(v.boolean()),
    lactating: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionId, ...intake }) => {
    const session = await getDraft(ctx, sessionId);
    if (session.consent) invalid("El consentimiento ya está firmado. Las respuestas de salud de hoy no se pueden cambiar.");
    const client = await getOwned(ctx, "clients", session.clientId);
    const asked = client.sex !== "male";
    if (asked && (intake.pregnant === undefined || intake.lactating === undefined)) {
      invalid("Responde si hay embarazo o lactancia.");
    }
    await ctx.db.patch(sessionId, {
      intake: {
        healthChanged: intake.healthChanged,
        medications: intake.medications.trim(),
        pregnant: asked ? intake.pregnant : undefined,
        lactating: asked ? intake.lactating : undefined,
        evolution: session.intake?.evolution,
      },
      step: completed(session, STEPS.ficha),
    });
  },
});

/** Moves a draft session to another open case of the client, or to a new one. */
async function moveToCase(ctx: MemberCtx, session: Doc<"sessions">, target: Id<"cases"> | "new") {
  const current = (await ctx.db.get(session.caseId))!;
  const others = (await sessionsOfCase(ctx, current._id)).filter((s) => s._id !== session._id);

  let next: Doc<"cases">;
  if (target === "new") {
    // A case that only holds this session is already the new case.
    if (others.length === 0 && current.sessionCount === 0) return current;
    next = await insertCase(ctx, session.clientId, session.treatmentId);
  } else {
    if (target === current._id) return current;
    next = await getOwned(ctx, "cases", target);
    if (next.status !== "open" || next.clientId !== session.clientId || next.treatmentId !== session.treatmentId) {
      invalid("Ese caso no corresponde a este cliente y tratamiento.");
    }
  }
  await ctx.db.patch(session._id, { caseId: next._id });
  await ctx.db.patch(session.appointmentId, { caseId: next._id });
  if (!(await caseIsReferenced(ctx, current, { sessionId: session._id, appointmentId: session.appointmentId }))) {
    await ctx.db.delete(current._id);
  }
  return next;
}

/** Paso 2: case choice and motivo, what the professional sees today, evolution, (photos attach separately). */
export const saveAssessment = memberMutation({
  args: {
    sessionId: v.id("sessions"),
    caseId: v.union(v.id("cases"), v.literal("new")),
    reasons: v.array(vReason),
    reasonOther: v.optional(v.string()),
    plannedSessions: v.optional(v.number()),
    assessment: vSessionAssessment,
    evolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await getDraft(ctx, args.sessionId);
    const { plannedSessions } = args;
    if (plannedSessions !== undefined && (!Number.isInteger(plannedSessions) || plannedSessions < 1 || plannedSessions > 50)) {
      invalid("Escribe un número de sesiones entre 1 y 50.");
    }
    const caseDoc = await moveToCase(ctx, session, args.caseId);
    await ctx.db.patch(caseDoc._id, {
      reasons: args.reasons,
      reasonOther: args.reasons.includes("other") ? clean(args.reasonOther) : undefined,
      plannedSessions,
    });
    const moved = (await ctx.db.get(session._id))!;
    await ctx.db.patch(session._id, {
      assessment: {
        observed: args.assessment.observed,
        observedOther: args.assessment.observed.includes("other") ? clean(args.assessment.observedOther) : undefined,
        skinType: args.assessment.skinType,
        notes: clean(args.assessment.notes),
      },
      // Evolution only applies when the case already has sessions.
      intake: moved.intake && { ...moved.intake, evolution: caseDoc.sessionCount > 0 ? clean(args.evolution) : undefined },
      step: completed(moved, STEPS.assessment),
    });
  },
});

/** Paso 3: nothing applies, or the professional continues under her judgment with a justification. */
export const saveContraindications = memberMutation({
  args: { sessionId: v.id("sessions"), present: v.array(v.string()), justification: v.optional(v.string()) },
  handler: async (ctx, { sessionId, present, justification }) => {
    const session = await getDraft(ctx, sessionId);
    if (session.consent) invalid("El consentimiento ya está firmado. Las contraindicaciones no se pueden cambiar.");
    // Today's answers mark these; the only way past them is "Continuar bajo mi criterio".
    if (session.intake?.pregnant && !present.includes(PREGNANCY)) {
      invalid("Hoy respondió que hay embarazo. Márcalo, y pospón el tratamiento o continúa bajo tu criterio.");
    }
    if (session.intake?.lactating && !present.includes(LACTATION)) {
      invalid("Hoy respondió que hay lactancia. Márcala, y pospón el tratamiento o continúa bajo tu criterio.");
    }
    const reason = clean(justification);
    if (present.length > 0 && !reason) invalid("Escribe por qué continúas a pesar de las contraindicaciones.");
    await ctx.db.patch(sessionId, {
      contraindications: { present, proceed: true, justification: present.length > 0 ? reason : undefined },
      step: completed(session, STEPS.contraindications),
    });
  },
});

/** Today's answers become the client's latest medications and pregnancy status (alert chips). */
function intakeOnClient({ intake }: Doc<"sessions">, now: number) {
  if (!intake) return {};
  return {
    lastMedications: intake.medications || undefined,
    healthReviewedAt: now,
    ...(intake.pregnant !== undefined && {
      lastPregnancy: { pregnant: intake.pregnant, lactating: intake.lactating ?? false, at: now },
    }),
  };
}

/** "Posponer tratamiento": keeps the session as postponed and cancels the appointment. */
export const postpone = memberMutation({
  args: { sessionId: v.id("sessions"), present: v.array(v.string()) },
  handler: async (ctx, { sessionId, present }) => {
    const session = await getDraft(ctx, sessionId);
    if (session.consent) invalid("El consentimiento ya está firmado. Esta atención no se puede posponer.");
    if (present.length === 0) invalid("Marca la contraindicación que impide el tratamiento.");
    const now = Date.now();
    await ctx.db.patch(sessionId, {
      status: "postponed",
      reason: POSTPONED_REASON,
      closedAt: now,
      contraindications: { present, proceed: false },
      step: completed(session, STEPS.contraindications),
    });
    const caseDoc = await ctx.db.get(session.caseId);
    if (caseDoc) await ctx.db.patch(caseDoc._id, { memberIds: withMember(caseDoc, session.memberId) });
    await ctx.db.patch(session.clientId, intakeOnClient(session, now));
    await ctx.db.patch(session.appointmentId, { status: "cancelled", cancelReason: POSTPONED_REASON });
    await ctx.runMutation(internal.notifications.cancelReminder, { appointmentId: session.appointmentId });
  },
});

/**
 * Paso 4: stores the immutable consent snapshot. The server renders the text, so the
 * stored text is exactly what the treatment and client data said at signing time.
 * The member who signs as the professional becomes the session's professional.
 * First visit: also stores the Habeas Data authorization signed with the same signature.
 */
export const signConsent = memberMutation({
  args: {
    sessionId: v.id("sessions"),
    photoUse: vPhotoUse,
    clientSignatureKey: v.string(),
    /** Drawn now; omitted to use the caller's saved signature. */
    professionalSignatureKey: v.optional(v.string()),
    userAgent: v.string(),
    /** Document typed in the consent step when the ficha had none. */
    document: v.optional(v.object({ type: v.optional(vDocumentType), number: v.string() })),
    guardian: v.optional(vGuardian),
    /** The client accepted the data processing policy (required when not authorized yet). */
    authorizeData: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await getDraft(ctx, args.sessionId);
    if (session.consent) invalid("Este consentimiento ya está firmado.");
    if (!session.contraindications?.proceed) invalid("Primero revisa las contraindicaciones.");

    const [client, treatment, org] = await Promise.all([
      getOwned(ctx, "clients", session.clientId),
      getOwned(ctx, "treatments", session.treatmentId),
      ctx.db.get(ctx.orgId),
    ]);
    const now = Date.now();

    let guardian;
    if (isMinor(client.birthDate, now)) {
      const name = clean(args.guardian?.name);
      const document = clean(args.guardian?.document);
      const relationship = clean(args.guardian?.relationship);
      if (!name || !document || !relationship) invalid("Escribe el nombre, el documento y el parentesco del acudiente.");
      guardian = { name, document, relationship };
    }

    const professionalSignatureKey = args.professionalSignatureKey ?? ctx.member.signatureKey;
    if (!professionalSignatureKey) invalid("Falta la firma del profesional.");
    await claimUpload(ctx, args.clientSignatureKey, "signature", owners.consent(session._id));
    if (args.professionalSignatureKey && args.professionalSignatureKey !== ctx.member.signatureKey) {
      await claimUpload(ctx, args.professionalSignatureKey, "signature", owners.consent(session._id));
    }

    const typed = clean(args.document?.number);
    if (typed && !client.documentNumber) {
      await ctx.db.patch(client._id, {
        documentType: args.document?.type,
        documentNumber: typed,
        searchText: clientSearchText({ ...client, documentNumber: typed }),
      });
    }
    const documentText = renderDocument(client.documentNumber ? client.documentType : args.document?.type, client.documentNumber ?? typed);

    if (!client.dataAuthorization) {
      if (!args.authorizeData) invalid("Falta la autorización de tratamiento de datos.");
      await ctx.db.patch(client._id, {
        dataAuthorization: {
          at: now,
          signatureKey: args.clientSignatureKey,
          method: "signature",
          policyId: await currentPolicyId(ctx, ctx.orgId),
        },
      });
    }

    const text = renderConsentText(treatment.consentText, {
      clientName: fullName(client),
      documentText,
      treatmentName: treatment.name,
      orgName: org?.name ?? "",
      at: now,
    });
    const evidence = { text, clientSignatureKey: args.clientSignatureKey, professionalSignatureKey, signedAt: now, guardian };

    // "No autorizo fotos": photos taken before signing are removed.
    if (args.photoUse === "none") {
      await deleteOwnedFiles(ctx, owners.session(session._id), session.photos.map((p) => p.key));
    }
    await ctx.db.patch(session._id, {
      memberId: ctx.member._id,
      consent: {
        ...evidence,
        photoUse: args.photoUse,
        userAgent: args.userAgent.slice(0, 500),
        documentText,
        hash: await consentHash({ ...evidence, photoUse: args.photoUse }),
        hashVersion: CONSENT_HASH_VERSION,
      },
      photos: args.photoUse === "none" ? [] : session.photos,
      step: completed(session, STEPS.consent),
    });
  },
});

function requireConsent(session: Doc<"sessions">) {
  if (!session.consent) invalid("Primero firma el consentimiento informado.");
}

/** Paso 5: procedure answers and notes. The form definition is snapshotted with the answers. */
export const saveProcedure = memberMutation({
  args: { sessionId: v.id("sessions"), answers: vFormAnswers, notes: v.optional(v.string()) },
  handler: async (ctx, { sessionId, answers, notes }) => {
    const session = await getDraft(ctx, sessionId);
    requireConsent(session);
    const fields = session.procedure?.fields ?? (await getOwned(ctx, "treatments", session.treatmentId)).formFields;
    await ctx.db.patch(sessionId, {
      procedure: { fields, answers, notes: clean(notes) },
      step: completed(session, STEPS.procedure),
    });
  },
});

/** Removes a photo from a draft session (and from storage). */
export const deletePhoto = memberMutation({
  args: { sessionId: v.id("sessions"), key: v.string() },
  handler: async (ctx, { sessionId, key }) => {
    const session = await getDraft(ctx, sessionId);
    if (!session.photos.some((p) => p.key === key)) fail("NOT_FOUND");
    await ctx.db.patch(sessionId, { photos: session.photos.filter((p) => p.key !== key) });
    await deleteOwnedFiles(ctx, owners.session(sessionId), [key]);
  },
});

function cleanAftercare(aftercare: { items: string[]; notes?: string }) {
  return { items: aftercare.items.map((item) => item.trim()).filter(Boolean), notes: clean(aftercare.notes) };
}

function cleanFollowUp(followUp: { recommended: boolean; inDays?: number; note?: string }) {
  if (!followUp.recommended) return { recommended: false };
  const { inDays } = followUp;
  if (inDays === undefined || !Number.isInteger(inDays) || inDays < 1 || inDays > 365) {
    invalid("Escribe en cuántos días recomiendas el seguimiento (entre 1 y 365).");
  }
  return { recommended: true, inDays, note: clean(followUp.note) };
}

/** Paso 6 draft (closing the stepper with the X keeps what was typed). */
export const saveClosing = memberMutation({
  args: { sessionId: v.id("sessions"), aftercare: vSessionAftercare, followUp: vSessionFollowUp },
  handler: async (ctx, { sessionId, aftercare, followUp }) => {
    await getDraft(ctx, sessionId);
    await ctx.db.patch(sessionId, {
      aftercare: cleanAftercare(aftercare),
      followUp: followUp.recommended ? { recommended: true, inDays: followUp.inDays, note: clean(followUp.note) } : { recommended: false },
    });
  },
});

/**
 * "Finalizar atención": validates the gates, records the payment, numbers the session
 * within its case, and makes it read-only.
 */
export const close = memberMutation({
  args: {
    sessionId: v.id("sessions"),
    aftercare: vSessionAftercare,
    followUp: vSessionFollowUp,
    /** Creates a follow-up reminder due in `followUp.inDays` days. */
    reminder: v.boolean(),
    price: v.number(),
    payment: v.optional(v.object({ amount: v.number(), method: vPaymentMethod })),
  },
  handler: async (ctx, args) => {
    const session = await getDraft(ctx, args.sessionId);
    requireConsent(session);
    const [appointment, client, treatment, caseDoc] = await Promise.all([
      getOwned(ctx, "appointments", session.appointmentId),
      getOwned(ctx, "clients", session.clientId),
      getOwned(ctx, "treatments", session.treatmentId),
      getOwned(ctx, "cases", session.caseId),
    ]);

    const procedure = session.procedure ?? { fields: treatment.formFields, answers: {} };
    const errors = validateAnswers(procedure.fields, procedure.answers);
    const missing = procedure.fields.filter((f) => errors[f.id]).map((f) => f.label);
    if (missing.length > 0) invalid(`Completa el procedimiento antes de finalizar: ${missing.join(", ")}.`);

    if (!Number.isInteger(args.price) || args.price < 0) invalid("Revisa el precio.");
    if (args.price < appointment.paidTotal) invalid("El precio no puede ser menor a lo que ya se pagó.");
    const followUp = cleanFollowUp(args.followUp);
    const now = Date.now();
    const number = caseDoc.sessionCount + 1;

    await ctx.db.patch(appointment._id, { price: args.price, status: "completed" });
    if (args.payment) {
      await addPayment(ctx, { ...appointment, price: args.price, status: "completed" }, { ...args.payment, paidAt: now });
    }
    await syncBalance(ctx, appointment._id);

    await ctx.db.patch(session._id, {
      status: "closed",
      number,
      closedAt: now,
      procedure,
      aftercare: cleanAftercare(args.aftercare),
      followUp,
      step: STEPS.closing,
    });

    // The skin type assessed today is the client's current one.
    const skinType = session.assessment?.skinType;
    await ctx.db.patch(client._id, {
      lastVisitAt: now,
      ...intakeOnClient(session, now),
      ...(skinType && { skin: { ...client.skin, type: skinType } }),
    });
    await ctx.db.patch(caseDoc._id, { sessionCount: number, lastSessionAt: now, memberIds: withMember(caseDoc, session.memberId) });

    // The client came back, so earlier pending follow-ups of this case are fulfilled.
    const pending = await ctx.db
      .query("followUps")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    for (const f of pending) {
      if (f.caseId === caseDoc._id && f.status === "pending") {
        await ctx.db.patch(f._id, { status: "done", outcome: `Volvió a la sesión ${number}.`, doneAt: now });
      }
    }

    if (followUp.recommended && args.reminder) {
      await ctx.db.insert("followUps", {
        orgId: ctx.orgId,
        clientId: client._id,
        caseId: caseDoc._id,
        sessionId: session._id,
        memberId: session.memberId,
        dueDate: addDaysToDateKey(bogotaDateKey(now), followUp.inDays!),
        note: followUp.note,
        status: "pending",
      });
    }
    return { caseId: caseDoc._id };
  },
});

/** "Enviar por correo": emails the aftercare of a closed session to the client. */
export const sendAftercare = memberMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await getOwned(ctx, "sessions", sessionId);
    if (session.status !== "closed") invalid("Finaliza la atención antes de enviar las indicaciones.");
    const [client, appointment] = await Promise.all([
      getOwned(ctx, "clients", session.clientId),
      ctx.db.get(session.appointmentId),
    ]);
    if (!client.email && !appointment?.contactEmail) invalid("Este cliente no tiene correo. Agrégalo en su ficha.");
    await ctx.runMutation(internal.notifications.sendAftercare, { sessionId });
  },
});

/** "Notas adicionales": the only change a closed or postponed session accepts. */
export const addAddendum = memberMutation({
  args: { sessionId: v.id("sessions"), text: v.string() },
  handler: async (ctx, { sessionId, text }) => {
    const session = await getOwned(ctx, "sessions", sessionId);
    if (session.status === "draft") invalid("Esta atención sigue en curso. Escribe en sus pasos.");
    const trimmed = text.trim();
    if (!trimmed) invalid("Escribe la nota.");
    if (trimmed.length > 2000) invalid("La nota es demasiado larga.");
    await ctx.db.patch(sessionId, { addenda: [...session.addenda, { at: Date.now(), memberId: ctx.member._id, text: trimmed }] });
  },
});

function formatAnswer(field: FormField, answer: FormAnswer | undefined): string | null {
  if (isEmptyAnswer(answer)) return null;
  if (typeof answer === "boolean") return answer ? "Sí" : "No";
  if (typeof answer === "number") {
    if (field.type === "scale") return `${answer} de ${field.max ?? 5}`;
    return field.unit ? `${formatNumber(answer)} ${field.unit}` : formatNumber(answer);
  }
  if (Array.isArray(answer)) return answer.join(", ");
  return answer as string;
}

/** Up to `limit` short answers (numbers, choices, scales) that summarize a procedure in a timeline. */
export function keyValues(procedure: Doc<"sessions">["procedure"], limit = 3) {
  if (!procedure) return [];
  const values: { label: string; value: string }[] = [];
  for (const field of procedure.fields) {
    if (values.length >= limit) break;
    if (!["number", "single", "multi", "scale", "yesno", "text"].includes(field.type)) continue;
    const value = formatAnswer(field, procedure.answers[field.id]);
    if (value) values.push({ label: field.label, value });
  }
  return values;
}

/** Every answer of a procedure as label/value rows (session detail and print). */
export function answerRows(procedure: NonNullable<Doc<"sessions">["procedure"]>) {
  return procedure.fields.map((field) =>
    field.type === "section"
      ? { kind: "section" as const, id: field.id, label: field.label }
      : { kind: "answer" as const, id: field.id, label: field.label, value: formatAnswer(field, procedure.answers[field.id]) },
  );
}

/** Read-only session for the session detail page and the print view. */
export const detail = memberQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await getOwned(ctx, "sessions", sessionId);
    const [client, treatment, member, caseDoc, appointment, org] = await Promise.all([
      ctx.db.get(session.clientId),
      ctx.db.get(session.treatmentId),
      ctx.db.get(session.memberId),
      ctx.db.get(session.caseId),
      ctx.db.get(session.appointmentId),
      ctx.db.get(ctx.orgId),
    ]);
    if (!client || !treatment || !member || !caseDoc || !appointment || !org) fail("NOT_FOUND");
    const authors = new Map<Id<"members">, string>();
    for (const addendum of session.addenda) {
      if (!authors.has(addendum.memberId)) authors.set(addendum.memberId, (await ctx.db.get(addendum.memberId))?.name ?? "");
    }
    return {
      session: {
        _id: session._id,
        caseId: session.caseId,
        appointmentId: session.appointmentId,
        number: session.number,
        status: session.status,
        reason: session.reason,
        startedAt: session.startedAt,
        closedAt: session.closedAt,
        intake: session.intake,
        assessment: session.assessment,
        contraindications: session.contraindications,
        consent: session.consent,
        procedureRows: session.procedure ? answerRows(session.procedure) : [],
        procedureNotes: session.procedure?.notes,
        photos: session.photos,
        aftercare: session.aftercare,
        followUp: session.followUp,
        addenda: session.addenda.map((a) => ({ ...a, author: authors.get(a.memberId) ?? "" })),
      },
      client: {
        _id: client._id,
        name: fullName(client),
        phone: client.phone,
        birthDate: client.birthDate,
        documentType: client.documentType,
        documentNumber: client.documentNumber,
        health: client.health,
        sex: client.sex,
        lastPregnancy: client.lastPregnancy,
      },
      treatment: { name: treatment.name },
      member: { name: member.name, title: member.title },
      case: { _id: caseDoc._id, reasons: caseDoc.reasons, reasonOther: caseDoc.reasonOther, plannedSessions: caseDoc.plannedSessions },
      appointment: { price: appointment.price, paidTotal: appointment.paidTotal, cancelReason: appointment.cancelReason },
      org: {
        name: org.name,
        legalName: org.legalName,
        taxId: org.taxId,
        city: org.city,
        address: org.address,
        whatsapp: org.whatsapp,
        logoKey: org.logoKey,
      },
    };
  },
});

/** Historial and Documentos tabs: the client's sessions, newest first (drafts included, marked "En curso"). */
export const listByClient = memberQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await getOwned(ctx, "clients", clientId);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    const names = new Map<string, string>();
    async function nameOf(id: Id<"treatments"> | Id<"members">) {
      if (!names.has(id)) names.set(id, (await ctx.db.get(id))?.name ?? "");
      return names.get(id)!;
    }
    const rows = [];
    for (const s of sessions.sort((a, b) => b.startedAt - a.startedAt)) {
      rows.push({
        _id: s._id,
        caseId: s.caseId,
        appointmentId: s.appointmentId,
        number: s.number,
        status: s.status,
        reason: s.reason,
        startedAt: s.startedAt,
        treatmentName: await nameOf(s.treatmentId),
        memberName: await nameOf(s.memberId),
        photos: s.photos,
        keyValues: keyValues(s.procedure),
        signedAt: s.consent?.signedAt,
      });
    }
    return rows;
  },
});

/** Draft sessions of the org (Hoy: "Continuar atención"). */
export const listInProgress = memberQuery({
  args: {},
  handler: async (ctx) => {
    const drafts = await ctx.db
      .query("sessions")
      .withIndex("by_org_status", (q) => q.eq("orgId", ctx.orgId).eq("status", "draft"))
      .collect();
    const rows = [];
    for (const s of drafts) {
      const [client, treatment] = await Promise.all([ctx.db.get(s.clientId), ctx.db.get(s.treatmentId)]);
      rows.push({
        sessionId: s._id,
        appointmentId: s.appointmentId,
        memberId: s.memberId,
        clientName: client ? fullName(client) : "",
        treatmentName: treatment?.name ?? "",
        step: s.step,
        startedAt: s.startedAt,
        /** Discarding after the consent keeps the record ("Atención no realizada"). */
        consentSigned: s.consent !== undefined,
      });
    }
    return rows.sort((a, b) => b.startedAt - a.startedAt);
  },
});
