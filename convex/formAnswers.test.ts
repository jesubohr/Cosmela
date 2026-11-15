import { describe, expect, test } from "vitest";
import { validateAnswers } from "../components/forms/validate-answers";
import { findTemplate } from "../data/treatment-templates";
import type { FormField } from "./lib/validators";

const FIELDS: FormField[] = [
  { id: "seccion", type: "section", label: "Peeling utilizado", required: true },
  { id: "producto", type: "text", label: "Producto", required: true },
  { id: "notas", type: "longtext", label: "Notas" },
  { id: "concentracion", type: "number", label: "Concentración", unit: "%", min: 1, max: 70, required: true },
  { id: "capas", type: "number", label: "Capas", min: 1 },
  { id: "acido", type: "multi", label: "Tipo de ácido", options: ["Glicólico", "Láctico"], required: true },
  { id: "frost", type: "single", label: "Frost", options: ["Ninguno", "Nivel I"] },
  { id: "neutralizacion", type: "yesno", label: "Neutralización", required: true },
  { id: "succion", type: "scale", label: "Succión", min: 1, max: 10 },
  { id: "control", type: "date", label: "Control" },
];

describe("validateAnswers", () => {
  test("reports missing required answers with Spanish messages", () => {
    expect(validateAnswers(FIELDS, { producto: "  ", acido: [] })).toEqual({
      producto: "Completa este campo.",
      concentracion: "Escribe un número.",
      acido: "Elige al menos una opción.",
      neutralizacion: "Elige sí o no.",
    });
  });

  test("accepts complete, valid answers and ignores unknown ids", () => {
    expect(
      validateAnswers(FIELDS, {
        producto: "Mandelac lote 22",
        concentracion: 35.5,
        acido: ["Glicólico"],
        neutralizacion: false,
        succion: 10,
        control: "2026-02-28",
        otro: "ignorado",
      }),
    ).toEqual({});
  });

  test("checks ranges, options, scale bounds, and dates", () => {
    expect(
      validateAnswers(FIELDS, {
        producto: "X",
        concentracion: 80,
        capas: 0,
        acido: ["Fenol"],
        frost: "Nivel IV",
        neutralizacion: true,
        succion: 11,
        control: "2026-02-30",
      }),
    ).toEqual({
      concentracion: "Escribe un número entre 1 y 70.",
      capas: "Escribe un número igual o mayor que 1.",
      acido: "Elige opciones de la lista.",
      frost: "Elige una opción de la lista.",
      succion: "Elige un valor de la escala.",
      control: "Escribe una fecha válida.",
    });
  });

  test("template fields have unique ids and the common closing fields", () => {
    const peeling = findTemplate("peeling-quimico")!;
    const ids = peeling.formFields.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(-2)).toEqual(["reaccion-inmediata", "observaciones-del-procedimiento"]);
    expect(peeling.consentText).toContain("Beneficios esperados: Mejora de manchas");
    expect(peeling.consentText).toContain("{cliente}");
  });
});
