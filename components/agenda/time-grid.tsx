"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { AppointmentStatus, StaffColor, TimeBlockKind } from "@/convex/lib/validators";
import { APPOINTMENT_STATUS_LABELS, STAFF_COLORS } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatHour, minutesOfDay, toMinutes } from "./dates";

export const HOUR_PX = 64;
const PX_PER_MIN = HOUR_PX / 60;
const SNAP_MIN = 15;

export type GridAppointment = {
  _id: Id<"appointments">;
  memberId: Id<"members">;
  start: number;
  end: number;
  status: AppointmentStatus;
  clientName: string;
  treatmentName: string;
  color: StaffColor;
};

export type GridBlock = {
  _id: Id<"timeBlocks">;
  memberId: Id<"members">;
  start: number;
  end: number;
  allDay: boolean;
  kind: TimeBlockKind;
  title?: string;
};

export type GridColumn = {
  key: string;
  /** Bogotá day, "YYYY-MM-DD". */
  date: string;
  /** Set when the column belongs to one professional (new appointments go to them). */
  memberId?: Id<"members">;
  /** Column title; the header row is left out when no column has one. */
  header: ReactNode;
  /** Working ranges ("HH:mm") shown on white; the rest is porcelain. */
  working: { start: string; end: string }[];
  appointments: GridAppointment[];
  blocks: GridBlock[];
  isToday: boolean;
};

export type SlotSelection = { date: string; startMin: number; endMin?: number; memberId?: Id<"members"> };

type Props = {
  columns: GridColumn[];
  startHour: number;
  endHour: number;
  now: number;
  /** Narrow columns (week on a phone): cards show the client's first name only. */
  compact?: boolean;
  onSlot: (slot: SlotSelection) => void;
  onAppointment: (id: Id<"appointments">) => void;
  onBlock: (block: GridBlock) => void;
};

