import { format } from "date-fns";
import { es } from "date-fns/locale";
import { bogotaDateKey, inBogota } from "@/convex/lib/time";

/** "1 h 30 min", "45 min". */
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** 85000 → "$ 85.000". Money is integer COP. */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$ ${groupThousands(Math.abs(Math.round(amount)))}`;
}

/** 85000 → "85.000" (no currency sign). */
export function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Epoch ms → "sábado 15 de noviembre" (Bogotá). */
export function formatDate(ms: number): string {
  return format(inBogota(ms), "EEEE d 'de' MMMM", { locale: es });
}

/** Epoch ms → "15 nov. 2026" (Bogotá), for lists and tables. */
export function formatShortDate(ms: number): string {
  return format(inBogota(ms), "d MMM yyyy", { locale: es });
}

/** Epoch ms → "10:30 a. m." (Bogotá), the 12-hour form Colombians read. */
export function formatTime(ms: number): string {
  const date = inBogota(ms);
  const hours = date.getHours();
  const period = hours < 12 ? "a. m." : "p. m.";
  return `${hours % 12 || 12}:${format(date, "mm")} ${period}`;
}

/** Epoch ms → "sábado 15 de noviembre, 10:30 a. m." */
export function formatDateTime(ms: number): string {
  return `${formatDate(ms)}, ${formatTime(ms)}`;
}

/** "1990-03-21" → "21 de marzo de 1990". Calendar dates have no time zone. */
export function formatCalendarDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return format(new Date(year, month - 1, day), "d 'de' MMMM 'de' yyyy", { locale: es });
}

/** Today in Bogotá as "YYYY-MM-DD". */
export function todayKey(now = Date.now()): string {
  return bogotaDateKey(now);
}

/** Age in whole years from a "YYYY-MM-DD" birth date, measured in Bogotá. */
export function ageFromBirthDate(birthDate: string, now = Date.now()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  const [nowYear, nowMonth, nowDay] = todayKey(now).split("-").map(Number);
  const hadBirthday = nowMonth > month || (nowMonth === month && nowDay >= day);
  return nowYear - year - (hadBirthday ? 0 : 1);
}

/** "+573001234567" → "300 123 4567". Other countries keep the E.164 form. */
export function formatPhone(e164: string): string {
  const match = e164.match(/^\+57(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : e164;
}

/**
 * User input → E.164, or null when it is not a valid number.
 * 10 digits are read as a Colombian number (+57); a leading "+" keeps its country code.
 */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  return null;
}

/** "Laura Gómez" → "LG". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

/** True for a complete Colombian mobile (+57 + 10 digits) or another E.164 number. */
export function isValidPhone(e164: string): boolean {
  return /^\+57\d{10}$/.test(e164) || /^\+(?!57)\d{8,15}$/.test(e164);
}

/**
 * "Sesión 2"; drafts read "Sesión en curso" and postponed sessions "Sesión pospuesta"
 * or "Atención no realizada" (their `reason`), since only closed sessions get a number.
 */
export function sessionLabel(session: { number?: number; status: "draft" | "closed" | "postponed"; reason?: string }): string {
  if (session.number !== undefined) return `Sesión ${session.number}`;
  if (session.status === "draft") return "Sesión en curso";
  return session.reason === "Atención no realizada" ? session.reason : "Sesión pospuesta";
}
