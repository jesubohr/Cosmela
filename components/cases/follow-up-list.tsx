"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { MessageCircle } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { errorText } from "@/components/forms/error-message";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { useViewer } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { FOLLOW_UP_STATUS_LABELS } from "@/lib/constants";
import { formatCalendarDate, todayKey } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export type FollowUpRow = FunctionReturnType<typeof api.followUps.listDue>[number];

/** Prefilled WhatsApp check-in for a follow-up. */
export function followUpMessage(row: FollowUpRow, orgName: string) {
  const firstName = row.client.name.split(" ")[0];
  const about = row.treatmentName ? ` después de tu ${row.treatmentName.toLowerCase()}` : "";
  return `Hola, ${firstName}. ¿Cómo sigues${about}? Si quieres, agendamos tu próxima sesión.\n${orgName}`;
}

/** Follow-ups with WhatsApp, Hecho, Reprogramar, and Descartar for the pending ones. */
export function FollowUpList({ rows }: { rows: FollowUpRow[] }) {
  const viewer = useViewer();
  const dismiss = useMutation(api.followUps.dismiss);
  const [done, setDone] = useState<FollowUpRow | null>(null);
  const [moving, setMoving] = useState<FollowUpRow | null>(null);

  return (
    <>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map((row) => (
          <li key={row._id} className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className={cn("font-medium", row.status === "pending" && row.overdue && "text-amber")}>
                {formatCalendarDate(row.dueDate)}
                {row.status === "pending" && row.overdue && ", vencido"}
                {row.status !== "pending" && <span className="font-normal text-ink-soft">, {FOLLOW_UP_STATUS_LABELS[row.status].toLowerCase()}</span>}
              </span>
              {row.note && <span className="text-ink-soft">{row.note}</span>}
              {row.outcome && <span className="text-ink-soft">Resultado: {row.outcome}</span>}
            </div>
            {row.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" asChild>
                  <a href={whatsappLink(row.client.phone, followUpMessage(row, viewer.org.name))} target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                    WhatsApp
                  </a>
                </Button>
                <Button variant="secondary" onClick={() => setDone(row)}>
                  Hecho
                </Button>
                <Button variant="ghost" onClick={() => setMoving(row)}>
                  Reprogramar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void dismiss({ followUpId: row._id })
                      .then(() => toast.success("Seguimiento descartado"))
                      .catch((error) => toast.error(errorText(error)))
                  }
                >
                  Descartar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {done && <DoneDialog row={done} onClose={() => setDone(null)} />}
      {moving && <RescheduleDialog row={moving} onClose={() => setMoving(null)} />}
    </>
  );
}

export function DoneDialog({ row, onClose }: { row: FollowUpRow; onClose: () => void }) {
  const markDone = useMutation(api.followUps.markDone);
  const id = useId();
  const [outcome, setOutcome] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      await markDone({ followUpId: row._id, outcome });
      toast.success("Seguimiento hecho");
      onClose();
    } catch (error) {
      toast.error(errorText(error));
      setPending(false);
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Marcar seguimiento como hecho"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Volver
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            Marcar como hecho
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-base">
          Resultado
        </Label>
        <Textarea id={id} rows={2} className="min-h-20" placeholder="Opcional: agendó para el martes, no respondió…" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      </div>
    </ResponsiveDialog>
  );
}

function RescheduleDialog({ row, onClose }: { row: FollowUpRow; onClose: () => void }) {
  const reschedule = useMutation(api.followUps.reschedule);
  const id = useId();
  const [dueDate, setDueDate] = useState(row.dueDate < todayKey() ? todayKey() : row.dueDate);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      await reschedule({ followUpId: row._id, dueDate });
      toast.success("Seguimiento reprogramado");
      onClose();
    } catch (error) {
      toast.error(errorText(error));
      setPending(false);
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Reprogramar seguimiento"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Volver
          </Button>
          <Button onClick={() => void submit()} disabled={pending || !dueDate}>
            Reprogramar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-base">
          Nueva fecha
        </Label>
        <Input id={id} type="date" min={todayKey()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-fit min-w-44" />
      </div>
    </ResponsiveDialog>
  );
}
