"use client";

import { useMutation } from "convex/react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SingleChips } from "@/components/clients/chips";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { bogotaDateKey, bogotaToEpoch } from "@/convex/lib/time";
import { TIME_BLOCK_KINDS, type TimeBlockKind } from "@/convex/lib/validators";
import { TIME_BLOCK_KIND_LABELS } from "@/lib/constants";
import { addDays, timeOf, todayKey } from "./dates";
import { errorText, FieldBlock, FormError, MemberSelect, SheetActions, useFormOptions } from "./parts";

export type BlockData = {
  _id: Id<"timeBlocks">;
  memberId: Id<"members">;
  start: number;
  end: number;
  allDay: boolean;
  kind: TimeBlockKind;
  title?: string;
};

export type BlockPrefill = { memberId?: Id<"members">; date?: string; startTime?: string; endTime?: string };

/** "Bloquear horario": create (prefill) or edit and delete (block). */
export function BlockForm({ prefill, block, onDone }: { prefill?: BlockPrefill; block?: BlockData; onDone: () => void }) {
  const viewer = useViewer();
  const options = useFormOptions();
  const create = useMutation(api.timeBlocks.create);
  const update = useMutation(api.timeBlocks.update);
  const remove = useMutation(api.timeBlocks.remove);
  const ids = { member: useId(), date: useId(), allDay: useId(), start: useId(), end: useId(), title: useId() };

  const isAdmin = viewer.member.role === "admin";
  const [memberId, setMemberId] = useState<Id<"members">>(block?.memberId ?? prefill?.memberId ?? viewer.member._id);
  const [date, setDate] = useState(block ? bogotaDateKey(block.start) : (prefill?.date ?? todayKey()));
  const [allDay, setAllDay] = useState(block?.allDay ?? false);
  const [startTime, setStartTime] = useState(block && !block.allDay ? timeOf(block.start) : (prefill?.startTime ?? "12:00"));
  const [endTime, setEndTime] = useState(block && !block.allDay ? timeOf(block.end) : (prefill?.endTime ?? "13:00"));
  const [kind, setKind] = useState<TimeBlockKind | undefined>(block?.kind ?? "personal");
  const [title, setTitle] = useState(block?.title ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!options) return <Skeleton className="h-64 w-full" />;
  const canPickMember = isAdmin && options.members.length > 1;
  // Staff may only block their own time; an admin's prefill may point at another member.
  const effectiveMember = isAdmin ? memberId : viewer.member._id;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!allDay && endTime <= startTime) return setError("La hora final debe ser después de la inicial.");
    setError(null);
    setPending(true);
    const times = allDay
      ? { start: bogotaToEpoch(date), end: bogotaToEpoch(addDays(date, 1)) }
      : { start: bogotaToEpoch(date, startTime), end: bogotaToEpoch(date, endTime) };
    const args = { memberId: effectiveMember, ...times, allDay, kind: kind ?? "personal", title };
    try {
      if (block) await update({ blockId: block._id, ...args });
      else await create(args);
      toast.success("Bloqueo guardado");
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  async function destroy() {
    if (!block) return;
    setPending(true);
    try {
      await remove({ blockId: block._id });
      toast.success("Bloqueo eliminado");
      onDone();
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {canPickMember && (
        <FieldBlock label="Profesional" htmlFor={ids.member}>
          <MemberSelect id={ids.member} members={options.members} value={memberId} onChange={setMemberId} />
        </FieldBlock>
      )}
      <FieldBlock label="Fecha" htmlFor={ids.date}>
        <Input id={ids.date} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="max-w-48" />
      </FieldBlock>
      <div className="flex items-center gap-3">
        <Switch id={ids.allDay} checked={allDay} onCheckedChange={setAllDay} />
        <Label htmlFor={ids.allDay} className="text-base">
          Todo el día
        </Label>
      </div>
      {!allDay && (
        <div className="grid grid-cols-2 gap-4">
          <FieldBlock label="Desde" htmlFor={ids.start}>
            <Input id={ids.start} type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} className="tabular-nums" />
          </FieldBlock>
          <FieldBlock label="Hasta" htmlFor={ids.end}>
            <Input id={ids.end} type="time" step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} className="tabular-nums" />
          </FieldBlock>
        </div>
      )}
      <FieldBlock label="Tipo">
        <SingleChips
          label="Tipo de bloqueo"
          options={TIME_BLOCK_KINDS.map((k) => ({ value: k, label: TIME_BLOCK_KIND_LABELS[k] }))}
          value={kind}
          onChange={setKind}
          required
        />
      </FieldBlock>
      <FieldBlock label="Título" htmlFor={ids.title}>
        <Input id={ids.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Almuerzo, capacitación…" />
      </FieldBlock>
      <FormError>{error}</FormError>
      <SheetActions>
        {block && (
          <Button type="button" variant="ghost" className="text-rose hover:bg-rose-soft" onClick={() => void destroy()} disabled={pending}>
            Eliminar bloqueo
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar bloqueo"}
        </Button>
      </SheetActions>
    </form>
  );
}
