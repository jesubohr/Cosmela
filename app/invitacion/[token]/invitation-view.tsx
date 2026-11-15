"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/forms/error-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { ROLE_LABELS } from "@/lib/constants";

export function InvitationView({ token }: { token: string }) {
  const router = useRouter();
  const invitation = useQuery(api.invitations.get, { token });
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.auth.viewer, isAuthenticated ? {} : "skip");
  const accept = useMutation(api.invitations.accept);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (invitation === undefined || isLoading || (isAuthenticated && viewer === undefined)) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (invitation === null) {
    return <Message title="Esta invitación no existe" text="Revisa el enlace o pide uno nuevo a quien te invitó." />;
  }
  if (invitation.status === "expired") {
    return <Message title="Esta invitación venció" text="Pide una nueva a quien te invitó." />;
  }
  if (invitation.status === "cancelled") {
    return <Message title="Esta invitación fue cancelada" text="Si crees que es un error, escribe a quien te invitó." />;
  }

  const signedInEmail = viewer?.user.email?.toLowerCase();
  const isInvitee = signedInEmail === invitation.email;
  const loginHref = `/ingresar?email=${encodeURIComponent(invitation.email)}&next=${encodeURIComponent(`/invitacion/${token}`)}`;

  if (invitation.status === "accepted") {
    return isInvitee ? (
      <Message title={`Ya eres parte de ${invitation.orgName}`}>
        <Button asChild size="lg">
          <Link href="/hoy">Ir a Hoy</Link>
        </Button>
      </Message>
    ) : (
      <Message title="Esta invitación ya fue usada" text="Si necesitas entrar al equipo, pide una nueva invitación." />
    );
  }

  async function acceptInvitation() {
    setPending(true);
    setError(null);
    try {
      await accept({ token });
      toast.success("Invitación aceptada");
      router.replace("/hoy");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  async function switchAccount() {
    setPending(true);
    await authClient.signOut();
    router.replace(loginHref);
  }

  return (
    <Message
      title={`${invitation.orgName} te invitó a su equipo`}
      text={`Entrarás como ${ROLE_LABELS[invitation.role].toLowerCase()} con el correo ${invitation.email}.`}
    >
      {!isAuthenticated ? (
        <Button asChild size="lg">
          <Link href={loginHref}>Ingresar para aceptar</Link>
        </Button>
      ) : isInvitee ? (
        <Button size="lg" disabled={pending} onClick={() => void acceptInvitation()}>
          {pending ? "Aceptando…" : "Aceptar invitación"}
        </Button>
      ) : (
        <>
          <p className="text-ink-soft">
            Ingresaste como <span className="font-medium text-ink [overflow-wrap:anywhere]">{signedInEmail}</span>. Para
            aceptar, ingresa con el correo invitado.
          </p>
          <Button size="lg" variant="secondary" disabled={pending} onClick={() => void switchAccount()}>
            Cambiar de cuenta
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose">
          {error}
        </p>
      )}
    </Message>
  );
}

function Message({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[1.75rem] leading-tight lg:text-[2.25rem]">{title}</h1>
        {text && <p className="text-ink-soft [overflow-wrap:anywhere]">{text}</p>}
      </div>
      {children}
    </div>
  );
}
