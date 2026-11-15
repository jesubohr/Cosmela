import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

// Colombia has no daylight saving time, but all conversions go through the
// IANA zone so nothing depends on the server or browser zone.
export const TIME_ZONE = "America/Bogota";

/** Epoch ms → Bogotá date in the zone, usable with date-fns. */
export function inBogota(ms: number): TZDate {
  return new TZDate(ms, TIME_ZONE);
}

/** Epoch ms → "YYYY-MM-DD" in Bogotá. */
export function bogotaDateKey(ms: number): string {
  return format(inBogota(ms), "yyyy-MM-dd");
}

/** "2026-11-15" + 30 → "2026-12-15". Calendar arithmetic, no time zone involved. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" + "HH:mm" in Bogotá → epoch ms. */
export function bogotaToEpoch(dateKey: string, time = "00:00"): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new TZDate(year, month - 1, day, hours, minutes, TIME_ZONE).getTime();
}
