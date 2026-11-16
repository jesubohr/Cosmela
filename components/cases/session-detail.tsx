"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Printer } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { errorText } from "@/components/agenda/parts";
import { AlertChips } from "@/components/shared/alert-chips";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SESSION_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, sessionLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { reasonsText } from "./labels";
import { SessionRecord, type SessionDetailData } from "./session-record";

/** `/casos/[id]/sesiones/[sessionId]`: read-only session, consent, and "notas adicionales". */
export function SessionDetail({ caseId, sessionId }: { caseId: string; sessionId: Id<"sessions"> }) {
  const data = useQuery(api.sessions.detail, { sessionId });
  const title = data ? sessionLabel(data.session) : "Sesión";

  return (
    <>
      <PageHeader
        title={title}
        backHref={`/casos/${caseId}`}
        actions={
          data && data.session.status !== "draft" ? (
            <Button variant="secondary" asChild>
              <Link href={`/imprimir/sesion/${sessionId}`}>
                <Printer strokeWidth={1.75} />
                Imprimir
              </Link>
            </Button>
          ) : null
        }
      />
      <PageBody className="flex max-w-[860px] flex-col gap-8">
        {!data ? (
          <div aria-busy className="flex flex-col gap-3">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <Summary data={data} />
            {data.session.status === "draft" ? (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-surface p-4">
                <p>Esta atención sigue en curso.</p>
                <Button asChild>
                  <Link href={`/atencion/${data.session.appointmentId}`}>Continuar atención</Link>
                </Button>
              </div>
            ) : (
              <>
                <SessionRecord data={data} />
                <Addenda data={data} />
              </>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

function Summary({ data }: { data: SessionDetailData }) {
  const { session, client, treatment, member } = data;
  const motivo = reasonsText(data.case.reasons, data.case.reasonOther);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <Link href={`/clientes/${client._id}`} className="text-lg font-medium hover:underline">
          {client.name}
        </Link>
        <span className="text-ink-soft">{motivo ? `${treatment.name} para ${motivo.toLowerCase()}` : treatment.name}</span>
        <span className="text-ink-soft">
          {formatDate(session.closedAt ?? session.startedAt)}, con {member.name}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex min-h-7 items-center rounded-full px-2.5 text-sm font-medium",
            session.status === "closed" ? "bg-sage-soft text-sage" : session.status === "postponed" ? "bg-rose-soft text-rose" : "bg-lilac text-plum",
          )}
        >
          {SESSION_STATUS_LABELS[session.status]}
        </span>
        <AlertChips client={client} />
      </div>
    </div>
  );
}

function Addenda({ data }: { data: SessionDetailData }) {
  const add = useMutation(api.sessions.addAddendum);
  const id = useId();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await add({ sessionId: data.session._id, text });
      setText("");
      toast.success("Nota agregada");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.125rem] font-medium">Notas adicionales</h2>
        <p className="text-sm text-ink-soft">La atención cerrada no se edita. Las correcciones quedan como notas con fecha y autor.</p>
      </div>
      {data.session.addenda.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {data.session.addenda.map((addendum) => (
            <li key={addendum.at} className="flex flex-col gap-1 px-4 py-3">
              <p className="whitespace-pre-line">{addendum.text}</p>
              <span className="text-sm text-ink-soft">
                {addendum.author}, {formatDateTime(addendum.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-base">
          Nueva nota
        </Label>
        <Textarea id={id} rows={3} className="min-h-24" value={text} onChange={(e) => setText(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
        )}
        <Button className="self-start" onClick={() => void submit()} disabled={pending || !text.trim()}>
          {pending ? "Guardando…" : "Agregar nota"}
        </Button>
      </div>
    </section>
  );
}
