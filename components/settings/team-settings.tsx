"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, Copy, EllipsisVertical, Send, UserPlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SingleChoice } from "@/components/forms/choice-chips";
import { errorMessage } from "@/components/forms/error-message";
import { EmptyState } from "@/components/shared/empty-state";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { ROLES, type Role } from "@/convex/lib/validators";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./settings-page";

type Member = FunctionReturnType<typeof api.members.list>[number];
type Invitation = FunctionReturnType<typeof api.invitations.list>[number];

const ROLE_HELP: Record<Role, string> = {
  admin: "Puede cambiar el negocio, el equipo, los tratamientos y ver reportes.",
  staff: "Atiende clientes, agenda citas y registra atenciones.",
};

/** "Invitar profesional" button for the page header. */
export function InviteButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus strokeWidth={1.75} />
        Invitar profesional
      </Button>
      <InviteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function TeamSettings() {
  const members = useQuery(api.members.list);
  const invitations = useQuery(api.invitations.list);
  const [editing, setEditing] = useState<Member | null>(null);

  if (!members || !invitations) {
    return (
      <div aria-busy className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsSection title="Profesionales">
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {members.map((member) => (
            <li key={member._id}>
              <button
                type="button"
                onClick={() => setEditing(member)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-porcelain/60"
              >
                <InitialsAvatar name={member.name} color={member.color} className={cn(!member.active && "opacity-50")} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("truncate font-medium", !member.active && "text-ink-soft")}>
                    {member.isMe ? `${member.name} (tú)` : member.name}
                  </span>
                  <span className="truncate text-sm text-ink-soft">{member.email}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end text-sm text-ink-soft">
                  <span>{ROLE_LABELS[member.role]}</span>
                  {!member.active && <span>Inactivo</span>}
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-soft" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection title="Invitaciones pendientes">
        {invitations.length === 0 ? (
          <EmptyState className="py-0" message="No hay invitaciones pendientes." />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {invitations.map((invitation) => (
              <InvitationRow key={invitation._id} invitation={invitation} />
            ))}
          </ul>
        )}
      </SettingsSection>

      {editing && (
        <MemberDialog
          // Fresh state for each member.
          key={editing._id}
          member={members.find((m) => m._id === editing._id) ?? editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useMutation(api.invitations.create);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await create({ email, role });
      toast.success("Invitación enviada");
      setEmail("");
      setRole("staff");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invitar profesional"
      description="Le enviamos un correo con un enlace para unirse a tu equipo."
      footer={
        <Button type="submit" form="invite-form" disabled={sending}>
          {sending ? "Enviando…" : "Enviar invitación"}
        </Button>
      }
    >
      <form id="invite-form" onSubmit={submit} noValidate className="flex flex-col gap-5 pb-1">
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email" className="text-base">
            Correo
          </Label>
          <Input
            id="invite-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <RolePicker id="invite-role" value={role} onChange={setRole} />
        {error && (
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
        )}
      </form>
    </ResponsiveDialog>
  );
}

function RolePicker({ id, value, onChange, disabled }: { id: string; value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="font-medium">
        Rol
      </span>
      <SingleChoice
        labelledBy={id}
        describedBy={`${id}-help`}
        required
        disabled={disabled}
        options={[...ROLES].reverse().map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        value={value}
        onChange={(role) => role && onChange(role)}
      />
      <p id={`${id}-help`} className="text-sm text-ink-soft">
        {ROLE_HELP[value]}
      </p>
    </div>
  );
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const resend = useMutation(api.invitations.resend);
  const cancel = useMutation(api.invitations.cancel);

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <li className="flex min-h-16 items-center gap-3 py-2 pl-4 pr-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{invitation.email}</span>
        <span className="text-sm text-ink-soft">
          {ROLE_LABELS[invitation.role]}
          {invitation.expired && <span className="ml-3 text-amber">Venció</span>}
        </span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Acciones para ${invitation.email}`}>
            <EllipsisVertical strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            className="min-h-11 text-base"
            onSelect={() => void run(() => resend({ id: invitation._id }), "Invitación reenviada")}
          >
            <Send className="size-5" strokeWidth={1.75} />
            Reenviar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11 text-base"
            onSelect={() =>
              void run(
                () => navigator.clipboard.writeText(`${window.location.origin}/invitacion/${invitation.token}`),
                "Enlace copiado",
              )
            }
          >
            <Copy className="size-5" strokeWidth={1.75} />
            Copiar enlace
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11 text-base text-rose focus:text-rose"
            onSelect={() => void run(() => cancel({ id: invitation._id }), "Invitación cancelada")}
          >
            <X className="size-5 text-rose" strokeWidth={1.75} />
            Cancelar invitación
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function MemberDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const update = useMutation(api.members.update);
  const [role, setRole] = useState<Role>(member.role);
  const [bookable, setBookable] = useState(member.bookable);
  const [busy, setBusy] = useState(false);
  // The owner and the signed-in admin keep their access.
  const locked = member.isOwner || member.isMe;

  async function run(args: Omit<Parameters<typeof update>[0], "id">, done: string) {
    setBusy(true);
    try {
      await update({ id: member._id, ...args });
      toast.success(done);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={member.name}
      description={member.email}
      footer={
        <Button disabled={busy} onClick={() => void run({ role, bookable }, "Profesional guardado")}>
          Guardar cambios
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pb-1">
        <RolePicker id="member-role" value={role} onChange={setRole} disabled={locked} />
        {locked && (
          <p className="-mt-3 text-sm text-ink-soft">
            {member.isOwner ? "Quien creó el negocio siempre es administrador." : "No puedes cambiar tu propio rol."}
          </p>
        )}
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="member-bookable" className="text-base font-normal">
            Acepta reservas en línea
          </Label>
          <Switch id="member-bookable" checked={bookable} onCheckedChange={setBookable} />
        </div>
        {!locked && (
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            {member.active ? (
              <>
                <p className="text-sm text-ink-soft">
                  Sin acceso, no podrá ingresar al negocio. Sus citas y atenciones se conservan.
                </p>
                <Button
                  variant="secondary"
                  className="self-start text-rose"
                  disabled={busy}
                  onClick={() => void run({ active: false }, "Acceso desactivado")}
                >
                  Desactivar acceso
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                className="self-start"
                disabled={busy}
                onClick={() => void run({ active: true }, "Acceso activado")}
              >
                Activar acceso
              </Button>
            )}
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
