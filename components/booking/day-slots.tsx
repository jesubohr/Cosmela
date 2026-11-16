"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { inBogota } from "@/convex/lib/time";
import { cn } from "@/lib/utils";

type Day = { date: string; slots: number[] };

const PERIODS = [
  { label: "Mañana", test: (hour: number) => hour < 12 },
  { label: "Tarde", test: (hour: number) => hour >= 12 && hour < 18 },
  { label: "Noche", test: (hour: number) => hour >= 18 },
];

function calendarDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const short = (date: Date, pattern: string) => format(date, pattern, { locale: es }).replace(".", "");

/** Day strip (only days with free times) and the free times of the chosen day. */
export function DaySlots({
  days,
  date,
  onDateChange,
  onPick,
}: {
  days: Day[];
  date: string | null;
  onDateChange: (date: string) => void;
  onPick: (start: number) => void;
}) {
  const active = days.find((d) => d.date === date) ?? days[0];

  return (
    <div className="flex flex-col gap-6">
      <div
        role="radiogroup"
        aria-label="Día"
        className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0"
      >
        {days.map((day) => {
          const calendar = calendarDate(day.date);
          const selected = day.date === active.date;
          return (
            <button
              key={day.date}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={format(calendar, "EEEE d 'de' MMMM", { locale: es })}
              onClick={() => onDateChange(day.date)}
              className={cn(
                "flex h-[76px] w-16 shrink-0 snap-start sm:w-auto flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors",
                selected
                  ? "border-plum bg-plum text-on-solid"
                  : "border-line bg-surface hover:border-plum/40 hover:bg-porcelain",
              )}
            >
              <span className={cn("text-sm", !selected && "text-ink-soft")}>{short(calendar, "EEE")}</span>
              <span className="font-display text-[1.375rem] leading-none tabular-nums">{calendar.getDate()}</span>
              <span className={cn("text-sm", !selected && "text-ink-soft")}>{short(calendar, "MMM")}</span>
            </button>
          );
        })}
      </div>

      <div key={active.date} className="flex flex-col gap-5">
        {PERIODS.map(({ label, test }) => {
          const slots = active.slots.filter((slot) => test(inBogota(slot).getHours()));
          if (slots.length === 0) return null;
          return (
            <div key={label} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-ink-soft">{label}</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => {
                  const time = inBogota(slot);
                  const hours = time.getHours();
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onPick(slot)}
                      className="flex h-[52px] items-baseline justify-center gap-1 rounded-lg border border-line bg-surface pt-3 transition-colors hover:border-plum hover:bg-lilac active:bg-lilac"
                    >
                      <span className="font-display text-[1.25rem] leading-none tabular-nums">
                        {hours % 12 || 12}:{format(time, "mm")}
                      </span>
                      <span className="text-sm text-ink-soft">{hours < 12 ? "a. m." : "p. m."}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
