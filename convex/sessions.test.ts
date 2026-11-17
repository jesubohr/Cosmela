import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verificationCode } from "./lib/consent";
import { addDaysToDateKey, bogotaDateKey } from "./lib/time";
import { at, errorCode, errorMessage, setupOrgs, upload, withTestClock } from "./lib/fixtures.testing";
import { NOT_PERFORMED_REASON, POSTPONED_REASON } from "./sessions";

withTestClock();

const FIELDS = [
  { id: "producto", type: "text" as const, label: "Producto", required: true },
  { id: "capas", type: "number" as const, label: "Capas", unit: "capas" },
];

async function setup() {
  const s = await setupOrgs();
  await s.t.run(async (ctx) => {
    await ctx.db.patch(s.ids.treatmentA, {
      consentText: "Yo, {cliente}, con {documento}, autorizo a {negocio} a realizarme {tratamiento} el {fecha}.",
      formFields: FIELDS,
      aftercare: ["Usar protector solar"],
      followUpDays: 30,
      suggestedSessions: 4,
    });
  });
  const book = (start = at("09:00"), extra: { caseId?: Id<"cases"> } = {}) =>
    s.asAna.mutation(api.appointments.create, {
      clientId: s.ids.clientA,
      treatmentId: s.ids.treatmentA,
      memberId: s.ids.ana,
      start,
      durationMin: 60,
      price: 100000,
      ...extra,
    });
  /** A fresh, unclaimed signature upload of org A. */
  const key = () => upload(s.t, s.ids.orgA, s.ids.ana, "signature");
  const get = <T extends "sessions" | "appointments" | "clients" | "cases">(id: Id<T>) => s.t.run((ctx) => ctx.db.get(id));

  /** Runs steps 1–4 for a fresh appointment and returns the session id. */
  async function throughConsent(appointmentId: Id<"appointments">, caseId: Id<"cases"> | "new" = "new") {
    const sessionId = await s.asAna.mutation(api.sessions.start, { appointmentId });
    await s.asAna.mutation(api.sessions.saveIntake, { sessionId, healthChanged: false, medications: "Ninguno", pregnant: false, lactating: false });
    await s.asAna.mutation(api.sessions.saveAssessment, {
      sessionId,
      caseId,
      reasons: ["melasma"],
      plannedSessions: 4,
      assessment: { observed: ["melasma"], skinType: "combination" },
      evolution: "Mejoró",
    });
    await s.asAna.mutation(api.sessions.saveContraindications, { sessionId, present: [] });
    await s.asAna.mutation(api.sessions.signConsent, {
      sessionId,
      signatureAccepted: true, photoUse: "clinical",
      clientSignatureKey: await key(),
      professionalSignatureKey: await key(),
      userAgent: "test",
      authorizeData: true,
    });
    return sessionId;
  }

  async function closeSession(sessionId: Id<"sessions">) {
    await s.asAna.mutation(api.sessions.saveProcedure, { sessionId, answers: { producto: "Ácido mandélico", capas: 2 } });
    return s.asAna.mutation(api.sessions.close, {
      sessionId,
      aftercare: { items: ["Usar protector solar", " "], notes: "" },
      followUp: { recommended: true, inDays: 30, note: "Revisar manchas" },
      reminder: true,
      price: 120000,
      payment: { amount: 50000, method: "nequi" },
    });
  }

  return { ...s, book, key, get, throughConsent, closeSession };
}

