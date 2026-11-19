"use client";

import { STAFF_COLORS } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatDayKey, formatShortDay } from "./dates";
import type { GridAppointment } from "./time-grid";

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const VISIBLE = 3;

/** Month grid: appointments per day (dots on phones, first lines on larger screens). Tap a day to open it. */
export function MonthView({
  days,
  month,
  today,
  byDay,
  onDay,
}: {
  days: string[];
  /** "YYYY-MM" of the month shown; other days are muted. */
  month: string;
  today: string;
  byDay: Map<string, GridAppointment[]>;
  onDay: (date: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2 text-sm text-ink-soft">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date, index) => {
          const items = byDay.get(date) ?? [];
          const inMonth = date.startsWith(month);
          const isToday = date === today;
          const label = formatDayKey(date);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onDay(date)}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${label}${items.length ? `, ${items.length} ${items.length === 1 ? "cita" : "citas"}` : ""}`}
              className={cn(
                "flex min-h-16 flex-col gap-1 border-line p-1 text-left hover:bg-porcelain sm:min-h-28 sm:p-1.5",
                index % 7 !== 0 && "border-l",
                index >= 7 && "border-t",
                !inMonth && "bg-porcelain/60",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                  isToday ? "bg-plum font-medium text-on-solid" : inMonth ? "text-ink" : "text-ink-soft",
                )}
              >
                {formatShortDay(date).day}
              </span>
              {items.length > 0 && (
                <>
                  <span className="flex flex-wrap gap-1 px-1 sm:hidden" aria-hidden>
                    {items.slice(0, 4).map((item) => (
                      <span key={item._id} className="size-1.5 rounded-full" style={{ backgroundColor: STAFF_COLORS[item.color].strong }} />
                    ))}
                  </span>
                  <span className="hidden flex-col gap-0.5 sm:flex" aria-hidden>
                    {items.slice(0, VISIBLE).map((item) => (
                      <span
                        key={item._id}
                        className={cn("flex items-center gap-1.5 truncate rounded px-1 text-sm", item.status === "requested" && "border border-dashed")}
                        style={{ backgroundColor: item.status === "requested" ? undefined : STAFF_COLORS[item.color].soft, borderColor: STAFF_COLORS[item.color].strong }}
                      >
                        <span className="shrink-0 tabular-nums text-ink-soft">{formatTime(item.start).replace(/ [ap]\. m\.$/, "")}</span>
                        <span className="truncate text-ink">{item.clientName.split(" ")[0]}</span>
                      </span>
                    ))}
                    {items.length > VISIBLE && <span className="px-1 text-sm text-ink-soft">{items.length - VISIBLE} más</span>}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
