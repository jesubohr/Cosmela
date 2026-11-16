import { format } from "date-fns";
import { es } from "date-fns/locale";
import { bogotaDateKey, bogotaToEpoch, inBogota } from "@/convex/lib/time";

// Agenda dates are Bogotá calendar days as "YYYY-MM-DD" keys. Day math runs on the
// keys (no time zone), and only epoch conversions go through Bogotá time.

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

function parts(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function fromUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const { year, month, day } = parts(key);
  return fromUtc(new Date(Date.UTC(year, month - 1, day + days)));
}

export function addMonths(key: string, months: number): string {
  const { year, month } = parts(key);
  return fromUtc(new Date(Date.UTC(year, month - 1 + months, 1)));
}

/** 0 = Sunday. */
export function weekday(key: string): number {
  const { year, month, day } = parts(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Monday of the key's week. */
export function weekStart(key: string): string {
  return addDays(key, -((weekday(key) + 6) % 7));
}

export function monthStart(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** Monday-first grid of whole weeks covering the month. */
export function monthGrid(key: string): string[] {
  const first = monthStart(key);
  const start = weekStart(first);
  const nextMonth = addMonths(first, 1);
  const days: string[] = [];
  for (let day = start; day < nextMonth || days.length % 7 !== 0; day = addDays(day, 1)) days.push(day);
  return days;
}

export function todayKey(): string {
  return bogotaDateKey(Date.now());
}

export function dayStart(key: string): number {
  return bogotaToEpoch(key);
}

/** Minutes since Bogotá midnight. */
export function minutesOfDay(ms: number): number {
  const date = inBogota(ms);
  return date.getHours() * 60 + date.getMinutes();
}

/** "HH:mm" → minutes. */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Minutes → "HH:mm". */
export function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Epoch → "HH:mm" in Bogotá. */
export function timeOf(ms: number): string {
  return toTime(minutesOfDay(ms));
}

function localDate(key: string) {
  const { year, month, day } = parts(key);
  return new Date(year, month - 1, day);
}

/** "sábado 15 de noviembre" */
export function formatDayKey(key: string): string {
  return format(localDate(key), "EEEE d 'de' MMMM", { locale: es });
}

/** Phone titles: "jue 12 nov", "9 – 15 nov", "noviembre 2026". */
export function formatCompactTitle(view: "dia" | "semana" | "mes", key: string): string {
  if (view === "mes") return format(localDate(key), "MMMM yyyy", { locale: es });
  if (view === "dia") return format(localDate(key), "EEE d MMM", { locale: es }).replace(/\./g, "");
  const start = weekStart(key);
  const end = addDays(start, 6);
  const first = format(localDate(start), start.slice(5, 7) === end.slice(5, 7) ? "d" : "d MMM", { locale: es });
  return `${first} – ${format(localDate(end), "d MMM", { locale: es })}`.replace(/\./g, "");
}

/** "sáb 15" */
export function formatShortDay(key: string): { weekday: string; day: string } {
  const date = localDate(key);
  return { weekday: format(date, "EEE", { locale: es }).replace(".", ""), day: format(date, "d") };
}

/** "noviembre de 2026" */
export function formatMonth(key: string): string {
  return format(localDate(key), "MMMM 'de' yyyy", { locale: es });
}

/** "10 – 16 de noviembre" or "27 de octubre – 2 de noviembre". */
export function formatWeek(key: string): string {
  const start = weekStart(key);
  const end = addDays(start, 6);
  const sameMonth = start.slice(5, 7) === end.slice(5, 7);
  const first = format(localDate(start), sameMonth ? "d" : "d 'de' MMMM", { locale: es });
  return `${first} – ${format(localDate(end), "d 'de' MMMM", { locale: es })}`;
}

/** Calendar Date (local) ↔ key, for the date picker. */
export function keyToDate(key: string): Date {
  return localDate(key);
}
export function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "8 a. m." for the hour labels of the time grid. */
export function formatHour(hour: number): string {
  const period = hour < 12 ? "a. m." : "p. m.";
  return `${hour % 12 || 12} ${period}`;
}