describe("attention lifecycle", () => {
  test("start, six steps, and close update the session, appointment, client, case, and follow-ups", async () => {
    const { book, get, throughConsent, closeSession, asAna, ids, t } = await setup();
    const appointmentId = await book();
    const sessionId = await throughConsent(appointmentId);

    // Starting again resumes the same draft.
    expect(await asAna.mutation(api.sessions.start, { appointmentId })).toBe(sessionId);
    const draft = await get(sessionId);
    expect(draft).toMatchObject({ status: "draft", step: 4 });
    // The number is assigned when the session closes.
    expect(draft?.number).toBeUndefined();
    expect((await get(appointmentId))?.status).toBe("in_progress");

    // Consent snapshot: rendered text, document fallback, evidence hash.
    const consent = draft!.consent!;
    // Without a document, the clause is dropped so the sentence reads naturally.
    expect(consent.text).toContain("Yo, Laura Prueba, autorizo a Alba a realizarme Limpieza facial el");
    expect(consent.documentText).toBe("documento no registrado");
    expect(consent.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(verificationCode(consent.hash)).toMatch(/^[0-9A-F]{4} [0-9A-F]{4} [0-9A-F]{4} [0-9A-F]{4}$/);
    expect(consent.hashVersion).toBe(3);
    expect(consent.signatureAgreement).toMatchObject({ version: 1, acceptedAt: consent.signedAt });
    expect((await get(ids.clientA))?.dataAuthorization).toBeUndefined();

    const { caseId } = await closeSession(sessionId);
    const closed = await get(sessionId);
    expect(closed).toMatchObject({ status: "closed", step: 6, number: 1, aftercare: { items: ["Usar protector solar"] } });
    expect(closed?.procedure?.fields).toEqual(FIELDS);
    expect(await get(appointmentId)).toMatchObject({ status: "completed", price: 120000, paidTotal: 50000, hasBalance: true });
    const client = await get(ids.clientA);
    // The skin type assessed today updates the ficha.
    expect(client).toMatchObject({ lastMedications: "Ninguno", lastPregnancy: { pregnant: false, lactating: false }, skin: { type: "combination" } });
    expect(client?.lastVisitAt).toBeDefined();
    expect(await get(caseId)).toMatchObject({ sessionCount: 1, reasons: ["melasma"], plannedSessions: 4, status: "open", memberIds: [ids.ana] });

    const followUps = await t.run((ctx) => ctx.db.query("followUps").collect());
    expect(followUps).toHaveLength(1);
    expect(followUps[0]).toMatchObject({ caseId, sessionId, status: "pending", note: "Revisar manchas", dueDate: addDaysToDateKey(bogotaDateKey(Date.now()), 30) });

    const detail = await asAna.query(api.sessions.detail, { sessionId });
    expect(detail.session.procedureRows).toContainEqual({ kind: "answer", id: "capas", label: "Capas", value: "2 capas" });
  });

  test("requested appointments cannot start", async () => {
    const { asAna, ids, t } = await setup();
    const appointmentId = await t.run((ctx) =>
      ctx.db.insert("appointments", {
        orgId: ids.orgA,
        clientId: ids.clientA,
        memberId: ids.ana,
        treatmentId: ids.treatmentA,
        start: at("09:00"),
        end: at("10:00"),
        status: "requested",
        source: "online",
        price: 100000,
        paidTotal: 0,
      }),
    );
    expect(await errorCode(asAna.mutation(api.sessions.start, { appointmentId }))).toBe("INVALID");
  });
});

describe("server-side gates", () => {
  test("no consent before contraindications, no procedure before consent", async () => {
    const { asAna, book, key } = await setup();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    const sign = async () =>
      asAna.mutation(api.sessions.signConsent, {
        sessionId,
        signatureAccepted: true, photoUse: "clinical",
        clientSignatureKey: await key(),
        professionalSignatureKey: await key(),
        userAgent: "test",
        authorizeData: true,
      });
    expect(await errorMessage(sign())).toBe("Primero revisa las contraindicaciones.");
    expect(await errorMessage(asAna.mutation(api.sessions.saveProcedure, { sessionId, answers: {} }))).toBe(
      "Primero firma el consentimiento informado.",
    );
    expect(await errorMessage(asAna.mutation(api.sessions.close, { sessionId, aftercare: { items: [] }, followUp: { recommended: false }, reminder: false, price: 0 }))).toBe(
      "Primero firma el consentimiento informado.",
    );

    // Marked contraindications need a justification to continue.
    expect(await errorCode(asAna.mutation(api.sessions.saveContraindications, { sessionId, present: ["Embarazo"] }))).toBe("INVALID");
    await asAna.mutation(api.sessions.saveContraindications, { sessionId, present: ["Embarazo"], justification: "Autorizado por su médico" });
    await sign();
    // The consent is signed once, and contraindications lock after it.
    expect(await errorCode(sign())).toBe("INVALID");
    expect(await errorCode(asAna.mutation(api.sessions.saveContraindications, { sessionId, present: [] }))).toBe("INVALID");
  });

  test("signature acknowledgement is required and a foreign signature key is rejected", async () => {
    const { asAna, book, key, ids, t } = await setup();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    await asAna.mutation(api.sessions.saveContraindications, { sessionId, present: [] });
    const args = { sessionId, signatureAccepted: true, photoUse: "clinical" as const, clientSignatureKey: await key(), professionalSignatureKey: await key(), userAgent: "test" };
    expect(await errorCode(asAna.mutation(api.sessions.signConsent, { ...args, signatureAccepted: false }))).toBe("INVALID");
    const foreign = await upload(t, ids.orgB, ids.bea, "signature");
    expect(await errorCode(asAna.mutation(api.sessions.signConsent, { ...args, authorizeData: true, clientSignatureKey: foreign }))).toBe("NOT_FOUND");
    // A photo upload cannot stand in for a signature.
    const photo = await upload(t, ids.orgA, ids.ana, "photo");
    expect(await errorCode(asAna.mutation(api.sessions.signConsent, { ...args, authorizeData: true, clientSignatureKey: photo }))).toBe("NOT_FOUND");
  });

  test("closing needs the required procedure answers", async () => {
    const { asAna, book, throughConsent } = await setup();
    const sessionId = await throughConsent(await book());
    await asAna.mutation(api.sessions.saveProcedure, { sessionId, answers: { capas: 2 } });
    const message = await errorMessage(
      asAna.mutation(api.sessions.close, { sessionId, aftercare: { items: [] }, followUp: { recommended: false }, reminder: false, price: 100000 }),
    );
    expect(message).toBe("Completa el procedimiento antes de finalizar: Producto.");
  });

  test("minor records cannot receive new health processing", async () => {
    const { asAna, book, ids, t } = await setup();
    const birthYear = Number(bogotaDateKey(Date.now()).slice(0, 4)) - 15;
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    await t.run((ctx) => ctx.db.patch(ids.clientA, { birthDate: `${birthYear}-01-01`, documentType: "TI", documentNumber: "1012345678" }));
    expect(await errorCode(asAna.mutation(api.sessions.saveContraindications, { sessionId, present: [] }))).toBe("AUTHORIZATION_REQUIRED");
  });

  test("postponing cancels the appointment and keeps the session as postponed", async () => {
    const { asAna, book, get } = await setup();
    const appointmentId = await book();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId });
    expect(await errorCode(asAna.mutation(api.sessions.postpone, { sessionId, present: [] }))).toBe("INVALID");
    await asAna.mutation(api.sessions.postpone, { sessionId, present: ["Herpes activo"] });
    expect(await get(sessionId)).toMatchObject({ status: "postponed", reason: POSTPONED_REASON, contraindications: { present: ["Herpes activo"], proceed: false } });
    expect((await get(sessionId))?.number).toBeUndefined();
    expect(await get(appointmentId)).toMatchObject({ status: "cancelled", cancelReason: POSTPONED_REASON });
    expect(await errorCode(asAna.mutation(api.sessions.saveIntake, { sessionId, healthChanged: false, medications: "", pregnant: false, lactating: false }))).toBe(
      "INVALID",
    );
    // The case keeps the motivo for the next try, and the postponed session does not count.
    const session = await get(sessionId);
    expect((await get(session!.caseId))?.sessionCount).toBe(0);
  });
});

