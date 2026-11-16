"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Chip } from "@/components/clients/chips";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { bogotaDateKey } from "@/convex/lib/time";
import { rangesForDate } from "@/convex/lib/slots";
import { cn } from "@/lib/utils";
import { useAgendaSheets } from "./agenda-sheets";
import {
  addDays,
  addMonths,
  dateToKey,
  dayStart,
  formatCompactTitle,
  formatDayKey,
  formatMonth,
  formatShortDay,
  formatWeek,
  keyToDate,
  minutesOfDay,
  monthGrid,
  toMinutes,
  todayKey,
  toTime,
  weekStart,
} from "./dates";
import { MonthView } from "./month-view";
import { useFormOptions, useNow, type FormOptions } from "./parts";
import { TimeGrid, type GridAppointment, type GridBlock, type GridColumn, type SlotSelection } from "./time-grid";

type View = "dia" | "semana" | "mes";
const VIEWS: { value: View; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

export function AgendaView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const viewer = useViewer();
  const openSheet = useAgendaSheets();
  const isPhone = useIsMobile();
  const options = useFormOptions();
  const now = useNow();

  const viewParam = params.get("vista");
  const view: View = viewParam === "dia" || viewParam === "semana" || viewParam === "mes" ? viewParam : isPhone ? "dia" : "semana";
  const dateParam = params.get("fecha");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayKey();
  const today = bogotaDateKey(now);

  const [memberFilter, setMemberFilter] = useState<Id<"members"> | "all">("all");
  const [showCancelled, setShowCancelled] = useState(false);

  function navigate(next: { vista?: View; fecha?: string }) {
    const search = new URLSearchParams(params);
    if (next.vista) search.set("vista", next.vista);
    if (next.fecha) search.set("fecha", next.fecha);
    router.replace(`${pathname}?${search}`, { scroll: false });
  }

  const range = useMemo(() => {
    if (view === "dia") return { days: [date], start: dayStart(date), end: dayStart(addDays(date, 1)) };
    if (view === "semana") {
      const first = weekStart(date);
      const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
      return { days, start: dayStart(first), end: dayStart(addDays(first, 7)) };
    }
    const days = monthGrid(date);
    return { days, start: dayStart(days[0]), end: dayStart(addDays(days[days.length - 1], 1)) };
  }, [view, date]);

  const data = useQuery(api.appointments.agenda, { start: range.start, end: range.end });

  const members = options?.members ?? [];
  const isSalon = viewer.org.kind === "salon" && members.length > 1;
  const ownMember = members.find((m) => m._id === viewer.member._id);
  // Phones show one professional at a time in the day view.
  const singleMemberDay = view === "dia" && isPhone && isSalon;
  const selected =
    memberFilter !== "all" ? memberFilter : singleMemberDay ? (ownMember?._id ?? members[0]?._id) : "all";

  const step = (direction: 1 | -1) =>
    navigate({ fecha: view === "dia" ? addDays(date, direction) : view === "semana" ? addDays(date, 7 * direction) : addMonths(date, direction) });

  const title = capitalize(
    isPhone ? formatCompactTitle(view, date) : view === "dia" ? formatDayKey(date) : view === "semana" ? formatWeek(date) : formatMonth(date),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <DatePicker title={title} value={date} onChange={(fecha) => navigate({ fecha })} />
          <Button variant="ghost" size="icon" aria-label="Anterior" onClick={() => step(-1)}>
            <ChevronLeft strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Siguiente" onClick={() => step(1)}>
            <ChevronRight strokeWidth={1.75} />
          </Button>
          {/* Phones only show "Hoy" when it does something, to keep the controls on one row. */}
          {(!isPhone || date !== today) && (
            <Button variant="secondary" onClick={() => navigate({ fecha: today })} disabled={date === today} className="ml-1">
              Hoy
            </Button>
          )}
        </div>
        {!isPhone && <Segmented value={view} onChange={(vista) => navigate({ vista })} />}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {isPhone && <Segmented value={view} onChange={(vista) => navigate({ vista })} compact />}
        {isSalon && !singleMemberDay && (
          <Chip selected={selected === "all"} aria-pressed={selected === "all"} onClick={() => setMemberFilter("all")} className="shrink-0">
            Todo el equipo
          </Chip>
        )}
        {isSalon &&
          members.map((member) => (
            <Chip
              key={member._id}
              selected={selected === member._id}
              aria-pressed={selected === member._id}
              onClick={() => setMemberFilter(member._id)}
              className="shrink-0"
            >
              {member.name.split(" ")[0]}
            </Chip>
          ))}
        <Chip
          selected={showCancelled}
          aria-pressed={showCancelled}
          onClick={() => setShowCancelled(!showCancelled)}
          className="shrink-0"
        >
          Canceladas
        </Chip>
      </div>

      {!options || !data ? (
        <AgendaSkeleton />
      ) : view === "mes" ? (
        <MonthView
          days={range.days}
          month={date.slice(0, 7)}
          today={today}
          byDay={groupByDay(filterAppointments(data.appointments, selected, showCancelled))}
          onDay={(fecha) => navigate({ vista: "dia", fecha })}
        />
      ) : (
        <div className="-mx-4 sm:mx-0">
          <GridForView
            view={view}
            days={range.days}
            today={today}
            now={now}
            options={options}
            selected={selected}
            byMemberColumns={view === "dia" && !isPhone && isSalon && selected === "all"}
            appointments={filterAppointments(data.appointments, selected, showCancelled)}
            blocks={data.blocks}
            compact={view === "semana" && isPhone}
            onSlot={(slot) =>
              openSheet({
                kind: "slot",
                date: slot.date,
                startTime: toTime(slot.startMin),
                endTime: slot.endMin ? toTime(slot.endMin) : undefined,
                memberId: slot.memberId ?? (selected === "all" ? undefined : selected),
              })
            }
            onAppointment={(appointmentId) => openSheet({ kind: "detail", appointmentId })}
            onBlock={(block) => openSheet({ kind: "block", block })}
          />
        </div>
      )}
    </div>
  );
}

