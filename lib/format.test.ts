import { describe, expect, test } from "vitest";
import { bogotaToEpoch } from "@/convex/lib/time";
import { ageFromBirthDate, formatDate, formatMoney, formatPhone, formatTime, isValidPhone, todayKey, toE164 } from "./format";
import { whatsappLink } from "./whatsapp";

describe("format", () => {
  test("money", () => {
    expect(formatMoney(85000)).toBe("$ 85.000");
    expect(formatMoney(1500)).toBe("$ 1.500");
    expect(formatMoney(0)).toBe("$ 0");
    expect(formatMoney(-120000)).toBe("-$ 120.000");
  });

  test("dates and times in Bogotá", () => {
    const at = bogotaToEpoch("2026-11-14", "10:30");
    expect(formatDate(at)).toBe("sábado 14 de noviembre");
    expect(formatTime(at)).toBe("10:30 a. m.");
    expect(formatTime(bogotaToEpoch("2026-11-14", "00:05"))).toBe("12:05 a. m.");
    expect(formatTime(bogotaToEpoch("2026-11-14", "15:00"))).toBe("3:00 p. m.");
    // 23:30 in Bogotá is already the next day in UTC.
    expect(todayKey(bogotaToEpoch("2026-11-14", "23:30"))).toBe("2026-11-14");
  });

  test("age", () => {
    const now = bogotaToEpoch("2026-11-14", "12:00");
    expect(ageFromBirthDate("1990-11-14", now)).toBe(36);
    expect(ageFromBirthDate("1990-11-15", now)).toBe(35);
  });

  test("phones", () => {
    expect(toE164("300 123 4567")).toBe("+573001234567");
    expect(toE164("+57 300 123 4567")).toBe("+573001234567");
    expect(toE164("+58 412 1234567")).toBe("+584121234567");
    expect(toE164("12345")).toBeNull();
    expect(formatPhone("+573001234567")).toBe("300 123 4567");
    expect(isValidPhone("+573001234567")).toBe(true);
    expect(isValidPhone("+57300123")).toBe(false);
  });

  test("whatsapp links", () => {
    expect(whatsappLink("+573001234567", "Hola, Laura")).toBe("https://wa.me/573001234567?text=Hola%2C%20Laura");
    expect(whatsappLink(undefined)).toBe("https://wa.me/");
  });
});