describe("closed sessions", () => {
  test("are immutable except for addenda", async () => {
    const { asAna, book, throughConsent, closeSession, get, key, ids, t } = await setup();
    const sessionId = await throughConsent(await book());
    await closeSession(sessionId);

    const attempts = [
      asAna.mutation(api.sessions.saveIntake, { sessionId, healthChanged: true, medications: "", pregnant: false, lactating: false }),
      asAna.mutation(api.sessions.saveProcedure, { sessionId, answers: { producto: "Otro" } }),
      asAna.mutation(api.sessions.signConsent, { sessionId, signatureAccepted: true, photoUse: "clinical", clientSignatureKey: await key(), userAgent: "x" }),
      asAna.mutation(api.sessions.close, { sessionId, aftercare: { items: [] }, followUp: { recommended: false }, reminder: false, price: 0 }),
      asAna.mutation(api.sessions.saveClosing, { sessionId, aftercare: { items: [] }, followUp: { recommended: false } }),
      asAna.mutation(api.files.attach, { key: await upload(t, ids.orgA, ids.ana, "photo"), target: { kind: "sessionPhoto", sessionId, photoKind: "after" } }),
    ];
    for (const attempt of attempts) expect(["INVALID", "FORBIDDEN"]).toContain(await errorCode(attempt));

    await asAna.mutation(api.sessions.addAddendum, { sessionId, text: "La clienta llamó: todo bien." });
    const session = await get(sessionId);
    expect(session?.addenda).toMatchObject([{ memberId: ids.ana, text: "La clienta llamó: todo bien." }]);
    expect(session?.procedure?.answers).toEqual({ producto: "Ácido mandélico", capas: 2 });
  });

  test("addenda wait until the session is closed", async () => {
    const { asAna, book } = await setup();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    expect(await errorCode(asAna.mutation(api.sessions.addAddendum, { sessionId, text: "Nota" }))).toBe("INVALID");
  });
});

