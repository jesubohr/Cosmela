"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorText } from "./step-parts";

/**
 * Confirms "Descartar atención" (`sessions.discard`). Before the consent the draft is
 * deleted and the appointment goes back to the agenda; after it, the signed consent
 * stays in the record and the appointment is cancelled as "Atención no realizada".
 */
export function DiscardAttentionDialog({
  sessionId,
  consentSigned,
  open,
  onOpenChange,
  onBeforeDiscard,
  onDiscarded,
}: {
  sessionId: Id<"sessions">;
  consentSigned: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs right before the mutation (e.g. to stop the flow from starting a new draft). */
  onBeforeDiscard?: () => void;
  onDiscarded?: () => void;
}) {
  const discard = useMutation(api.sessions.discard);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    onBeforeDiscard?.();
    try {
      await discard({ sessionId });
      toast.success(consentSigned ? "Atención marcada como no realizada" : "Atención descartada");
      onOpenChange(false);
      onDiscarded?.();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="¿Descartar esta atención?"
      description={
        consentSigned
          ? "El consentimiento ya está firmado, así que se guarda en el historial. La cita queda cancelada como «Atención no realizada»."
          : "Se borra lo que llevas de esta atención, incluidas las fotos, y la cita vuelve a la agenda."
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Volver
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={pending}>
            Descartar atención
          </Button>
        </>
      }
    >
      <span />
    </ResponsiveDialog>
  );
}
