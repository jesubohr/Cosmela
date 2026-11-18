import { describe, expect, test } from "vitest";
import { safeNext } from "./safe-next";

const ORIGIN = "https://app.cosmela.test";

describe("safeNext", () => {
  test("keeps internal deep links with query and hash", () => {
    expect(safeNext("/invitacion/abc123", ORIGIN)).toBe("/invitacion/abc123");
    expect(safeNext("/agenda?dia=2026-11-18#cita", ORIGIN)).toBe("/agenda?dia=2026-11-18#cita");
    expect(safeNext(`${ORIGIN}/clientes/1`, ORIGIN)).toBe("/clientes/1");
  });

  test("falls back to /hoy for missing or foreign destinations", () => {
    for (const next of [
      null,
      "",
      "https://other.test/hoy",
      "//other.test",
      "/\\other.test",
      "/\t/other.test",
      "/.//other.test",
      "javascript:alert(1)",
      "http://app.cosmela.test/hoy",
    ]) {
      expect(safeNext(next, ORIGIN)).toBe("/hoy");
    }
  });
});