/** Day and week time grid: hour rows of 64 px, 15-minute snapping, tap or drag an empty slot. */
export function TimeGrid({ columns, startHour, endHour, now, compact, onSlot, onAppointment, onBlock }: Props) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = (endHour - startHour) * HOUR_PX;
  const template = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };
  const hasHeader = columns.some((column) => column.header != null);
  const body = useRef<HTMLDivElement>(null);
  const todayShown = columns.some((column) => column.isToday);
  const days = columns.map((column) => column.date).join();

  // Opening a range with today scrolls to an hour before now, so the rest of the day is in view.
  useEffect(() => {
    if (!todayShown || !body.current) return;
    const target = minutesOfDay(Date.now()) - 60 - startHour * 60;
    if (target <= 0) return;
    const headers = hasHeader ? 112 : 72;
    window.scrollTo({ top: body.current.getBoundingClientRect().top + window.scrollY + target * PX_PER_MIN - headers });
    // Only when the shown days change, not on every data update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div className="border-y border-line bg-surface sm:overflow-clip sm:rounded-card sm:border">
      {hasHeader && (
        <div className="sticky top-14 z-10 flex border-b border-line bg-surface lg:top-16">
          <div className="w-16 shrink-0" />
          <div className="grid flex-1" style={template}>
            {columns.map((column) => (
              <div key={column.key} className="min-w-0 border-l border-line px-1 py-2 sm:px-2">
                {column.header}
              </div>
            ))}
          </div>
        </div>
      )}
      <div ref={body} className="flex">
        <div className="relative w-16 shrink-0" style={{ height }} aria-hidden>
          {hours.slice(1).map((hour) => (
            <span
              key={hour}
              className="absolute right-1.5 -translate-y-1/2 text-sm whitespace-nowrap text-ink-soft tabular-nums"
              style={{ top: (hour - startHour) * HOUR_PX }}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>
        <div className="grid flex-1" style={template}>
          {columns.map((column) => (
            <Column
              key={column.key}
              column={column}
              startHour={startHour}
              height={height}
              now={now}
              compact={compact}
              onSlot={onSlot}
              onAppointment={onAppointment}
              onBlock={onBlock}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Column({
  column,
  startHour,
  height,
  now,
  compact,
  onSlot,
  onAppointment,
  onBlock,
}: Omit<Props, "columns" | "endHour"> & { column: GridColumn; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const pointerType = useRef<string>("mouse");
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null);
  const top = (minutes: number) => (minutes - startHour * 60) * PX_PER_MIN;
  // Blocks share lanes with appointments, so an overlapping appointment never hides a block's title.
  const lanes = layoutLanes([...column.appointments, ...column.blocks]);
  const laneStyle = (id: string) => {
    const { lane, count } = lanes.get(id)!;
    return { left: `calc(${(lane / count) * 100}% + 2px)`, width: `calc(${100 / count}% - 4px)` };
  };

  function minuteAt(clientY: number) {
    const rect = ref.current!.getBoundingClientRect();
    const minutes = startHour * 60 + (clientY - rect.top) / PX_PER_MIN;
    return Math.max(0, Math.min(24 * 60 - SNAP_MIN, Math.floor(minutes / SNAP_MIN) * SNAP_MIN));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerType.current = event.pointerType;
    if (event.pointerType !== "mouse" || event.button !== 0 || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const minute = minuteAt(event.clientY);
    setDrag({ anchor: minute, current: minute });
  }

  function onPointerUp() {
    if (!drag) return;
    const from = Math.min(drag.anchor, drag.current);
    const to = Math.max(drag.anchor, drag.current) + SNAP_MIN;
    setDrag(null);
    onSlot({ date: column.date, startMin: from, endMin: to - from > SNAP_MIN ? to : undefined, memberId: column.memberId });
  }

  const nowMin = minutesOfDay(now);

  return (
    <div
      ref={ref}
      role="presentation"
      className="relative touch-pan-y border-l border-line bg-porcelain select-none"
      style={{ height }}
      onPointerDown={onPointerDown}
      onPointerMove={(event) => drag && setDrag({ ...drag, current: minuteAt(event.clientY) })}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onClick={(event) => {
        if (pointerType.current === "mouse" || event.target !== event.currentTarget) return;
        onSlot({ date: column.date, startMin: minuteAt(event.clientY), memberId: column.memberId });
      }}
    >
      {column.working.map((range) => (
        <div
          key={`${range.start}-${range.end}`}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bg-surface"
          style={{ top: top(toMinutes(range.start)), height: (toMinutes(range.end) - toMinutes(range.start)) * PX_PER_MIN }}
        />
      ))}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, var(--line) 1px, transparent 1px)`,
          backgroundSize: `100% ${HOUR_PX}px`,
        }}
      />

      {column.blocks.map((block) => {
        const start = block.allDay ? startHour * 60 : Math.max(minutesOfDay(block.start), startHour * 60);
        const end = block.allDay || block.end - block.start >= 24 * 60 * 60_000 ? 24 * 60 : minutesOfDay(block.end) || 24 * 60;
        return (
          <button
            key={block._id}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onBlock(block)}
            className="absolute flex flex-col items-start overflow-hidden rounded-md border border-line px-1.5 py-1 text-left text-sm text-ink-soft"
            style={{
              ...laneStyle(block._id),
              top: top(start),
              height: Math.max((Math.min(end, 24 * 60) - start) * PX_PER_MIN, 20),
              backgroundImage: "repeating-linear-gradient(135deg, var(--line) 0 2px, var(--porcelain) 2px 9px)",
            }}
          >
            <span className="line-clamp-2 rounded bg-porcelain/80 font-medium">
              {block.title || (block.allDay ? "Todo el día" : "Bloqueado")}
            </span>
          </button>
        );
      })}

      {column.appointments.map((appointment) => {
        const start = minutesOfDay(appointment.start);
        const minutes = Math.max(Math.round((appointment.end - appointment.start) / 60_000), 15);
        return (
          <AppointmentCard
            key={appointment._id}
            appointment={appointment}
            compact={compact}
            heightPx={minutes * PX_PER_MIN}
            style={{
              top: top(start),
              height: Math.max(minutes * PX_PER_MIN - 2, 20),
              ...laneStyle(appointment._id),
            }}
            onClick={() => onAppointment(appointment._id)}
          />
        );
      })}

      {drag && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0.5 rounded-md border-2 border-plum bg-lilac/80"
          style={{
            top: top(Math.min(drag.anchor, drag.current)),
            height: (Math.abs(drag.current - drag.anchor) + SNAP_MIN) * PX_PER_MIN,
          }}
        />
      )}

      {column.isToday && nowMin >= startHour * 60 && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[5] flex items-center" style={{ top: top(nowMin) }}>
          <span className="-ml-1 size-2.5 rounded-full bg-plum" />
          <span className="h-0.5 flex-1 bg-plum" />
        </div>
      )}
    </div>
  );
}

function AppointmentCard({
  appointment,
  compact,
  heightPx,
  style,
  onClick,
}: {
  appointment: GridAppointment;
  compact?: boolean;
  heightPx: number;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const { soft, strong } = STAFF_COLORS[appointment.color];
  const status = appointment.status;
  const requested = status === "requested";
  const muted = status === "completed" || status === "cancelled" || status === "no_show";
  const struck = status === "no_show" || status === "cancelled";
  const name = compact ? appointment.clientName.split(" ")[0] : appointment.clientName;
  const short = heightPx < 36;
  const time = formatTime(appointment.start).replace(/ [ap]\. m\.$/, "");

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      aria-label={`${formatTime(appointment.start)}, ${appointment.clientName}, ${appointment.treatmentName}, ${APPOINTMENT_STATUS_LABELS[status]}`}
      className={cn(
        "absolute z-[4] flex overflow-hidden rounded-md text-left leading-tight hover:brightness-95 focus-visible:z-10",
        short ? "items-center gap-1.5" : "flex-col",
        compact ? "px-1 py-0.5" : short ? "pr-1.5 pl-2.5" : "pt-0.5 pr-1.5 pb-0.5 pl-2.5",
        requested && "border border-dashed bg-surface",
        muted && "opacity-60",
      )}
      style={{ ...style, backgroundColor: requested ? undefined : soft, borderColor: requested ? strong : undefined }}
    >
      {!compact && !requested && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: strong }} />}
      {status === "in_progress" && (
        <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full" style={{ backgroundColor: strong }} />
      )}
      {!compact && (
        <span className={cn("font-display shrink-0 tabular-nums", short ? "text-sm/5" : "text-base/5")} style={{ color: strong }}>
          {time}
        </span>
      )}
      <span className={cn("shrink-0 truncate text-sm/[1.125rem] font-medium text-ink", struck && "line-through")}>{name}</span>
      {!compact && heightPx >= 56 && <span className="shrink-0 truncate text-sm/[1.125rem] text-ink-soft">{appointment.treatmentName}</span>}
    </button>
  );
}

/** Side-by-side lanes for overlapping appointments: lane index and lane count per cluster. */
export function layoutLanes(items: { _id: string; start: number; end: number }[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result = new Map<string, { lane: number; count: number }>();
  let cluster: { _id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const item of cluster) result.set(item._id, { lane: item.lane, count: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) lane = laneEnds.push(item.end) - 1;
    else laneEnds[lane] = item.end;
    cluster.push({ _id: item._id, lane });
    clusterEnd = Math.max(item.start >= clusterEnd ? item.end : clusterEnd, item.end);
  }
  flush();
  return result;
}