function GridForView({
  view,
  days,
  today,
  now,
  options,
  selected,
  byMemberColumns,
  appointments,
  blocks,
  compact,
  onSlot,
  onAppointment,
  onBlock,
}: {
  view: View;
  days: string[];
  today: string;
  now: number;
  options: FormOptions;
  selected: Id<"members"> | "all";
  byMemberColumns: boolean;
  appointments: GridAppointment[];
  blocks: GridBlock[];
  compact: boolean;
  onSlot: (slot: SlotSelection) => void;
  onAppointment: (id: Id<"appointments">) => void;
  onBlock: (block: GridBlock) => void;
}) {
  const visibleMembers = selected === "all" ? options.members : options.members.filter((m) => m._id === selected);
  const inDay = (date: string) => (item: { start: number }) => bogotaDateKey(item.start) === date;
  const ofMembers = (ids: Set<string>) => (item: { memberId: string }) => ids.has(item.memberId);

  const columns: GridColumn[] = byMemberColumns
    ? options.members.map((member) => {
        const ids = new Set([member._id as string]);
        return {
          key: member._id,
          date: days[0],
          memberId: member._id,
          header: (
            <span className="flex min-w-0 items-center gap-2">
              <InitialsAvatar name={member.name} color={member.color} size="sm" />
              <span className="truncate font-medium">{member.name}</span>
            </span>
          ),
          working: rangesForDate(member.schedule, days[0]),
          appointments: appointments.filter(inDay(days[0])).filter(ofMembers(ids)),
          blocks: blocks.filter(inDay(days[0])).filter(ofMembers(ids)),
          isToday: days[0] === today,
        };
      })
    : days.map((date) => {
        const ids = new Set(visibleMembers.map((m) => m._id as string));
        const short = formatShortDay(date);
        return {
          key: date,
          date,
          memberId: selected === "all" ? undefined : selected,
          header:
            // The member chips already say whose day it is.
            view === "dia" ? null : (
              <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
                <span className="text-sm text-ink-soft">{short.weekday}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                    date === today && "bg-plum text-on-solid",
                  )}
                >
                  {short.day}
                </span>
              </span>
            ),
          working: mergeRanges(visibleMembers.flatMap((m) => rangesForDate(m.schedule, date))),
          appointments: appointments.filter(inDay(date)).filter(ofMembers(ids)),
          blocks: blocks.filter(inDay(date)).filter(ofMembers(ids)),
          isToday: date === today,
        };
      });

  // Show 7:00–20:00 at least, stretched to fit working hours and events.
  let startHour = 7;
  let endHour = 20;
  for (const column of columns) {
    for (const range of column.working) {
      startHour = Math.min(startHour, Math.floor(toMinutes(range.start) / 60));
      endHour = Math.max(endHour, Math.ceil(toMinutes(range.end) / 60));
    }
    for (const item of [...column.appointments, ...column.blocks.filter((b) => !b.allDay)]) {
      startHour = Math.min(startHour, Math.floor(minutesOfDay(item.start) / 60));
      const endMinutes = minutesOfDay(item.end) || 24 * 60;
      endHour = Math.max(endHour, Math.ceil(endMinutes / 60));
    }
  }

  return (
    <TimeGrid
      columns={columns}
      startHour={startHour}
      endHour={Math.min(endHour, 24)}
      now={now}
      compact={compact}
      onSlot={onSlot}
      onAppointment={onAppointment}
      onBlock={onBlock}
    />
  );
}

