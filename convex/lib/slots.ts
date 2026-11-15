import type { ScheduleRange } from "./validators";
import { bogotaToEpoch } from "./time";

export type Interval = { start: number; end: number };

export type FreeSlotsInput = {
  /** Bogotá calendar day, "YYYY-MM-DD". */
  date: string;
  /** The member's working ranges for that day ("HH:mm", Bogotá). Use `rangesForDate`. */
  ranges: Pick<ScheduleRange, "start" | "end">[];
  /** Busy intervals in epoch ms: active appointments and time blocks. */
  busy: Interval[];
  durationMin: number;
  /** Distance between candidate starts, counted from the start of each range. */
  stepMin: number;
  /** Earliest bookable start is `now + minNoticeMin`. */
  minNoticeMin: number;
  now: number;
};

const MINUTE = 60_000;

/** Weekday (0 = Sunday) of a calendar day; calendar days have no time zone. */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The schedule ranges that apply to a Bogotá calendar day. */
export function rangesForDate(schedule: ScheduleRange[], date: string): ScheduleRange[] {
  const day = weekdayOf(date);
  return schedule.filter((range) => range.day === day);
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Start times (epoch ms, ascending) where `[start, start + duration)` fits fully
 * inside one working range and overlaps no busy interval.
 */
export function freeSlots(input: FreeSlotsInput): number[] {
  const { date, ranges, busy, durationMin, stepMin, minNoticeMin, now } = input;
  if (durationMin <= 0 || stepMin <= 0) return [];
  const duration = durationMin * MINUTE;
  const earliest = now + minNoticeMin * MINUTE;
  const starts = new Set<number>();

  for (const range of ranges) {
    const rangeStart = bogotaToEpoch(date, range.start);
    const rangeEnd = bogotaToEpoch(date, range.end);
    for (let start = rangeStart; start + duration <= rangeEnd; start += stepMin * MINUTE) {
      if (start < earliest) continue;
      const candidate = { start, end: start + duration };
      if (busy.some((interval) => overlaps(candidate, interval))) continue;
      starts.add(start);
    }
  }

  return [...starts].sort((a, b) => a - b);
}
