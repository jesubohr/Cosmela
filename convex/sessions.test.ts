import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verificationCode } from "./lib/consent";
import { addDaysToDateKey, bogotaDateKey } from "./lib/time";
import { at, errorCode, errorMessage, setupOrgs } from "./lib/fixtures.testing";
import { POSTPONED_REASON } from "./sessions";

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
  const key = (name: string) => `orgs/${s.ids.orgA}/signature/${name}`;
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
      photoUse: "clinical",
      clientSignatureKey: key("client"),
      professionalSignatureKey: key("pro"),
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
    expect(draft).toMatchObject({ status: "draft", step: 4, number: 1 });
    expect((await get(appointmentId))?.status).toBe("in_progress");

    // Consent snapshot: rendered text, document fallback, evidence hash.
    const consent = draft!.consent!;
    expect(consent.text).toContain("Yo, Laura Prueba, con documento no registrado, autorizo a Alba a realizarme Limpieza facial el");
    expect(consent.documentText).toBe("documento no registrado");
    expect(consent.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(verificationCode(consent.hash)).toMatch(/^[0-9A-F]{4} [0-9A-F]{4} [0-9A-F]{4} [0-9A-F]{4}$/);
    expect((await get(ids.clientA))?.dataAuthorization).toMatchObject({ method: "signature", signatureKey: `orgs/${ids.orgA}/signature/client` });

    const { caseId } = await closeSession(sessionId);
    const closed = await get(sessionId);
    expect(closed).toMatchObject({ status: "closed", step: 6, aftercare: { items: ["Usar protector solar"] } });
    expect(closed?.procedure?.fields).toEqual(FIELDS);
    expect(await get(appointmentId)).toMatchObject({ status: "completed", price: 120000, paidTotal: 50000 });
    const client = await get(ids.clientA);
    expect(client).toMatchObject({ lastMedications: "Ninguno", lastPregnancy: { pregnant: false, lactating: false } });
    expect(client?.lastVisitAt).toBeDefined();
    expect(await get(caseId)).toMatchObject({ sessionCount: 1, reasons: ["melasma"], plannedSessions: 4, status: "open" });

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
    const sign = () =>
      asAna.mutation(api.sessions.signConsent, {
        sessionId,
        photoUse: "clinical",
        clientSignatureKey: key("c"),
        professionalSignatureKey: key("p"),
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

  test("the first consent requires the data authorization and a foreign signature key is rejected", async () => {
    const { asAna, book, key, ids } = await setup();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    await asAna.mutation(api.sessions.saveContraindications, { sessionId, present: [] });
    const args = { sessionId, photoUse: "clinical" as const, clientSignatureKey: key("c"), professionalSignatureKey: key("p"), userAgent: "test" };
    expect(await errorMessage(asAna.mutation(api.sessions.signConsent, args))).toBe("Falta la autorización de tratamiento de datos.");
    expect(
      await errorCode(asAna.mutation(api.sessions.signConsent, { ...args, authorizeData: true, clientSignatureKey: `orgs/${ids.orgB}/signature/x` })),
    ).toBe("NOT_FOUND");
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

  test("minors need a guardian, who is stored with the consent", async () => {
    const { asAna, book, key, ids, t, get } = await setup();
    const birthYear = Number(bogotaDateKey(Date.now()).slice(0, 4)) - 15;
    await t.run((ctx) => ctx.db.patch(ids.clientA, { birthDate: `${birthYear}-01-01`, documentType: "TI", documentNumber: "1012345678" }));
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: await book() });
    await asAna.mutation(api.sessions.saveContraindications, { sessionId, present: [] });
    const args = { sessionId, photoUse: "none" as const, clientSignatureKey: key("g"), professionalSignatureKey: key("p"), userAgent: "test", authorizeData: true };
    expect(await errorMessage(asAna.mutation(api.sessions.signConsent, args))).toBe(
      "Escribe el nombre, el documento y el parentesco del acudiente.",
    );
    const guardian = { name: "Marta Prueba", document: "CC 52.000.111", relationship: "Madre" };
    await asAna.mutation(api.sessions.signConsent, { ...args, guardian });
    const consent = (await get(sessionId))!.consent!;
    expect(consent.guardian).toEqual(guardian);
    expect(consent.documentText).toBe("tarjeta de identidad 1.012.345.678");
  });

  test("postponing cancels the appointment and keeps the session as postponed", async () => {
    const { asAna, book, get } = await setup();
    const appointmentId = await book();
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId });
    expect(await errorCode(asAna.mutation(api.sessions.postpone, { sessionId, present: [] }))).toBe("INVALID");
    await asAna.mutation(api.sessions.postpone, { sessionId, present: ["Herpes activo"] });
    expect(await get(sessionId)).toMatchObject({ status: "postponed", contraindications: { present: ["Herpes activo"], proceed: false } });
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
    const { asAna, book, throughConsent, closeSession, get, key, ids } = await setup();
    const sessionId = await throughConsent(await book());
    await closeSession(sessionId);

    const attempts = [
      asAna.mutation(api.sessions.saveIntake, { sessionId, healthChanged: true, medications: "", pregnant: false, lactating: false }),
      asAna.mutation(api.sessions.saveProcedure, { sessionId, answers: { producto: "Otro" } }),
      asAna.mutation(api.sessions.signConsent, { sessionId, photoUse: "clinical", clientSignatureKey: key("c"), userAgent: "x" }),
      asAna.mutation(api.sessions.close, { sessionId, aftercare: { items: [] }, followUp: { recommended: false }, reminder: false, price: 0 }),
      asAna.mutation(api.sessions.saveClosing, { sessionId, aftercare: { items: [] }, followUp: { recommended: false } }),
      asAna.mutation(api.files.attach, { key: `orgs/${ids.orgA}/photo/x`, target: { kind: "sessionPhoto", sessionId, photoKind: "after" } }),
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
    expect(await get(second)).toMatchObject({ caseId, number: 2 });
    expect((await get(secondAppointment))?.caseId).toBe(caseId);

    const data = await asAna.query(api.sessions.attention, { appointmentId: secondAppointment });
    expect(data.openCases.map((c) => c._id)).toEqual([caseId]);

    // Closing the second session fulfills the first session's follow-up.
    await asAna.mutation(api.sessions.saveIntake, { sessionId: second, healthChanged: false, medications: "", pregnant: false, lactating: false });
    await asAna.mutation(api.sessions.saveContraindications, { sessionId: second, present: [] });
    await asAna.mutation(api.sessions.signConsent, { sessionId: second, photoUse: "clinical", clientSignatureKey: key("c2"), professionalSignatureKey: key("p2"), userAgent: "test" });
    await closeSession(second);
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
    expect(session?.number).toBe(1);
    expect((await get(caseId))?.sessionCount).toBe(1);

    // Going back to the first case renumbers the session and drops the empty new case.
    const newCaseId = session!.caseId;
    await asAna.mutation(api.sessions.saveAssessment, { sessionId, caseId, reasons: [], assessment: { observed: [] } });
    expect(await get(sessionId)).toMatchObject({ caseId, number: 2 });
    expect(await get(newCaseId)).toBeNull();
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
    const sessionId = await asAna.mutation(api.sessions.start, { appointmentId: linked });
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

describe("follow-ups", () => {
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
