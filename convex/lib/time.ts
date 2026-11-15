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

/** "YYYY-MM-DD" + "HH:mm" in Bogotá → epoch ms. */
export function bogotaToEpoch(dateKey: string, time = "00:00"): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new TZDate(year, month - 1, day, hours, minutes, TIME_ZONE).getTime();
}
