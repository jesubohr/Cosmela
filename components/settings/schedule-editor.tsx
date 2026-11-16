"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ScheduleRange } from "@/convex/lib/validators";
import { rangesOf, WEEK_DAYS } from "./schedule";

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Splits the day's last range with a one-hour pause (at noon when it fits). Null when it is too short. */
function withPause(ranges: ScheduleRange[]): ScheduleRange[] | null {
  const last = ranges[ranges.length - 1];
  const start = toMinutes(last.start);
  const end = toMinutes(last.end);
  if (end - start < 120) return null;
  const pause = start < 12 * 60 && end > 13 * 60 ? 12 * 60 : Math.floor((start + end) / 2 / 30) * 30;
  return [
    ...ranges.slice(0, -1),
    { ...last, end: toTime(pause) },
    { day: last.day, start: toTime(pause + 60), end: last.end },
  ];
}

const sameHours = (a: ScheduleRange[], b: ScheduleRange[]) =>
  a.length === b.length && a.every((range, i) => range.start === b[i].start && range.end === b[i].end);

// Phones open the native picker on tap, so the icon only takes space there.
const TIME_INPUT = "px-2.5 tabular-nums max-sm:[&::-webkit-calendar-picker-indicator]:hidden";

export type ScheduleEditorProps = {
  value: ScheduleRange[];
  onChange: (schedule: ScheduleRange[]) => void;
  /** Message from `scheduleError(value)`, shown under the week. */
  error?: string | null;
  disabled?: boolean;
};

/** Working hours per weekday: an on/off switch, time ranges, and "Agregar pausa" for lunch. */
export function ScheduleEditor({ value, onChange, error, disabled }: ScheduleEditorProps) {
  // "Aplicar a todos" shows only on the day the user just edited.
  const [editedDay, setEditedDay] = useState<number | null>(null);

  function setDay(day: number, ranges: ScheduleRange[]) {
    setEditedDay(day);
    onChange([...value.filter((range) => range.day !== day), ...ranges]);
  }

  const workDays: number[] = WEEK_DAYS.map(({ day }) => day).filter((day) => rangesOf(value, day).length > 0);

  function applyToWorkDays(ranges: ScheduleRange[]) {
    onChange([
      ...value.filter((range) => !workDays.includes(range.day)),
      ...workDays.flatMap((day) => ranges.map((range) => ({ ...range, day }))),
    ]);
    toast.success("Horario aplicado a todos los días laborales");
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {WEEK_DAYS.map(({ day, label }) => {
          const ranges = rangesOf(value, day);
          const open = ranges.length > 0;
          const pause = open ? withPause(ranges) : null;
          const canApplyToAll = day === editedDay && workDays.some((other) => !sameHours(ranges, rangesOf(value, other)));
          const switchId = `schedule-day-${day}`;

          return (
            <li key={day} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex min-h-11 items-center justify-between gap-3 sm:w-36 sm:shrink-0">
                <label htmlFor={switchId} className="font-medium">
                  {label}
                </label>
                <Switch
                  id={switchId}
                  checked={open}
                  disabled={disabled}
                  onCheckedChange={(checked) => setDay(day, checked ? [{ day, start: "08:00", end: "18:00" }] : [])}
                />
              </div>

              {open ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {ranges.map((range, index) => (
                    <div key={index} className="grid grid-cols-[minmax(0,8.5rem)_min-content_minmax(0,8.5rem)_2.75rem] items-center gap-2">
                      <Input
                        type="time"
                        step={900}
                        aria-label={`${label}, entrada${index ? ` después de la pausa ${index}` : ""}`}
                        value={range.start}
                        disabled={disabled}
                        onChange={(e) =>
                          setDay(day, ranges.map((r, i) => (i === index ? { ...r, start: e.target.value } : r)))
                        }
                        className={TIME_INPUT}
                      />
                      <span className="text-ink-soft">a</span>
                      <Input
                        type="time"
                        step={900}
                        aria-label={`${label}, salida${index < ranges.length - 1 ? ` antes de la pausa ${index + 1}` : ""}`}
                        value={range.end}
                        disabled={disabled}
                        onChange={(e) =>
                          setDay(day, ranges.map((r, i) => (i === index ? { ...r, end: e.target.value } : r)))
                        }
                        className={TIME_INPUT}
                      />
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar pausa del ${label.toLowerCase()}`}
                          disabled={disabled}
                          // Removing a pause joins this range with the previous one.
                          onClick={() =>
                            setDay(
                              day,
                              ranges
                                .map((r, i) => (i === index - 1 ? { ...r, end: range.end } : r))
                                .filter((_, i) => i !== index),
                            )
                          }
                        >
                          <X strokeWidth={1.75} />
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-x-6 empty:hidden">
                    {pause && ranges.length < 4 && (
                      <Button
                        type="button"
                        variant="link"
                        disabled={disabled}
                        className="h-11 px-0"
                        onClick={() => setDay(day, pause)}
                      >
                        Agregar pausa
                      </Button>
                    )}
                    {canApplyToAll && (
                      <Button
                        type="button"
                        variant="link"
                        disabled={disabled}
                        className="h-11 px-0 text-ink-soft"
                        onClick={() => applyToWorkDays(ranges)}
                      >
                        Aplicar a todos los días laborales
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="flex min-h-11 items-center text-ink-soft">No trabajas</p>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      )}
    </div>
  );
}