describe("cases", () => {
  test("a second appointment continues the open case and numbers the session", async () => {
    const { asAna, book, throughConsent, closeSession, get, key, t } = await setup();
    const first = await throughConsent(await book(at("09:00")));
    const { caseId } = await closeSession(first);

    const secondAppointment = await book(at("09:00", "2030-01-14"));
    const second = await asAna.mutation(api.sessions.start, { appointmentId: secondAppointment });
    expect(await get(second)).toMatchObject({ caseId });
    expect((await get(secondAppointment))?.caseId).toBe(caseId);

    const data = await asAna.query(api.sessions.attention, { appointmentId: secondAppointment });
    expect(data.openCases.map((c) => c._id)).toEqual([caseId]);

    // Closing the second session fulfills the first session's follow-up.
    await asAna.mutation(api.sessions.saveIntake, { sessionId: second, healthChanged: false, medications: "", pregnant: false, lactating: false });
    await asAna.mutation(api.sessions.saveContraindications, { sessionId: second, present: [] });
    await asAna.mutation(api.sessions.signConsent, { sessionId: second, signatureAccepted: true, photoUse: "clinical", clientSignatureKey: await key(), professionalSignatureKey: await key(), userAgent: "test" });
    await closeSession(second);
    expect((await get(second))?.number).toBe(2);
    const followUps = await t.run((ctx) => ctx.db.query("followUps").collect());
    expect(followUps.map((f) => [f.sessionId, f.status])).toEqual([
      [first, "done"],
      [second, "pending"],
    ]);
    expect((await get(caseId))?.sessionCount).toBe(2);
  });

  test("starting a new case moves the session to session 1 of a new case", async () => {
    const { asAna, book, throughConsent, closeSession, get } = await setup();
    const { caseId } = await closeSession(await throughConsent(await book(at("09:00"))));
    const sessionId = await throughConsent(await book(at("09:00", "2030-01-14")), "new");
    const session = await get(sessionId);
    expect(session?.caseId).not.toBe(caseId);
    expect((await get(caseId))?.sessionCount).toBe(1);

    // Going back to the first case drops the empty new case; the session closes as number 2.
    const newCaseId = session!.caseId;
    await asAna.mutation(api.sessions.saveAssessment, { sessionId, caseId, reasons: [], assessment: { observed: [] } });
    expect((await get(sessionId))?.caseId).toBe(caseId);
    expect(await get(newCaseId)).toBeNull();
    await closeSession(sessionId);
    expect((await get(sessionId))?.number).toBe(2);
  });

  test("an appointment booked for a case uses it, and closed cases reopen", async () => {
    const { asAna, book, throughConsent, closeSession, get } = await setup();
    const { caseId } = await closeSession(await throughConsent(await book(at("09:00"))));
    await asAna.mutation(api.cases.close, { caseId, summary: "Manchas aclaradas" });
    expect(await get(caseId)).toMatchObject({ status: "closed", summary: "Manchas aclaradas" });

    // A closed case is not suggested.
    const other = await asAna.mutation(api.sessions.start, { appointmentId: await book(at("11:00")) });
    expect((await get(other))?.caseId).not.toBe(caseId);

    await asAna.mutation(api.cases.reopen, { caseId });
    const linked = await book(at("09:00", "2030-01-14"), { caseId });
    // The draft starts in the case the appointment was booked for.
    const started = await asAna.mutation(api.sessions.start, { appointmentId: linked });
    expect((await get(started))?.caseId).toBe(caseId);
    const sessionId = await throughConsent(linked, caseId);
    await closeSession(sessionId);
    expect(await get(sessionId)).toMatchObject({ caseId, number: 2 });

    const list = await asAna.query(api.cases.list, { status: "open" });
    expect(list.map((c) => c._id)).toContain(caseId);
    const detail = await asAna.query(api.cases.get, { caseId });
    expect(detail.sessions.map((s) => s.number)).toEqual([1, 2]);
    expect(detail.sessions[0].keyValues).toEqual([
      { label: "Producto", value: "Ácido mandélico" },
      { label: "Capas", value: "2 capas" },
    ]);
  });
});

