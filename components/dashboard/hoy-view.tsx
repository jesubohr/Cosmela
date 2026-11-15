"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useAgendaSheets } from "@/components/agenda/agenda-sheets";
import { useNow } from "@/components/agenda/parts";
import { Segmented } from "@/components/forms/segmented";
import { EmptyState } from "@/components/shared/empty-state";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { bogotaDateKey, inBogota } from "@/convex/lib/time";
import { formatDate } from "@/lib/format";
import { DayTimeline } from "./day-timeline";
import { FirstSteps } from "./first-steps";
import { InProgressCard, NextAppointmentCard } from "./next-appointment";
import { firstName, Section } from "./parts";
import { Birthdays, DueFollowUps, PendingPayments, Requests } from "./today-lists";

export type TodayData = FunctionReturnType<typeof api.dashboard.today>;
export type DayAppointment = TodayData["appointments"][number];
export type DayBlock = TodayData["blocks"][number];
export type InProgress = FunctionReturnType<typeof api.sessions.listInProgress>[number];

type Scope = "mine" | "team";

function greeting(now: number) {
  const hour = inBogota(now).getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

export function HoyView() {
  const viewer = useViewer();
  const now = useNow();
  const today = bogotaDateKey(now);
  const data = useQuery(api.dashboard.today, { date: today });
  const followUps = useQuery(api.followUps.listDue, {});
  const inProgress = useQuery(api.sessions.listInProgress, {});
  const isSalon = viewer.org.kind === "salon";
  const [scope, setScope] = useState<Scope>(isSalon && viewer.member.role === "admin" ? "team" : "mine");
  const team = isSalon && scope === "team";

  const members = useMemo(() => new Map((data?.members ?? []).map((m) => [m._id, m])), [data?.members]);
  const mine = <T extends { memberId: string }>(rows: T[]) => (team ? rows : rows.filter((r) => r.memberId === viewer.member._id));

  const name = firstName(viewer.member.name);
  const date = formatDate(now);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-[1.75rem] leading-tight lg:text-[2.25rem]">
              {greeting(now)}
              {name && `, ${name}`}
            </p>
            <p className="text-[1.125rem] text-ink-soft first-letter:uppercase">{date}</p>
          </div>
          {isSalon && (
            <Segmented
              label="Citas a mostrar"
              options={[
                ["mine", "Mi día"],
                ["team", "Todo el equipo"],
              ]}
              value={scope}
              onChange={setScope}
            />
          )}
        </div>

        {data === undefined || inProgress === undefined ? (
          <DaySkeleton />
        ) : (
          <Day
            appointments={mine(data.appointments)}
            blocks={mine(data.blocks)}
            inProgress={mine(inProgress)}
            members={members}
            team={team}
            today={today}
            now={now}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-8">
        {data === undefined || followUps === undefined ? (
          <ListsSkeleton />
        ) : (
          <>
            <Requests rows={data.requests} today={today} members={members} />
            <DueFollowUps rows={followUps} />
            <PendingPayments data={data.pendingPayments} />
            <Birthdays rows={data.birthdays} />
            {data.checklist && <FirstSteps checklist={data.checklist} bookingEnabled={data.bookingEnabled} />}
          </>
        )}
      </div>
    </div>
  );
}

function Day({
  appointments,
  blocks,
  inProgress,
  members,
  team,
  today,
  now,
}: {
  appointments: DayAppointment[];
  blocks: DayBlock[];
  inProgress: InProgress[];
  members: Map<Id<"members">, TodayData["members"][number]>;
  team: boolean;
  today: string;
  now: number;
}) {
  const openSheet = useAgendaSheets();
  // Late arrivals stay "next" until their slot ends.
  const next = appointments.find((a) => a.status === "scheduled" && a.end > now);

  return (
    <>
      {inProgress.length > 0 ? (
        <Section title="En atención">
          {inProgress.map((session) => (
            <InProgressCard key={session.sessionId} session={session} member={team ? members.get(session.memberId) : undefined} />
          ))}
        </Section>
      ) : (
        next && (
          <Section title="Próxima cita">
            <NextAppointmentCard appointment={next} member={team ? members.get(next.memberId) : undefined} />
          </Section>
        )
      )}

      <Section title="Tu día">
        {appointments.length === 0 && blocks.length === 0 ? (
          <EmptyState
            className="py-2"
            message={team ? "El equipo no tiene citas hoy." : "No tienes citas hoy."}
            action={
              <Button variant="secondary" onClick={() => openSheet({ kind: "create", prefill: { date: today } })}>
                <CalendarPlus strokeWidth={1.75} />
                Agendar cita
              </Button>
            }
          />
        ) : (
          <DayTimeline appointments={appointments} blocks={blocks} now={now} members={team ? members : undefined} />
        )}
      </Section>
    </>
  );
}

function DaySkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-8">
      <Skeleton className="h-56 w-full rounded-card" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-24" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

function ListsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-36 w-full rounded-card" />
    </div>
  );
}
