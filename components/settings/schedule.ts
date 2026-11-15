// Pure schedule helpers shared by the UI and Convex functions (relative imports only).
import type { ScheduleRange } from "../../convex/lib/validators";

/** Monday first, as Colombian calendars show it. Day 0 is Sunday. */
export const WEEK_DAYS = [
  { day: 1, label: "Lunes", short: "Lun" },
  { day: 2, label: "Martes", short: "Mar" },
  { day: 3, label: "Miércoles", short: "Mié" },
  { day: 4, label: "Jueves", short: "Jue" },
  { day: 5, label: "Viernes", short: "Vie" },
  { day: 6, label: "Sábado", short: "Sáb" },
  { day: 0, label: "Domingo", short: "Dom" },
] as const;

/** Monday to Friday 8:00–18:00, Saturday 8:00–13:00. */
export const DEFAULT_SCHEDULE: ScheduleRange[] = [
  ...[1, 2, 3, 4, 5].map((day) => ({ day, start: "08:00", end: "18:00" })),
  { day: 6, start: "08:00", end: "13:00" },
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_RANGES_PER_DAY = 4;

/** Ranges of one day, sorted by start time. */
export function rangesOf(schedule: ScheduleRange[], day: number): ScheduleRange[] {
  return schedule.filter((range) => range.day === day).sort((a, b) => a.start.localeCompare(b.start));
}

/** The first problem in a schedule as a Spanish message, or null when it is valid. */
export function scheduleError(schedule: ScheduleRange[]): string | null {
  for (const { day, label } of WEEK_DAYS) {
    const ranges = rangesOf(schedule, day);
    if (ranges.length > MAX_RANGES_PER_DAY) return `${label} tiene demasiadas pausas.`;
    for (const [index, range] of ranges.entries()) {
      if (!TIME.test(range.start) || !TIME.test(range.end)) return `Revisa las horas del ${label.toLowerCase()}.`;
      if (range.start >= range.end) return `El ${label.toLowerCase()}, la hora de salida debe ser después de la de entrada.`;
      const previous = ranges[index - 1];
      if (previous && range.start < previous.end) return `El ${label.toLowerCase()} tiene horarios que se cruzan.`;
    }
  }
  if (schedule.some((range) => !Number.isInteger(range.day) || range.day < 0 || range.day > 6)) {
    return "Revisa los días del horario.";
  }
  return null;
}