describe("discarding an attention", () => {
  test("before the consent: deletes the draft, its photos, and its fresh case; the appointment goes back to scheduled", async () => {
    const { asAna, book, get, t, ids } = await setup();
    const appointmentId = await book();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId });
    const caseId = (await get(sessionId))!.caseId;
    const photo = await upload(t, ids.orgA, ids.ana, "photo", sessionId);
    await asAna.mutation(api.files.attach, { key: photo, target: { kind: "sessionPhoto", sessionId, photoKind: "before" } });

    await asAna.mutation(api.sessions.discard, { sessionId });
    expect(await get(sessionId)).toBeNull();
    expect(await get(caseId)).toBeNull();
    const appointment = await get(appointmentId);
    expect(appointment).toMatchObject({ status: "scheduled" });
    expect(appointment?.sessionId).toBeUndefined();
    expect(appointment?.caseId).toBeUndefined();
    expect(appointment?.reminderJobId).toBeDefined();
    // The photo's upload row is gone and its R2 object is scheduled for deletion.
    const { uploads, jobs } = await t.run(async (ctx) => ({
      uploads: await ctx.db.query("uploads").withIndex("by_key", (q) => q.eq("key", photo)).collect(),
      jobs: (await ctx.db.system.query("_scheduled_functions").collect()).filter((j) => j.name.includes("deleteObjects")),
    }));
    expect(uploads).toEqual([]);
    expect(jobs.map((j) => j.args[0])).toEqual([{ keys: [photo] }]);
    expect(await asAna.query(api.sessions.listInProgress, {})).toEqual([]);

    // The appointment can start again, or be cancelled.
    await asAna.mutation(api.appointments.cancel, { appointmentId });
  });

  test("before the consent: a case with earlier sessions stays", async () => {
    const { asAna, book, get, throughConsent, closeSession } = await setup();
    const { caseId } = await closeSession(await throughConsent(await book(at("09:00"))));
    const appointmentId = await book(at("09:00", "2030-01-14"));
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId });
    await asAna.mutation(api.sessions.discard, { sessionId });
    expect(await get(caseId)).toMatchObject({ sessionCount: 1 });
    expect((await get(appointmentId))?.caseId).toBe(caseId);
  });

  test("after the consent: keeps the signed record as not performed and cancels the appointment", async () => {
    const { asAna, book, get, throughConsent, t } = await setup();
    const appointmentId = await book();
    const sessionId = await throughConsent(appointmentId);
    const consent = (await get(sessionId))!.consent;

    await asAna.mutation(api.sessions.discard, { sessionId });
    const session = await get(sessionId);
    expect(session).toMatchObject({ status: "postponed", reason: NOT_PERFORMED_REASON, consent });
    expect(session?.number).toBeUndefined();
    expect(await get(appointmentId)).toMatchObject({ status: "cancelled", cancelReason: NOT_PERFORMED_REASON });
    expect((await get(session!.caseId))?.sessionCount).toBe(0);
    // The consent signature is never deleted.
    const deletions = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).filter((j) => j.name.includes("deleteObjects")),
    );
    expect(deletions).toEqual([]);
    expect(await errorCode(asAna.mutation(api.sessions.discard, { sessionId }))).toBe("INVALID");
  });

  test("an in-progress appointment without a session can be rescheduled, cancelled, or marked as no-show", async () => {
    const { asAna, book, get, t, ids } = await setup();
    const appointmentId = await book();
    await t.run((ctx) => ctx.db.patch(appointmentId, { status: "in_progress" }));
    await asAna.mutation(api.appointments.update, {
      appointmentId,
      clientId: ids.clientA,
      treatmentId: ids.treatmentA,
      memberId: ids.ana,
      start: at("11:00"),
      durationMin: 60,
      price: 100000,
    });
    expect(await get(appointmentId)).toMatchObject({ status: "scheduled", start: at("11:00") });
    await t.run((ctx) => ctx.db.patch(appointmentId, { status: "in_progress" }));
    await asAna.mutation(api.appointments.markNoShow, { appointmentId });
    expect((await get(appointmentId))?.status).toBe("no_show");

    // With a session, the attention has to be discarded instead.
    const other = await book(at("13:00"));
    await asAna.mutation(api.sessions.start, { appointmentId: other });
    expect(await errorCode(asAna.mutation(api.appointments.cancel, { appointmentId: other }))).toBe("INVALID");
  });

  test("org B cannot discard org A's attention", async () => {
    const { asAna, asBea, book, get } = await setup();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    expect(await errorCode(asBea.mutation(api.sessions.discard, { sessionId }))).toBe("NOT_FOUND");
    expect((await get(sessionId))?.status).toBe("draft");
  });
});

