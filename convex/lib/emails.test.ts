import { describe, expect, test } from "vitest";
import { aftercareEmail, appointmentConfirmedEmail, emailTime } from "./emails";
import { bogotaToEpoch } from "./time";

const start = bogotaToEpoch("2026-11-17", "15:30");

describe("emails", () => {
  test("escapes user text and builds a plain-text alternative", () => {
    const email = appointmentConfirmedEmail({
      orgName: "Spa <Luz>",
      clientFirstName: "Ana & Co",
      treatmentName: "Limpieza",
      start,
    });
    expect(email.subject).toBe("Tu cita en Spa <Luz> está confirmada");
    expect(email.html).toContain("Spa &#60;Luz&#62;");
    expect(email.html).not.toContain("<Luz>");
    expect(email.text).toContain("Hola, Ana & Co. Tu cita está confirmada.");
    expect(email.text).toContain("Fecha: martes 17 de noviembre");
    expect(email.text).toContain("Hora: 3:30 p. m.");
  });

  test("the aftercare subject carries no care details", () => {
    const email = aftercareEmail({
      orgName: "Alba",
      clientFirstName: "Ana",
      treatmentName: "Peeling químico",
      date: start,
      items: ["Usa protector solar."],
    });
    expect(email.subject).toBe("Tus indicaciones de cuidado de Alba");
    expect(email.text).toContain("- Usa protector solar.");
  });

  test("formats times the Colombian way", () => {
    expect(emailTime(bogotaToEpoch("2026-11-17", "00:05"))).toBe("12:05 a. m.");
    expect(emailTime(bogotaToEpoch("2026-11-17", "12:00"))).toBe("12:00 p. m.");
  });
});
