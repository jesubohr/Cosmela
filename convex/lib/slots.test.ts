import { describe, expect, test } from "vitest";
import { freeSlots, rangesForDate, weekdayOf, type FreeSlotsInput } from "./slots";
import { bogotaToEpoch } from "./time";

// Saturday 2026-11-14 in Bogotá (UTC-5, no daylight saving time).
const DATE = "2026-11-14";
const at = (time: string, date = DATE) => bogotaToEpoch(date, time);
const MIDNIGHT_BEFORE = at("00:00");

function slots(overrides: Partial<FreeSlotsInput>) {
  return freeSlots({
    date: DATE,
    ranges: [{ start: "08:00", end: "10:00" }],
    busy: [],
    durationMin: 60,
    stepMin: 30,
    minNoticeMin: 0,
    now: MIDNIGHT_BEFORE,
    ...overrides,
  });
}

const times = (starts: number[]) =>
  starts.map((ms) => {
    const date = new Date(ms - 5 * 3_600_000); // Bogotá is UTC-5
    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  });

describe("freeSlots", () => {
  test("steps through a range and keeps the duration inside it", () => {
    expect(times(slots({}))).toEqual(["08:00", "08:30", "09:00"]);
  });

  test("uses Bogotá time, not UTC", () => {
    expect(slots({})[0]).toBe(Date.UTC(2026, 10, 14, 13, 0));
  });

  test("covers several ranges in one day (lunch break)", () => {
    const result = slots({
      ranges: [
        { start: "08:00", end: "12:00" },
        { start: "14:00", end: "16:00" },
      ],
      stepMin: 60,
    });
    expect(times(result)).toEqual(["08:00", "09:00", "10:00", "11:00", "14:00", "15:00"]);
  });

  test("a duration that crosses the end of a range never fits there", () => {
    const result = slots({ ranges: [{ start: "08:00", end: "09:45" }], durationMin: 60, stepMin: 15 });
    expect(times(result)).toEqual(["08:00", "08:15", "08:30", "08:45"]);
  });

  test("does not join two ranges to fit a long duration", () => {
    const result = slots({
      ranges: [
        { start: "08:00", end: "09:00" },
        { start: "09:00", end: "10:00" },
      ],
      durationMin: 90,
    });
    expect(result).toEqual([]);
  });

  test("a duration longer than every range gives no slots", () => {
    expect(slots({ durationMin: 180 })).toEqual([]);
  });

  test("skips starts that overlap a busy interval", () => {
    const result = slots({ busy: [{ start: at("08:30"), end: at("09:00") }] });
    // 08:00 ends at 09:00 and 08:30 starts inside the busy time; 09:00 is free.
    expect(times(result)).toEqual(["09:00"]);
  });

  test("touching intervals do not overlap", () => {
    const result = slots({ busy: [{ start: at("07:00"), end: at("08:00") }, { start: at("09:00"), end: at("10:00") }] });
    expect(times(result)).toEqual(["08:00"]);
  });

  test("a busy interval that covers the whole range leaves nothing", () => {
    expect(slots({ busy: [{ start: at("07:00"), end: at("11:00") }] })).toEqual([]);
  });

  test("handles several busy intervals", () => {
    const result = slots({
      ranges: [{ start: "08:00", end: "12:00" }],
      busy: [
        { start: at("08:00"), end: at("08:30") },
        { start: at("10:00"), end: at("11:00") },
      ],
      durationMin: 30,
    });
    expect(times(result)).toEqual(["08:30", "09:00", "09:30", "11:00", "11:30"]);
  });

  test("respects the minimum notice from now", () => {
    const result = slots({ now: at("07:10"), minNoticeMin: 60, durationMin: 30 });
    // Earliest start is 08:10, so 08:00 is out.
    expect(times(result)).toEqual(["08:30", "09:00", "09:30"]);
  });

  test("never offers past starts", () => {
    expect(times(slots({ now: at("08:45"), durationMin: 30 }))).toEqual(["09:00", "09:30"]);
    expect(slots({ now: at("23:00") })).toEqual([]);
  });

  test("the step counts from each range start", () => {
    const result = slots({ ranges: [{ start: "08:15", end: "09:45" }], durationMin: 30, stepMin: 30 });
    expect(times(result)).toEqual(["08:15", "08:45", "09:15"]);
  });

  test("overlapping ranges give each start once, in order", () => {
    const result = slots({
      ranges: [
        { start: "09:00", end: "10:00" },
        { start: "08:00", end: "10:00" },
      ],
    });
    expect(times(result)).toEqual(["08:00", "08:30", "09:00"]);
  });

  test("no ranges or invalid sizes give no slots", () => {
    expect(slots({ ranges: [] })).toEqual([]);
    expect(slots({ durationMin: 0 })).toEqual([]);
    expect(slots({ stepMin: 0 })).toEqual([]);
  });

  test("busy time on another day does not matter", () => {
    const nextDay = { start: at("08:00", "2026-11-15"), end: at("10:00", "2026-11-15") };
    expect(times(slots({ busy: [nextDay] }))).toEqual(["08:00", "08:30", "09:00"]);
  });
});

describe("rangesForDate", () => {
  const schedule = [
    { day: 1, start: "08:00", end: "12:00" },
    { day: 1, start: "14:00", end: "18:00" },
    { day: 6, start: "08:00", end: "13:00" },
  ];

  test("picks the ranges of the weekday", () => {
    expect(weekdayOf(DATE)).toBe(6);
    expect(rangesForDate(schedule, DATE)).toEqual([{ day: 6, start: "08:00", end: "13:00" }]);
    expect(rangesForDate(schedule, "2026-11-16")).toHaveLength(2);
    expect(rangesForDate(schedule, "2026-11-15")).toEqual([]);
  });
});