describe("gates on today's answers and the signer", () => {
  test("pregnancy or lactation must stay marked; continuing needs a justification", async () => {
    const { asAna, book } = await setup();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    await asAna.mutation(api.sessions.saveIntake, { sessionId, healthChanged: false, medications: "", pregnant: true, lactating: true });
    expect(await errorCode(asAna.mutation(api.sessions.saveContraindications, { sessionId, present: [] }))).toBe("INVALID");
    expect(await errorCode(asAna.mutation(api.sessions.saveContraindications, { sessionId, present: ["Embarazo"], justification: "Su médico lo autorizó" }))).toBe(
      "INVALID",
    );
    await asAna.mutation(api.sessions.saveContraindications, { sessionId, present: ["Embarazo", "Lactancia"], justification: "Su médico lo autorizó" });
  });

  test("today's answers lock once the consent is signed", async () => {
    const { asAna, book, throughConsent } = await setup();
    const sessionId = await throughConsent(await book());
    expect(
      await errorCode(asAna.mutation(api.sessions.saveIntake, { sessionId, healthChanged: true, medications: "", pregnant: true, lactating: false })),
    ).toBe("INVALID");
  });

  test("the member who signs the consent becomes the session's professional and uses her saved signature", async () => {
    const { asSofi, book, key, get, t, ids } = await setup();
    const saved = await upload(t, ids.orgA, ids.sofi, "signature");
    await asSofi.mutation(api.files.attach, { key: saved, target: { kind: "memberSignature" } });
    // Ana's appointment, attended by Sofi.
    const sessionId = await asSofi.mutation(api.sessions.start, { appointmentId: await book() });
    await asSofi.mutation(api.sessions.saveContraindications, { sessionId, present: [] });
    await asSofi.mutation(api.sessions.signConsent, { sessionId, signatureAccepted: true, photoUse: "clinical", clientSignatureKey: await key(), userAgent: "test", authorizeData: true });
    const session = await get(sessionId);
    expect(session?.memberId).toBe(ids.sofi);
    expect(session?.consent?.professionalSignatureKey).toBe(saved);
    const data = await asSofi.query(api.sessions.attention, { appointmentId: session!.appointmentId });
    expect(data.member._id).toBe(ids.sofi);
    expect(data.signer).toMatchObject({ _id: ids.sofi, signatureKey: saved });
  });

  test("the first visit is the first session that closes, whatever the ficha holds", async () => {
    const { asAna, book, throughConsent, closeSession, t, ids } = await setup();
    await t.run((ctx) => ctx.db.patch(ids.clientA, { fichaCompletedAt: Date.now() }));
    const first = await book(at("09:00"));
    await asAna.mutation(api.sessions.start, { appointmentId: first });
    expect((await asAna.query(api.sessions.attention, { appointmentId: first })).firstVisit).toBe(true);
    await closeSession(await throughConsent(first));
    const second = await book(at("09:00", "2030-01-14"));
    expect((await asAna.query(api.sessions.attention, { appointmentId: second })).firstVisit).toBe(false);
  });

  test("the photo choice is part of the consent hash", async () => {
    const { asAna, book, key, get } = await setup();
    const sign = async (photoUse: "clinical" | "clinical_and_marketing") => {
      const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book(photoUse === "clinical" ? at("09:00") : at("11:00")) });
      await asAna.mutation(api.sessions.saveContraindications, { sessionId, present: [] });
      return sessionId;
    };
    const { consentHash } = await import("./lib/consent");
    const sessionId = await sign("clinical");
    await asAna.mutation(api.sessions.signConsent, { sessionId, signatureAccepted: true, photoUse: "clinical", clientSignatureKey: await key(), professionalSignatureKey: await key(), userAgent: "t", authorizeData: true });
    const consent = (await get(sessionId))!.consent!;
    const evidence = { ...consent, guardian: consent.guardian };
    expect(await consentHash({ ...evidence, photoUse: "clinical" })).toBe(consent.hash);
    expect(await consentHash({ ...evidence, signatureAgreement: { ...consent.signatureAgreement!, label: "Changed agreement" } })).not.toBe(consent.hash);
    expect(await consentHash({ ...evidence, photoUse: "clinical_and_marketing" })).not.toBe(consent.hash);
  });
});