function filterAppointments(appointments: GridAppointment[], selected: Id<"members"> | "all", showCancelled: boolean) {
  return appointments.filter(
    (a) => (selected === "all" || a.memberId === selected) && (showCancelled || a.status !== "cancelled"),
  );
}

function groupByDay(appointments: GridAppointment[]) {
  const map = new Map<string, GridAppointment[]>();
  for (const appointment of [...appointments].sort((a, b) => a.start - b.start)) {
    const key = bogotaDateKey(appointment.start);
    map.set(key, [...(map.get(key) ?? []), appointment]);
  }
  return map;
}

/** Union of "HH:mm" ranges, so overlapping schedules shade once. */
function mergeRanges(ranges: { start: string; end: string }[]) {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  const merged: { start: string; end: string }[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = range.end > last.end ? range.end : last.end;
    else merged.push({ start: range.start, end: range.end });
  }
  return merged;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function DatePicker({ title, value, onChange }: { title: string; value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${title}. Elegir fecha`}
          className="font-display -ml-2 min-h-11 min-w-0 truncate rounded-lg px-2 text-left text-[1.375rem] leading-tight hover:bg-lilac lg:text-[1.75rem]"
        >
          {title}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={keyToDate(value)}
          defaultMonth={keyToDate(value)}
          weekStartsOn={1}
          onSelect={(day) => {
            if (!day) return;
            onChange(dateToKey(day));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function Segmented({ value, onChange, compact }: { value: View; onChange: (value: View) => void; compact?: boolean }) {
  return (
    <div
      role="radiogroup"
      aria-label="Vista"
      className={cn("flex shrink-0 rounded-[0.75rem] border border-line bg-porcelain", compact ? "p-0.5" : "p-1")}
    >
      {VIEWS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg text-base font-medium transition-colors",
            compact ? "min-h-10 px-3" : "min-h-11 flex-1 px-4 lg:flex-none",
            value === option.value ? "bg-surface text-ink shadow-[0_1px_2px_rgb(42_33_49/0.08)]" : "text-ink-soft hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AgendaSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
