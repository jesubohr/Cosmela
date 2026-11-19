"use client";

import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { StatusChip } from "@/components/agenda/parts";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import type { Id } from "@/convex/_generated/dataModel";
import type { AppointmentStatus, StaffColor } from "@/convex/lib/validators";
import { STAFF_COLORS, TIME_BLOCK_KIND_LABELS } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NotStartedChip, TimeText } from "./parts";
import type { BlockData } from "@/components/agenda/block-form";
import type { DayAppointment } from "./hoy-view";

/** The fields a row needs, so Hoy and the agenda list can both pass their own data. */
type TimelineAppointment = Pick<DayAppointment, "_id" | "start" | "memberId" | "color" | "treatmentName"> & {
  status: AppointmentStatus;
  client: { name: string };
};

type Item = { kind: "appointment"; start: number; appointment: TimelineAppointment } | { kind: "block"; start: number; block: BlockData };

const HATCH = "repeating-linear-gradient(135deg, var(--line) 0 2px, var(--porcelain) 2px 9px)";

/** "Tu día": appointments and blocks in time order, with a plum line at the current time. */
export function DayTimeline({
  appointments,
  blocks,
  now,
  showNow = true,
  members,
}: {
  appointments: TimelineAppointment[];
  blocks: BlockData[];
  now: number;
  /** Off for any day but today, where a current-time line means nothing. */
  showNow?: boolean;
  /** Set in team view: each row shows its professional. */
  members?: Map<Id<"members">, { name: string; color: StaffColor }>;
}) {
  const openSheet = useAgendaSheets();
  const items: Item[] = [
    ...appointments.map((appointment) => ({ kind: "appointment" as const, start: appointment.start, appointment })),
    ...blocks.map((block) => ({ kind: "block" as const, start: block.start, block })),
  ].sort((a, b) => a.start - b.start);
  const nowIndex = items.findIndex((item) => item.start > now);
  const linePosition = nowIndex === -1 ? items.length : nowIndex;

  const rows = items.map((item) => {
    const member = members?.get(item.kind === "appointment" ? item.appointment.memberId : item.block.memberId);
    return (
      <li key={item.kind === "appointment" ? item.appointment._id : item.block._id}>
        {item.kind === "appointment" ? (
          <AppointmentRow appointment={item.appointment} member={member} notStarted={item.appointment.status === "scheduled" && item.appointment.start <= now} onOpen={() => openSheet({ kind: "detail", appointmentId: item.appointment._id })} />
        ) : (
          <BlockRow block={item.block} member={member} onOpen={() => openSheet({ kind: "block", block: item.block })} />
        )}
      </li>
    );
  });
  if (showNow) {
    rows.splice(
      linePosition,
      0,
      <li key="now" className="flex items-center gap-3 px-3 py-1" aria-label={`Ahora, ${formatTime(now)}`}>
        <span className="w-[6.5rem] shrink-0 text-sm font-medium text-plum tabular-nums">{formatTime(now)}</span>
        <span aria-hidden className="size-2 rounded-full bg-plum" />
        <span aria-hidden className="h-px flex-1 bg-plum" />
      </li>,
    );
  }

  return <ol className="-mx-3 flex flex-col">{rows}</ol>;
}

const rowClass = "flex w-full items-stretch gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-lilac/60";

function AppointmentRow({
  appointment,
  member,
  notStarted,
  onOpen,
}: {
  appointment: TimelineAppointment;
  member?: { name: string; color: StaffColor };
  notStarted: boolean;
  onOpen: () => void;
}) {
  const muted = appointment.status === "completed" || appointment.status === "no_show" || appointment.status === "cancelled";
  return (
    <button type="button" onClick={onOpen} className={rowClass}>
      <TimeText ms={appointment.start} className={cn("w-[6.5rem] shrink-0 pt-0.5 text-[1.375rem] leading-none", muted && "text-ink-soft")} />
      <span
        aria-hidden
        className={cn("w-1 shrink-0 rounded-full", appointment.status === "requested" && "border border-dashed bg-transparent!")}
        style={{ backgroundColor: STAFF_COLORS[appointment.color].strong, borderColor: STAFF_COLORS[appointment.color].strong }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("line-clamp-2 font-medium", muted && "text-ink-soft", (appointment.status === "no_show" || appointment.status === "cancelled") && "line-through")}>
          {appointment.client.name}
        </span>
        <span className="line-clamp-2 text-ink-soft">{appointment.treatmentName}</span>
        {appointment.status !== "scheduled" && <StatusChip status={appointment.status} className="mt-1 self-start" />}
        {notStarted && <NotStartedChip className="mt-1 self-start" />}
      </span>
      {member && (
        <span className="self-center" title={member.name}>
          <InitialsAvatar name={member.name} color={member.color} size="sm" />
          <span className="sr-only">{member.name}</span>
        </span>
      )}
    </button>
  );
}

function BlockRow({ block, member, onOpen }: { block: BlockData; member?: { name: string; color: StaffColor }; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={rowClass}>
      {block.allDay ? (
        <span className="w-[6.5rem] shrink-0 pt-0.5 text-ink-soft">Todo el día</span>
      ) : (
        <TimeText ms={block.start} className="w-[6.5rem] shrink-0 pt-0.5 text-[1.375rem] leading-none text-ink-soft" />
      )}
      <span aria-hidden className="w-1 shrink-0 rounded-full" style={{ backgroundImage: HATCH, backgroundColor: "var(--line)" }} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 font-medium text-ink-soft">{block.title || `Bloqueo ${TIME_BLOCK_KIND_LABELS[block.kind].toLowerCase()}`}</span>
        {!block.allDay && <span className="text-ink-soft">Hasta las {formatTime(block.end)}</span>}
      </span>
      {member && (
        <span className="self-center" title={member.name}>
          <InitialsAvatar name={member.name} color={member.color} size="sm" />
          <span className="sr-only">{member.name}</span>
        </span>
      )}
    </button>
  );
}