describe("uploads", () => {
  test("withdrawn photo authorization blocks upload URLs and attachment", async () => {
    const { asAna, book, ids, t } = await setup();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    const notice = await asAna.query(api.clientAuthorizations.notice, { clientId: ids.clientA });
    await asAna.mutation(api.clientAuthorizations.record, { clientId: ids.clientA, purpose: "record_photos", action: "withdrawn", policyHash: notice.policyHash, evidence: "Client requested withdrawal", requestKey: "photo-withdraw" });
    expect(await errorCode(asAna.mutation(api.files.generateUploadUrl, { kind: "photo", sessionId }))).toBe("AUTHORIZATION_REQUIRED");
    const key = await upload(t, ids.orgA, ids.ana, "photo");
    expect(await errorCode(asAna.mutation(api.files.attach, { key, target: { kind: "sessionPhoto", sessionId, photoKind: "before" } }))).toBe("AUTHORIZATION_REQUIRED");
  });

  test("a key is attached once, only for its kind, and only its owner deletes it", async () => {
    const { asAna, book, throughConsent, get, t, ids } = await setup();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    const photo = await upload(t, ids.orgA, ids.ana, "photo", sessionId);
    const attach = (key: string, id = sessionId) => asAna.mutation(api.files.attach, { key, target: { kind: "sessionPhoto", sessionId: id, photoKind: "before" } });
    await attach(photo);
    expect(await errorCode(attach(photo))).toBe("FORBIDDEN");

    // A signed consent's signature cannot be attached as a photo, so it cannot be deleted through one.
    const signed = await throughConsent(await book(at("11:00")));
    const signature = (await get(signed))!.consent!.clientSignatureKey;
    expect(await errorCode(attach(signature, signed))).toBe("NOT_FOUND");
    expect(await errorCode(asAna.mutation(api.files.attach, { key: signature, target: { kind: "memberSignature" } }))).toBe("FORBIDDEN");
    // A key nobody uploaded is rejected.
    expect(await errorCode(attach(`orgs/${ids.orgA}/photo/${crypto.randomUUID()}`))).toBe("NOT_FOUND");

    await asAna.mutation(api.sessions.deletePhoto, { sessionId, key: photo });
    expect((await get(sessionId))?.photos).toEqual([]);
  });

  test("unclaimed uploads older than a day are swept", async () => {
    const { t, ids } = await setup();
    const stale = await upload(t, ids.orgA, ids.ana, "photo");
    vi.setSystemTime(Date.now() + 25 * 60 * 60_000);
    const fresh = await upload(t, ids.orgA, ids.ana, "photo");
    expect(await t.mutation(internal.files.sweepUploads, {})).toBe(1);
    const keys = await t.run(async (ctx) => (await ctx.db.query("uploads").collect()).map((u) => u.key));
    expect(keys).toEqual([fresh]);
    expect(keys).not.toContain(stale);
  });
});

describe("cases list", () => {
  test("shows the next appointment or follow-up and filters by professional", async () => {
    const { asAna, book, throughConsent, closeSession, ids } = await setup();
    const { caseId } = await closeSession(await throughConsent(await book(at("09:00"))));
    let [row] = await asAna.query(api.cases.list, { status: "open" });
    expect(row.next).toMatchObject({ kind: "followUp" });
    await book(at("09:00", "2030-01-14"), { caseId });
    [row] = await asAna.query(api.cases.list, { status: "open" });
    expect(row.next).toEqual({ kind: "appointment", start: at("09:00", "2030-01-14") });
    expect(await asAna.query(api.cases.list, { status: "open", memberId: ids.ana })).toHaveLength(1);
    expect(await asAna.query(api.cases.list, { status: "open", memberId: ids.sofi })).toHaveLength(0);
  });
});

describe("follow-ups", () => {
  test("listDue excludes archived clients", async () => {
    const { asAna, ids, t } = await setup();
    await asAna.mutation(api.followUps.create, { clientId: ids.clientA, dueDate: bogotaDateKey(Date.now()) });
    await t.run((ctx) => ctx.db.patch(ids.clientA, { isArchived: true }));

    expect(await asAna.query(api.followUps.listDue, {})).toEqual([]);
  });

  test("listDue omits follow-ups whose client is missing", async () => {
    const { asAna, ids, t } = await setup();
    await asAna.mutation(api.followUps.create, { clientId: ids.clientA, dueDate: bogotaDateKey(Date.now()) });
    await t.run((ctx) => ctx.db.delete(ids.clientA));

    const due = await asAna.query(api.followUps.listDue, {});
    expect(due).toHaveLength(0);
  });

  test("listDue returns pending follow-ups due today or before; done, dismissed, and rescheduled leave the list", async () => {
    const { asAna, ids } = await setup();
    const today = bogotaDateKey(Date.now());
    const create = (dueDate: string) => asAna.mutation(api.followUps.create, { clientId: ids.clientA, dueDate, note: "Llamar" });
    const overdue = await create(addDaysToDateKey(today, -3));
    const dueToday = await create(today);
    await create(addDaysToDateKey(today, 5));

    let due = await asAna.query(api.followUps.listDue, {});
    expect(due.map((f) => [f._id, f.overdue])).toEqual([
      [overdue, true],
      [dueToday, false],
    ]);
    expect(due[0].client).toMatchObject({ name: "Laura Prueba", phone: "+573001234567" });

    await asAna.mutation(api.followUps.markDone, { followUpId: overdue, outcome: "Agendó" });
    await asAna.mutation(api.followUps.reschedule, { followUpId: dueToday, dueDate: addDaysToDateKey(today, 2) });
    due = await asAna.query(api.followUps.listDue, {});
    expect(due).toHaveLength(0);
    expect(await errorCode(asAna.mutation(api.followUps.dismiss, { followUpId: overdue }))).toBe("INVALID");
  });
});

describe("cross-org isolation", () => {
  test("org B cannot read or change org A's sessions, cases, or follow-ups", async () => {
    const { asBea, book, throughConsent, closeSession, ids, t } = await setup();
    const appointmentId = await book();
    const sessionId = await throughConsent(appointmentId);
    const { caseId } = await closeSession(sessionId);
    const followUpId = (await t.run((ctx) => ctx.db.query("followUps").first()))!._id;

    const attempts = [
      asBea.query(api.sessions.attention, { appointmentId }),
      asBea.mutation(api.sessions.start, { appointmentId }),
      asBea.query(api.sessions.detail, { sessionId }),
      asBea.mutation(api.sessions.addAddendum, { sessionId, text: "x" }),
      asBea.query(api.sessions.listByClient, { clientId: ids.clientA }),
      asBea.query(api.cases.get, { caseId }),
      asBea.mutation(api.cases.close, { caseId }),
      asBea.mutation(api.followUps.markDone, { followUpId }),
      asBea.mutation(api.followUps.create, { clientId: ids.clientA, dueDate: "2030-01-01" }),
    ];
    for (const attempt of attempts) expect(await errorCode(attempt)).toBe("NOT_FOUND");
    expect(await asBea.query(api.cases.list, { status: "all" })).toEqual([]);
    expect(await asBea.query(api.followUps.listDue, {})).toEqual([]);
    expect(await asBea.query(api.sessions.listInProgress, {})).toEqual([]);
  });
});
